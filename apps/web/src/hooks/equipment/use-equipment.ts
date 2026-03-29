import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  equipmentService,
  type Equipment,
  type ListEquipmentParams,
  type CreateEquipmentDto,
  type UpdateEquipmentDto,
} from "@/services/equipment/equipment.service";

export const equipmentKeys = {
  all: (clientId: string) => ["equipment", clientId] as const,
  list: (clientId: string, params?: ListEquipmentParams) =>
    ["equipment", clientId, "list", params] as const,
  detail: (clientId: string, id: string) =>
    ["equipment", clientId, id] as const,
};

export function useEquipment(clientId: string, params?: ListEquipmentParams) {
  return useQuery({
    queryKey: equipmentKeys.list(clientId, params),
    queryFn: () => equipmentService.list(clientId, params),
    enabled: !!clientId,
    staleTime: 30 * 1000,
  });
}

export function useEquipmentById(clientId: string, id: string) {
  return useQuery<Equipment>({
    queryKey: equipmentKeys.detail(clientId, id),
    queryFn: () => equipmentService.getById(clientId, id),
    enabled: !!clientId && !!id,
  });
}

export function useCreateEquipment(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEquipmentDto | FormData) =>
      equipmentService.create(clientId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(clientId) });
      toast.success("Equipamento cadastrado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEquipment(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEquipmentDto }) =>
      equipmentService.update(clientId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(clientId) });
      toast.success("Equipamento atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteEquipment(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.remove(clientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(clientId) });
      toast.success("Equipamento removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRecalculateDepreciation(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      equipmentService.recalculateDepreciation(clientId, id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(clientId) });
      if (result?.currentValue !== undefined) {
        toast.success(
          `Depreciação calculada — Valor atual: R$ ${Number(result.currentValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        );
      } else {
        toast.info(result?.message ?? "Depreciação recalculada");
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
