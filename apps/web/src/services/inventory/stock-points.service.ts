import { api } from "@/lib/api";

export interface StockPoint {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clients: { id: string; name: string }[];
  _count: { items: number };
}

export interface StockPointDetail extends StockPoint {
  items: {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    currentQuantity: number;
    minimumQuantity: number;
    category: { id: string; name: string; color: string | null } | null;
  }[];
}

export interface CreateStockPointDto {
  name: string;
  description?: string;
  clientIds?: string[];
}

export interface UpdateStockPointDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface ListStockPointsParams {
  search?: string;
  isActive?: boolean;
  clientId?: string;
}

export const stockPointsService = {
  async list(params?: ListStockPointsParams): Promise<StockPoint[]> {
    const { data } = await api.get("/inventory/points", { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async getById(id: string): Promise<StockPointDetail> {
    const { data } = await api.get(`/inventory/points/${id}`);
    return data;
  },

  async create(dto: CreateStockPointDto): Promise<StockPoint> {
    const { data } = await api.post("/inventory/points", dto);
    return data;
  },

  async update(id: string, dto: UpdateStockPointDto): Promise<StockPoint> {
    const { data } = await api.patch(`/inventory/points/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/inventory/points/${id}`);
  },

  async assignClients(id: string, clientIds: string[]): Promise<StockPoint> {
    const { data } = await api.put(`/inventory/points/${id}/clients`, { clientIds });
    return data;
  },
};
