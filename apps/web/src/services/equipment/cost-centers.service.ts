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
  async list(params?: ListCostCentersParams): Promise<CostCenter[]> {
    const { data } = await api.get(`/cost-centers`, { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(dto: CreateCostCenterDto): Promise<CostCenter> {
    const { data } = await api.post(`/cost-centers`, dto);
    return data;
  },

  async update(id: string, dto: UpdateCostCenterDto): Promise<CostCenter> {
    const { data } = await api.patch(`/cost-centers/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/cost-centers/${id}`);
  },
};
