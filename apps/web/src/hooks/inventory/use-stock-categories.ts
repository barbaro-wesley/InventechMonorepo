import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  stockCategoriesService,
  type CreateStockCategoryDto,
  type UpdateStockCategoryDto,
} from "@/services/inventory/stock-categories.service";

export const stockCategoryKeys = {
  all: ["stock-categories"] as const,
  list: (params?: object) => ["stock-categories", "list", params] as const,
};

export function useStockCategories(params?: { search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: stockCategoryKeys.list(params),
    queryFn: () => stockCategoriesService.list(params),
  });
}

export function useCreateStockCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStockCategoryDto) => stockCategoriesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockCategoryKeys.all });
      toast.success("Categoria criada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateStockCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStockCategoryDto }) =>
      stockCategoriesService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockCategoryKeys.all });
      toast.success("Categoria atualizada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteStockCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stockCategoriesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockCategoryKeys.all });
      toast.success("Categoria removida!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
