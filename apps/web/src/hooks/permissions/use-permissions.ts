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
    onMutate: async ({ resource, action, allowedRoles }) => {
      await queryClient.cancelQueries({ queryKey: permissionKeys.matrix() });
      const previous = queryClient.getQueryData(permissionKeys.matrix());
      queryClient.setQueryData(permissionKeys.matrix(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          matrix: old.matrix.map((item: any) =>
            item.resource === resource && item.action === action
              ? { ...item, effectiveRoles: allowedRoles, isOverridden: true }
              : item,
          ),
        };
      });
      return { previous };
    },
    onError: (e, _, context) => {
      queryClient.setQueryData(permissionKeys.matrix(), context?.previous);
      toast.error(getErrorMessage(e));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
  });
}

export function useRemovePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resource, action }: { resource: string; action: string }) =>
      permissionsService.remove(resource, action),
    onMutate: async ({ resource, action }) => {
      await queryClient.cancelQueries({ queryKey: permissionKeys.matrix() });
      const previous = queryClient.getQueryData(permissionKeys.matrix());
      queryClient.setQueryData(permissionKeys.matrix(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          matrix: old.matrix.map((item: any) =>
            item.resource === resource && item.action === action
              ? { ...item, effectiveRoles: item.defaultRoles, isOverridden: false }
              : item,
          ),
        };
      });
      return { previous };
    },
    onError: (e, _, context) => {
      queryClient.setQueryData(permissionKeys.matrix(), context?.previous);
      toast.error(getErrorMessage(e));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.all });
    },
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

export function useCustomRoles(targetCompanyId?: string) {
  return useQuery({
    queryKey: [...permissionKeys.customRoles(), targetCompanyId],
    queryFn: () => customRolesService.list(targetCompanyId),
    enabled: targetCompanyId !== undefined,
  });
}

export function useCustomRole(id: string, targetCompanyId?: string) {
  return useQuery({
    queryKey: [...permissionKeys.customRole(id), targetCompanyId],
    queryFn: () => customRolesService.getOne(id, targetCompanyId),
    enabled: !!id,
  });
}

export function useCreateCustomRole(targetCompanyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCustomRoleDto) => customRolesService.create(dto, targetCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.customRoles() });
      toast.success("Papel criado com sucesso!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUpdateCustomRole(id: string, targetCompanyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCustomRoleDto) => customRolesService.update(id, dto, targetCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.customRoles() });
      toast.success("Papel atualizado!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useDeleteCustomRole(targetCompanyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customRolesService.remove(id, targetCompanyId),
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

export function useSetCustomRolePermissions(id: string, targetCompanyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissions: { resource: string; action: string }[]) =>
      customRolesService.setPermissions(id, permissions, targetCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.customRoles() });
      toast.success("Permissões salvas!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
