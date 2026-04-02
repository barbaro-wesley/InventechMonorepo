import { api } from "@/lib/api";
import type {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  ListOrganizationsParams,
} from "@/types/client";
import type { PaginatedResponse } from "@/types/user";

export interface CreateOrganizationResponse {
  organization: Organization;
  admin: { id: string; name: string; email: string; role: string };
}

export const organizationsService = {
  async list(params?: ListOrganizationsParams): Promise<PaginatedResponse<Organization>> {
    const { data } = await api.get("/organizations", { params });
    return data;
  },

  async getById(id: string): Promise<Organization> {
    const { data } = await api.get(`/organizations/${id}`);
    return data;
  },

  async create(dto: CreateOrganizationDto): Promise<CreateOrganizationResponse> {
    const { data } = await api.post("/organizations", dto);
    return data;
  },

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const { data } = await api.patch(`/organizations/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/organizations/${id}`);
  },

  async uploadLogo(
    organizationId: string,
    file: File
  ): Promise<{ logoUrl: string }> {
    const form = new FormData();
    form.append("logo", file);
    const { data } = await api.post(`/organizations/${organizationId}/logo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
