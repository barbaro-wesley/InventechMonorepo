import { formatDurationHours, formatDurationDetailed } from '@/lib/sla'
import type {
  ServiceOrderStatus,
  ServiceOrderPriority,
  MaintenanceType,
} from '@/services/service-orders/service-orders.types'

// ─── Status ───────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  ServiceOrderStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  AWAITING_PICKUP: {
    label: 'No Painel',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900',
    dot: 'bg-orange-500',
  },
  OPEN: {
    label: 'Atribuída',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
    dot: 'bg-blue-500',
  },
  IN_PROGRESS: {
    label: 'Em Andamento',
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900',
    dot: 'bg-indigo-500',
  },
  COMPLETED: {
    label: 'Aguard. Aprovação',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
    dot: 'bg-amber-500',
  },
  COMPLETED_APPROVED: {
    label: 'Aprovada',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900',
    dot: 'bg-emerald-500',
  },
  COMPLETED_REJECTED: {
    label: 'Reprovada',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    dot: 'bg-red-500',
  },
  CANCELLED: {
    label: 'Cancelada',
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-400',
  },
}

// ─── Priority ─────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<
  ServiceOrderPriority,
  { label: string; color: string; bar: string; badge: string }
> = {
  LOW: {
    label: 'Baixa',
    color: 'text-slate-500 dark:text-slate-400',
    bar: 'bg-slate-400',
    badge: 'bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
  },
  MEDIUM: {
    label: 'Média',
    color: 'text-blue-600 dark:text-blue-400',
    bar: 'bg-blue-500',
    badge: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900',
  },
  HIGH: {
    label: 'Alta',
    color: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
    badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  },
  URGENT: {
    label: 'Urgente',
    color: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
    badge: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900',
  },
}

// ─── Maintenance Type ─────────────────────────────────────────

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  PREVENTIVE: 'Preventiva',
  CORRECTIVE: 'Corretiva',
  INITIAL_ACCEPTANCE: 'Aceitação Inicial',
  EXTERNAL_SERVICE: 'Serviço Externo',
  TECHNOVIGILANCE: 'Tecnovigilância',
  TRAINING: 'Treinamento',
  IMPROPER_USE: 'Uso Indevido',
  DEACTIVATION: 'Desativação',
}

// ─── Time helpers ─────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'ontem'
  return `há ${diffDays} dias`
}

export function formatDuration(startStr: string, endStr?: string | null): string {
  const start = new Date(startStr)
  const end = endStr ? new Date(endStr) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const diffHours = Math.floor(diffMs / 3600000)
  const diffMin = Math.floor((diffMs % 3600000) / 60000)

  if (diffHours === 0) return `${diffMin}min`
  if (diffMin === 0) return `${diffHours}h`
  return `${diffHours}h ${diffMin}min`
}

// ─── TPA (primeiro atendimento) ───────────────────────────────────────────────
// Métrica independente do prazo de conclusão: uma OS pode concluir no prazo e
// ainda assim ter estourado o TPA. O estouro vem de slaResponseBreachedAt, campo
// gravado no backend e nunca limpo — não dá para inferir de slaStatus, que é
// recalculado e volta a ON_TIME quando a OS inicia.

export interface TpaInfo {
  /** Texto pronto para exibição, já com a duração formatada. */
  label: string
  breached: boolean
  /** Ainda em aberto, sem estouro: o relógio está correndo. */
  pending: boolean
}

