import { api } from "@/lib/api";

export interface EmbeddedLocation {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  costCenterId: string | null;
  _count: { equipments: number };
  parent: { id: string; name: string } | null;
}

export interface CostCenter {
  id: string;
  companyId: string;
  clientId: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { equipments: number; locations: number };
  locations: EmbeddedLocation[];
}


export interface ListCostCentersParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateCostCenterDto {
  name: string;
  code?: string;
  description?: string;
}

export interface UpdateCostCenterDto {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export const costCentersService = {
  async list(clientId: string, params?: ListCostCentersParams): Promise<CostCenter[]> {
    const { data } = await api.get(`/clients/${clientId}/cost-centers`, { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(clientId: string, dto: CreateCostCenterDto): Promise<CostCenter> {
    const { data } = await api.post(`/clients/${clientId}/cost-centers`, dto);
    return data;
  },

  async update(clientId: string, id: string, dto: UpdateCostCenterDto): Promise<CostCenter> {
    const { data } = await api.patch(`/clients/${clientId}/cost-centers/${id}`, dto);
    return data;
  },

  async remove(clientId: string, id: string): Promise<void> {
    await api.delete(`/clients/${clientId}/cost-centers/${id}`);
  },
};
