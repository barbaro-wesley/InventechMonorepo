'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Clock, Flag, Wrench, User, Plus, X, Loader2, FileText, Download, GitBranch,
  CalendarClock, CheckCircle2, Circle, CircleDot, Tag, ListChecks,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAddTechnician, useRemoveTechnician } from '@/hooks/service-orders/use-service-orders'
import { useUsers } from '@/hooks/users/use-users'
import type { ServiceOrderDetail, ServiceOrderStatus } from '@/services/service-orders/service-orders.types'
import { PRIORITY_CONFIG, STATUS_CONFIG, MAINTENANCE_TYPE_LABELS, timeAgo, formatDuration, getSlaInfo } from '../os-utils'

interface OsSummaryTabProps {
  os: ServiceOrderDetail
  clientId: string | null
  osId: string
  canManage: boolean
  onNavigateTab?: (tab: any) => void
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, iconClass, valueClass, sub, children }: {
  icon: React.ElementType
  label: string
  iconClass: string
  valueClass?: string
  sub?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] font-medium text-[#6c7c93] dark:text-zinc-400">{label}</span>
      </div>
      <div>
        <p className={`text-base font-bold leading-tight ${valueClass ?? 'text-[#1d2530] dark:text-zinc-100'}`}>
          {children}
        </p>
        {sub && <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function Card({ title, icon: Icon, children, className = '' }: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 ${className}`}>
      <div className="flex items-center gap-1.5 mb-3">
        {Icon && <Icon className="h-4 w-4 text-[#6c7c93] dark:text-zinc-400" />}
        <h3 className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function TechAvatar({ name }: { name: string }) {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const color = colors[Math.abs(hash) % colors.length]
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  return (
    <div className={`h-7 w-7 rounded-full ${color} flex items-center justify-center shrink-0`}>
      <span className="text-white text-xs font-semibold">{initials}</span>
    </div>
  )
}

function elapsedLabel(os: ServiceOrderDetail): string {
  const base = os.startedAt ?? os.createdAt
  return formatDuration(base, os.completedAt)
}

function getNextActions(status: ServiceOrderStatus): { label: string; done: boolean; current: boolean }[] {
  const steps = [
    { key: 'assign', label: 'Aguardar aprovação' },
    { key: 'start', label: 'Receber materiais' },
    { key: 'execute', label: 'Finalizar execução' },
    { key: 'finish', label: 'Testes finais' },
    { key: 'approve', label: 'Encerrar OS' },
  ]
  const stepIndexByStatus: Record<ServiceOrderStatus, number> = {
    AWAITING_PICKUP: 1,
    OPEN: 1,
    IN_PROGRESS: 3,
    COMPLETED: 4,
    COMPLETED_APPROVED: 5,
    COMPLETED_REJECTED: 3,
    CANCELLED: 0,
  }
  const cur = stepIndexByStatus[status]
  return steps.map((s, i) => ({
    label: s.label,
    done: i + 1 < cur,
    current: i + 1 === cur,
  }))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OsSummaryTab({ os, clientId, osId, canManage, onNavigateTab }: OsSummaryTabProps) {
  const priority = PRIORITY_CONFIG[os.priority]
  const status = STATUS_CONFIG[os.status]

  const [selectedTechId, setSelectedTechId] = useState('')
  const addTechnician = useAddTechnician(clientId, osId)
  const removeTechnician = useRemoveTechnician(clientId, osId)

  const { data: techData } = useUsers({ role: 'TECHNICIAN', clientId: os.client?.id, limit: 100 })
  const linkedIds = new Set(os.technicians.map((t) => t.technician.id))
  const availableTechs = (techData?.data ?? []).filter((u) => !linkedIds.has(u.id))
  const isTerminal = os.status === 'COMPLETED_APPROVED' || os.status === 'CANCELLED'

  const handleAddTechnician = () => {
    if (!selectedTechId) return
    addTechnician.mutate(
      { technicianId: selectedTechId, role: 'ASSISTANT' },
      { onSuccess: () => setSelectedTechId('') },
    )
  }

  const nextActions = getNextActions(os.status as ServiceOrderStatus)
  const sla = getSlaInfo(os)

  return (
    <div className="space-y-4">
      {/* Resumo da OS Title */}
      <h3 className="text-sm font-bold text-[#1d2530] dark:text-zinc-100 uppercase tracking-wider">Resumo da OS</h3>

      {/* 5 Stat cards matching mockup */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={CircleDot} label="Status" iconClass={`${status.bg} ${status.color}`} valueClass={status.color}>
          {status.label}
        </StatCard>
        <StatCard icon={Flag} label="Prioridade" iconClass={priority.badge} valueClass={priority.color}>
          {priority.label}
        </StatCard>
        <StatCard
          icon={Wrench}
          label="Tipo de manutenção"
          iconClass="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
        >
          {MAINTENANCE_TYPE_LABELS[os.maintenanceType]}
        </StatCard>
        <StatCard
          icon={CheckCircle2}
          label="SLA"
          iconClass={sla?.late ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200'}
          valueClass={sla?.late ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
          sub={sla ? `${sla.timeLeftStr} (SLA: ${sla.totalHoursStr})` : 'Sem prazo'}
        >
          {sla ? sla.label : 'Dentro do prazo'}
        </StatCard>
        <StatCard
          icon={Clock}
          label="Tempo decorrido"
          iconClass="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900"
          valueClass="text-blue-700 dark:text-blue-400"
          sub={
            !os.completedAt && os.startedAt
              ? 'em andamento'
              : os.completedAt
                ? 'até a conclusão'
                : os.startedAt ? null : 'ainda não iniciada'
          }
        >
          {elapsedLabel(os)}
        </StatCard>
      </div>

      {/* 3 Columns matching mockup */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Coluna 1: Descrição + Informações Adicionais */}
        <div className="space-y-3">
          <Card title="Descrição do problema" icon={FileText}>
            <p className="text-xs text-[#4a5568] dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {os.description || 'Equipamento não está funcionando.'}
            </p>
          </Card>

          <Card title="Informações adicionais" icon={CalendarClock}>
            <div className="space-y-2.5 text-xs">
              <div>
                <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400">Criada em</p>
                <p className="font-semibold text-[#1d2530] dark:text-zinc-100">
                  {timeAgo(os.createdAt)} <span className="font-normal text-[#6c7c93]">({new Date(os.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})</span>
                </p>
              </div>
              {os.startedAt && (
                <div>
                  <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400">Iniciada em</p>
                  <p className="font-semibold text-[#1d2530] dark:text-zinc-100">
                    {timeAgo(os.startedAt)} <span className="font-normal text-[#6c7c93]">({new Date(os.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})</span>
                  </p>
                </div>
              )}
              {os.scheduledFor && (
                <div>
                  <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400">Previsão de conclusão</p>
                  <p className="font-semibold text-[#1d2530] dark:text-zinc-100">
                    {new Date(os.scheduledFor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400">Última atualização</p>
                <p className="font-semibold text-[#1d2530] dark:text-zinc-100">
                  {timeAgo(os.updatedAt)} <span className="font-normal text-[#6c7c93]">({new Date(os.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})</span>
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Coluna 2: Linha do tempo */}
        <Card title="Linha do tempo" icon={Clock} className="flex flex-col justify-between">
          <Timeline os={os} />
          {onNavigateTab && (
            <div className="pt-3 border-t border-[#e0e5eb] dark:border-zinc-800 text-center">
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="text-xs font-semibold text-[#0d4da5] dark:text-blue-400 hover:underline"
              >
                Ver histórico completo
              </button>
            </div>
          )}
        </Card>

        {/* Coluna 3: Próximas Ações + SLA / Prazo */}
        <div className="space-y-3">
          <Card title="Próximas ações" icon={ListChecks}>
            <ul className="space-y-2">
              {nextActions.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  {a.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : a.current ? (
                    <CircleDot className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#c5cdd8] dark:text-zinc-700 shrink-0 mt-0.5" />
                  )}
                  <span className={`text-xs ${
                    a.current
                      ? 'text-[#1d2530] dark:text-zinc-100 font-semibold'
                      : a.done
                        ? 'text-[#6c7c93] dark:text-zinc-400 line-through'
                        : 'text-[#6c7c93] dark:text-zinc-400'
                  }`}>
                    {a.label}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="SLA / Prazo" icon={Clock}>
            <div className="flex flex-col items-center justify-center py-2">
              <div className={`relative flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 ${
                sla?.late
                  ? 'border-red-500 text-red-600 dark:border-red-600 dark:text-red-400 bg-red-50/40 dark:bg-red-950/20'
                  : 'border-[#0d4da5] text-[#1d2530] dark:border-blue-500 dark:text-zinc-100 bg-blue-50/30 dark:bg-blue-950/20'
              } mb-2.5 transition-all`}>
                <span className="text-base font-extrabold leading-tight">
                  {sla ? sla.mainDisplayTime : '24h'}
                </span>
                <span className="text-[10px] font-medium text-[#6c7c93] dark:text-zinc-400 leading-tight">
                  {sla?.late ? 'em atraso' : 'restantes'}
                </span>
              </div>
              <div className="w-full space-y-1 text-center">
                {priority && (
                  <p className="text-xs text-[#6c7c93] dark:text-zinc-400">
                    Prazo prioridade ({priority.label}): <span className="font-semibold text-[#1d2530] dark:text-zinc-100">{sla?.totalHoursStr ?? '24h'}</span>
                  </p>
                )}
                <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400">
                  Prazo limite: <span className="font-medium text-[#1d2530] dark:text-zinc-100">{sla?.prazoFinal ?? '—'}</span>
                </p>
                <p className={`text-xs font-semibold mt-1 flex items-center justify-center gap-1 ${sla?.late ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {sla?.late ? '✕ Atrasada' : '✓ Dentro do prazo'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Informações adicionais */}
      <Card title="Informações adicionais" icon={CalendarClock}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoItem label="Criada em" value={`${timeAgo(os.createdAt)} (${new Date(os.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`} />
          {os.startedAt && (
            <InfoItem label="Iniciada em" value={`${timeAgo(os.startedAt)} (${new Date(os.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`} />
          )}
          {os.scheduledFor && (
            <InfoItem label="Previsão de conclusão" value={new Date(os.scheduledFor).toLocaleDateString('pt-BR')} />
          )}
          {os.completedAt && (
            <InfoItem label="Concluída em" value={`${timeAgo(os.completedAt)} (${new Date(os.completedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`} />
          )}
          <InfoItem label="Última atualização" value={`${timeAgo(os.updatedAt)} (${new Date(os.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`} />
        </div>
      </Card>

      {/* Resolução */}
      {os.resolution && (
        <Card title="Resolução" icon={CheckCircle2}>
          <p className="text-sm text-[#1d2530] dark:text-zinc-100 leading-relaxed bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-900">
            {os.resolution}
          </p>
        </Card>
      )}

      {/* Técnicos */}
      <Card title="Técnicos" icon={User}>
        <div className="space-y-2">
          {os.technicians.length === 0 && (
            <p className="text-xs text-[#6c7c93] dark:text-zinc-400 italic">Nenhum técnico vinculado</p>
          )}
          {os.technicians.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#f8f9fb] dark:bg-zinc-900/50 border border-[#e0e5eb] dark:border-zinc-800">
              <TechAvatar name={t.technician.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1d2530] dark:text-zinc-100">{t.technician.name}</p>
                <p className="text-xs text-[#6c7c93] dark:text-zinc-400">{t.technician.email}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                t.role === 'LEAD'
                  ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                  : 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}>
                {t.role === 'LEAD' ? 'Responsável' : 'Auxiliar'}
              </span>
              {canManage && !isTerminal && t.role !== 'LEAD' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#6c7c93] dark:text-zinc-400 hover:text-red-500 shrink-0"
                  disabled={removeTechnician.isPending}
                  onClick={() => removeTechnician.mutate(t.technician.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

          {canManage && !isTerminal && availableTechs.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                <SelectTrigger className="h-8 text-xs flex-1 bg-[#f3f4f7] dark:bg-zinc-800 border-transparent">
                  <SelectValue placeholder="Adicionar técnico auxiliar..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTechs.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs px-3 shrink-0"
                disabled={!selectedTechId || addTechnician.isPending}
                onClick={handleAddTechnician}
              >
                {addTechnician.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Laudos vinculados */}
      {os.laudos && os.laudos.length > 0 && (
        <Card title={`Laudos Vinculados (${os.laudos.length})`} icon={FileText}>
          <LaudosList laudos={os.laudos} />
        </Card>
      )}

      {/* OS Vinculadas */}
      {(os.parentServiceOrder || os.childServiceOrders?.length > 0 || os.originatedSchedules?.length > 0) && (
        <Card title="OS Vinculadas" icon={GitBranch}>
          <LinkedOrders os={os} />
        </Card>
      )}

      {/* Notas internas */}
      {os.internalNotes && (
        <Card title="Notas Internas" icon={Tag}>
          <p className="text-sm text-[#1d2530] dark:text-zinc-100 leading-relaxed bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-900">
            {os.internalNotes}
          </p>
        </Card>
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#1d2530] dark:text-zinc-100">{value}</p>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ os }: { os: ServiceOrderDetail }) {
  // Evento de criação + histórico de status, em ordem cronológica
  const events: { label: string; date: string; by?: string | null; kind: 'created' | 'status' }[] = [
    { label: 'OS criada', date: os.createdAt, by: os.requester?.name, kind: 'created' as const },
    ...(os.statusHistory ?? []).map((h) => ({
      label: STATUS_CONFIG[h.toStatus].label,
      date: h.createdAt,
      by: h.changedBy?.name,
      kind: 'status' as const,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (events.length === 0) return <p className="text-sm text-[#6c7c93] dark:text-zinc-400">Sem eventos.</p>

  return (
    <ol className="relative space-y-4">
      {events.map((e, i) => {
        const last = i === events.length - 1
        return (
          <li key={i} className="relative flex gap-3">
            {/* linha + ponto */}
            <div className="flex flex-col items-center">
              <span className={`h-3 w-3 rounded-full border-2 ${
                last
                  ? 'bg-[#0d4da5] border-[#0d4da5] dark:bg-blue-500 dark:border-blue-500'
                  : 'bg-emerald-500 border-emerald-500'
              }`} />
              {!last && <span className="w-px flex-1 bg-[#e0e5eb] dark:bg-zinc-800 mt-1" />}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-sm font-medium text-[#1d2530] dark:text-zinc-100">{e.label}</p>
              <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400">
                {new Date(e.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                {e.by ? ` · por ${e.by}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Laudos ─────────────────────────────────────────────────────────────────

function LaudosList({ laudos }: { laudos: NonNullable<ServiceOrderDetail['laudos']> }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    DRAFT: { label: 'Rascunho', bg: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800', text: 'text-slate-600 dark:text-slate-400' },
    PENDING_REVIEW: { label: 'Em Revisão', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900', text: 'text-amber-700 dark:text-amber-400' },
    PENDING_SIGNATURE: { label: 'Aguard. Assinatura', bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900', text: 'text-orange-700 dark:text-orange-400' },
    SIGNED: { label: 'Assinado', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900', text: 'text-blue-700 dark:text-blue-400' },
    APPROVED: { label: 'Aprovado', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900', text: 'text-emerald-700 dark:text-emerald-400' },
    CANCELLED: { label: 'Cancelado', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900', text: 'text-red-600 dark:text-red-400' },
  }
  return (
    <div className="space-y-2">
      {laudos.map((laudo) => {
        const st = statusConfig[laudo.status] ?? { label: laudo.status, bg: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800', text: 'text-slate-600 dark:text-slate-400' }
        const laudoNum = String(laudo.number).padStart(4, '0')
        return (
          <div
            key={laudo.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-[#f8f9fb] dark:bg-zinc-900/50 border border-[#e0e5eb] dark:border-zinc-800 hover:border-[#c5cdd8] dark:hover:border-zinc-700 transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1d2530] dark:text-zinc-100 truncate">
                #{laudoNum} — {laudo.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${st.bg} ${st.text}`}>
                  {st.label}
                </span>
                {laudo.technician && (
                  <span className="text-[11px] text-[#6c7c93] dark:text-zinc-400 truncate">Técnico: {laudo.technician.name}</span>
                )}
                <span className="text-[11px] text-[#6c7c93] dark:text-zinc-400">
                  {new Date(laudo.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
            <a
              href={`${apiBase}/laudos/${laudo.id}/${laudo.status === 'SIGNED' ? 'signed-pdf' : 'pdf'}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                laudo.status === 'SIGNED'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400'
              }`}
              title={laudo.status === 'SIGNED' ? 'Baixar PDF assinado' : 'Baixar PDF'}
            >
              {laudo.status === 'SIGNED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ─── OS Vinculadas ─────────────────────────────────────────────────────────

function LinkedOrders({ os }: { os: ServiceOrderDetail }) {
  return (
    <div className="space-y-2">
      {os.parentServiceOrder && (
        <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 p-3">
          <p className="text-[10px] text-violet-500 font-medium mb-1.5 uppercase tracking-wide">Originada de</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#6c7c93] dark:text-zinc-400">#{os.parentServiceOrder.number}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_CONFIG[os.parentServiceOrder.status].bg} ${STATUS_CONFIG[os.parentServiceOrder.status].color}`}>
              <span className={`h-1 w-1 rounded-full ${STATUS_CONFIG[os.parentServiceOrder.status].dot}`} />
              {STATUS_CONFIG[os.parentServiceOrder.status].label}
            </span>
            <span className="text-xs text-[#6c7c93] dark:text-zinc-400 truncate">{MAINTENANCE_TYPE_LABELS[os.parentServiceOrder.maintenanceType]}</span>
          </div>
          <Link href={`/operacional/os/${os.parentServiceOrder.id}`} className="text-sm text-[#0d4da5] dark:text-blue-400 hover:underline mt-1 block truncate">
            {os.parentServiceOrder.title}
          </Link>
        </div>
      )}

      {os.childServiceOrders?.map((child) => (
        <Link
          key={child.id}
          href={`/operacional/os/${child.id}`}
          className="block rounded-lg border border-[#e0e5eb] dark:border-zinc-800 bg-[#f8f9fb] dark:bg-zinc-900/50 p-3 hover:border-[#c5cdd8] dark:hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-[#6c7c93] dark:text-zinc-400">#{child.number}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_CONFIG[child.status].bg} ${STATUS_CONFIG[child.status].color}`}>
              <span className={`h-1 w-1 rounded-full ${STATUS_CONFIG[child.status].dot}`} />
              {STATUS_CONFIG[child.status].label}
            </span>
            <span className="text-[10px] text-[#6c7c93] dark:text-zinc-400 ml-auto shrink-0">
              {MAINTENANCE_TYPE_LABELS[child.maintenanceType]}
            </span>
          </div>
          <p className="text-sm text-[#1d2530] dark:text-zinc-100 truncate">{child.title}</p>
          {child.scheduledFor && (
            <div className="flex items-center gap-1 mt-1">
              <CalendarClock className="h-3 w-3 text-[#6c7c93] dark:text-zinc-400" />
              <span className="text-[11px] text-[#6c7c93] dark:text-zinc-400">
                Agendada: {new Date(child.scheduledFor).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </Link>
      ))}

      {os.originatedSchedules?.map((schedule) => (
        <div key={schedule.id} className="rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 p-3">
          <p className="text-[10px] text-indigo-500 font-medium mb-1.5 uppercase tracking-wide">Agendamento recorrente</p>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${schedule.isActive ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800'}`}>
              {schedule.isActive ? 'Ativo' : 'Inativo'}
            </span>
            <span className="text-[10px] text-[#6c7c93] dark:text-zinc-400">{MAINTENANCE_TYPE_LABELS[schedule.maintenanceType]}</span>
          </div>
          <p className="text-sm text-[#1d2530] dark:text-zinc-100 truncate">{schedule.title}</p>
          <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 mt-0.5">
            Início: {new Date(schedule.startDate).toLocaleDateString('pt-BR')}
          </p>
        </div>
      ))}
    </div>
  )
}
