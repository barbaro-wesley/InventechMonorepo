import {
  CompanySecuritySettings,
  DEFAULT_SECURITY_SETTINGS,
  SECURITY_SETTINGS_LIMITS,
} from '@inventech/shared-types'
import type { Prisma } from '@prisma/client'

const { passwordMinLength: PWD, maxLoginAttempts: ATTEMPTS } = SECURITY_SETTINGS_LIMITS

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Lê os parâmetros de segurança a partir de `Company.settings`, mesclando com os
 * defaults e aplicando os limites de guard-rail. Tolerante a settings nulo/parcial.
 */
export function getSecuritySettings(
  settings: Prisma.JsonValue | null | undefined,
): CompanySecuritySettings {
  const raw =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? ((settings as Record<string, unknown>).security as
          | Partial<CompanySecuritySettings>
          | undefined)
      : undefined

  return clampSecuritySettings({
    ...DEFAULT_SECURITY_SETTINGS,
    ...(raw ?? {}),
    hasDefaultFirstAccessPassword: !!getDefaultFirstAccessPasswordHash(settings),
  })
}

/**
 * Normaliza e aplica os limites mínimos/máximos a um conjunto (parcial) de
 * parâmetros, retornando um objeto completo válido.
 */
export function clampSecuritySettings(
  input: Partial<CompanySecuritySettings>,
): CompanySecuritySettings {
  return {
    requireEmailVerification:
      input.requireEmailVerification ?? DEFAULT_SECURITY_SETTINGS.requireEmailVerification,
    forcePasswordChangeOnFirstLogin:
      input.forcePasswordChangeOnFirstLogin ??
      DEFAULT_SECURITY_SETTINGS.forcePasswordChangeOnFirstLogin,
    passwordMinLength: clampInt(
      input.passwordMinLength ?? DEFAULT_SECURITY_SETTINGS.passwordMinLength,
      PWD.min,
      PWD.max,
      DEFAULT_SECURITY_SETTINGS.passwordMinLength,
    ),
    maxLoginAttempts: clampInt(
      input.maxLoginAttempts ?? DEFAULT_SECURITY_SETTINGS.maxLoginAttempts,
      ATTEMPTS.min,
      ATTEMPTS.max,
      DEFAULT_SECURITY_SETTINGS.maxLoginAttempts,
    ),
    hasDefaultFirstAccessPassword:
      input.hasDefaultFirstAccessPassword ?? DEFAULT_SECURITY_SETTINGS.hasDefaultFirstAccessPassword,
  }
}

/**
 * Lê o hash bcrypt da senha padrão de primeiro acesso diretamente do JSON bruto.
 * Uso interno apenas (UsersService) — nunca deve ser exposto via API.
 */
export function getDefaultFirstAccessPasswordHash(
  settings: Prisma.JsonValue | null | undefined,
): string | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null
  const security = (settings as Record<string, unknown>).security
  if (!security || typeof security !== 'object' || Array.isArray(security)) return null
  const hash = (security as Record<string, unknown>).defaultFirstAccessPasswordHash
  return typeof hash === 'string' ? hash : null
}

/**
 * Remove o hash da senha padrão de primeiro acesso de um `Company.settings` bruto
 * antes de devolvê-lo ao cliente. Defesa em profundidade — o frontend deve usar
 * `securitySettings.hasDefaultFirstAccessPassword`, nunca `settings.security` diretamente.
 */
export function redactCompanySettings(
  settings: Prisma.JsonValue | null | undefined,
): Prisma.JsonValue | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return (settings as Prisma.JsonValue | null) ?? null
  }
  const clone = { ...(settings as Record<string, unknown>) }
  const security = clone.security
  if (security && typeof security === 'object' && !Array.isArray(security)) {
    const { defaultFirstAccessPasswordHash, ...restSecurity } = security as Record<string, unknown>
    clone.security = restSecurity
  }
  return clone as Prisma.JsonValue
}
