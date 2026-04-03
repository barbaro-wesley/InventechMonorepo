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
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    dot: 'bg-orange-500',
  },
  OPEN: {
    label: 'Atribuída',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
  },
  IN_PROGRESS: {
    label: 'Em Andamento',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  COMPLETED: {
    label: 'Aguard. Aprovação',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
  },
  COMPLETED_APPROVED: {
    label: 'Aprovada',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  COMPLETED_REJECTED: {
    label: 'Reprovada',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    dot: 'bg-red-500',
  },
  CANCELLED: {
    label: 'Cancelada',
    color: 'text-slate-500',
    bg: 'bg-slate-50 border-slate-200',
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
    color: 'text-slate-500',
    bar: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  MEDIUM: {
    label: 'Média',
    color: 'text-blue-600',
    bar: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  HIGH: {
    label: 'Alta',
    color: 'text-amber-600',
    bar: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  URGENT: {
    label: 'Urgente',
    color: 'text-red-600',
    bar: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
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
