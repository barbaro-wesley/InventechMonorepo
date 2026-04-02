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
  all: (organizationId: string) => ["cost-centers", organizationId] as const,
  list: (organizationId: string, params?: ListCostCentersParams) =>
    ["cost-centers", organizationId, "list", params] as const,
};

export function useCostCenters(organizationId: string, params?: ListCostCentersParams) {
  return useQuery<CostCenter[]>({
    queryKey: costCenterKeys.list(organizationId, params),
    queryFn: () => costCentersService.list(organizationId, params),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}

export function useCreateCostCenter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCostCenterDto) =>
      costCentersService.create(organizationId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(organizationId) });
      toast.success("Centro de custo criado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateCostCenter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCostCenterDto }) =>
      costCentersService.update(organizationId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(organizationId) });
      toast.success("Centro de custo atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteCostCenter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => costCentersService.remove(organizationId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(organizationId) });
      toast.success("Centro de custo removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
