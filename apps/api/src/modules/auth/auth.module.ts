import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy'
import { LoginSecurityService } from './security/login-security.service'
import { TwoFactorService } from './security/two-factor.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    NotificationsModule,  // Fornece NotificationsService com queue para envio async
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    LoginSecurityService,
    TwoFactorService,
  ],
  controllers: [AuthController],
  exports: [AuthService, LoginSecurityService, TwoFactorService],
})
export class AuthModule { }