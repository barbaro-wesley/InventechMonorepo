import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  accessoriesService,
  type Accessory,
  type AssignAccessoryDto,
  type CreateAccessoryDto,
  type ListAccessoriesParams,
  type UnassignAccessoryDto,
  type UpdateAccessoryDto,
} from "@/services/accessories/accessories.service";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const accessoryKeys = {
  all: () => ["accessories"] as const,
  list: (params?: ListAccessoriesParams) =>
    ["accessories", "list", params] as const,
  detail: (id: string) => ["accessories", id] as const,
  history: (id: string) => ["accessories", id, "history"] as const,
  byEquipment: (equipmentId: string) =>
    ["accessories", "by-equipment", equipmentId] as const,
};

// ─── List & Detail ────────────────────────────────────────────────────────────

export function useAccessories(params?: ListAccessoriesParams) {
  return useQuery({
    queryKey: accessoryKeys.list(params),
    queryFn: () => accessoriesService.list(params),
    staleTime: 30 * 1000,
  });
}

export function useAccessoryById(id: string) {
  return useQuery({
    queryKey: accessoryKeys.detail(id),
    queryFn: () => accessoriesService.getById(id),
    enabled: !!id,
  });
}

export function useAccessoryHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: accessoryKeys.history(id),
    queryFn: () => accessoriesService.getHistory(id),
    enabled: !!id && enabled,
    staleTime: 30 * 1000,
  });
}

export function useEquipmentAccessories(equipmentId: string) {
  return useQuery<Accessory[]>({
    queryKey: accessoryKeys.byEquipment(equipmentId),
    queryFn: () => accessoriesService.listByEquipment(equipmentId),
    enabled: !!equipmentId,
    staleTime: 30 * 1000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAccessoryDto) => accessoriesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessoryKeys.all() });
      toast.success("Acessório cadastrado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAccessoryDto }) =>
      accessoriesService.update(id, dto),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accessoryKeys.all() });
      queryClient.invalidateQueries({ queryKey: accessoryKeys.detail(id) });
      toast.success("Acessório atualizado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accessoriesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessoryKeys.all() });
      toast.success("Acessório removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export function useAssignAccessory(accessoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AssignAccessoryDto) =>
      accessoriesService.assign(accessoryId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessoryKeys.all() });
      queryClient.invalidateQueries({ queryKey: accessoryKeys.detail(accessoryId) });
      queryClient.invalidateQueries({ queryKey: accessoryKeys.history(accessoryId) });
      // Invalidate the equipment's accessory list too
      queryClient.invalidateQueries({ queryKey: ["accessories", "by-equipment"] });
      toast.success("Acessório vinculado ao equipamento!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUnassignAccessory(accessoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UnassignAccessoryDto) =>
      accessoriesService.unassign(accessoryId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessoryKeys.all() });
      queryClient.invalidateQueries({ queryKey: accessoryKeys.detail(accessoryId) });
      queryClient.invalidateQueries({ queryKey: accessoryKeys.history(accessoryId) });
      queryClient.invalidateQueries({ queryKey: ["accessories", "by-equipment"] });
      toast.success("Acessório desvinculado!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ─── Maintenances ─────────────────────────────────────────────────────────────

export function useCreateAccessoryMaintenance(accessoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      type: string;
      title: string;
      description?: string;
      technicianId?: string;
      scheduledAt?: string;
    }) => accessoriesService.createMaintenance(accessoryId, dto as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessoryKeys.history(accessoryId) });
      queryClient.invalidateQueries({ queryKey: accessoryKeys.detail(accessoryId) });
      toast.success("Manutenção registrada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
