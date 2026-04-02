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
  all: (organizationId: string) => ["locations", organizationId] as const,
  list: (organizationId: string, params?: ListLocationsParams) =>
    ["locations", organizationId, "list", params] as const,
};

export function useLocations(organizationId: string, params?: ListLocationsParams) {
  return useQuery<Location[]>({
    queryKey: locationKeys.list(organizationId, params),
    queryFn: () => locationsService.list(organizationId, params),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}

export function useCreateLocation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLocationDto) =>
      locationsService.create(organizationId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all(organizationId) });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(organizationId) });
      toast.success("Localização criada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateLocation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateLocationDto }) =>
      locationsService.update(organizationId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all(organizationId) });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(organizationId) });
      toast.success("Localização atualizada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteLocation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => locationsService.remove(organizationId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all(organizationId) });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all(organizationId) });
      toast.success("Localização removida!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
