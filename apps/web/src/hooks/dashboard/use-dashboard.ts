import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard/dashboard.service";

export const dashboardKeys = {
  platform: ["dashboard", "platform"] as const,
  tenant: ["dashboard", "tenant"] as const,
};

export function usePlatformDashboard() {
  return useQuery({
    queryKey: dashboardKeys.platform,
    queryFn: () => dashboardService.getPlatform(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useTenantDashboard() {
  return useQuery({
    queryKey: dashboardKeys.tenant,
    queryFn: () => dashboardService.getTenant(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
