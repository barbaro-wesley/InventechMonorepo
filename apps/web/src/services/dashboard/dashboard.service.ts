import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlatformDashboard {
  tenantMetrics: {
    total: number;
    byStatus: { active: number; trial: number; suspended: number; inactive: number };
  };
  userMetrics: {
    total: number;
    active: number;
    unverified: number;
    blocked: number;
  };
  organizationMetrics: {
    total: number;
    active: number;
  };
  equipmentTotal: number;
  osMetrics: {
    total: number;
    open: number;
    inProgress: number;
    urgent: number;
    active: number;
  };
  licenseAlerts: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    trialEndsAt: string | null;
    _count: { users: number };
  }>;
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    _count: { users: number; organizations: number };
  }>;
  generatedAt: string;
}

export interface CompanyDashboard {
  osMetrics: {
    total: number;
    active: number;
    byStatus: {
      open: number;
      awaitingPickup: number;
      inProgress: number;
      completed: number;
      approved: number;
      rejected: number;
      cancelled: number;
    };
    urgent: number;
    avgResolutionHours: number | null;
  };
  osTimeline: Array<{ date: string; total: number; completed: number }>;
  topTechnicians: Array<{
    technician_id: string;
    name: string;
    total_os: number;
    completed_os: number;
    avg_hours: number | null;
  }>;
  equipmentMetrics: {
    total: number;
    byStatus: { active: number; underMaintenance: number; inactive: number; scrapped: number };
    critical: number;
    availabilityRate: number;
  };
  groupMetrics: Array<{
    group_id: string;
    group_name: string;
    color: string;
    total_os: number;
    open_os: number;
    in_progress_os: number;
  }>;
  alerts: {
    unassignedOs: number;
    overdueAlerts: number;
    equipmentUnderMaintenance: number;
    warrantyExpiring: number;
    total: number;
  };
  generatedAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const dashboardService = {
  async getPlatform(): Promise<PlatformDashboard> {
    const { data } = await api.get("/dashboard/platform");
    return data;
  },

  async getTenant(): Promise<CompanyDashboard> {
    const { data } = await api.get("/dashboard");
    return data;
  },
};
