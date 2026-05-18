import { api } from "@/lib/api";
import type { StockCategory } from "./inventory.service";

export interface CreateStockCategoryDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateStockCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export const stockCategoriesService = {
  async list(params?: { search?: string; isActive?: boolean }): Promise<StockCategory[]> {
    const { data } = await api.get("/inventory/categories", { params });
    const result = Array.isArray(data) ? data : (data?.data ?? []);
    return result;
  },

  async create(dto: CreateStockCategoryDto): Promise<StockCategory> {
    const { data } = await api.post("/inventory/categories", dto);
    return data;
  },

  async update(id: string, dto: UpdateStockCategoryDto): Promise<StockCategory> {
    const { data } = await api.patch(`/inventory/categories/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/inventory/categories/${id}`);
  },
};
