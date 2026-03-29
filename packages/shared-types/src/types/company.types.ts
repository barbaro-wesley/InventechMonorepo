import type { CompanyStatus } from '../enums/company.enum';

export interface Company {
  id: string;
  platformId: string;
  name: string;
  slug: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  status: CompanyStatus;
  trialEndsAt?: string | null;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    clients: number;
    users: number;
  };
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
