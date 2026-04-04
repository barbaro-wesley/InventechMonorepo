export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  COMPANY_MANAGER: 'COMPANY_MANAGER',
  TECHNICIAN: 'TECHNICIAN',
  CLIENT_ADMIN: 'CLIENT_ADMIN',
  CLIENT_USER: 'CLIENT_USER',
  CLIENT_VIEWER: 'CLIENT_VIEWER',
  MEMBER: 'MEMBER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  BLOCKED: 'BLOCKED',
  UNVERIFIED: 'UNVERIFIED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
