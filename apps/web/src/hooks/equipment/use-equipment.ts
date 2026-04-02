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
  all: (organizationId: string) => ["equipment", organizationId] as const,
  list: (organizationId: string, params?: ListEquipmentParams) =>
    ["equipment", organizationId, "list", params] as const,
  detail: (organizationId: string, id: string) =>
    ["equipment", organizationId, id] as const,
};

export function useEquipment(organizationId: string, params?: ListEquipmentParams) {
  return useQuery({
    queryKey: equipmentKeys.list(organizationId, params),
    queryFn: () => equipmentService.list(organizationId, params),
    enabled: !!organizationId,
    staleTime: 30 * 1000,
  });
}

export function useEquipmentById(organizationId: string, id: string) {
  return useQuery<Equipment>({
    queryKey: equipmentKeys.detail(organizationId, id),
    queryFn: () => equipmentService.getById(organizationId, id),
    enabled: !!organizationId && !!id,
  });
}

export function useCreateEquipment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEquipmentDto | FormData) =>
      equipmentService.create(organizationId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(organizationId) });
      toast.success("Equipamento cadastrado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEquipment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEquipmentDto }) =>
      equipmentService.update(organizationId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(organizationId) });
      toast.success("Equipamento atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteEquipment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.remove(organizationId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(organizationId) });
      toast.success("Equipamento removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRecalculateDepreciation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      equipmentService.recalculateDepreciation(organizationId, id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(organizationId) });
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
