import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthGuard } from './guards/admin.guard';
import { env } from '../../config/env.config';

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminAuthGuard],
  exports: [AuthService, AdminAuthGuard, JwtModule],
})
export class AuthModule {}
