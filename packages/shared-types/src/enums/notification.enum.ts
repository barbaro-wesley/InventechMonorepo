export const NotificationChannel = {
  EMAIL: 'EMAIL',
  TELEGRAM: 'TELEGRAM',
  WEBSOCKET: 'WEBSOCKET',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];
