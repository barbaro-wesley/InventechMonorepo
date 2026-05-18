import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  stockPointsService,
  type CreateStockPointDto,
  type ListStockPointsParams,
  type UpdateStockPointDto,
} from "@/services/inventory/stock-points.service";

export const stockPointKeys = {
  all: ["stock-points"] as const,
  list: (params?: object) => ["stock-points", "list", params] as const,
  detail: (id: string) => ["stock-points", "detail", id] as const,
};

export function useStockPoints(params?: ListStockPointsParams) {
  return useQuery({
    queryKey: stockPointKeys.list(params),
    queryFn: () => stockPointsService.list(params),
  });
}

export function useStockPoint(id: string) {
  return useQuery({
    queryKey: stockPointKeys.detail(id),
    queryFn: () => stockPointsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateStockPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStockPointDto) => stockPointsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockPointKeys.all });
      toast.success("Ponto de estoque criado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateStockPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStockPointDto }) =>
      stockPointsService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockPointKeys.all });
      toast.success("Ponto de estoque atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteStockPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stockPointsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockPointKeys.all });
      toast.success("Ponto de estoque removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useAssignStockPointClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientIds }: { id: string; clientIds: string[] }) =>
      stockPointsService.assignClients(id, clientIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockPointKeys.all });
      toast.success("Clientes atualizados!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
