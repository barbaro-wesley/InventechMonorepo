import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  equipmentService,
  type Equipment,
  type ListEquipmentParams,
  type ListEquipmentServiceOrdersParams,
  type CreateEquipmentDto,
  type UpdateEquipmentDto,
} from "@/services/equipment/equipment.service";

export const equipmentKeys = {
  all: () => ["equipment"] as const,
  list: (params?: ListEquipmentParams) =>
    ["equipment", "list", params] as const,
  detail: (id: string) => ["equipment", id] as const,
  history: (id: string, params?: Omit<ListEquipmentServiceOrdersParams, "cursor">) =>
    ["equipment", id, "service-orders", params] as const,
};

export function useEquipment(params?: ListEquipmentParams) {
  return useQuery({
    queryKey: equipmentKeys.list(params),
    queryFn: () => equipmentService.list(params),
    staleTime: 30 * 1000,
  });
}

export function useEquipmentById(id: string) {
  return useQuery<Equipment>({
    queryKey: equipmentKeys.detail(id),
    queryFn: () => equipmentService.getById(id),
    enabled: !!id,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEquipmentDto | FormData) =>
      equipmentService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all() });
      toast.success("Equipamento cadastrado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEquipmentDto }) =>
      equipmentService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all() });
      toast.success("Equipamento atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all() });
      toast.success("Equipamento removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useEquipmentServiceOrders(
  id: string,
  params?: Omit<ListEquipmentServiceOrdersParams, "cursor">,
) {
  return useInfiniteQuery({
    queryKey: equipmentKeys.history(id, params),
    queryFn: ({ pageParam }) =>
      equipmentService.listServiceOrders(id, {
        ...params,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useRecalculateDepreciation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentService.recalculateDepreciation(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all() });
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
