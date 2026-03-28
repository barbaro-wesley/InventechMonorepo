export const ServiceOrderStatus = {
  OPEN: 'OPEN',
  AWAITING_PICKUP: 'AWAITING_PICKUP',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  COMPLETED_APPROVED: 'COMPLETED_APPROVED',
  COMPLETED_REJECTED: 'COMPLETED_REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type ServiceOrderStatus = (typeof ServiceOrderStatus)[keyof typeof ServiceOrderStatus];

export const ServiceOrderPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type ServiceOrderPriority = (typeof ServiceOrderPriority)[keyof typeof ServiceOrderPriority];

export const ServiceOrderTechnicianRole = {
  LEAD: 'LEAD',
  ASSISTANT: 'ASSISTANT',
} as const;
export type ServiceOrderTechnicianRole = (typeof ServiceOrderTechnicianRole)[keyof typeof ServiceOrderTechnicianRole];

export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
