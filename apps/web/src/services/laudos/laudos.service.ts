import { api } from "@/lib/api";
import type { LaudoFieldDefinition, LaudoReferenceType } from "@/services/laudo-templates/laudo-templates.types";

export interface Laudo {
  id: string;
  number: number;
  title: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PENDING_SIGNATURE" | "SIGNED" | "APPROVED" | "CANCELLED";
  referenceType: LaudoReferenceType;
  fields: LaudoFieldDefinition[];
  notes?: string | null;
  pdfUrl?: string | null;
  serviceOrderId?: string | null;
  maintenanceId?: string | null;
  clientId?: string | null;
  templateId?: string | null;
  createdAt: string;
}

export interface CreateLaudoDto {
  title: string;
  referenceType: LaudoReferenceType;
  templateId?: string;
  serviceOrderId?: string;
  maintenanceId?: string;
  clientId?: string;
  technicianId?: string;
  fields: LaudoFieldDefinition[];
  notes?: string;
}

export interface UpdateLaudoDto {
  title?: string;
  fields?: LaudoFieldDefinition[];
  notes?: string;
}

export const laudosService = {
  async create(dto: CreateLaudoDto): Promise<Laudo> {
    const { data } = await api.post("/laudos", dto);
    return data;
  },

  async update(id: string, dto: UpdateLaudoDto): Promise<Laudo> {
    const { data } = await api.patch(`/laudos/${id}`, dto);
    return data;
  },

  async getById(id: string): Promise<Laudo> {
    const { data } = await api.get(`/laudos/${id}`);
    return data;
  },

  async findDraftForServiceOrder(serviceOrderId: string): Promise<Laudo | null> {
    const { data } = await api.get("/laudos", {
      params: { serviceOrderId, status: "DRAFT", limit: 1 },
    });
    return data?.data?.[0] ?? null;
  },

  async previewFields(payload: {
    templateId: string;
    clientId?: string;
    serviceOrderId?: string;
    maintenanceId?: string;
    technicianId?: string;
  }): Promise<{ fields: any[] }> {
    const { data } = await api.post("/laudos/preview-fields", payload);
    return data;
  },
};
