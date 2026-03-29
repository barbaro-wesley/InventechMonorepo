import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  movementsService,
  type CreateMovementDto,
} from "@/services/equipment/movements.service";
import { equipmentKeys } from "./use-equipment";

export const movementKeys = {
  all: (equipmentId: string) => ["movements", equipmentId] as const,
};

export function useMovements(clientId: string, equipmentId: string) {
  return useQuery({
    queryKey: movementKeys.all(equipmentId),
    queryFn: () => movementsService.list(clientId, equipmentId),
    enabled: !!clientId && !!equipmentId,
  });
}

export function useCreateMovement(clientId: string, equipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMovementDto) =>
      movementsService.create(clientId, equipmentId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movementKeys.all(equipmentId) });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(clientId) });
      toast.success("Movimentação registrada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReturnEquipment(clientId: string, equipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ movementId, notes }: { movementId: string; notes?: string }) =>
      movementsService.returnEquipment(clientId, equipmentId, movementId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movementKeys.all(equipmentId) });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(clientId) });
      toast.success("Equipamento devolvido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
