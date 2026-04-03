import { api } from "@/lib/api";

export type MovementType = "TRANSFER" | "LOAN";
export type MovementStatus = "ACTIVE" | "RETURNED" | "CANCELLED";

export interface Movement {
  id: string;
  equipmentId: string;
  type: MovementType;
  status: MovementStatus;
  originLocationId: string;
  destinationLocationId: string;
  reason: string | null;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  notes: string | null;
  createdAt: string;
  origin: { id: string; name: string };
  destination: { id: string; name: string };
  requester: { id: string; name: string };
  approver: { id: string; name: string } | null;
}

export interface CreateMovementDto {
  type: MovementType;
  originLocationId: string;
  destinationLocationId: string;
  reason?: string;
  expectedReturnAt?: string;
  notes?: string;
}

export const movementsService = {
  async list(equipmentId: string): Promise<Movement[]> {
    const { data } = await api.get(`/equipment/${equipmentId}/movements`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(equipmentId: string, dto: CreateMovementDto): Promise<Movement> {
    const { data } = await api.post(`/equipment/${equipmentId}/movements`, dto);
    return data;
  },

  async returnEquipment(equipmentId: string, movementId: string, notes?: string): Promise<Movement> {
    const { data } = await api.post(
      `/equipment/${equipmentId}/movements/${movementId}/return`,
      { notes }
    );
    return data;
  },
};
