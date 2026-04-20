import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { LaudoFieldDefinition } from '../dto/laudo.dto'

export const AVAILABLE_VARIABLES = [
  '{equipment_name}', '{equipment_model}', '{equipment_brand}',
  '{equipment_serial}', '{equipment_patrimony}', '{equipment_location}',
  '{equipment_type}', '{equipment_status}',
  '{client_name}', '{client_document}', '{client_phone}', '{client_email}',
  '{company_name}', '{company_document}',
  '{technician_name}', '{technician_email}',
  '{service_order_number}', '{service_order_title}', '{service_order_type}', '{service_order_status}',
  '{maintenance_type}', '{maintenance_title}', '{maintenance_scheduled_at}',
  '{date_today}', '{datetime_now}', '{year}', '{month}',
] as const

interface ResolveContext {
  companyId: string
  clientId?: string | null
  serviceOrderId?: string | null
  maintenanceId?: string | null
  technicianId?: string | null
}

@Injectable()
export class LaudoVariablesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(context: ResolveContext): Promise<Record<string, string>> {
    const vars: Record<string, string> = {}

    const now = new Date()
    vars['{date_today}'] = now.toLocaleDateString('pt-BR')
    vars['{datetime_now}'] = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    vars['{year}'] = String(now.getFullYear())
    vars['{month}'] = String(now.getMonth() + 1).padStart(2, '0')

    const company = await this.prisma.company.findUnique({
      where: { id: context.companyId },
      select: { name: true, document: true },
    })
    if (company) {
      vars['{company_name}'] = company.name ?? ''
      vars['{company_document}'] = company.document ?? ''
    }

    if (context.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: context.clientId, companyId: context.companyId, deletedAt: null },
        select: { name: true, document: true, phone: true, email: true },
      })
      if (client) {
        vars['{client_name}'] = client.name ?? ''
        vars['{client_document}'] = client.document ?? ''
        vars['{client_phone}'] = client.phone ?? ''
        vars['{client_email}'] = client.email ?? ''
      }
    }

    if (context.technicianId) {
      const tech = await this.prisma.user.findFirst({
        where: { id: context.technicianId },
        select: { name: true, email: true },
      })
      if (tech) {
        vars['{technician_name}'] = tech.name ?? ''
        vars['{technician_email}'] = tech.email ?? ''
      }
    }

    if (context.serviceOrderId) {
      const so = await this.prisma.serviceOrder.findFirst({
        where: { id: context.serviceOrderId, companyId: context.companyId },
        select: {
          number: true, title: true, maintenanceType: true, status: true,
          equipment: {
            select: {
              name: true, model: true, brand: true, serialNumber: true,
              patrimonyNumber: true, type: { select: { name: true } },
              currentLocation: { select: { name: true } },
              status: true,
            },
          },
        },
      })
      if (so) {
        vars['{service_order_number}'] = String(so.number)
        vars['{service_order_title}'] = so.title ?? ''
        vars['{service_order_type}'] = so.maintenanceType ?? ''
        vars['{service_order_status}'] = so.status ?? ''
        if (so.equipment) {
          const eq = so.equipment
          vars['{equipment_name}'] = eq.name ?? ''
          vars['{equipment_model}'] = eq.model ?? ''
          vars['{equipment_brand}'] = eq.brand ?? ''
          vars['{equipment_serial}'] = eq.serialNumber ?? ''
          vars['{equipment_patrimony}'] = eq.patrimonyNumber ?? ''
          vars['{equipment_location}'] = eq.currentLocation?.name ?? ''
          vars['{equipment_type}'] = eq.type?.name ?? ''
          vars['{equipment_status}'] = eq.status ?? ''
        }
      }
    }

    if (context.maintenanceId) {
      const maint = await this.prisma.maintenance.findFirst({
        where: { id: context.maintenanceId, companyId: context.companyId },
        select: {
          type: true, title: true, scheduledAt: true,
          equipment: {
            select: {
              name: true, model: true, brand: true, serialNumber: true,
              patrimonyNumber: true, type: { select: { name: true } },
              currentLocation: { select: { name: true } },
              status: true,
            },
          },
        },
      })
      if (maint) {
        vars['{maintenance_type}'] = maint.type ?? ''
        vars['{maintenance_title}'] = maint.title ?? ''
        vars['{maintenance_scheduled_at}'] = maint.scheduledAt
          ? maint.scheduledAt.toLocaleDateString('pt-BR')
          : ''
        if (maint.equipment && !vars['{equipment_name}']) {
          const eq = maint.equipment
          vars['{equipment_name}'] = eq.name ?? ''
          vars['{equipment_model}'] = eq.model ?? ''
          vars['{equipment_brand}'] = eq.brand ?? ''
          vars['{equipment_serial}'] = eq.serialNumber ?? ''
          vars['{equipment_patrimony}'] = eq.patrimonyNumber ?? ''
          vars['{equipment_location}'] = eq.currentLocation?.name ?? ''
          vars['{equipment_type}'] = eq.type?.name ?? ''
          vars['{equipment_status}'] = eq.status ?? ''
        }
      }
    }

    return vars
  }

  applyVariablesToFields(
    fields: LaudoFieldDefinition[],
    vars: Record<string, string>,
  ): LaudoFieldDefinition[] {
    return fields.map((field) => {
      if (!field.variable) return field

      // If the user already filled in a value, preserve it.
      // Only auto-fill from variable when value is empty/null/undefined.
      const hasUserValue =
        field.value !== undefined &&
        field.value !== null &&
        field.value !== ''

      if (hasUserValue) return field

      const resolved = vars[field.variable] ?? ''
      return { ...field, value: resolved }
    })
  }

  interpolate(text: string, vars: Record<string, string>): string {
    return text.replace(/\{[\w_]+\}/g, (match) => vars[match] ?? match)
  }
}
