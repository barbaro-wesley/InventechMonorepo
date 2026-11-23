import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  auditService,
  type ListAttemptsParams,
  type ListBlocksParams,
  type ListAuditLogsParams,
} from "@/services/audit/audit.service";

export const auditKeys = {
  stats: ["audit", "stats"] as const,
  attempts: (params: ListAttemptsParams) =>
    ["audit", "attempts", params] as const,
  blocks: (params: ListBlocksParams) => ["audit", "blocks", params] as const,
  changes: (params: ListAuditLogsParams) =>
    ["audit", "changes", params] as const,
  entities: ["audit", "entities"] as const,
};

export function useAuditStats() {
  return useQuery({
    queryKey: auditKeys.stats,
    queryFn: () => auditService.getStats(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useLoginAttempts(params: ListAttemptsParams = {}) {
  return useQuery({
    queryKey: auditKeys.attempts(params),
    queryFn: () => auditService.getAttempts(params),
    staleTime: 30 * 1000,
  });
}

export function useAccountBlocks(params: ListBlocksParams = {}) {
  return useQuery({
    queryKey: auditKeys.blocks(params),
    queryFn: () => auditService.getBlocks(params),
    staleTime: 30 * 1000,
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => auditService.unblockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useAuditChangeLogs(params: ListAuditLogsParams = {}) {
  return useQuery({
    queryKey: auditKeys.changes(params),
    queryFn: () => auditService.getChangeLogs(params),
    staleTime: 30 * 1000,
  });
}

export function useAuditedEntities() {
  return useQuery({
    queryKey: auditKeys.entities,
    queryFn: () => auditService.getAuditedEntities(),
    staleTime: 5 * 60 * 1000,
  });
}
