import { api } from "@/lib/api";
import type {
  ChecklistTemplate,
  ChecklistFieldDefinition,
  CreateChecklistTemplateDto,
  ListChecklistTemplatesParams,
  PaginatedChecklistTemplates,
  ServiceOrderChecklist,
  UpdateChecklistTemplateDto,
} from "./checklist-templates.types";

export const checklistTemplatesService = {
  async list(params?: ListChecklistTemplatesParams): Promise<PaginatedChecklistTemplates> {
    const { data } = await api.get("/checklist-templates", { params });
    return data;
  },

  async getById(id: string): Promise<ChecklistTemplate> {
    const { data } = await api.get(`/checklist-templates/${id}`);
    return data;
  },

  async create(dto: CreateChecklistTemplateDto): Promise<ChecklistTemplate> {
    const { data } = await api.post("/checklist-templates", dto);
    return data;
  },

  async update(id: string, dto: UpdateChecklistTemplateDto): Promise<ChecklistTemplate> {
    const { data } = await api.patch(`/checklist-templates/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/checklist-templates/${id}`);
  },

  async clone(id: string): Promise<ChecklistTemplate> {
    const { data } = await api.post(`/checklist-templates/${id}/clone`);
    return data;
  },

  // ── Checklist na OS ──────────────────────────────────────────────────────────

  async getChecklist(clientId: string, serviceOrderId: string): Promise<ServiceOrderChecklist> {
    const { data } = await api.get(`/clients/${clientId}/service-orders/${serviceOrderId}/checklist`);
    return data;
  },

  async fillChecklist(
    clientId: string,
    serviceOrderId: string,
    fields: ChecklistFieldDefinition[],
  ): Promise<ServiceOrderChecklist> {
    const { data } = await api.patch(
      `/clients/${clientId}/service-orders/${serviceOrderId}/checklist/fill`,
      { fields },
    );
    return data;
  },

  async completeChecklist(
    clientId: string,
    serviceOrderId: string,
    fields?: ChecklistFieldDefinition[],
  ): Promise<ServiceOrderChecklist> {
    const { data } = await api.post(
      `/clients/${clientId}/service-orders/${serviceOrderId}/checklist/complete`,
      { fields },
    );
    return data;
  },

  async reopenChecklist(
    clientId: string,
    serviceOrderId: string,
  ): Promise<ServiceOrderChecklist> {
    const { data } = await api.post(
      `/clients/${clientId}/service-orders/${serviceOrderId}/checklist/reopen`,
    );
    return data;
  },
};
