import { api } from "@/lib/api";

export interface MaintenanceGroup {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  noRestriction: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { technicians: number; serviceOrders: number };
}

export interface CreateMaintenanceGroupDto {
  name: string;
  description?: string;
  color?: string;
  noRestriction?: boolean;
}

export interface UpdateMaintenanceGroupDto {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
  noRestriction?: boolean;
}

export const maintenanceGroupsService = {
  async list(params?: { search?: string; isActive?: boolean }): Promise<MaintenanceGroup[]> {
    const { data } = await api.get("/maintenance-groups", { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(dto: CreateMaintenanceGroupDto): Promise<MaintenanceGroup> {
    const { data } = await api.post("/maintenance-groups", dto);
    return data;
  },

  async update(id: string, dto: UpdateMaintenanceGroupDto): Promise<MaintenanceGroup> {
    const { data } = await api.patch(`/maintenance-groups/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/maintenance-groups/${id}`);
  },
};
