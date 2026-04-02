import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EquipmentSubtype {
  id: string;
  typeId: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface EquipmentType {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  subtypes: EquipmentSubtype[];
  _count: { equipments: number };
}

export interface EquipmentTypesResponse {
  data: EquipmentType[];
  total: number;
  page: number;
  limit: number;
}

export interface ListEquipmentTypesParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateEquipmentTypeDto {
  name: string;
  description?: string;
}

export interface UpdateEquipmentTypeDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateEquipmentSubtypeDto {
  typeId: string;
  name: string;
  description?: string;
}

export interface UpdateEquipmentSubtypeDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const equipmentTypesService = {
  async list(params?: ListEquipmentTypesParams): Promise<EquipmentType[]> {
    const { data } = await api.get("/equipment-types", { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(dto: CreateEquipmentTypeDto): Promise<EquipmentType> {
    const { data } = await api.post("/equipment-types", dto);
    return data;
  },

  async update(id: string, dto: UpdateEquipmentTypeDto): Promise<EquipmentType> {
    const { data } = await api.patch(`/equipment-types/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/equipment-types/${id}`);
  },

  async createSubtype(dto: CreateEquipmentSubtypeDto): Promise<EquipmentSubtype> {
    const { data } = await api.post("/equipment-types/subtypes", dto);
    return data;
  },

  async updateSubtype(id: string, dto: UpdateEquipmentSubtypeDto): Promise<EquipmentSubtype> {
    const { data } = await api.patch(`/equipment-types/subtypes/${id}`, dto);
    return data;
  },

  async removeSubtype(id: string): Promise<void> {
    await api.delete(`/equipment-types/subtypes/${id}`);
  },
};
