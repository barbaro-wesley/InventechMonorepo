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
};