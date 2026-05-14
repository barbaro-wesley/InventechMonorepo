import { api } from "@/lib/api";

export interface StockCategory {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { items: number };
}

export interface StockItem {
  id: string;
  companyId: string;
  clientId: string | null;
  categoryId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  unit: string;
  brand: string | null;
  minimumQuantity: number;
  currentQuantity: number;
  unitCost: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
  category: { id: string; name: string; color: string | null } | null;
}

export interface StockMovement {
  id: string;
  companyId: string;
  itemId: string;
  userId: string;
  serviceOrderId: string | null;
  type: "ENTRY" | "EXIT" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  item: { id: string; name: string; code: string | null; unit: string };
  user: { id: string; name: string };
  serviceOrder: { id: string; number: number } | null;
}

export interface ListStockItemsParams {
  clientId?: string;
  categoryId?: string;
  search?: string;
  isActive?: boolean;
  belowMinimum?: boolean;
  page?: number;
  limit?: number;
}

export interface ListMovementsParams {
  itemId?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}

export interface CreateStockItemDto {
  clientId?: string;
  categoryId?: string;
  code?: string;
  name: string;
  description?: string;
  unit?: string;
  brand?: string;
  minimumQuantity?: number;
  unitCost?: number;
}

export interface UpdateStockItemDto {
  categoryId?: string | null;
  code?: string;
  name?: string;
  description?: string;
  unit?: string;
  brand?: string;
  minimumQuantity?: number;
  unitCost?: number;
  isActive?: boolean;
}

export interface CreateMovementDto {
  itemId: string;
  type: "ENTRY" | "EXIT" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  unitCost?: number;
  reason?: string;
  notes?: string;
}

export const inventoryService = {
  async list(params?: ListStockItemsParams): Promise<PaginatedResponse<StockItem>> {
    const { data } = await api.get("/inventory", { params });
    return data;
  },

  async getById(id: string): Promise<StockItem> {
    const { data } = await api.get(`/inventory/${id}`);
    return data;
  },

  async create(dto: CreateStockItemDto): Promise<StockItem> {
    const { data } = await api.post("/inventory", dto);
    return data;
  },

  async update(id: string, dto: UpdateStockItemDto): Promise<StockItem> {
    const { data } = await api.patch(`/inventory/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/inventory/${id}`);
  },

  async listMovements(params?: ListMovementsParams): Promise<PaginatedResponse<StockMovement>> {
    const { data } = await api.get("/inventory/movements", { params });
    return data;
  },

  async listMovementsByItem(itemId: string, page = 1, limit = 50): Promise<PaginatedResponse<StockMovement>> {
    const { data } = await api.get(`/inventory/movements/item/${itemId}`, { params: { page, limit } });
    return data;
  },

  async createMovement(dto: CreateMovementDto): Promise<StockMovement> {
    const { data } = await api.post("/inventory/movements", dto);
    return data;
  },
};
