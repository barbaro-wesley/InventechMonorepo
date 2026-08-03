import { api } from "@/lib/api";
import type {
  LabelTemplate,
  CreateLabelTemplateDto,
  UpdateLabelTemplateDto,
  ListLabelTemplatesParams,
  PaginatedLabelTemplates,
  LabelReferenceType,
  LabelVariable,
  RenderSheetParams,
} from "./label-templates.types";

export const labelTemplatesService = {
  async list(params?: ListLabelTemplatesParams): Promise<PaginatedLabelTemplates> {
    const { data } = await api.get("/label-templates", { params });
    return data;
  },

  async getById(id: string): Promise<LabelTemplate> {
    const { data } = await api.get(`/label-templates/${id}`);
    return data;
  },

  async create(dto: CreateLabelTemplateDto): Promise<LabelTemplate> {
    const { data } = await api.post("/label-templates", dto);
    return data;
  },

  async update(id: string, dto: UpdateLabelTemplateDto): Promise<LabelTemplate> {
    const { data } = await api.patch(`/label-templates/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/label-templates/${id}`);
  },

  async clone(id: string): Promise<LabelTemplate> {
    const { data } = await api.post(`/label-templates/${id}/clone`);
    return data;
  },

  async getVariables(referenceType: LabelReferenceType): Promise<LabelVariable[]> {
    const { data } = await api.get("/label-templates/variables", {
      params: { referenceType },
    });
    return data.variables;
  },

  /** URL do PDF de uma etiqueta (para abrir/imprimir). */
  getRenderUrl(id: string, entityId: string): string {
    const baseUrl = api.defaults.baseURL || "http://localhost:3000/api/v1";
    return `${baseUrl}/label-templates/${id}/render?entityId=${encodeURIComponent(entityId)}`;
  },

  /** Abre o PDF de várias etiquetas em uma nova aba. */
  async openBatch(id: string, entityIds: string[]): Promise<void> {
    const { data } = await api.post(
      `/label-templates/${id}/render-batch`,
      { entityIds },
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  /** Abre o PDF de uma folha (A4/A3/A5) com várias etiquetas — avulsas ou por entidade. */
  async printSheet(id: string, params: RenderSheetParams): Promise<void> {
    const { data } = await api.post(
      `/label-templates/${id}/render-sheet`,
      params,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
