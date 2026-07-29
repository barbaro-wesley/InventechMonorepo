'use client'

import { useState } from 'react'
import { X, Loader2, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useServiceOrder } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { OsDetailTab } from './tabs/os-detail-tab'
import { OsTasksTab } from './tabs/os-tasks-tab'
import { OsCommentsTab } from './tabs/os-comments-tab'
import { OsHistoryTab } from './tabs/os-history-tab'
import { OsCostsTab } from './tabs/os-costs-tab'
import { OsChecklistTab } from './tabs/os-checklist-tab'
import { OsMaterialsTab } from './tabs/os-materials-tab'
import { OsActions } from './workspace/os-actions'
import { STATUS_CONFIG, PRIORITY_CONFIG } from './os-utils'

type Tab = 'details' | 'tasks' | 'comments' | 'history' | 'costs' | 'checklist' | 'materials'

interface OsDetailDrawerProps {
  osId: string | null
  clientId: string | null
  open: boolean
  onClose: () => void
}

const MANAGER_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_MANAGER', 'CLIENT_ADMIN']

export function OsDetailDrawer({ osId, clientId, open, onClose }: OsDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details')

  const user = useCurrentUser()
  const { data: os, isLoading } = useServiceOrder(clientId, osId ?? '')

  if (!open || !osId) return null

  const canManageMaterials = user?.permissions?.includes('inventory-movement:create') ?? false

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'details', label: 'Detalhes' },
    { id: 'tasks', label: 'Tarefas', count: os?.tasks?.length },
    { id: 'comments', label: 'Comentários', count: os?.comments?.length },
    { id: 'costs', label: 'Custos' },
    ...(user?.permissions?.includes('inventory-movement:list') ? [{ id: 'materials' as Tab, label: 'Materiais' }] : []),
    ...(os?.checklist != null ? [{ id: 'checklist' as Tab, label: 'Checklist' }] : []),
    {
      id: 'history',
      label: 'Histórico',
      count:
        1 + // criação
        (os?.statusHistory?.length ?? 0) +
        (os?.comments?.length ?? 0) +
        (os?.tasks?.length ?? 0) +
        (os?.technicians?.length ?? 0) +
        (os?.attachments?.length ?? 0),
    },
  ]

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:!w-[820px] sm:!max-w-[820px] lg:!w-[1000px] lg:!max-w-[1000px] p-0 flex flex-col gap-0"
      >
        <SheetTitle className="sr-only">
          {os ? `OS #${os.number} — ${os.title}` : 'Detalhes da OS'}
        </SheetTitle>
        {isLoading || !os ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#6c7c93] dark:text-zinc-400 " />
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="px-4 sm:px-6 pt-5 pb-4 border-b border-[#e0e5eb] dark:border-zinc-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Número + badges */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-mono text-[#6c7c93] dark:text-zinc-400 ">#{os.number}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${STATUS_CONFIG[os.status].bg} ${STATUS_CONFIG[os.status].color}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[os.status].dot}`} />
                      {STATUS_CONFIG[os.status].label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${PRIORITY_CONFIG[os.priority].badge}`}
                    >
                      {PRIORITY_CONFIG[os.priority].label}
                    </span>
                  </div>
                  <h2 className="font-semibold text-[#1d2530] dark:text-zinc-100 text-base leading-snug line-clamp-2">
                    {os.title}
                  </h2>
                  <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-1">
                    {os.client?.name ?? 'Interno'}{os.equipment ? ` · ${os.equipment.name}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0 text-[#6c7c93] dark:text-zinc-400 "
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Ações de status */}
              <OsActions os={os} clientId={clientId} osId={osId} onDeleted={onClose} />
            </SheetHeader>

            {/* Banner: checklist obrigatório pendente */}
            {os.maintenanceType === 'PREVENTIVE' && os.checklist && !os.checklist.completedAt &&
              os.status !== 'COMPLETED' && os.status !== 'COMPLETED_APPROVED' &&
              os.status !== 'COMPLETED_REJECTED' && os.status !== 'CANCELLED' && (
              <div className="mx-4 sm:mx-6 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-xs">
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
            <div className="flex border-b border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 px-1 py-3 mr-5 text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#0d4da5] dark:border-blue-500 text-[#0d4da5] dark:text-blue-400 font-medium'
                      : 'border-transparent text-[#6c7c93] dark:text-zinc-400 hover:text-[#1d2530] dark:hover:text-zinc-100 dark:text-zinc-100 '
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                        activeTab === tab.id
                          ? 'bg-[#0d4da5] dark:bg-blue-500 text-white'
                          : 'bg-[#f3f4f7] dark:bg-zinc-800 text-[#6c7c93] dark:text-zinc-400 '
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {activeTab === 'details' && (
                <OsDetailTab
                  os={os}
                  clientId={clientId}
                  osId={osId}
                  canManage={MANAGER_ROLES.includes(user?.role ?? '')}
                />
              )}
              {activeTab === 'tasks' && (
                <OsTasksTab
                  clientId={clientId}
                  osId={osId}
                  tasks={os.tasks ?? []}
                />
              )}
              {activeTab === 'comments' && (
                <OsCommentsTab
                  clientId={clientId}
                  osId={osId}
                  comments={os.comments ?? []}
                />
              )}
              {activeTab === 'costs' && (
                <OsCostsTab
                  clientId={clientId}
                  osId={osId}
                  equipment={os.equipment
                    ? {
                        name: os.equipment.name,
                        currentValue: os.equipment.currentValue,
                        purchaseValue: os.equipment.purchaseValue,
                      }
                    : null
                  }
                />
              )}
              {activeTab === 'materials' && (
                <OsMaterialsTab
                  clientId={clientId}
                  osId={osId}
                  canEdit={canManageMaterials && os.status !== 'CANCELLED' && os.status !== 'COMPLETED_APPROVED'}
                />
              )}
              {activeTab === 'checklist' && (
                <OsChecklistTab clientId={clientId} osId={osId} />
              )}
              {activeTab === 'history' && (
                <OsHistoryTab os={os} />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
