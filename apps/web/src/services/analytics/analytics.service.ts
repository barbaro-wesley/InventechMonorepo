import { api } from "@/lib/api";

// ─── Shared filter params ────────────────────────────────────────────────────

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface BaseOsParams extends DateRangeParams {
  clientId?: string;
  groupId?: string;
  maintenanceType?: string;
  priority?: string;
}

// ─── Equipment types ─────────────────────────────────────────────────────────

export interface EquipmentOverviewParams {
  typeId?: string;
  locationId?: string;
  costCenterId?: string;
}

export interface EquipmentRangeParams extends EquipmentOverviewParams, DateRangeParams {
  limit?: number;
}

export interface EquipmentCostsParams extends EquipmentRangeParams {
  groupBy?: "equipment" | "type" | "location" | "costCenter";
}

export interface EquipmentOverview {
  total: number;
  byStatus: { active: number; underMaintenance: number; inactive: number; scrapped: number; borrowed: number };
  byCriticality: { low: number; medium: number; high: number; critical: number };
  availabilityRate: number;
  financials: { totalPurchaseValue: number; totalCurrentValue: number; depreciationPercent: number };
  warranty: { expired: number; expiringSoon30: number; expiringSoon90: number };
  withoutActiveSchedule: number;
  generatedAt: string;
}

export interface EquipmentTopFailureItem {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  criticality: string;
  type_name: string | null;
  location_name: string | null;
  total_os: number;
  completed_os: number;
  mttr_hours: number | null;
  total_cost: number;
}

export interface EquipmentTopFailuresResult {
  period: { start: string; end: string };
  globalMttrHours: number | null;
  items: EquipmentTopFailureItem[];
  generatedAt: string;
}

export interface EquipmentWithoutPreventiveItem {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  criticality: string;
  type: { id: string; name: string } | null;
  currentLocation: { id: string; name: string } | null;
}

export interface EquipmentWithoutPreventiveResult {
  count: number;
  items: EquipmentWithoutPreventiveItem[];
  generatedAt: string;
}

export interface EquipmentOsTimelineItem {
  month: string;
  total_os: number;
  corrective: number;
  preventive: number;
  completed_os: number;
}

export interface EquipmentOsTimelineResult {
  period: { start: string; end: string };
  series: EquipmentOsTimelineItem[];
  generatedAt: string;
}

// ─── OS types ────────────────────────────────────────────────────────────────

