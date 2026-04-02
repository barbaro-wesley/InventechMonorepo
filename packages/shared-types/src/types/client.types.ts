import type { OrganizationStatus } from '../enums/client.enum';

export interface OrganizationAddress {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  status: OrganizationStatus;
  address?: OrganizationAddress | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    equipments: number;
    serviceOrders: number;
    users: number;
  };
}

export interface CreateOrganizationAdminDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface CreateOrganizationDto {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  status?: OrganizationStatus;
  address?: OrganizationAddress;
  /** Usado pelo SUPER_ADMIN para criar organizações em outros tenants */
  tenantId?: string;
  /** Administrador inicial da organização — criado junto na mesma transação */
  admin: CreateOrganizationAdminDto;
}

export interface UpdateOrganizationDto {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  status?: OrganizationStatus;
  address?: OrganizationAddress;
}

export interface ListOrganizationsParams {
  page?: number;
  limit?: number;
  search?: string;
  tenantId?: string;
}
