import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  accessoriesService,
  type CreateCategoryDto,
  type UpdateCategoryDto,
} from "@/services/accessories/accessories.service";

export const categoryKeys = {
  all: () => ["accessory-categories"] as const,
};

export function useAccessoryCategories() {
  return useQuery({
    queryKey: categoryKeys.all(),
    queryFn: () => accessoriesService.listCategories(),
    staleTime: 60 * 1000,
  });
}

export function useCreateAccessoryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCategoryDto) => accessoriesService.createCategory(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success("Categoria criada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateAccessoryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) =>
      accessoriesService.updateCategory(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success("Categoria atualizada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteAccessoryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accessoriesService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success("Categoria removida!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
