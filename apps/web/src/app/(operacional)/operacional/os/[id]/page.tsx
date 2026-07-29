'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Loader2, Wrench, User, Building2, MapPin, Landmark, Tag, Package,
  ClipboardList, ArrowLeft, Clock,
  FileText, ListChecks, DollarSign, MessageSquare, Paperclip, History, ClipboardCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useServiceOrder } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { STATUS_CONFIG, PRIORITY_CONFIG, MAINTENANCE_TYPE_LABELS, timeAgo } from '../../_components/os-utils'
import { OsActions } from '../../_components/workspace/os-actions'
import { OsSummaryTab } from '../../_components/workspace/os-summary-tab'
import { OsSidePanel, type WorkspaceTab } from '../../_components/workspace/os-side-panel'
import { OsAttachmentsTab } from '../../_components/workspace/os-attachments-tab'
import { OsTasksTab } from '../../_components/tabs/os-tasks-tab'
import { OsCommentsTab } from '../../_components/tabs/os-comments-tab'
import { OsHistoryTab } from '../../_components/tabs/os-history-tab'
import { OsCostsTab } from '../../_components/tabs/os-costs-tab'
import { OsChecklistTab } from '../../_components/tabs/os-checklist-tab'
import { OsMaterialsTab } from '../../_components/tabs/os-materials-tab'

const MANAGER_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_MANAGER', 'CLIENT_ADMIN']

