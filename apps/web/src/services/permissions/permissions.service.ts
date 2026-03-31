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
  companyId: string;
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
  companyId: string;
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
  async list(targetCompanyId?: string): Promise<CustomRole[]> {
    const { data } = await api.get("/custom-roles", { params: targetCompanyId ? { targetCompanyId } : undefined });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async getOne(id: string, targetCompanyId?: string): Promise<CustomRole> {
    const { data } = await api.get(`/custom-roles/${id}`, { params: targetCompanyId ? { targetCompanyId } : undefined });
    return data;
  },

  async create(dto: CreateCustomRoleDto, targetCompanyId?: string): Promise<CustomRole> {
    const { data } = await api.post("/custom-roles", dto, { params: targetCompanyId ? { targetCompanyId } : undefined });
    return data;
  },

  async update(id: string, dto: UpdateCustomRoleDto, targetCompanyId?: string): Promise<CustomRole> {
    const { data } = await api.patch(`/custom-roles/${id}`, dto, { params: targetCompanyId ? { targetCompanyId } : undefined });
    return data;
  },

  async remove(id: string, targetCompanyId?: string): Promise<{ message: string }> {
    const { data } = await api.delete(`/custom-roles/${id}`, { params: targetCompanyId ? { targetCompanyId } : undefined });
    return data;
  },

  async setPermissions(id: string, permissions: { resource: string; action: string }[], targetCompanyId?: string): Promise<CustomRole> {
    const { data } = await api.put(`/custom-roles/${id}/permissions`, { permissions }, { params: targetCompanyId ? { targetCompanyId } : undefined });
    return data;
  },

  async assignToUser(userId: string, customRoleId: string | null): Promise<void> {
    await api.patch(`/custom-roles/assign/${userId}`, { customRoleId });
  },
};
