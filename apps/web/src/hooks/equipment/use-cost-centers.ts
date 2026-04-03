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
  all: () => ["cost-centers"] as const,
  list: (params?: ListCostCentersParams) =>
    ["cost-centers", "list", params] as const,
};

export function useCostCenters(params?: ListCostCentersParams) {
  return useQuery<CostCenter[]>({
    queryKey: costCenterKeys.list(params),
    queryFn: () => costCentersService.list(params),
    staleTime: 60 * 1000,
  });
}

export function useCreateCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCostCenterDto) => costCentersService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all() });
      toast.success("Centro de custo criado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCostCenterDto }) =>
      costCentersService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all() });
      toast.success("Centro de custo atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => costCentersService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all() });
      toast.success("Centro de custo removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
