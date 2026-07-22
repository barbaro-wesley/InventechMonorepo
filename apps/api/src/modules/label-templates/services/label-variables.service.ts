import { Injectable } from '@nestjs/common'
import { LabelReferenceType } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'

export interface LabelVariable {
  key: string
  label: string
}

// Variáveis comuns a qualquer tipo de etiqueta
const COMMON_VARIABLES: LabelVariable[] = [
  { key: '{company_name}', label: 'Nome da empresa' },
  { key: '{company_document}', label: 'CNPJ da empresa' },
  { key: '{date_today}', label: 'Data de hoje' },
  { key: '{datetime_now}', label: 'Data e hora' },
  { key: '{year}', label: 'Ano' },
  { key: '{month}', label: 'Mês' },
  { key: '{qr_url}', label: 'URL do QR (link do item)' },
]

const EQUIPMENT_VARIABLES: LabelVariable[] = [
  { key: '{equipment_name}', label: 'Nome do equipamento' },
  { key: '{equipment_patrimony}', label: 'Nº de patrimônio' },
  { key: '{equipment_serial}', label: 'Nº de série' },
  { key: '{equipment_anvisa}', label: 'Nº ANVISA' },
  { key: '{equipment_brand}', label: 'Marca' },
  { key: '{equipment_model}', label: 'Modelo' },
  { key: '{equipment_type}', label: 'Tipo' },
  { key: '{equipment_subtype}', label: 'Subtipo' },
  { key: '{equipment_location}', label: 'Localização' },
  { key: '{equipment_status}', label: 'Status' },
]

const SERVICE_ORDER_VARIABLES: LabelVariable[] = [
  { key: '{service_order_number}', label: 'Nº da OS' },
  { key: '{service_order_title}', label: 'Título da OS' },
  { key: '{service_order_type}', label: 'Tipo de manutenção' },
  { key: '{service_order_status}', label: 'Status da OS' },
  ...EQUIPMENT_VARIABLES,
]

@Injectable()
export class LabelVariablesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista as variáveis disponíveis para um tipo de referência (para a UI). */
  getAvailableVariables(referenceType: LabelReferenceType): LabelVariable[] {
    const specific =
      referenceType === LabelReferenceType.EQUIPMENT
        ? EQUIPMENT_VARIABLES
        : SERVICE_ORDER_VARIABLES
    return [...specific, ...COMMON_VARIABLES]
  }

  /** URL apontada pelo QR, por tipo de referência. */
  private buildQrUrl(referenceType: LabelReferenceType, entityId: string): string {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001'
    if (referenceType === LabelReferenceType.SERVICE_ORDER)
      return `${frontendUrl}/minhas-os?detail=${entityId}`
    return `${frontendUrl}/equipamentos?detail=${entityId}`
  }

  /** Resolve os valores das variáveis para uma entidade concreta. */
  async resolve(
    companyId: string,
    referenceType: LabelReferenceType,
    entityId: string,
  ): Promise<Record<string, string>> {
    const vars: Record<string, string> = {}

    const now = new Date()
    vars['{date_today}'] = now.toLocaleDateString('pt-BR')
    vars['{datetime_now}'] = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    vars['{year}'] = String(now.getFullYear())
    vars['{month}'] = String(now.getMonth() + 1).padStart(2, '0')
    vars['{qr_url}'] = this.buildQrUrl(referenceType, entityId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, document: true },
    })
    if (company) {
      vars['{company_name}'] = company.name ?? ''
      vars['{company_document}'] = company.document ?? ''
    }

    if (referenceType === LabelReferenceType.EQUIPMENT) {
      const eq = await this.prisma.equipment.findFirst({
        where: { id: entityId, companyId, deletedAt: null },
        select: {
          name: true, brand: true, model: true, serialNumber: true,
          patrimonyNumber: true, anvisaNumber: true, status: true,
          type: { select: { name: true } },
          subtype: { select: { name: true } },
          location: { select: { name: true } },
          currentLocation: { select: { name: true } },
        },
      })
      if (eq) this.applyEquipmentVars(vars, eq)
    }

    if (referenceType === LabelReferenceType.SERVICE_ORDER) {
      const so = await this.prisma.serviceOrder.findFirst({
        where: { id: entityId, companyId, deletedAt: null },
        select: {
          number: true, title: true, maintenanceType: true, status: true,
          equipment: {
            select: {
              name: true, brand: true, model: true, serialNumber: true,
              patrimonyNumber: true, anvisaNumber: true, status: true,
              type: { select: { name: true } },
              subtype: { select: { name: true } },
              location: { select: { name: true } },
              currentLocation: { select: { name: true } },
            },
          },
        },
      })
      if (so) {
        vars['{service_order_number}'] = String(so.number)
        vars['{service_order_title}'] = so.title ?? ''
        vars['{service_order_type}'] = so.maintenanceType ?? ''
        vars['{service_order_status}'] = so.status ?? ''
        if (so.equipment) this.applyEquipmentVars(vars, so.equipment)
      }
    }

    return vars
  }

  private applyEquipmentVars(vars: Record<string, string>, eq: any): void {
    vars['{equipment_name}'] = eq.name ?? ''
    vars['{equipment_brand}'] = eq.brand ?? ''
    vars['{equipment_model}'] = eq.model ?? ''
    vars['{equipment_serial}'] = eq.serialNumber ?? ''
    vars['{equipment_patrimony}'] = eq.patrimonyNumber ?? ''
    vars['{equipment_anvisa}'] = eq.anvisaNumber ?? ''
    vars['{equipment_type}'] = eq.type?.name ?? ''
    vars['{equipment_subtype}'] = eq.subtype?.name ?? ''
    vars['{equipment_location}'] = eq.currentLocation?.name ?? eq.location?.name ?? ''
    vars['{equipment_status}'] = eq.status ?? ''
  }

  /** Substitui {variavel} pelo valor resolvido (mantém o token se não houver valor). */
  interpolate(text: string, vars: Record<string, string>): string {
    if (!text) return ''
    return text.replace(/\{[\w_]+\}/g, (match) => vars[match] ?? '')
  }
}
