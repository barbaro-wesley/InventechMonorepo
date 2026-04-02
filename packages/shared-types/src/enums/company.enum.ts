export const TenantStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  TRIAL: 'TRIAL',
  EXPIRED: 'EXPIRED',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];
