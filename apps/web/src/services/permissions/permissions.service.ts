import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PermissionMatrixItem {
  resource: string;
  action: string;
  defaultRoles: string[];
  effectiveRoles: string[];
  isOverridden: boolean;
}

export interface PermissionMatrix {
  matrix: PermissionMatrixItem[];
  resources: Record<string, string[]>;
}

export interface ResourcePermission {
  id: string;
  tenantId: string;
  resource: string;
  action: string;
  allowedRoles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomRolePermission {
  customRoleId: string;
  resource: string;
  action: string;
}

export interface CustomRole {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: CustomRolePermission[];
  _count: { users: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomRoleDto {
  name: string;
  description?: string;
}

export interface UpdateCustomRoleDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// ─── Permissions Service ──────────────────────────────────────────────────────

export const permissionsService = {
  async getMatrix(): Promise<PermissionMatrix> {
    const { data } = await api.get("/permissions/matrix");
    return data;
  },

  async getDefaults(): Promise<PermissionMatrix> {
    const { data } = await api.get("/permissions/defaults");
    return data;
  },

  async getOverrides(): Promise<ResourcePermission[]> {
    const { data } = await api.get("/permissions");
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async upsert(resource: string, action: string, allowedRoles: string[]): Promise<ResourcePermission> {
    const { data } = await api.post("/permissions", { resource, action, allowedRoles });
    return data;
  },

  async remove(resource: string, action: string): Promise<{ message: string }> {
    const { data } = await api.delete("/permissions", { data: { resource, action } });
    return data;
  },

  async reset(): Promise<{ message: string }> {
    const { data } = await api.patch("/permissions/reset");
    return data;
  },
};

// ─── Custom Roles Service ─────────────────────────────────────────────────────

export const customRolesService = {
  async list(targetTenantId?: string): Promise<CustomRole[]> {
    const { data } = await api.get("/custom-roles", { params: targetTenantId ? { targetTenantId } : undefined });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async getOne(id: string, targetTenantId?: string): Promise<CustomRole> {
    const { data } = await api.get(`/custom-roles/${id}`, { params: targetTenantId ? { targetTenantId } : undefined });
    return data;
  },

  async create(dto: CreateCustomRoleDto, targetTenantId?: string): Promise<CustomRole> {
    const { data } = await api.post("/custom-roles", dto, { params: targetTenantId ? { targetTenantId } : undefined });
    return data;
  },

  async update(id: string, dto: UpdateCustomRoleDto, targetTenantId?: string): Promise<CustomRole> {
    const { data } = await api.patch(`/custom-roles/${id}`, dto, { params: targetTenantId ? { targetTenantId } : undefined });
    return data;
  },

  async remove(id: string, targetTenantId?: string): Promise<{ message: string }> {
    const { data } = await api.delete(`/custom-roles/${id}`, { params: targetTenantId ? { targetTenantId } : undefined });
    return data;
  },

  async setPermissions(id: string, permissions: { resource: string; action: string }[], targetTenantId?: string): Promise<CustomRole> {
    const { data } = await api.put(`/custom-roles/${id}/permissions`, { permissions }, { params: targetTenantId ? { targetTenantId } : undefined });
    return data;
  },

  async assignToUser(userId: string, customRoleId: string | null): Promise<void> {
    await api.patch(`/custom-roles/assign/${userId}`, { customRoleId });
  },
};