export function getTpaInfo(os: {
  createdAt: string
  startedAt?: string | null
  slaResponseDueDate?: string | null
  slaResponseBreachedAt?: string | null
}): TpaInfo | null {
  // Sem prazo de TPA configurado para o tipo/prioridade da OS.
  if (!os.slaResponseDueDate) return null

  const created = new Date(os.createdAt).getTime()
  const due = new Date(os.slaResponseDueDate).getTime()

  if (os.slaResponseBreachedAt) {
    if (os.startedAt) {
      const atraso = new Date(os.startedAt).getTime() - due
      return {
        label: `estourado (atendido ${formatDurationDetailed(atraso)} após o prazo)`,
        breached: true,
        pending: false,
      }
    }
    return {
      label: `estourado há ${formatDurationDetailed(Date.now() - due)}, sem atendimento`,
      breached: true,
      pending: false,
    }
  }

  if (os.startedAt) {
    const levou = new Date(os.startedAt).getTime() - created
    return { label: `cumprido em ${formatDurationDetailed(levou)}`, breached: false, pending: false }
  }

  return {
    label: `vence em ${formatDurationDetailed(due - Date.now())}`,
    breached: false,
    pending: true,
  }
}

// ─── SLA derivado ─────────────────────────────────────────────────────────────
// Não há campo formal de prazo na OS; deriva de scheduledFor ou (criada + alertAfterHours).

export interface SlaInfo {
  label: string
  sub: string
  prazoFinal: string
  pct: number
  late: boolean
  totalDurationStr: string
  timeLeftStr: string
  mainDisplayTime: string
}

export function getSlaInfo(os: {
  scheduledFor?: string | null
  alertAfterHours?: number | null
  createdAt: string
  completedAt?: string | null
  slaResolutionDueDate?: string | null
}): SlaInfo | null {
  let deadline: Date | null = null
  if (os.slaResolutionDueDate) deadline = new Date(os.slaResolutionDueDate)
  else if (os.scheduledFor) deadline = new Date(os.scheduledFor)
  else if (os.alertAfterHours) deadline = new Date(new Date(os.createdAt).getTime() + os.alertAfterHours * 3_600_000)
  if (!deadline) return null

  const start = new Date(os.createdAt).getTime()
  const now = os.completedAt ? new Date(os.completedAt).getTime() : Date.now()

  const totalMs = deadline.getTime() - start
  const elapsedMs = now - start
  const msLeft = deadline.getTime() - now

  const late = msLeft < 0
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 100

  const totalDurationStr = formatDurationHours(Math.max(1, totalMs / 3_600_000))
  const mainDisplayTime = formatDurationDetailed(msLeft)
  const timeLeftStr = `${mainDisplayTime} ${late ? 'em atraso' : 'restantes'}`

  return {
    label: late ? 'Atrasada' : 'Dentro do prazo',
    sub: timeLeftStr,
    prazoFinal: deadline.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    pct,
    late,
    totalDurationStr,
    timeLeftStr,
    mainDisplayTime,
  }
}

// ─── Valid status transitions (mirrors backend rules) ────────────────────────

export const VALID_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  AWAITING_PICKUP: ['IN_PROGRESS', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['COMPLETED_APPROVED', 'COMPLETED_REJECTED'],
  COMPLETED_APPROVED: [],
  COMPLETED_REJECTED: ['OPEN'],
  CANCELLED: [],
}

// ─── Kanban columns config ────────────────────────────────────

export const KANBAN_COLUMNS: {
  status: ServiceOrderStatus
  label: string
  headerColor: string
  countBg: string
}[] = [
  {
    status: 'AWAITING_PICKUP',
    label: 'No Painel',
    headerColor: 'border-t-orange-400',
    countBg: 'bg-orange-100 text-orange-700',
  },
  {
    status: 'OPEN',
    label: 'Atribuídas',
    headerColor: 'border-t-blue-400',
    countBg: 'bg-blue-100 text-blue-700',
  },
  {
    status: 'IN_PROGRESS',
    label: 'Em Andamento',
    headerColor: 'border-t-indigo-400',
    countBg: 'bg-indigo-100 text-indigo-700',
  },
  {
    status: 'COMPLETED',
    label: 'Aguard. Aprovação',
    headerColor: 'border-t-amber-400',
    countBg: 'bg-amber-100 text-amber-700',
  },
  {
    status: 'COMPLETED_APPROVED',
    label: 'Encerradas',
    headerColor: 'border-t-emerald-400',
    countBg: 'bg-emerald-100 text-emerald-700',
  },
]
