import { useQuery } from "@tanstack/react-query";
import {
  analyticsService,
  BaseOsParams,
  EquipmentCostsParams,
  EquipmentOverviewParams,
  EquipmentRangeParams,
  FinancialParams,
  FinancialTcoParams,
  FinancialTrendParams,
  OsBacklogParams,
  OsCostsParams,
  OsTimelineParams,
  PreventiveAdherenceParams,
  PreventiveBaseParams,
  PreventiveUpcomingParams,
  TechnicianRankingParams,
} from "@/services/analytics/analytics.service";

const STALE = 5 * 60 * 1000;

export const analyticsKeys = {
  all: ["analytics"] as const,
  equipment: {
    overview: (p: EquipmentOverviewParams) => ["analytics", "equipment", "overview", p] as const,
    topFailures: (p: EquipmentRangeParams) => ["analytics", "equipment", "top-failures", p] as const,
    costs: (p: EquipmentCostsParams) => ["analytics", "equipment", "costs", p] as const,
    withoutPreventive: (p: EquipmentOverviewParams) => ["analytics", "equipment", "without-preventive", p] as const,
    osTimeline: (p: EquipmentRangeParams) => ["analytics", "equipment", "os-timeline", p] as const,
  },
  os: {
    overview: (p: BaseOsParams) => ["analytics", "os", "overview", p] as const,
    timeline: (p: OsTimelineParams) => ["analytics", "os", "timeline", p] as const,
    costs: (p: OsCostsParams) => ["analytics", "os", "costs", p] as const,
    backlog: (p: OsBacklogParams) => ["analytics", "os", "backlog", p] as const,
    comparison: (p: BaseOsParams) => ["analytics", "os", "comparison", p] as const,
  },
  technicians: {
    ranking: (p: TechnicianRankingParams) => ["analytics", "technicians", "ranking", p] as const,
  },
  preventive: {
    adherence: (p: PreventiveAdherenceParams) => ["analytics", "preventive", "adherence", p] as const,
    upcoming: (p: PreventiveUpcomingParams) => ["analytics", "preventive", "upcoming", p] as const,
    overdue: (p: PreventiveBaseParams) => ["analytics", "preventive", "overdue", p] as const,
    byRecurrence: (p: PreventiveBaseParams) => ["analytics", "preventive", "by-recurrence", p] as const,
  },
  financial: {
    overview: (p: FinancialParams) => ["analytics", "financial", "overview", p] as const,
    trend: (p: FinancialTrendParams) => ["analytics", "financial", "trend", p] as const,
    tco: (p: FinancialTcoParams) => ["analytics", "financial", "tco", p] as const,
  },
};

// Equipment
export function useEquipmentOverview(p: EquipmentOverviewParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.equipment.overview(p),
    queryFn: () => analyticsService.getEquipmentOverview(p),
    staleTime: STALE,
  });
}

export function useEquipmentTopFailures(p: EquipmentRangeParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.equipment.topFailures(p),
    queryFn: () => analyticsService.getEquipmentTopFailures(p),
    staleTime: STALE,
  });
}

export function useEquipmentCosts(p: EquipmentCostsParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.equipment.costs(p),
    queryFn: () => analyticsService.getEquipmentCosts(p),
    staleTime: STALE,
  });
}

export function useEquipmentWithoutPreventive(p: EquipmentOverviewParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.equipment.withoutPreventive(p),
    queryFn: () => analyticsService.getEquipmentWithoutPreventive(p),
    staleTime: STALE,
  });
}

export function useEquipmentOsTimeline(p: EquipmentRangeParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.equipment.osTimeline(p),
    queryFn: () => analyticsService.getEquipmentOsTimeline(p),
    staleTime: STALE,
  });
}

// Service Orders
export function useOsOverview(p: BaseOsParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.os.overview(p),
    queryFn: () => analyticsService.getOsOverview(p),
    staleTime: STALE,
  });
}

export function useOsTimeline(p: OsTimelineParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.os.timeline(p),
    queryFn: () => analyticsService.getOsTimeline(p),
    staleTime: STALE,
  });
}

export function useOsCosts(p: OsCostsParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.os.costs(p),
    queryFn: () => analyticsService.getOsCosts(p),
    staleTime: STALE,
  });
}

export function useOsBacklog(p: OsBacklogParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.os.backlog(p),
    queryFn: () => analyticsService.getOsBacklog(p),
    staleTime: STALE,
  });
}

export function useOsComparison(p: BaseOsParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.os.comparison(p),
    queryFn: () => analyticsService.getOsComparison(p),
    staleTime: STALE,
  });
}

// Technicians
export function useTechnicianRanking(p: TechnicianRankingParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.technicians.ranking(p),
    queryFn: () => analyticsService.getTechnicianRanking(p),
    staleTime: STALE,
  });
}

// Preventive
export function usePreventiveAdherence(p: PreventiveAdherenceParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.preventive.adherence(p),
    queryFn: () => analyticsService.getPreventiveAdherence(p),
    staleTime: STALE,
  });
}

export function usePreventiveUpcoming(p: PreventiveUpcomingParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.preventive.upcoming(p),
    queryFn: () => analyticsService.getPreventiveUpcoming(p),
    staleTime: STALE,
  });
}

export function usePreventiveOverdue(p: PreventiveBaseParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.preventive.overdue(p),
    queryFn: () => analyticsService.getPreventiveOverdue(p),
    staleTime: STALE,
  });
}

export function usePreventiveByRecurrence(p: PreventiveBaseParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.preventive.byRecurrence(p),
    queryFn: () => analyticsService.getPreventiveByRecurrence(p),
    staleTime: STALE,
  });
}

// Financial
export function useFinancialOverview(p: FinancialParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.financial.overview(p),
    queryFn: () => analyticsService.getFinancialOverview(p),
    staleTime: STALE,
  });
}

export function useFinancialTrend(p: FinancialTrendParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.financial.trend(p),
    queryFn: () => analyticsService.getFinancialTrend(p),
    staleTime: STALE,
  });
}

export function useFinancialTco(p: FinancialTcoParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.financial.tco(p),
    queryFn: () => analyticsService.getFinancialTco(p),
    staleTime: STALE,
  });
}
