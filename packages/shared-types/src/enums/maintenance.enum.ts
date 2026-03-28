export const MaintenanceType = {
  PREVENTIVE: 'PREVENTIVE',
  CORRECTIVE: 'CORRECTIVE',
  INITIAL_ACCEPTANCE: 'INITIAL_ACCEPTANCE',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  TECHNOVIGILANCE: 'TECHNOVIGILANCE',
  TRAINING: 'TRAINING',
  IMPROPER_USE: 'IMPROPER_USE',
  DEACTIVATION: 'DEACTIVATION',
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];

export const RecurrenceType = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMIANNUAL: 'SEMIANNUAL',
  ANNUAL: 'ANNUAL',
  CUSTOM: 'CUSTOM',
} as const;
export type RecurrenceType = (typeof RecurrenceType)[keyof typeof RecurrenceType];
