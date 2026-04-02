import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  permissionsService,
  customRolesService,
  type CreateCustomRoleDto,
  type UpdateCustomRoleDto,
} from "@/services/permissions/permissions.service";
import { getErrorMessage } from "@/lib/api";

export const permissionKeys = {
  all: ["permissions"] as const,
  matrix: () => ["permissions", "matrix"] as const,
  overrides: () => ["permissions", "overrides"] as const,
  customRoles: () => ["permissions", "custom-roles"] as const,
  customRole: (id: string) => ["permissions", "custom-roles", id] as const,
};

// ─── System permission matrix ─────────────────────────────────────────────────

export function usePermissionMatrix() {
  return useQuery({
    queryKey: permissionKeys.matrix(),
    queryFn: () => permissionsService.getMatrix(),
  });
}

export function useUpsertPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resource, action, allowedRoles }: { resource: string; action: string; allowedRoles: string[] }) =>
      permissionsService.upsert(resource, action, allowedRoles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useRemovePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resource, action }: { resource: string; action: string }) =>
      permissionsService.remove(resource, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useResetPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => permissionsService.reset(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
      toast.success(res.message);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

// ─── Custom Roles ─────────────────────────────────────────────────────────────

export function useCustomRoles(targetTenantId?: string) {
  return useQuery({
    queryKey: [...permissionKeys.customRoles(), targetTenantId],
    queryFn: () => customRolesService.list(targetTenantId),
    enabled: targetTenantId !== undefined ? !!targetTenantId : true,
  });
}

export function useCustomRole(id: string, targetTenantId?: string) {
  return useQuery({
    queryKey: [...permissionKeys.customRole(id), targetTenantId],
    queryFn: () => customRolesService.getOne(id, targetTenantId),
    enabled: !!id,
  });
}

export function useCreateCustomRole(targetTenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCustomRoleDto) => customRolesService.create(dto, targetTenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.customRoles() });
      toast.success("Papel criado com sucesso!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUpdateCustomRole(id: string, targetTenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCustomRoleDto) => customRolesService.update(id, dto, targetTenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.customRoles() });
      toast.success("Papel atualizado!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useDeleteCustomRole(targetTenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customRolesService.remove(id, targetTenantId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.customRoles() });
      toast.success(res.message);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useAssignCustomRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, customRoleId }: { userId: string; customRoleId: string | null }) =>
      customRolesService.assignToUser(userId, customRoleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Papel personalizado atribuído!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useSetCustomRolePermissions(id: string, targetTenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissions: { resource: string; action: string }[]) =>
      customRolesService.setPermissions(id, permissions, targetTenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.customRoles() });
      toast.success("Permissões salvas!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