export interface OsOverview {
  period: { start: string; end: string };
  total: number;
  byStatus: {
    open: number;
    awaitingPickup: number;
    inProgress: number;
    completed: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
  byPriority: { low: number; medium: number; high: number; urgent: number };
  byMaintenanceType: {
    corrective: number;
    preventive: number;
    initialAcceptance: number;
    externalService: number;
    technovigilance: number;
    training: number;
    improperUse: number;
    deactivation: number;
  };
  sla: {
    avgResponseHours: number | null;
    avgResolutionHours: number | null;
    avgTotalHours: number | null;
  };
  rates: {
    approvalRate: number | null;
    urgentActive: number;
    childOsCount: number;
    childOsRate: number;
  };
  totalCost: number;
  generatedAt: string;
}

export interface OsTimelineParams extends BaseOsParams {
  groupBy?: "day" | "week" | "month";
}

export interface OsTimelineItem {
  period: string;
  total: number;
  completed: number;
  cancelled: number;
  corrective: number;
  preventive: number;
  total_cost: number;
}

export interface OsTimelineResult {
  period: { start: string; end: string };
  granularity: string;
  series: OsTimelineItem[];
  generatedAt: string;
}

export interface OsCostsParams extends BaseOsParams {
  groupBy?: "client" | "group" | "maintenanceType" | "technician";
  limit?: number;
}

export interface OsCostByItemType {
  total: number;
  itemCount: number;
  osCount: number;
}

export interface OsCostBreakdownItem {
  id: string | null;
  name: string;
  totalCost: number;
  osCount: number;
  avgCost: number;
}

export interface OsCostsResult {
  period: { start: string; end: string };
  totalCost: number;
  byItemType: Record<string, OsCostByItemType>;
  groupBy: string;
  breakdown: OsCostBreakdownItem[];
  generatedAt: string;
}

export interface TechnicianRankingParams extends BaseOsParams {
  technicianId?: string;
  limit?: number;
}

export interface TechnicianRankingItem {
  technician_id: string;
  name: string;
  avatar_url: string | null;
  total_os: number;
  completed_os: number;
  rejected_os: number;
  avg_response_hours: number | null;
  avg_resolution_hours: number | null;
  labor_cost: number;
  completionRate: number;
}

export interface TechnicianRankingResult {
  period: { start: string; end: string };
  technicians: TechnicianRankingItem[];
  generatedAt: string;
}

export interface OsBacklogParams {
  clientId?: string;
  groupId?: string;
}

export interface OsBacklogBucket {
  bucket: string;
  count: number;
  avg_days_open: number;
  urgent_count: number;
}

export interface OsBacklogOldest {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  days_open: number;
  equipment: string | null;
  group_name: string | null;
  client_name: string | null;
}

export interface OsBacklog {
  totalOpen: number;
  criticalCount: number;
  buckets: OsBacklogBucket[];
  oldest: OsBacklogOldest[];
  generatedAt: string;
}

export interface OsComparisonDelta {
  absolute: number;
  percent: number | null;
}

export interface OsComparisonPeriod {
  period: { start: string; end: string };
  total: number;
  completed: number;
  cancelled: number;
  rejected: number;
  avgResolutionHours: number | null;
  avgResponseHours: number | null;
  totalCost: number;
  firstTimeFixRate: number | null;
}

export interface OsComparison {
  current: OsComparisonPeriod;
  previous: OsComparisonPeriod;
  delta: {
    total: OsComparisonDelta | null;
    completed: OsComparisonDelta | null;
    avgResolutionHours: OsComparisonDelta | null;
    avgResponseHours: OsComparisonDelta | null;
    totalCost: OsComparisonDelta | null;
    firstTimeFixRate: OsComparisonDelta | null;
  };
  generatedAt: string;
}

// ─── Preventive types ─────────────────────────────────────────────────────────

export interface PreventiveBaseParams {
  clientId?: string;
  groupId?: string;
  equipmentId?: string;
}

export interface PreventiveAdherenceParams extends PreventiveBaseParams, DateRangeParams {}

export interface PreventiveAdherenceByRecurrence {
  recurrenceType: string;
  total: number;
  executed: number;
  onTime: number;
  overdueNow: number;
  adherenceRate: number | null;
  executionRate: number | null;
}

export interface PreventiveAdherence {
  period: { start: string; end: string };
  summary: {
    total: number;
    executed: number;
    onTime: number;
    late: number;
    notExecuted: number;
    overdueNow: number;
  };
  rates: {
    adherenceRate: number | null;
    executionRate: number | null;
  };
  byRecurrence: PreventiveAdherenceByRecurrence[];
  generatedAt: string;
}

export interface PreventiveUpcomingParams extends PreventiveBaseParams {
  daysAhead?: number;
  limit?: number;
}

export interface PreventiveUpcomingItem {
  id: string;
  title: string;
  maintenance_type: string;
  recurrence_type: string;
  next_run_at: string;
  days_until: number;
  equipment_id: string;
  equipment_name: string;
  equipment_serial: string | null;
  type_name: string | null;
  location_name: string | null;
  client_name: string | null;
  group_name: string | null;
  technician_name: string | null;
}

export interface PreventiveUpcomingResult {
  daysAhead: number;
  count: number;
  items: PreventiveUpcomingItem[];
  generatedAt: string;
}

export interface PreventiveOverdueItem {
  id: string;
  title: string;
  maintenance_type: string;
  recurrence_type: string;
  next_run_at: string;
  days_overdue: number;
  equipment_id: string;
  equipment_name: string;
  equipment_serial: string | null;
  criticality: string;
  type_name: string | null;
  location_name: string | null;
  technician_name: string | null;
}

export interface PreventiveOverdueResult {
  count: number;
  byCriticality: Record<string, number>;
  items: PreventiveOverdueItem[];
  generatedAt: string;
}

export interface PreventiveByRecurrenceItem {
  recurrence_type: string;
  total: number;
  overdue: number;
  due_this_week: number;
  due_this_month: number;
}

export interface PreventiveByRecurrenceResult {
  total: number;
  byRecurrence: PreventiveByRecurrenceItem[];
  generatedAt: string;
}

// ─── Financial types ─────────────────────────────────────────────────────────

export interface FinancialParams extends DateRangeParams {
  clientId?: string;
  groupId?: string;
}

export interface FinancialDelta {
  absolute: number;
  percent: number | null;
}

export interface FinancialPeriodData {
  totalCost: number;
  byItemType: { labor: number; material: number; external: number; travel: number; other: number };
  osCount: number;
  osWithCost: number;
  avgCostPerOs: number;
}

export interface FinancialOverview {
  period: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  current: FinancialPeriodData;
  previous: FinancialPeriodData;
  delta: {
    totalCost: FinancialDelta | null;
    osCount: FinancialDelta | null;
    labor: FinancialDelta | null;
    material: FinancialDelta | null;
    external: FinancialDelta | null;
  };
  generatedAt: string;
}

export interface FinancialTrendParams extends FinancialParams {
  groupBy?: "month" | "quarter";
}

export interface FinancialTrendItem {
  period: string;
  total: number;
  labor: number;
  material: number;
  external: number;
  travel: number;
  other: number;
  os_count: number;
}

export interface FinancialTrendResult {
  period: { start: string; end: string };
  granularity: string;
  series: FinancialTrendItem[];
  generatedAt: string;
}

export interface FinancialTcoParams {
  typeId?: string;
  locationId?: string;
  costCenterId?: string;
  limit?: number;
}

export interface FinancialTcoItem {
  id: string;
  name: string;
  serial_number: string | null;
  type_name: string | null;
  purchase_value: number;
  maintenance_cost: number;
  tco: number;
  cost_ratio: number | null;
}

export interface FinancialTcoResult {
  summary: { totalMaintenanceCost: number; totalPurchaseValue: number; totalTco: number };
  items: FinancialTcoItem[];
  generatedAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toQuery(params: any): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const analyticsService = {
  // Equipment
  async getEquipmentOverview(p: EquipmentOverviewParams = {}): Promise<EquipmentOverview> {
    const { data } = await api.get(`/analytics/equipment/overview${toQuery(p)}`);
    return data;
  },

  async getEquipmentTopFailures(p: EquipmentRangeParams = {}): Promise<EquipmentTopFailuresResult> {
    const { data } = await api.get(`/analytics/equipment/top-failures${toQuery(p)}`);
    return data;
  },

  async getEquipmentCosts(p: EquipmentCostsParams = {}): Promise<unknown> {
    const { data } = await api.get(`/analytics/equipment/costs${toQuery(p)}`);
    return data;
  },

  async getEquipmentWithoutPreventive(p: EquipmentOverviewParams = {}): Promise<EquipmentWithoutPreventiveResult> {
    const { data } = await api.get(`/analytics/equipment/without-preventive${toQuery(p)}`);
    return data;
  },

  async getEquipmentOsTimeline(p: EquipmentRangeParams = {}): Promise<EquipmentOsTimelineResult> {
    const { data } = await api.get(`/analytics/equipment/os-timeline${toQuery(p)}`);
    return data;
  },

  // Service Orders
  async getOsOverview(p: BaseOsParams = {}): Promise<OsOverview> {
    const { data } = await api.get(`/analytics/service-orders/overview${toQuery(p)}`);
    return data;
  },

  async getOsTimeline(p: OsTimelineParams = {}): Promise<OsTimelineResult> {
    const { data } = await api.get(`/analytics/service-orders/timeline${toQuery(p)}`);
    return data;
  },

  async getOsCosts(p: OsCostsParams = {}): Promise<OsCostsResult> {
    const { data } = await api.get(`/analytics/service-orders/costs${toQuery(p)}`);
    return data;
  },

  async getOsBacklog(p: OsBacklogParams = {}): Promise<OsBacklog> {
    const { data } = await api.get(`/analytics/service-orders/backlog${toQuery(p)}`);
    return data;
  },

  async getOsComparison(p: BaseOsParams = {}): Promise<OsComparison> {
    const { data } = await api.get(`/analytics/service-orders/comparison${toQuery(p)}`);
    return data;
  },

  // Technicians
  async getTechnicianRanking(p: TechnicianRankingParams = {}): Promise<TechnicianRankingResult> {
    const { data } = await api.get(`/analytics/technicians/ranking${toQuery(p)}`);
    return data;
  },

  // Preventive
  async getPreventiveAdherence(p: PreventiveAdherenceParams = {}): Promise<PreventiveAdherence> {
    const { data } = await api.get(`/analytics/preventive/adherence${toQuery(p)}`);
    return data;
  },

  async getPreventiveUpcoming(p: PreventiveUpcomingParams = {}): Promise<PreventiveUpcomingResult> {
    const { data } = await api.get(`/analytics/preventive/upcoming${toQuery(p)}`);
    return data;
  },

  async getPreventiveOverdue(p: PreventiveBaseParams = {}): Promise<PreventiveOverdueResult> {
    const { data } = await api.get(`/analytics/preventive/overdue${toQuery(p)}`);
    return data;
  },

  async getPreventiveByRecurrence(p: PreventiveBaseParams = {}): Promise<PreventiveByRecurrenceResult> {
    const { data } = await api.get(`/analytics/preventive/by-recurrence${toQuery(p)}`);
    return data;
  },

  // Financial
  async getFinancialOverview(p: FinancialParams = {}): Promise<FinancialOverview> {
    const { data } = await api.get(`/analytics/financial/overview${toQuery(p)}`);
    return data;
  },

  async getFinancialTrend(p: FinancialTrendParams = {}): Promise<FinancialTrendResult> {
    const { data } = await api.get(`/analytics/financial/trend${toQuery(p)}`);
    return data;
  },

  async getFinancialTco(p: FinancialTcoParams = {}): Promise<FinancialTcoResult> {
    const { data } = await api.get(`/analytics/financial/tco${toQuery(p)}`);
    return data;
  },
};
