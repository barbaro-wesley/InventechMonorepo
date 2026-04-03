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
  all: () => ["locations"] as const,
  list: (params?: ListLocationsParams) =>
    ["locations", "list", params] as const,
};

export function useLocations(params?: ListLocationsParams) {
  return useQuery<Location[]>({
    queryKey: locationKeys.list(params),
    queryFn: () => locationsService.list(params),
    staleTime: 60 * 1000,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLocationDto) => locationsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all() });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all() });
      toast.success("Localização criada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateLocationDto }) =>
      locationsService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all() });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all() });
      toast.success("Localização atualizada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => locationsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all() });
      queryClient.invalidateQueries({ queryKey: costCenterKeys.all() });
      toast.success("Localização removida!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
