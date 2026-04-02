import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ListClientsDto } from './dto/list-organizations.dto'

export const CLIENT_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  document: true,
  email: true,
  phone: true,
  address: true,
  status: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      equipments: true,
      users: true,
      serviceOrders: true,
    },
  },
} satisfies Prisma.OrganizationSelect

export type SafeClient = Prisma.OrganizationGetPayload<{
  select: typeof CLIENT_SELECT
}>

@Injectable()
export class OrganizationsRepository {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────
  // Busca por ID garantindo que pertence à empresa
  // ─────────────────────────────────────────
  async findById(id: string, tenantId: string): Promise<SafeClient | null> {
    return this.prisma.organization.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: CLIENT_SELECT,
    })
  }

  // ─────────────────────────────────────────
  // Listagem filtrada por empresa (tenant)
  // ─────────────────────────────────────────
  async findMany(
    tenantId: string,
    filters: ListClientsDto,
  ): Promise<{ data: SafeClient[]; total: number; page: number; limit: number }> {
    const { search, status, page = 1, limit = 20 } = filters

    const where: Prisma.OrganizationWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { document: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        select: CLIENT_SELECT,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async create(data: Prisma.OrganizationCreateInput): Promise<SafeClient> {
    return this.prisma.organization.create({
      data,
      select: CLIENT_SELECT,
    })
  }

  async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<SafeClient> {
    return this.prisma.organization.update({
      where: { id },
      data,
      select: CLIENT_SELECT,
    })
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async documentExists(
    document: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<boolean> {
    const client = await this.prisma.organization.findFirst({
      where: {
        document,
        tenantId,
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    })
    return !!client
  }
}