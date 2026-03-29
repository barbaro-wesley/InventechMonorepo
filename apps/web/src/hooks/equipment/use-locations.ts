import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  locationsService,
  type Location,
  type ListLocationsParams,
  type CreateLocationDto,
  type UpdateLocationDto,
} from "@/services/equipment/locations.service";
import { costCenterKeys } from "./use-cost-centers";

export const locationKeys = {
  all: (clientId: string) => ["locations", clientId] as const,
  list: (clientId: string, params?: ListLocationsParams) =>
    ["locations", clientId, "list", params] as const,
};

export function useLocations(clientId: string, params?: ListLocationsParams) {
  return useQuery<Location[]>({
    queryKey: locationKeys.list(clientId, params),
    queryFn: () => locationsService.list(clientId, params),
    enabled: !!clientId,
    staleTime: 60 * 1000,
  });
}

export function useCreateLocation(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLocationDto) =>
      locationsService.create(clientId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all(clientId) });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(clientId) });
      toast.success("Localização criada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateLocation(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateLocationDto }) =>
      locationsService.update(clientId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all(clientId) });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(clientId) });
      toast.success("Localização atualizada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteLocation(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => locationsService.remove(clientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all(clientId) });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(clientId) });
      toast.success("Localização removida!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
