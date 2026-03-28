export const EquipmentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
  SCRAPPED: 'SCRAPPED',
  BORROWED: 'BORROWED',
} as const;
export type EquipmentStatus = (typeof EquipmentStatus)[keyof typeof EquipmentStatus];

export const EquipmentCriticality = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type EquipmentCriticality = (typeof EquipmentCriticality)[keyof typeof EquipmentCriticality];

export const MovementType = {
  TRANSFER: 'TRANSFER',
  LOAN: 'LOAN',
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const MovementStatus = {
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
} as const;
export type MovementStatus = (typeof MovementStatus)[keyof typeof MovementStatus];

export const AttachmentEntity = {
  EQUIPMENT: 'EQUIPMENT',
  SERVICE_ORDER: 'SERVICE_ORDER',
  MAINTENANCE: 'MAINTENANCE',
  INVOICE: 'INVOICE',
  AVATAR: 'AVATAR',
  COMMENT: 'COMMENT',
} as const;
export type AttachmentEntity = (typeof AttachmentEntity)[keyof typeof AttachmentEntity];
