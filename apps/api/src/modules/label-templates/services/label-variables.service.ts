import { Injectable } from '@nestjs/common'
import {
  EquipmentCriticality, LabelReferenceType, MaintenanceType, ServiceOrderStatus,
} from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { getFrontendUrl } from '../../../config/app.config'
import { recurrenceLabel } from '../../maintenance/schedule/recurrence.util'

// Quantas preventivas concluídas listar na variável {preventivas_realizadas}
const PREVENTIVE_HISTORY_LIMIT = 6

// Teto de OS preventivas buscadas para a tabela (o maxRows do elemento afina depois)
const OS_TABLE_QUERY_LIMIT = 50

// Rótulos pt-BR para o status da OS (usado na tabela de preventivas)
const SERVICE_ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  COMPLETED_APPROVED: 'Aprovada',
  COMPLETED_REJECTED: 'Reprovada',
  CANCELLED: 'Cancelada',
  AWAITING_PICKUP: 'Aguardando retirada',
}

// Rótulos pt-BR para a criticidade do equipamento
const EQUIPMENT_CRITICALITY_LABELS: Record<EquipmentCriticality, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

/** Formata uma data (ou null) como dd/mm/aaaa em pt-BR, ou string vazia. */
function formatDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''
}

/** Formata um valor Decimal/número (ou null) como moeda BRL, ou string vazia. */
function formatCurrency(value: unknown): string {
  if (value === null || value === undefined) return ''
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Uma linha da tabela de OS preventivas (valores já formatados como texto). */
export type PreventiveOsRow = Record<
  'number' | 'createdAt' | 'description' | 'status' | 'client' | 'technician',
  string
>

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

// Etiquetas avulsas não têm entidade — logo, não há {qr_url} (o QR usa texto livre).
const STANDALONE_VARIABLES: LabelVariable[] = COMMON_VARIABLES.filter(
  (v) => v.key !== '{qr_url}',
)

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
  { key: '{equipment_criticality}', label: 'Criticidade' },
  { key: '{equipment_cost_center}', label: 'Centro de custo' },
  { key: '{equipment_purchase_date}', label: 'Data de compra' },
  { key: '{equipment_purchase_value}', label: 'Valor de compra' },
  { key: '{equipment_warranty_end}', label: 'Fim da garantia' },
  { key: '{equipment_voltage}', label: 'Voltagem' },
  { key: '{equipment_power}', label: 'Potência' },
  { key: '{equipment_ip}', label: 'Endereço IP' },
  { key: '{equipment_observations}', label: 'Observações' },
  { key: '{proxima_preventiva}', label: 'Próxima preventiva agendada' },
  { key: '{preventivas_realizadas}', label: 'Preventivas realizadas (data · recorrência)' },
]

const SERVICE_ORDER_VARIABLES: LabelVariable[] = [
  { key: '{service_order_number}', label: 'Nº da OS' },
  { key: '{service_order_title}', label: 'Título da OS' },
  { key: '{service_order_type}', label: 'Tipo de manutenção' },
  { key: '{service_order_status}', label: 'Status da OS' },
  { key: '{service_order_client}', label: 'Prestador' },
  { key: '{service_order_technician}', label: 'Técnico' },
  ...EQUIPMENT_VARIABLES,
]

