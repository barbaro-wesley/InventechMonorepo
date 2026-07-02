import type { CompanyStatus } from '../enums/company.enum';

/**
 * Parâmetros de segurança configuráveis por empresa.
 * Persistidos em `Company.settings.security` (JSON), exceto `enforce2FAForAll`
 * que tem coluna dedicada em `Company.enforce2FAForAll`.
 */
export interface CompanySecuritySettings {
  /** Exige verificação de email ao criar usuário (status nasce UNVERIFIED). */
  requireEmailVerification: boolean;
  /** Força troca de senha no primeiro login. */
  forcePasswordChangeOnFirstLogin: boolean;
  /** Tamanho mínimo de senha (piso 6, teto 32). */
  passwordMinLength: number;
  /** Tentativas de login falhas antes de bloquear a conta (entre 3 e 10). */
  maxLoginAttempts: number;
  /** Indica se a empresa tem uma senha padrão de primeiro acesso configurada. Nunca expõe a senha/hash em si. */
  hasDefaultFirstAccessPassword: boolean;
}

export const SECURITY_SETTINGS_LIMITS = {
  passwordMinLength: { min: 6, max: 32 },
  maxLoginAttempts: { min: 3, max: 10 },
} as const;

export const DEFAULT_SECURITY_SETTINGS: CompanySecuritySettings = {
  requireEmailVerification: true,
  forcePasswordChangeOnFirstLogin: true,
  passwordMinLength: 6,
  maxLoginAttempts: 5,
  hasDefaultFirstAccessPassword: false,
};

/** Payload do PATCH /companies/:id/security-settings. */
export interface UpdateSecuritySettingsDto extends Partial<CompanySecuritySettings> {
  enforce2FAForAll?: boolean;
  /** Texto puro, write-only — define/atualiza a senha padrão de primeiro acesso. Nunca retornada pela API. */
  defaultFirstAccessPassword?: string;
  /** Remove a senha padrão de primeiro acesso configurada. */
  clearDefaultFirstAccessPassword?: boolean;
}

export interface Company {
  id: string;
  platformId: string;
  name: string;
  slug: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  reportPrimaryColor?: string | null;
  reportSecondaryColor?: string | null;
  reportHeaderTitle?: string | null;
  reportFooterText?: string | null;
  // Endereço
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  enforce2FAForAll?: boolean;
  status: CompanyStatus;
  trialEndsAt?: string | null;
  settings?: Record<string, unknown> | null;
  /** Derivado de `settings.security` mesclado com os defaults. */
  securitySettings?: CompanySecuritySettings | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    clients: number;
    users: number;
  };
}

export interface UpdateReportSettingsDto {
  reportPrimaryColor?: string;
  reportSecondaryColor?: string;
  reportHeaderTitle?: string;
  reportFooterText?: string;
}

export interface License {
  status: CompanyStatus;
  isActive: boolean;
  isSuspended: boolean;
  isTrial: boolean;
  isLicenseExpired: boolean;
  isTrialExpired: boolean;
  licenseExpiresAt?: string | null;
  daysUntilExpiry?: number | null;
  trialEndsAt?: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  notes?: string | null;
  expiryWarning?: boolean;
  users?: number;
  clients?: number;
}

export interface CompanyWithLicense extends Company {
  license?: License | null;
}

export interface CreateCompanyDto {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  licenseExpiresAt?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  admin: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  };
}

export interface CreateCompanyResponse {
  company: Company;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface UpdateCompanyDto {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  reportPrimaryColor?: string;
  reportSecondaryColor?: string;
  reportHeaderTitle?: string;
  reportFooterText?: string;
  enforce2FAForAll?: boolean;
}

export interface CompanyLicenseRow {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  licenseExpiresAt: string | null;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  daysUntilExpiry: number | null;
  isLicenseExpired: boolean;
  isTrialExpired: boolean;
  expiryWarning: boolean;
  _count: { users: number; clients: number };
}

export interface ListCompaniesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CompanyStatus;
}
