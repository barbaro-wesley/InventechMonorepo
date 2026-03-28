import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { clientsService } from "@/services/clients/clients.service";
import { getErrorMessage } from "@/lib/api";
import type {
  CreateClientDto,
  UpdateClientDto,
  ListClientsParams,
} from "@inventech/shared-types";

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