function InfoBarItem({ icon: Icon, label, value, sub, dotColor }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string | null
  dotColor?: string | null
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f7] dark:bg-zinc-800">
        <Icon className="h-3.5 w-3.5 text-[#6c7c93] dark:text-zinc-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 leading-none mb-1">{label}</p>
        <p className="text-xs font-semibold text-[#1d2530] dark:text-zinc-100 truncate flex items-center gap-1.5 leading-tight">
          {dotColor && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: dotColor }} />}
          {value}
        </p>
        {sub && <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400 truncate leading-tight mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function ServiceOrderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const user = useCurrentUser()

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('summary')

  const { data: os, isLoading, isError } = useServiceOrder(null, id)

  const canManageMaterials = user?.permissions?.includes('inventory-movement:create') ?? false
  const canListMaterials = user?.permissions?.includes('inventory-movement:list') ?? false

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#6c7c93] dark:text-zinc-400" />
      </div>
    )
  }

  if (isError || !os) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-sm text-[#6c7c93] dark:text-zinc-400">Ordem de serviço não encontrada ou sem acesso.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/operacional')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao painel
        </Button>
      </div>
    )
  }

  const status = STATUS_CONFIG[os.status]
  const priority = PRIORITY_CONFIG[os.priority]

  const location = os.location ?? os.equipment?.location ?? null
  const costCenter = os.costCenter ?? os.equipment?.costCenter ?? null

  const tabs: { id: WorkspaceTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'summary', label: 'Resumo', icon: FileText },
    { id: 'tasks', label: 'Tarefas', icon: ListChecks, count: os.tasks?.length },
    ...(canListMaterials ? [{ id: 'materials' as WorkspaceTab, label: 'Materiais', icon: Package }] : []),
    { id: 'costs', label: 'Custos', icon: DollarSign },
    { id: 'comments', label: 'Comentários', icon: MessageSquare, count: os.comments?.length },
    { id: 'attachments', label: 'Anexos', icon: Paperclip, count: os.attachments?.length },
    { id: 'history', label: 'Histórico', icon: History },
    ...(os.checklist != null ? [{ id: 'checklist' as WorkspaceTab, label: 'Checklist', icon: ClipboardCheck }] : []),
  ]

  const showChecklistBanner =
    os.maintenanceType === 'PREVENTIVE' && os.checklist && !os.checklist.completedAt &&
    os.status !== 'COMPLETED' && os.status !== 'COMPLETED_APPROVED' &&
    os.status !== 'COMPLETED_REJECTED' && os.status !== 'CANCELLED'

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 space-y-3">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-[#6c7c93] dark:text-zinc-400">
          <Link href="/operacional" className="hover:text-[#0d4da5] dark:hover:text-blue-400 transition-colors">
            Ordens de Serviço
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#1d2530] dark:text-zinc-200 font-medium">OS #{os.number}</span>
        </nav>

        {/* Header compacto idêntico ao Mockup */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {/* Titulo principal + badge prioridade */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-[#1d2530] dark:text-zinc-100 tracking-tight">OS #{os.number}</h1>
              {priority && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${priority.badge}`}>
                  {priority.label}
                </span>
              )}
            </div>

            {/* Titulo do problema */}
            <h2 className="text-base font-bold text-[#1d2530] dark:text-zinc-100 tracking-tight leading-snug uppercase">
              {os.title}
            </h2>

            {/* Metadata row */}
            <div className="flex items-center gap-4 text-xs text-[#6c7c93] dark:text-zinc-400 flex-wrap pt-0.5">
              <span className="flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5 text-[#6c7c93]" />
                {MAINTENANCE_TYPE_LABELS[os.maintenanceType]}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                <span className="font-medium text-[#1d2530] dark:text-zinc-200">{status.label}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-[#6c7c93]" />
                Criada {timeAgo(os.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start">
            <OsActions
              os={os}
              clientId={null}
              osId={id}
              onDeleted={() => router.push('/operacional')}
              showPrimaryComplete
            />
          </div>
        </div>

        {/* Info bar compacto */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-[#f8f9fb] dark:bg-zinc-900/40 p-3">
          <InfoBarItem icon={User} label="Solicitante" value={os.requester?.name ?? '—'} />
          <InfoBarItem icon={Building2} label="Prestador" value={os.client?.name ?? 'Interno'} />
          <InfoBarItem
            icon={Wrench}
            label="Equipamento"
            value={os.equipment?.name ?? '—'}
            sub={os.equipment?.patrimonyNumber ? `Patrimônio: ${os.equipment.patrimonyNumber}` : null}
          />
          <InfoBarItem icon={MapPin} label="Localização" value={location?.name ?? '—'} />
          <InfoBarItem icon={Landmark} label="Centro de custo" value={costCenter?.name ?? '—'} sub={costCenter?.code ?? null} />
          <InfoBarItem icon={Tag} label="Grupo" value={os.group?.name ?? '—'} dotColor={os.group?.color ?? null} />
        </div>

        {/* Banner checklist */}
        {showChecklistBanner && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-xs">
            <ClipboardList className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              <span className="font-semibold">Checklist obrigatório pendente.</span>
              {' '}Conclua o checklist antes de encerrar esta OS preventiva.
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              className="ml-auto shrink-0 text-amber-700 dark:text-amber-400 font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300"
            >
              Ir ao checklist →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide border-b border-[#e0e5eb] dark:border-zinc-800">
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 px-1 py-2.5 mr-6 text-xs sm:text-sm border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-[#0d4da5] dark:border-blue-500 text-[#0d4da5] dark:text-blue-400 font-semibold'
                    : 'border-transparent text-[#6c7c93] dark:text-zinc-400 hover:text-[#1d2530] dark:hover:text-zinc-100'
                }`}
              >
                <tab.icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#0d4da5] dark:text-blue-400' : ''}`} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                      active
                        ? 'bg-[#0d4da5] dark:bg-blue-500 text-white'
                        : 'bg-[#f3f4f7] dark:bg-zinc-800 text-[#6c7c93] dark:text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className={activeTab === 'summary' ? 'flex flex-col lg:flex-row gap-4 items-start' : ''}>
          <div className="flex-1 min-w-0 w-full">
            {activeTab === 'summary' && (
              <OsSummaryTab os={os} clientId={null} osId={id} canManage={MANAGER_ROLES.includes(user?.role ?? '')} onNavigateTab={setActiveTab} />
            )}
            {activeTab === 'tasks' && (
              <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <OsTasksTab clientId={null} osId={id} tasks={os.tasks ?? []} />
              </div>
            )}
            {activeTab === 'materials' && (
              <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <OsMaterialsTab
                  clientId={null}
                  osId={id}
                  canEdit={canManageMaterials && os.status !== 'CANCELLED' && os.status !== 'COMPLETED_APPROVED'}
                />
              </div>
            )}
            {activeTab === 'costs' && (
              <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <OsCostsTab
                  clientId={null}
                  osId={id}
                  equipment={os.equipment
                    ? { name: os.equipment.name, currentValue: os.equipment.currentValue, purchaseValue: os.equipment.purchaseValue }
                    : null}
                />
              </div>
            )}
            {activeTab === 'comments' && (
              <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <OsCommentsTab clientId={null} osId={id} comments={os.comments ?? []} />
              </div>
            )}
            {activeTab === 'attachments' && (
              <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <OsAttachmentsTab os={os} />
              </div>
            )}
            {activeTab === 'history' && (
              <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <OsHistoryTab os={os} />
              </div>
            )}
            {activeTab === 'checklist' && (
              <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                <OsChecklistTab clientId={null} osId={id} />
              </div>
            )}
          </div>

          {/* Painel lateral (só no Resumo) */}
          {activeTab === 'summary' && (
            <OsSidePanel
              os={os}
              clientId={null}
              osId={id}
              canManageMaterials={canManageMaterials}
              onNavigate={setActiveTab}
            />
          )}
        </div>
      </div>
    </div>
  )
}
