'use client'

import { useState } from 'react'
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle,
  XCircle, Loader2, Search, Plus, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useMyServiceOrders, useMyOsStats } from '@/hooks/service-orders/use-service-orders'
import { usePermissions } from '@/hooks/auth/use-permissions'
import { MyOsDetailSheet } from '@/components/service-orders/my-os-detail-sheet'
import type { ServiceOrderStatus, ServiceOrder } from '@/services/service-orders/service-orders.types'

// ─── Labels e estilos ───────────────────────────────────────────────────────

const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  OPEN: 'Aberta',
  AWAITING_PICKUP: 'Ag. Assumção',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
  COMPLETED_APPROVED: 'Aprovada',
  COMPLETED_REJECTED: 'Reprovada',
  CANCELLED: 'Cancelada',
}

const STATUS_BADGE: Record<ServiceOrderStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700',
  AWAITING_PICKUP: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-violet-100 text-violet-700',
  COMPLETED_APPROVED: 'bg-emerald-100 text-emerald-700',
  COMPLETED_REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
}

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

// Tabs de filtro (null = todas)
const STATUS_TABS: { label: string; value: ServiceOrderStatus | null }[] = [
  { label: 'Todas', value: null },
  { label: 'Abertas', value: 'OPEN' },
  { label: 'Em Andamento', value: 'IN_PROGRESS' },
  { label: 'Ag. Aprovação', value: 'COMPLETED' },
  { label: 'Aprovadas', value: 'COMPLETED_APPROVED' },
  { label: 'Reprovadas', value: 'COMPLETED_REJECTED' },
  { label: 'Canceladas', value: 'CANCELLED' },
]

// ─── Cards de stats ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  count: number
  icon: React.ElementType
  color: string
  onClick?: () => void
  active?: boolean
}

function StatCard({ label, count, icon: Icon, color, onClick, active }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 p-4 rounded-xl border text-left transition-all',
        'hover:shadow-md hover:-translate-y-0.5',
        active
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card',
      )}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MinhasOsPage() {
  const { canAccess, isClientLevel } = usePermissions()
  const canCreate = isClientLevel || canAccess('service-order', 'create')
  const [activeStatus, setActiveStatus] = useState<ServiceOrderStatus | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOsId, setSelectedOsId] = useState<string | null>(null)

  const { data: stats } = useMyOsStats()

  const { data: response, isLoading } = useMyServiceOrders({
    status: activeStatus ?? undefined,
    search: search || undefined,
    page,
    limit: 15,
  })

  const orders = response?.data ?? []
  const total = response?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / 15)

  function handleStatusCardClick(status: ServiceOrderStatus | null) {
    setActiveStatus((prev) => (prev === status ? null : status))
    setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  const hasActiveFilter = activeStatus !== null || search !== ''

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Minhas Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe os chamados que você solicitou
          </p>
        </div>
        {canCreate && (
          <Button size="sm" asChild className="shadow-sm">
            <Link href="/minhas-os/nova">
              <Plus className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Novo Chamado</span>
              <span className="sm:hidden">Novo</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Cards de stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <StatCard
            label="Abertas"
            count={stats.OPEN}
            icon={ClipboardList}
            color="bg-slate-500"
            onClick={() => handleStatusCardClick('OPEN')}
            active={activeStatus === 'OPEN'}
          />
          <StatCard
            label="Em Andamento"
            count={stats.IN_PROGRESS}
            icon={Clock}
            color="bg-blue-500"
            onClick={() => handleStatusCardClick('IN_PROGRESS')}
            active={activeStatus === 'IN_PROGRESS'}
          />
          <StatCard
            label="Ag. Aprovação"
            count={stats.COMPLETED}
            icon={AlertTriangle}
            color="bg-violet-500"
            onClick={() => handleStatusCardClick('COMPLETED')}
            active={activeStatus === 'COMPLETED'}
          />
          <StatCard
            label="Aprovadas"
            count={stats.COMPLETED_APPROVED}
            icon={CheckCircle2}
            color="bg-emerald-500"
            onClick={() => handleStatusCardClick('COMPLETED_APPROVED')}
            active={activeStatus === 'COMPLETED_APPROVED'}
          />
          <StatCard
            label="Reprovadas"
            count={stats.COMPLETED_REJECTED}
            icon={XCircle}
            color="bg-red-500"
            onClick={() => handleStatusCardClick('COMPLETED_REJECTED')}
            active={activeStatus === 'COMPLETED_REJECTED'}
          />
          <StatCard
            label="Canceladas"
            count={stats.CANCELLED}
            icon={XCircle}
            color="bg-gray-400"
            onClick={() => handleStatusCardClick('CANCELLED')}
            active={activeStatus === 'CANCELLED'}
          />
        </div>
      )}

      {/* Barra de filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Tabs de status — scroll horizontal no mobile */}
        <div className="flex-1 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          <div className="flex items-center gap-1 min-w-max">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value ?? 'all'}
                type="button"
                onClick={() => { setActiveStatus(tab.value); setPage(1) }}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  activeStatus === tab.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setActiveStatus(null); setSearch(''); setPage(1) }}
                className="ml-1 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Busca */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar chamado..."
            className="pl-8 h-8 text-sm bg-background"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <ClipboardList className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum chamado encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveFilter ? 'Tente ajustar os filtros de busca' : 'Os chamados que você abrir aparecerão aqui'}
            </p>
          </div>
        ) : (
          <>
            {/* Cabeçalho da tabela */}
            <div className="hidden sm:grid sm:grid-cols-[3rem_1fr_8rem_6rem_2rem] gap-x-3 px-4 py-2.5 border-b border-border bg-muted/40">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">#</span>
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Chamado</span>
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Status</span>
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Prioridade</span>
              <span />
            </div>

            {/* Linhas — desktop */}
            <div className="divide-y divide-border/60">
              {orders.map((os: ServiceOrder) => {
                const subline = [os.equipment?.name, os.client?.name].filter(Boolean).join(' · ')
                return (
                  <button
                    key={os.id}
                    type="button"
                    onClick={() => setSelectedOsId(os.id)}
                    className="w-full text-left hover:bg-muted/30 transition-colors group"
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid sm:grid-cols-[3rem_1fr_8rem_6rem_2rem] gap-x-3 items-center px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">
                        {os.number}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{os.title}</p>
                        {subline ? (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{subline}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/40 truncate mt-0.5 italic">Sem equipamento</p>
                        )}
                      </div>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap text-center',
                        STATUS_BADGE[os.status],
                      )}>
                        {STATUS_LABELS[os.status]}
                      </span>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap text-center',
                        PRIORITY_BADGE[os.priority],
                      )}>
                        {PRIORITY_LABELS[os.priority]}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Mobile card row */}
                    <div className="sm:hidden px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-foreground leading-snug flex-1 min-w-0 truncate">
                          {os.title}
                        </p>
                        <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                          #{os.number}
                        </span>
                      </div>
                      {subline && (
                        <p className="text-xs text-muted-foreground mb-2 truncate">{subline}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-md font-medium',
                          STATUS_BADGE[os.status],
                        )}>
                          {STATUS_LABELS[os.status]}
                        </span>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-md font-medium',
                          PRIORITY_BADGE[os.priority],
                        )}>
                          {PRIORITY_LABELS[os.priority]}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} chamado{total !== 1 ? 's' : ''} no total</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 px-3 text-xs"
            >
              Anterior
            </Button>
            <span className="tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-3 text-xs"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <MyOsDetailSheet
        osId={selectedOsId}
        open={!!selectedOsId}
        onClose={() => setSelectedOsId(null)}
      />

    </div>
  )
}
