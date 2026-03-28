export const ClientStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type ClientStatus = (typeof ClientStatus)[keyof typeof ClientStatus];
