import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { organizationsService } from "@/services/clients/clients.service";
import { getErrorMessage } from "@/lib/api";
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  ListOrganizationsParams,
} from "@inventech/shared-types";

export const organizationKeys = {
  all: ["organizations"] as const,
  list: (params?: ListOrganizationsParams) => ["organizations", "list", params] as const,
  detail: (id: string) => ["organizations", "detail", id] as const,
};

export function useOrganizations(params?: ListOrganizationsParams) {
  return useQuery({
    queryKey: organizationKeys.list(params),
    queryFn: () => organizationsService.list(params),
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => organizationsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateOrganizationDto) => organizationsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success("Organização criada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateOrganization(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateOrganizationDto) => organizationsService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success("Organização atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success("Organização removida com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUploadOrganizationLogo(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => organizationsService.uploadLogo(organizationId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      toast.success("Logo da organização atualizado!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
