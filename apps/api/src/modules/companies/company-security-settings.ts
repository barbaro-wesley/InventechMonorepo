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

  return clampSecuritySettings({ ...DEFAULT_SECURITY_SETTINGS, ...(raw ?? {}) })
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
  }
}
