import { api } from "@/lib/api";

// ─── Enums ────────────────────────────────────────────────────────────────────

export type AccessoryStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "UNDER_MAINTENANCE"
  | "LOANED"
  | "SCRAPPED"
  | "LOST";

export type AccessoryOwnership =
  | "COMPANY"
  | "CLIENT"
  | "LEASED"
  | "DONATED";

export type AccessoryCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MovementType = "TRANSFER" | "LOAN";
export type MaintenanceType =
  | "PREVENTIVE"
  | "CORRECTIVE"
  | "INITIAL_ACCEPTANCE"
  | "EXTERNAL_SERVICE"
  | "TECHNOVIGILANCE"
  | "TRAINING"
  | "IMPROPER_USE"
  | "DEACTIVATION";

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface AccessoryCategory {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { accessories: number };
}

export interface Accessory {
  id: string;
  companyId: string;
  categoryId: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  patrimonyNumber: string | null;
  qrCode: string | null;
  anvisaNumber: string | null;
  ownership: AccessoryOwnership;
  purchaseValue: number | null;
  purchaseDate: string | null;
  invoiceNumber: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  status: AccessoryStatus;
  criticality: AccessoryCriticality;
  observations: string | null;
  currentLocationId: string | null;
  currentEquipmentId: string | null;
  lastMaintenanceAt: string | null;
  totalMaintenances: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; color: string | null } | null;
  currentLocation: { id: string; name: string } | null;
  currentEquipment: { id: string; name: string } | null;
}

export interface AccessoryAssignment {
  id: string;
  companyId: string;
  accessoryId: string;
  equipmentId: string;
  assignedById: string;
  unassignedById: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  reason: string | null;
  unassignReason: string | null;
  notes: string | null;
  isActive: boolean;
  equipment: { id: string; name: string };
  assignedBy: { id: string; name: string };
  unassignedBy: { id: string; name: string } | null;
}

export interface AccessoryMovement {
  id: string;
  companyId: string;
  accessoryId: string;
  requesterId: string;
  approverId: string | null;
  type: MovementType;
  status: "ACTIVE" | "RETURNED" | "CANCELLED";
  originLocationId: string;
  destinationLocationId: string;
  reason: string | null;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  originLocation: { id: string; name: string };
  destinationLocation: { id: string; name: string };
  requester: { id: string; name: string };
  approver: { id: string; name: string } | null;
}

export interface AccessoryMaintenance {
  id: string;
  companyId: string;
  accessoryId: string;
  technicianId: string | null;
  type: MaintenanceType;
  title: string;
  description: string | null;
  observations: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  technician: { id: string; name: string } | null;
}

export interface AccessoryStatusHistory {
  id: string;
  accessoryId: string;
  fromStatus: AccessoryStatus | null;
  toStatus: AccessoryStatus;
  changedById: string;
  reason: string | null;
  createdAt: string;
  changedBy: { id: string; name: string };
}

export interface AccessoryHistory {
  statusHistory: AccessoryStatusHistory[];
  assignments: AccessoryAssignment[];
  movements: AccessoryMovement[];
  maintenances: AccessoryMaintenance[];
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface ListAccessoriesParams {
  search?: string;
  status?: AccessoryStatus;
  categoryId?: string;
  qrCode?: string;
  page?: number;
  limit?: number;
}

export interface AccessoryListResponse {
  data: Accessory[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAccessoryDto {
  name: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  patrimonyNumber?: string;
  qrCode?: string;
  anvisaNumber?: string;
  ownership?: AccessoryOwnership;
  purchaseValue?: number;
  purchaseDate?: string;
  invoiceNumber?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  status?: AccessoryStatus;
  criticality?: AccessoryCriticality;
  observations?: string;
  locationId?: string;
}

export type UpdateAccessoryDto = Partial<CreateAccessoryDto>;

export interface AssignAccessoryDto {
  equipmentId: string;
  reason?: string;
  notes?: string;
}

export interface UnassignAccessoryDto {
  unassignReason?: string;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  color?: string;
}

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

// Kept for backwards compat but the real response is a plain array
export type ListEquipmentAccessoriesResponse = Accessory[];

// ─── Service ──────────────────────────────────────────────────────────────────

export const accessoriesService = {
  // ── Accessories CRUD ──────────────────────────────────────────────────────

  async list(params?: ListAccessoriesParams): Promise<AccessoryListResponse> {
    const { data } = await api.get("/accessories", { params });
    if (data?.pagination) {
      return {
        data: data.data ?? [],
        total: data.pagination.total,
        page: data.pagination.page,
        limit: data.pagination.limit,
      };
    }
    if (data?.data) return data;
    return { data: Array.isArray(data) ? data : [], total: 0, page: 1, limit: 20 };
  },

  async getById(id: string): Promise<Accessory> {
    const { data } = await api.get(`/accessories/${id}`);
    return data;
  },

  async getHistory(id: string): Promise<AccessoryHistory> {
    const { data } = await api.get(`/accessories/${id}/history`);
    return data;
  },

  async create(dto: CreateAccessoryDto): Promise<Accessory> {
    const { data } = await api.post("/accessories", dto);
    return data;
  },

  async update(id: string, dto: UpdateAccessoryDto): Promise<Accessory> {
    const { data } = await api.patch(`/accessories/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/accessories/${id}`);
  },

  // ── Assignments ───────────────────────────────────────────────────────────

  async assign(id: string, dto: AssignAccessoryDto): Promise<{ assignmentId: string }> {
    const { data } = await api.post(`/accessories/${id}/assignments/assign`, dto);
    return data;
  },

  async unassign(id: string, dto: UnassignAccessoryDto): Promise<{ message: string }> {
    const { data } = await api.post(`/accessories/${id}/assignments/unassign`, dto);
    return data;
  },

  // ── Equipment accessories ─────────────────────────────────────────────────

  async listByEquipment(equipmentId: string): Promise<Accessory[]> {
    const { data } = await api.get(`/equipment/${equipmentId}/accessories`);
    // Backend returns a plain array (not wrapped in { data: [...] })
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories(): Promise<AccessoryCategory[]> {
    const { data } = await api.get("/accessories/categories");
    return Array.isArray(data) ? data : data?.data ?? [];
  },

  async createCategory(dto: CreateCategoryDto): Promise<AccessoryCategory> {
    const { data } = await api.post("/accessories/categories", dto);
    return data;
  },

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<AccessoryCategory> {
    const { data } = await api.patch(`/accessories/categories/${id}`, dto);
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/accessories/categories/${id}`);
  },

  // ── Maintenances ──────────────────────────────────────────────────────────

  async createMaintenance(
    accessoryId: string,
    dto: {
      type: MaintenanceType;
      title: string;
      description?: string;
      technicianId?: string;
      scheduledAt?: string;
    }
  ): Promise<AccessoryMaintenance> {
    const { data } = await api.post(`/accessories/${accessoryId}/maintenances`, dto);
    return data;
  },

  async completeMaintenance(
    accessoryId: string,
    maintenanceId: string,
    dto: { observations?: string }
  ): Promise<AccessoryMaintenance> {
    const { data } = await api.patch(
      `/accessories/${accessoryId}/maintenances/${maintenanceId}/complete`,
      dto
    );
    return data;
  },
};
