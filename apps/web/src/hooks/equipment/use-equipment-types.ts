import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  equipmentTypesService,
  type EquipmentType,
  type ListEquipmentTypesParams,
  type CreateEquipmentTypeDto,
  type UpdateEquipmentTypeDto,
  type CreateEquipmentSubtypeDto,
  type UpdateEquipmentSubtypeDto,
} from "@/services/equipment/equipment-types.service";

export const equipmentTypeKeys = {
  all: ["equipment-types"] as const,
  list: (params?: ListEquipmentTypesParams) =>
    ["equipment-types", "list", params] as const,
};

export function useEquipmentTypes(params?: ListEquipmentTypesParams) {
  return useQuery<EquipmentType[]>({
    queryKey: equipmentTypeKeys.list(params),
    queryFn: () => equipmentTypesService.list(params),
    staleTime: 60 * 1000,
  });
}

export function useCreateEquipmentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEquipmentTypeDto) =>
      equipmentTypesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentTypeKeys.all });
      toast.success("Tipo criado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEquipmentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEquipmentTypeDto }) =>
      equipmentTypesService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentTypeKeys.all });
      toast.success("Tipo atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteEquipmentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentTypesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentTypeKeys.all });
      toast.success("Tipo removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCreateEquipmentSubtype() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEquipmentSubtypeDto) =>
      equipmentTypesService.createSubtype(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentTypeKeys.all });
      toast.success("Subtipo criado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEquipmentSubtype() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEquipmentSubtypeDto }) =>
      equipmentTypesService.updateSubtype(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentTypeKeys.all });
      toast.success("Subtipo atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteEquipmentSubtype() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentTypesService.removeSubtype(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentTypeKeys.all });
      toast.success("Subtipo removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
