import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard/dashboard.service";

export const dashboardKeys = {
  platform: ["dashboard", "platform"] as const,
  company: ["dashboard", "company"] as const,
};

export function usePlatformDashboard() {
  return useQuery({
    queryKey: dashboardKeys.platform,
    queryFn: () => dashboardService.getPlatform(),
    staleTime: 60 * 1000, // 1 min
    refetchInterval: 5 * 60 * 1000, // revalida a cada 5 min
  });
}

export function useCompanyDashboard() {
  return useQuery({
    queryKey: dashboardKeys.company,
    queryFn: () => dashboardService.getCompany(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
