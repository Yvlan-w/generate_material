import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { AdminGuard, AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtService, AuthGuard, AdminGuard],
  exports: [AuthService, JwtService, AuthGuard],
})
export class AuthModule {}
