import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from './jwt.service';
import { AuthService } from './auth.service';

export interface AuthUser {
  id: string;
  openid: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    const payload = this.jwtService.verify(token);
    if (!payload) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    request.user = { id: payload.sub, openid: payload.openid };
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const currentUser = request.user;

    if (!currentUser) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    const isAdmin = await this.authService.checkAdminByUserId(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('需要管理员权限');
    }

    return true;
  }
}
