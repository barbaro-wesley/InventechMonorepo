import { api } from "@/lib/api";

export type EquipmentStatus = "ACTIVE" | "BORROWED" | "UNDER_MAINTENANCE" | "INACTIVE" | "DISPOSED";
export type EquipmentCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Equipment {
  id: string;
  companyId: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  patrimonyNumber: string | null;
  anvisaNumber: string | null;
  status: EquipmentStatus;
  criticality: EquipmentCriticality;
  purchaseValue: string | null;
  purchaseDate: string | null;
  invoiceNumber: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  depreciationRate: string | null;
  currentValue: string | null;
  lastDepreciationCalc: string | null;
  ipAddress: string | null;
  operatingSystem: string | null;
  btus: number | null;
  voltage: string | null;
  power: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  type: { id: string; name: string } | null;
  subtype: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  currentLocation: { id: string; name: string } | null;
  costCenter: { id: string; name: string; code: string | null } | null;
  _count: { serviceOrders: number; maintenances: number; attachments: number };
}

export interface ListEquipmentParams {
  search?: string;
  ipAddress?: string;
  patrimonyNumber?: string;
  status?: EquipmentStatus;
  criticality?: EquipmentCriticality;
  typeId?: string;
  locationId?: string;
  costCenterId?: string;
  page?: number;
  limit?: number;
}

export interface CreateEquipmentDto {
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  patrimonyNumber?: string;
  anvisaNumber?: string;
  typeId?: string;
  subtypeId?: string;
  locationId?: string;
  costCenterId?: string;
  purchaseValue?: string;
  purchaseDate?: string;
  invoiceNumber?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  depreciationRate?: string;
  ipAddress?: string;
  operatingSystem?: string;
  btus?: number;
  voltage?: string;
  power?: string;
  criticality?: EquipmentCriticality;
  observations?: string;
}

export interface UpdateEquipmentDto extends Partial<CreateEquipmentDto> {
  status?: EquipmentStatus;
}

export interface EquipmentListResponse {
  data: Equipment[];
  total: number;
  page: number;
  limit: number;
}

export const equipmentService = {
  async list(params?: ListEquipmentParams): Promise<EquipmentListResponse> {
    const { data } = await api.get(`/equipment`, { params });
    if (data?.data) return data;
    return { data: Array.isArray(data) ? data : [], total: 0, page: 1, limit: 20 };
  },

  async getById(id: string): Promise<Equipment> {
    const { data } = await api.get(`/equipment/${id}`);
    return data;
  },

  async create(payload: CreateEquipmentDto | FormData): Promise<Equipment> {
    const { data } = await api.post(`/equipment`, payload);
    return data;
  },

  async update(id: string, dto: UpdateEquipmentDto): Promise<Equipment> {
    const { data } = await api.patch(`/equipment/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/equipment/${id}`);
  },

  async recalculateDepreciation(id: string) {
    const { data } = await api.post(`/equipment/${id}/depreciation`);
    return data;
  },
};
