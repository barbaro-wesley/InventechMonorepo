import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { SECURITY_SETTINGS_LIMITS } from '@inventech/shared-types'

const { passwordMinLength: PWD, maxLoginAttempts: ATTEMPTS } = SECURITY_SETTINGS_LIMITS

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional({ description: 'Força 2FA para todos os usuários da empresa' })
  @IsOptional() @IsBoolean()
  enforce2FAForAll?: boolean

  @ApiPropertyOptional({ description: 'Exige verificação de email ao criar usuário' })
  @IsOptional() @IsBoolean()
  requireEmailVerification?: boolean

  @ApiPropertyOptional({ description: 'Força troca de senha no primeiro login' })
  @IsOptional() @IsBoolean()
  forcePasswordChangeOnFirstLogin?: boolean

  @ApiPropertyOptional({ minimum: PWD.min, maximum: PWD.max, description: 'Tamanho mínimo de senha' })
  @IsOptional() @IsInt() @Min(PWD.min) @Max(PWD.max)
  passwordMinLength?: number

  @ApiPropertyOptional({ minimum: ATTEMPTS.min, maximum: ATTEMPTS.max, description: 'Tentativas de login antes de bloquear' })
  @IsOptional() @IsInt() @Min(ATTEMPTS.min) @Max(ATTEMPTS.max)
  maxLoginAttempts?: number

  @ApiPropertyOptional({ description: 'Define/atualiza a senha padrão de primeiro acesso (texto puro, write-only — nunca retornada pela API)' })
  @IsOptional() @IsString()
  defaultFirstAccessPassword?: string

  @ApiPropertyOptional({ description: 'Remove a senha padrão de primeiro acesso configurada' })
  @IsOptional() @IsBoolean()
  clearDefaultFirstAccessPassword?: boolean
}
