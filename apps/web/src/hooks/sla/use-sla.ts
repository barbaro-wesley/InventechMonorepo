import { useQuery } from "@tanstack/react-query";
import { slaService } from "@/services/sla/sla.service";

export const slaKeys = {
  all: ["sla-configs"] as const,
  byPriority: () => ["sla-configs", "by-priority"] as const,
  byMaintenanceType: () => ["sla-configs", "maintenance-types"] as const,
};

/**
 * `staleTime: 0` é deliberado. Estes prazos são exibidos no formulário de
 * abertura de OS, onde mostrar um valor desatualizado é pior do que refazer a
 * requisição — o cache padrão de 1 min do QueryProvider serviria a configuração
 * antiga logo depois de alguém salvá-la na aba de SLA.
 */
const SLA_STALE_TIME = 0;

/** Prazos das corretivas, por prioridade. */
export function useSlaConfigs(enabled = true) {
  return useQuery({
    queryKey: slaKeys.byPriority(),
    queryFn: () => slaService.getSlaConfigs(),
    staleTime: SLA_STALE_TIME,
    enabled,
  });
}

/** Matriz tipo × prioridade — todos os tipos exceto corretiva. */
export function useMaintenanceTypeSlaConfigs(enabled = true) {
  return useQuery({
    queryKey: slaKeys.byMaintenanceType(),
    queryFn: () => slaService.getMaintenanceTypeSlaConfigs(),
    staleTime: SLA_STALE_TIME,
    enabled,
  });
}
