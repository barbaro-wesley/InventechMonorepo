import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  manualService,
  CreateManualPayload,
  UpdateManualPayload,
} from "@/services/equipment/manual.service";

const manualKeys = {
  list: (equipmentId: string) => ["equipment-manuals", equipmentId] as const,
};

export function useManuals(equipmentId: string) {
  return useQuery({
    queryKey: manualKeys.list(equipmentId),
    queryFn: () => manualService.list(equipmentId),
    enabled: !!equipmentId,
    staleTime: 30 * 1000,
  });
}

export function useCreateManual(equipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, file }: { payload: CreateManualPayload; file?: File }) =>
      manualService.create(equipmentId, payload, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: manualKeys.list(equipmentId) });
      toast.success("Manual adicionado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateManual(equipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ manualId, payload }: { manualId: string; payload: UpdateManualPayload }) =>
      manualService.update(equipmentId, manualId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: manualKeys.list(equipmentId) });
      toast.success("Manual atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteManual(equipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (manualId: string) => manualService.remove(equipmentId, manualId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: manualKeys.list(equipmentId) });
      toast.success("Manual removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
