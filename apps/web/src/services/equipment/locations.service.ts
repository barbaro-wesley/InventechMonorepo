import { api } from "@/lib/api";

export interface LocationCostCenter {
  id: string;
  name: string;
  code: string | null;
}

export interface Location {
  id: string;
  companyId: string;
  costCenterId: string | null;
  name: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  costCenter: LocationCostCenter | null;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string; isActive: boolean }[];
  _count: { equipments: number };
}


export interface ListLocationsParams {
  search?: string;
  costCenterId?: string;
  parentId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateLocationDto {
  name: string;
  description?: string;
  parentId?: string;
  costCenterId?: string;
}

export interface UpdateLocationDto {
  name?: string;
  description?: string;
  parentId?: string | null;
  costCenterId?: string | null;
  isActive?: boolean;
}

export const locationsService = {
  async list(params?: ListLocationsParams): Promise<Location[]> {
    const { data } = await api.get(`/locations`, { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(dto: CreateLocationDto): Promise<Location> {
    const { data } = await api.post(`/locations`, dto);
    return data;
  },

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const { data } = await api.patch(`/locations/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/locations/${id}`);
  },
};
