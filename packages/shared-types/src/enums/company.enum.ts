export const CompanyStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  TRIAL: 'TRIAL',
  EXPIRED: 'EXPIRED',
} as const;
export type CompanyStatus = (typeof CompanyStatus)[keyof typeof CompanyStatus];
