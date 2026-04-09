import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { clientsService } from "@/services/clients/clients.service";
import { getErrorMessage } from "@/lib/api";
import type {
  CreateClientDto,
  UpdateClientDto,
  ListClientsParams,
} from "@inventech/shared-types";
import type { PlatformUser } from "@/services/clients/clients.service";

export const clientKeys = {
  all: ["clients"] as const,
  list: (params?: ListClientsParams) => ["clients", "list", params] as const,
  detail: (id: string) => ["clients", "detail", id] as const,
};

export function useClients(params?: ListClientsParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => clientsService.list(params),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateClientDto) => clientsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      toast.success("Cliente criado com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateClientDto) => clientsService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      toast.success("Cliente atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      toast.success("Cliente removido com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUploadClientLogo(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => clientsService.uploadLogo(clientId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      toast.success("Logo do cliente atualizado!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ── Grupos de Manutenção ──────────────────────────────────────────────────────

export const clientGroupKeys = {
  list: (clientId: string) => ["clients", clientId, "maintenance-groups"] as const,
};

export function useClientMaintenanceGroups(clientId: string) {
  return useQuery({
    queryKey: clientGroupKeys.list(clientId),
    queryFn: () => clientsService.listMaintenanceGroups(clientId),
    enabled: !!clientId,
  });
}

export function useAssignMaintenanceGroup(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => clientsService.assignMaintenanceGroup(clientId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientGroupKeys.list(clientId) });
      toast.success("Grupo vinculado ao cliente!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRemoveMaintenanceGroup(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => clientsService.removeMaintenanceGroup(clientId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientGroupKeys.list(clientId) });
      toast.success("Grupo removido do cliente!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Usuários da plataforma ────────────────────────────────────────────────────

export const platformUserKeys = {
  available: (clientId: string) => ["clients", clientId, "platform-users", "available"] as const,
};

export function useAvailablePlatformUsers(clientId: string) {
  return useQuery<PlatformUser[]>({
    queryKey: platformUserKeys.available(clientId),
    queryFn: () => clientsService.listAvailablePlatformUsers(clientId),
    enabled: !!clientId,
  });
}

export function useLinkPlatformUser(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => clientsService.linkPlatformUser(clientId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: platformUserKeys.available(clientId) });
      toast.success("Usuário vinculado ao cliente!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUnlinkPlatformUser(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => clientsService.unlinkPlatformUser(clientId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: platformUserKeys.available(clientId) });
      toast.success("Usuário desvinculado do cliente!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}