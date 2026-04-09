import { api } from "@/lib/api";
import type {
  Client,
  CreateClientDto,
  UpdateClientDto,
  ListClientsParams,
} from "@/types/client";
import type { PaginatedResponse } from "@/types/user";

export interface CreateClientResponse {
  client: Client;
  admin: { id: string; name: string; email: string; role: string };
}

export const clientsService = {
  async list(params?: ListClientsParams): Promise<PaginatedResponse<Client>> {
    const { data } = await api.get("/clients", { params });
    return data;
  },

  async getById(id: string): Promise<Client> {
    const { data } = await api.get(`/clients/${id}`);
    return data;
  },

  async create(dto: CreateClientDto): Promise<CreateClientResponse> {
    const { data } = await api.post("/clients", dto);
    return data;
  },

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const { data } = await api.patch(`/clients/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  async uploadLogo(
    clientId: string,
    file: File
  ): Promise<{ logoUrl: string }> {
    const form = new FormData();
    form.append("logo", file);
    const { data } = await api.post(`/clients/${clientId}/logo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async listMaintenanceGroups(clientId: string): Promise<ClientMaintenanceGroupAssignment[]> {
    const { data } = await api.get(`/clients/${clientId}/maintenance-groups`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async assignMaintenanceGroup(clientId: string, groupId: string): Promise<void> {
    await api.post(`/clients/${clientId}/maintenance-groups/${groupId}`);
  },

  async removeMaintenanceGroup(clientId: string, groupId: string): Promise<void> {
    await api.delete(`/clients/${clientId}/maintenance-groups/${groupId}`);
  },

  async listAvailablePlatformUsers(clientId: string): Promise<PlatformUser[]> {
    const { data } = await api.get(`/clients/${clientId}/platform-users/available`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async linkPlatformUser(clientId: string, userId: string): Promise<void> {
    await api.post(`/clients/${clientId}/platform-users/${userId}`);
  },

  async unlinkPlatformUser(clientId: string, userId: string): Promise<void> {
    await api.delete(`/clients/${clientId}/platform-users/${userId}`);
  },
};

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

export interface ClientMaintenanceGroupAssignment {
  id: string;
  isActive: boolean;
  assignedAt: string;
  group: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    isActive: boolean;
    equipmentTypes: { id: string; name: string }[];
  };
}