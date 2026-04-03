import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  maintenanceGroupsService,
  type CreateMaintenanceGroupDto,
  type UpdateMaintenanceGroupDto,
} from "@/services/maintenance-groups/maintenance-groups.service";

export const maintenanceGroupKeys = {
  all: ["maintenance-groups"] as const,
  list: (params?: object) => ["maintenance-groups", "list", params] as const,
};

export function useMaintenanceGroups(params?: { search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: maintenanceGroupKeys.list(params),
    queryFn: () => maintenanceGroupsService.list(params),
  });
}

export function useCreateMaintenanceGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMaintenanceGroupDto) => maintenanceGroupsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceGroupKeys.all });
      toast.success("Grupo criado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateMaintenanceGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMaintenanceGroupDto }) =>
      maintenanceGroupsService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceGroupKeys.all });
      toast.success("Grupo atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteMaintenanceGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => maintenanceGroupsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceGroupKeys.all });
      toast.success("Grupo removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
