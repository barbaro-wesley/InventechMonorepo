import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  costCentersService,
  type CostCenter,
  type ListCostCentersParams,
  type CreateCostCenterDto,
  type UpdateCostCenterDto,
} from "@/services/equipment/cost-centers.service";

export const costCenterKeys = {
  all: (clientId: string) => ["cost-centers", clientId] as const,
  list: (clientId: string, params?: ListCostCentersParams) =>
    ["cost-centers", clientId, "list", params] as const,
};

export function useCostCenters(clientId: string, params?: ListCostCentersParams) {
  return useQuery<CostCenter[]>({
    queryKey: costCenterKeys.list(clientId, params),
    queryFn: () => costCentersService.list(clientId, params),
    enabled: !!clientId,
    staleTime: 60 * 1000,
  });
}

export function useCreateCostCenter(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCostCenterDto) =>
      costCentersService.create(clientId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(clientId) });
      toast.success("Centro de custo criado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateCostCenter(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCostCenterDto }) =>
      costCentersService.update(clientId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(clientId) });
      toast.success("Centro de custo atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteCostCenter(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => costCentersService.remove(clientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(clientId) });
      toast.success("Centro de custo removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
