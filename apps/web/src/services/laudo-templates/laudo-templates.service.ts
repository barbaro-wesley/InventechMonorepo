import { api } from "@/lib/api";
import type {
  LaudoTemplate,
  CreateLaudoTemplateDto,
  UpdateLaudoTemplateDto,
  ListLaudoTemplatesParams,
} from "./laudo-templates.types";

export interface PaginatedTemplates {
  data: LaudoTemplate[];
  total: number;
  page: number;
  limit: number;
}

export const laudoTemplatesService = {
  async list(params?: ListLaudoTemplatesParams): Promise<PaginatedTemplates> {
    const { data } = await api.get("/laudo-templates", { params });
    return data;
  },

  async getById(id: string): Promise<LaudoTemplate> {
    const { data } = await api.get(`/laudo-templates/${id}`);
    return data;
  },

  async create(dto: CreateLaudoTemplateDto): Promise<LaudoTemplate> {
    const { data } = await api.post("/laudo-templates", dto);
    return data;
  },

  async update(id: string, dto: UpdateLaudoTemplateDto): Promise<LaudoTemplate> {
    const { data } = await api.patch(`/laudo-templates/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/laudo-templates/${id}`);
  },

  async clone(id: string): Promise<LaudoTemplate> {
    const { data } = await api.post(`/laudo-templates/${id}/clone`);
    return data;
  },

  async getVariables(): Promise<{ variables: string[] }> {
    const { data } = await api.get("/laudo-templates/variables");
    return data;
  },
};