@Injectable()
export class LabelVariablesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista as variáveis disponíveis para um tipo de referência (para a UI). */
  getAvailableVariables(referenceType: LabelReferenceType): LabelVariable[] {
    if (referenceType === LabelReferenceType.STANDALONE) {
      return [...STANDALONE_VARIABLES]
    }
    const specific =
      referenceType === LabelReferenceType.EQUIPMENT
        ? EQUIPMENT_VARIABLES
        : SERVICE_ORDER_VARIABLES
    return [...specific, ...COMMON_VARIABLES]
  }

  /** URL apontada pelo QR, por tipo de referência. */
  private buildQrUrl(referenceType: LabelReferenceType, entityId: string): string {
    const frontendUrl = getFrontendUrl()
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
    // Etiqueta avulsa não aponta para nenhuma entidade — sem {qr_url}.
    if (referenceType !== LabelReferenceType.STANDALONE) {
      vars['{qr_url}'] = this.buildQrUrl(referenceType, entityId)
    }

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
          criticality: true, purchaseDate: true, purchaseValue: true,
          warrantyEnd: true, voltage: true, power: true, ipAddress: true,
          observations: true,
          type: { select: { name: true } },
          subtype: { select: { name: true } },
          location: { select: { name: true } },
          currentLocation: { select: { name: true } },
          costCenter: { select: { name: true } },
        },
      })
      if (eq) this.applyEquipmentVars(vars, eq)
      vars['{proxima_preventiva}'] = await this.buildNextPreventive(companyId, entityId)
      vars['{preventivas_realizadas}'] = await this.buildPreventiveHistory(companyId, entityId)
    }

    if (referenceType === LabelReferenceType.SERVICE_ORDER) {
      const so = await this.prisma.serviceOrder.findFirst({
        where: { id: entityId, companyId, deletedAt: null },
        select: {
          number: true, title: true, maintenanceType: true, status: true,
          equipmentId: true,
          client: { select: { reportName: true, name: true } },
          technicians: {
            select: { technician: { select: { name: true } } },
            orderBy: { assignedAt: 'asc' },
          },
          equipment: {
            select: {
              name: true, brand: true, model: true, serialNumber: true,
              patrimonyNumber: true, anvisaNumber: true, status: true,
              criticality: true, purchaseDate: true, purchaseValue: true,
              warrantyEnd: true, voltage: true, power: true, ipAddress: true,
              observations: true,
              type: { select: { name: true } },
              subtype: { select: { name: true } },
              location: { select: { name: true } },
              currentLocation: { select: { name: true } },
              costCenter: { select: { name: true } },
            },
          },
        },
      })
      if (so) {
        vars['{service_order_number}'] = String(so.number)
        vars['{service_order_title}'] = so.title ?? ''
        vars['{service_order_type}'] = so.maintenanceType ?? ''
        vars['{service_order_status}'] = so.status ?? ''
        vars['{service_order_client}'] = so.client?.reportName || so.client?.name || ''
        vars['{service_order_technician}'] = so.technicians
          .map((t) => t.technician?.name)
          .filter(Boolean)
          .join(', ')
        if (so.equipment) this.applyEquipmentVars(vars, so.equipment)
        if (so.equipmentId) {
          vars['{proxima_preventiva}'] = await this.buildNextPreventive(companyId, so.equipmentId)
          vars['{preventivas_realizadas}'] = await this.buildPreventiveHistory(companyId, so.equipmentId)
        }
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
    vars['{equipment_criticality}'] = eq.criticality
      ? (EQUIPMENT_CRITICALITY_LABELS[eq.criticality as EquipmentCriticality] ?? eq.criticality)
      : ''
    vars['{equipment_cost_center}'] = eq.costCenter?.name ?? ''
    vars['{equipment_purchase_date}'] = formatDate(eq.purchaseDate)
    vars['{equipment_purchase_value}'] = formatCurrency(eq.purchaseValue)
    vars['{equipment_warranty_end}'] = formatDate(eq.warrantyEnd)
    vars['{equipment_voltage}'] = eq.voltage ?? ''
    vars['{equipment_power}'] = eq.power ?? ''
    vars['{equipment_ip}'] = eq.ipAddress ?? ''
    vars['{equipment_observations}'] = eq.observations ?? ''
  }

  /**
   * Monta o histórico de preventivas concluídas do equipamento — uma linha por
   * manutenção, no formato "dd/mm/aaaa · Recorrência", da mais recente para a mais
   * antiga. A recorrência vem do agendamento (MaintenanceSchedule) que originou a
   * OS; preventivas avulsas (sem agendamento) exibem apenas a data.
   */
  private async buildPreventiveHistory(companyId: string, equipmentId: string): Promise<string> {
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        companyId,
        equipmentId,
        deletedAt: null,
        maintenanceType: MaintenanceType.PREVENTIVE,
        status: { in: [ServiceOrderStatus.COMPLETED, ServiceOrderStatus.COMPLETED_APPROVED] },
        completedAt: { not: null },
      },
      select: {
        completedAt: true,
        maintenance: {
          select: {
            schedule: { select: { recurrenceType: true, customIntervalDays: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: PREVENTIVE_HISTORY_LIMIT,
    })

    return orders
      .map((os) => {
        const date =
          os.completedAt?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) ?? ''
        const schedule = os.maintenance?.schedule
        const recurrence = schedule
          ? recurrenceLabel(schedule.recurrenceType, schedule.customIntervalDays ?? undefined)
          : ''
        return recurrence ? `${date} · ${recurrence}` : date
      })
      .join('\n')
  }

  /**
   * Data da próxima preventiva agendada do equipamento (dd/mm/aaaa), a partir do
   * agendamento ativo com `nextRunAt` mais próximo. Retorna '' se não houver.
   */
  private async buildNextPreventive(companyId: string, equipmentId: string): Promise<string> {
    const schedule = await this.prisma.maintenanceSchedule.findFirst({
      where: { companyId, equipmentId, isActive: true },
      select: { nextRunAt: true },
      orderBy: { nextRunAt: 'asc' },
    })
    return formatDate(schedule?.nextRunAt)
  }

  /** Descobre o equipmentId a partir da entidade da etiqueta (equipamento ou OS). */
  private async resolveEquipmentId(
    companyId: string,
    referenceType: LabelReferenceType,
    entityId: string,
  ): Promise<string | null> {
    if (referenceType === LabelReferenceType.EQUIPMENT) return entityId
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: entityId, companyId, deletedAt: null },
      select: { equipmentId: true },
    })
    return so?.equipmentId ?? null
  }

  /**
   * Linhas da tabela de OS preventivas do equipamento — todas as OS de manutenção
   * preventiva (qualquer status), da mais recente para a mais antiga. Os valores já
   * saem formatados (data pt-BR, status traduzido) prontos para desenhar no PDF.
   */
  async resolvePreventiveOsRows(
    companyId: string,
    referenceType: LabelReferenceType,
    entityId: string,
  ): Promise<PreventiveOsRow[]> {
    const equipmentId = await this.resolveEquipmentId(companyId, referenceType, entityId)
    if (!equipmentId) return []

    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        companyId,
        equipmentId,
        deletedAt: null,
        maintenanceType: MaintenanceType.PREVENTIVE,
      },
      select: {
        number: true, createdAt: true, description: true, status: true,
        client: { select: { reportName: true, name: true } },
        technicians: {
          select: { technician: { select: { name: true } } },
          orderBy: { assignedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: OS_TABLE_QUERY_LIMIT,
    })

    return orders.map((os) => ({
      number: String(os.number),
      createdAt: os.createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      description: os.description ?? '',
      status: SERVICE_ORDER_STATUS_LABELS[os.status] ?? os.status,
      client: os.client?.reportName || os.client?.name || '',
      technician: os.technicians
        .map((t) => t.technician?.name)
        .filter(Boolean)
        .join(', '),
    }))
  }

  /** Substitui {variavel} pelo valor resolvido (mantém o token se não houver valor). */
  interpolate(text: string, vars: Record<string, string>): string {
    if (!text) return ''
    return text.replace(/\{[\w_]+\}/g, (match) => vars[match] ?? '')
  }
}
