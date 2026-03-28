import type { ClientStatus } from '../enums/client.enum';

export interface ClientAddress {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  status: ClientStatus;
  address?: ClientAddress | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    equipments: number;
    serviceOrders: number;
    users: number;
  };
}

export interface CreateClientAdminDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface CreateClientDto {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  status?: ClientStatus;
  address?: ClientAddress;
  /** Usado pelo SUPER_ADMIN para criar clientes em outras empresas */
  companyId?: string;
  /** Administrador inicial do cliente — criado junto na mesma transação */
  admin: CreateClientAdminDto;
}

export interface UpdateClientDto {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  status?: ClientStatus;
  address?: ClientAddress;
}

export interface ListClientsParams {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
}
