export const ReportType = {
  SERVICE_ORDERS: 'SERVICE_ORDERS',
  EQUIPMENT: 'EQUIPMENT',
  PREVENTIVE: 'PREVENTIVE',
  TECHNICIANS: 'TECHNICIANS',
  FINANCIAL: 'FINANCIAL',
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];
