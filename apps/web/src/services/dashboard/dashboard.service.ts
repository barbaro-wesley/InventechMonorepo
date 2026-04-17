import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlatformDashboard {
  companyMetrics: {
    total: number;
    byStatus: { active: number; trial: number; suspended: number; inactive: number };
  };
  userMetrics: {
    total: number;
    active: number;
    unverified: number;
    blocked: number;
  };
  clientMetrics: {
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
  recentCompanies: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    _count: { users: number; clients: number };
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
    byType: Array<{ id: string; name: string; count: number }>;
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

export interface ClientDashboard {
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
  equipmentMetrics: {
    total: number;
    byStatus: { active: number; underMaintenance: number; inactive: number; scrapped: number };
    critical: number;
    availabilityRate: number;
  };
  recentOs: Array<{
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string;
    maintenanceType: string;
    createdAt: string;
    equipment: { id: string; name: string } | null;
    group: { id: string; name: string; color: string | null } | null;
    technicians: Array<{ technician: { id: string; name: string } }>;
  }>;
  generatedAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const dashboardService = {
  async getPlatform(): Promise<PlatformDashboard> {
    const { data } = await api.get("/dashboard/platform");
    return data;
  },

  async getCompany(): Promise<CompanyDashboard> {
    const { data } = await api.get("/dashboard");
    return data;
  },

  async getClient(clientId: string): Promise<ClientDashboard> {
    const { data } = await api.get(`/dashboard/client/${clientId}`);
    return data;
  },
};
