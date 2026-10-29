import { Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export interface TokenPayload {
  sub: string;
  openid: string;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class JwtService {
  private resolveSecret(): string {
    const explicit = process.env.JWT_SECRET;
    if (explicit) {
      return explicit;
    }

    // 未显式配置 JWT_SECRET 时，基于微信密钥派生一个稳定的签名密钥
    const fallback = process.env.WECHAT_SECRET;
    if (fallback) {
      return createHash('sha256').update(`jwt:${fallback}`).digest('hex');
    }

    throw new Error('JWT_SECRET 未配置，无法签发登录凭证');
  }

  private encode(data: string): string {
    return Buffer.from(data, 'utf8').toString('base64url');
  }

  private signRaw(input: string): string {
    return createHmac('sha256', this.resolveSecret()).update(input).digest('base64url');
  }

  sign(sub: string, openid: string, isAdmin: boolean): string {
    const iat = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      sub,
      openid,
      isAdmin,
      iat,
      exp: iat + TOKEN_TTL_SECONDS,
    };
    const header = this.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = this.encode(JSON.stringify(payload));
    const input = `${header}.${body}`;
    return `${input}.${this.signRaw(input)}`;
  }

  verify(token: string): TokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [header, body, signature] = parts;
    const expected = this.signRaw(`${header}.${body}`);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      return null;
    }

    let payload: TokenPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (!payload?.sub || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  }
}
