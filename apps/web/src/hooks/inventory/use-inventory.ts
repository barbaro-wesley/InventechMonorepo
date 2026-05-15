import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  inventoryService,
  type CreateMovementDto,
  type CreateStockItemDto,
  type ListMovementsParams,
  type ListStockItemsParams,
  type UpdateStockItemDto,
} from "@/services/inventory/inventory.service";

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (params?: object) => ["inventory", "list", params] as const,
  detail: (id: string) => ["inventory", "detail", id] as const,
  movements: (params?: object) => ["inventory", "movements", params] as const,
  itemMovements: (itemId: string) => ["inventory", "movements", "item", itemId] as const,
  dashboard: () => ["inventory", "dashboard"] as const,
};

export function useInventory(params?: ListStockItemsParams) {
  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => inventoryService.list(params),
  });
}

export function useStockItem(id: string) {
  return useQuery({
    queryKey: inventoryKeys.detail(id),
    queryFn: () => inventoryService.getById(id),
    enabled: !!id,
  });
}

export function useCreateStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStockItemDto) => inventoryService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Item criado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStockItemDto }) =>
      inventoryService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Item atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Item removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useStockMovements(params?: ListMovementsParams) {
  return useQuery({
    queryKey: inventoryKeys.movements(params),
    queryFn: () => inventoryService.listMovements(params),
  });
}

export function useItemMovements(itemId: string) {
  return useQuery({
    queryKey: inventoryKeys.itemMovements(itemId),
    queryFn: () => inventoryService.listMovementsByItem(itemId),
    enabled: !!itemId,
  });
}

export function useInventoryDashboard() {
  return useQuery({
    queryKey: inventoryKeys.dashboard(),
    queryFn: () => inventoryService.getDashboard(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMovementDto) => inventoryService.createMovement(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Movimentação registrada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
