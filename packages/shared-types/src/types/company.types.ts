import type { TenantStatus } from '../enums/company.enum';

export interface Tenant {
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
  status: TenantStatus;
  trialEndsAt?: string | null;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    organizations: number;
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
  status: TenantStatus;
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
  organizations?: number;
}

export interface TenantWithLicense extends Tenant {
  license?: License | null;
}

export interface CreateTenantDto {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  admin: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  };
}

export interface CreateTenantResponse {
  tenant: Tenant;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface UpdateTenantDto {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
}

export interface TenantLicenseRow {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  licenseExpiresAt: string | null;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  daysUntilExpiry: number | null;
  isLicenseExpired: boolean;
  isTrialExpired: boolean;
  expiryWarning: boolean;
  _count: { users: number; organizations: number };
}

export interface ListTenantsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantStatus;
}
