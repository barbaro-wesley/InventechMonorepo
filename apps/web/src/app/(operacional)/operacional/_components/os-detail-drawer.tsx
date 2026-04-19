'use client'

import { useState, useRef } from 'react'
import { X, ExternalLink, Loader2, ChevronDown, Paperclip, File as FileIcon, Pencil, FileText, CheckCircle2 } from 'lucide-react'
import { LaudoFillDrawer } from '@/components/laudos/laudo-fill-drawer'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useServiceOrder, useUpdateServiceOrderStatus, useAssumeServiceOrder, useUpdateServiceOrder } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { OsDetailTab } from './tabs/os-detail-tab'
import { OsTasksTab } from './tabs/os-tasks-tab'
import { OsCommentsTab } from './tabs/os-comments-tab'
import { OsHistoryTab } from './tabs/os-history-tab'
import { OsCostsTab } from './tabs/os-costs-tab'
import { STATUS_CONFIG, PRIORITY_CONFIG } from './os-utils'
import type { ServiceOrderStatus, ServiceOrderPriority, MaintenanceType } from '@/services/service-orders/service-orders.types'
import { MAINTENANCE_TYPE_LABELS } from './os-utils'

type Tab = 'details' | 'tasks' | 'comments' | 'history' | 'costs'

interface OsDetailDrawerProps {
  osId: string | null
  clientId: string | null
  open: boolean
  onClose: () => void
}

const MANAGER_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_MANAGER', 'CLIENT_ADMIN']

// Ações de status disponíveis por papel
function getStatusActions(
  currentStatus: ServiceOrderStatus,
  role: string,
): { label: string; status: ServiceOrderStatus; variant?: 'destructive' | 'success' }[] {
  const actions: { label: string; status: ServiceOrderStatus; variant?: 'destructive' | 'success' }[] = []

  if (currentStatus === 'OPEN' || currentStatus === 'AWAITING_PICKUP') {
    actions.push({ label: 'Iniciar Atendimento', status: 'IN_PROGRESS' })
    actions.push({ label: 'Cancelar OS', status: 'CANCELLED', variant: 'destructive' })
  }
  if (currentStatus === 'IN_PROGRESS') {
    actions.push({ label: 'Marcar como Concluída', status: 'COMPLETED', variant: 'success' })
    actions.push({ label: 'Cancelar OS', status: 'CANCELLED', variant: 'destructive' })
  }
  if (currentStatus === 'COMPLETED' && MANAGER_ROLES.includes(role)) {
    actions.push({ label: '✅ Aprovar', status: 'COMPLETED_APPROVED', variant: 'success' })
    actions.push({ label: '❌ Reprovar', status: 'COMPLETED_REJECTED', variant: 'destructive' })
  }
  if (currentStatus === 'COMPLETED_REJECTED' && MANAGER_ROLES.includes(role)) {
    actions.push({ label: 'Reabrir OS', status: 'OPEN' })
  }

  return actions
}

export function OsDetailDrawer({ osId, clientId, open, onClose }: OsDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [statusAction, setStatusAction] = useState<ServiceOrderStatus | null>(null)
  const [resolution, setResolution] = useState('')
  const [reason, setReason] = useState('')
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const completionFileInputRef = useRef<HTMLInputElement>(null)
  const [laudoFillOpen, setLaudoFillOpen] = useState(false)
  const [linkedLaudoId, setLinkedLaudoId] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPriority, setEditPriority] = useState<ServiceOrderPriority>('MEDIUM')
  const [editMaintenanceType, setEditMaintenanceType] = useState<MaintenanceType>('CORRECTIVE')
  const [editClientId, setEditClientId] = useState('')
  const [editResolution, setEditResolution] = useState('')
  const [editClients, setEditClients] = useState<{ id: string; name: string }[]>([])

  const user = useCurrentUser()
  const { data: os, isLoading } = useServiceOrder(clientId, osId ?? '')
  const updateStatus = useUpdateServiceOrderStatus(clientId, osId ?? '')
  const assume = useAssumeServiceOrder(clientId, osId ?? '')
  const updateOs = useUpdateServiceOrder(clientId, osId ?? '')

  const COMPLETED_STATUSES: ServiceOrderStatus[] = ['COMPLETED', 'COMPLETED_APPROVED', 'COMPLETED_REJECTED']

  const openEdit = () => {
    if (!os) return
    setEditTitle(os.title)
    setEditDescription(os.description)
    setEditPriority(os.priority as ServiceOrderPriority)
    setEditMaintenanceType(os.maintenanceType as MaintenanceType)
    setEditClientId(os.client?.id ?? '')
    setEditResolution(os.resolution ?? '')
    setEditOpen(true)
    // carrega lista de clientes (prestadores)
    import('@/lib/api').then(({ api }) =>
      api.get('/clients', { params: { limit: 100 } }).then(({ data }) =>
        setEditClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))),
      ),
    )
  }

  const handleSaveEdit = () => {
    updateOs.mutate(
      {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        maintenanceType: editMaintenanceType,
        clientId: editClientId || undefined,
        resolution: COMPLETED_STATUSES.includes(os?.status as ServiceOrderStatus)
          ? (editResolution || undefined)
          : undefined,
      },
      { onSuccess: () => setEditOpen(false) },
    )
  }

  if (!open || !osId) return null

  const handleStatusAction = (status: ServiceOrderStatus) => {
    if (status === 'COMPLETED' || status === 'COMPLETED_REJECTED') {
      setStatusAction(status)
      return
    }
    updateStatus.mutate({ status })
  }

  const handleConfirmStatus = () => {
    if (!statusAction) return
    updateStatus.mutate(
      {
        status: statusAction,
        resolution: statusAction === 'COMPLETED' ? (resolution || undefined) : undefined,
        reason: statusAction === 'COMPLETED_REJECTED' ? reason : undefined,
        files: statusAction === 'COMPLETED' && completionFiles.length > 0 ? completionFiles : undefined,
        laudoId: statusAction === 'COMPLETED' && linkedLaudoId ? linkedLaudoId : undefined,
      },
      {
        onSuccess: () => {
          setStatusAction(null)
          setResolution('')
          setReason('')
          setCompletionFiles([])
          setLinkedLaudoId(null)
        },
      },
    )
  }

  const handleCompletionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setCompletionFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeCompletionFile = (index: number) => {
    setCompletionFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'details', label: 'Detalhes' },
    { id: 'tasks', label: 'Tarefas', count: os?.tasks?.length },
    { id: 'comments', label: 'Comentários', count: os?.comments?.length },
    { id: 'costs', label: 'Custos' },
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

  const statusActions = os
    ? getStatusActions(os.status as ServiceOrderStatus, user?.role ?? '')
    : []
  const canAssume =
    os?.status === 'AWAITING_PICKUP' &&
    os?.isAvailable &&
    (user?.permissions?.includes('service-order:assume') ?? false)

  return (
    <>
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
              <Loader2 className="h-6 w-6 animate-spin text-[#6c7c93]" />
            </div>
          ) : (
            <>
              {/* Header */}
              <SheetHeader className="px-6 pt-5 pb-4 border-b border-[#e0e5eb] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Número + badges */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-mono text-[#6c7c93]">#{os.number}</span>
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
                    <h2 className="font-semibold text-[#1d2530] text-base leading-snug line-clamp-2">
                      {os.title}
                    </h2>
                    <p className="text-xs text-[#6c7c93] mt-1">
                      {os.client?.name ?? 'Interno'}{os.equipment ? ` · ${os.equipment.name}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="shrink-0 text-[#6c7c93]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Ações de status */}
                <div className="flex items-center gap-2">
                  {MANAGER_ROLES.includes(user?.role ?? '') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      onClick={openEdit}
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </Button>
                  )}

                  {canAssume && (
                    <Button
                      size="sm"
                      onClick={() => assume.mutate()}
                      disabled={assume.isPending}
                      className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {assume.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : null}
                      Assumir OS
                    </Button>
                  )}

                  {statusActions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          Alterar Status
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {statusActions.map((action, idx) => (
                          <DropdownMenuItem
                            key={action.status}
                            onClick={() => handleStatusAction(action.status)}
                            className={
                              action.variant === 'destructive'
                                ? 'text-red-600 focus:text-red-600'
                                : action.variant === 'success'
                                  ? 'text-emerald-600 focus:text-emerald-600'
                                  : ''
                            }
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </SheetHeader>

              {/* Tabs */}
              <div className="flex border-b border-[#e0e5eb] bg-white px-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-1 py-3 mr-5 text-sm border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-[#0d4da5] text-[#0d4da5] font-medium'
                        : 'border-transparent text-[#6c7c93] hover:text-[#1d2530]'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                          activeTab === tab.id
                            ? 'bg-[#0d4da5] text-white'
                            : 'bg-[#f3f4f7] text-[#6c7c93]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
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
                {activeTab === 'history' && (
                  <OsHistoryTab os={os} />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação de conclusão */}
      <AlertDialog open={statusAction === 'COMPLETED'} onOpenChange={(v) => { if (!v) { setStatusAction(null); setLinkedLaudoId(null) } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir OS</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedLaudoId
                ? 'Laudo técnico vinculado. A resolução em texto é opcional.'
                : 'Descreva a resolução ou crie um laudo técnico detalhado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Laudo section */}
          <div className="mt-1">
            {linkedLaudoId ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    Laudo técnico criado e vinculado
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLaudoFillOpen(true)}
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkedLaudoId(null)}
                    className="text-xs text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLaudoFillOpen(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm text-blue-600 dark:text-blue-400"
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span>Criar laudo técnico <span className="text-xs text-blue-400">(opcional)</span></span>
              </button>
            )}
          </div>

          <Textarea
            placeholder={linkedLaudoId ? 'Observação adicional (opcional)...' : 'Descreva o que foi feito para resolver o problema...'}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
            className="mt-2"
          />

          {/* Anexos de conclusão */}
          <div className="mt-2">
            <input
              type="file"
              multiple
              ref={completionFileInputRef}
              onChange={handleCompletionFileChange}
              className="hidden"
            />
            {completionFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {completionFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-[#f3f4f7] border border-[#e0e5eb] rounded-lg px-2 py-1 text-[10px] text-[#1d2530]"
                  >
                    <FileIcon className="h-3 w-3 text-[#6c7c93]" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeCompletionFile(i)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => completionFileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-[#6c7c93] hover:bg-[#f3f4f7] border border-dashed border-[#e0e5eb] transition-colors w-full justify-center"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Anexar arquivos (opcional)
            </button>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setStatusAction(null); setCompletionFiles([]); setLinkedLaudoId(null) }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatus}
              disabled={(!resolution.trim() && !linkedLaudoId) || updateStatus.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Laudo fill drawer */}
      <LaudoFillDrawer
        open={laudoFillOpen}
        onClose={() => setLaudoFillOpen(false)}
        onSaved={(id) => {
          setLinkedLaudoId(id)
          setLaudoFillOpen(false)
        }}
        serviceOrderId={osId ?? undefined}
        clientId={os?.client?.id ?? clientId ?? undefined}
        technicianId={user?.id}
        referenceType="SERVICE_ORDER"
        existingLaudoId={linkedLaudoId}
      />

      {/* Dialog de edição da OS */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar OS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Título</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-priority">Prioridade</Label>
                <Select
                  value={editPriority}
                  onValueChange={(v) => setEditPriority(v as ServiceOrderPriority)}
                >
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_CONFIG) as ServiceOrderPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_CONFIG[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-maintenance-type">Tipo de manutenção</Label>
                <Select
                  value={editMaintenanceType}
                  onValueChange={(v) => setEditMaintenanceType(v as MaintenanceType)}
                >
                  <SelectTrigger id="edit-maintenance-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {MAINTENANCE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editClients.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-client">Prestador</Label>
                <Select
                  value={editClientId}
                  onValueChange={setEditClientId}
                >
                  <SelectTrigger id="edit-client">
                    <SelectValue placeholder="Selecione o prestador" />
                  </SelectTrigger>
                  <SelectContent>
                    {editClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {COMPLETED_STATUSES.includes(os?.status as ServiceOrderStatus) && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-resolution">Resolução</Label>
                <Textarea
                  id="edit-resolution"
                  placeholder="Descreva a resolução aplicada..."
                  value={editResolution}
                  onChange={(e) => setEditResolution(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || updateOs.isPending}
            >
              {updateOs.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de reprovação */}
      <AlertDialog open={statusAction === 'COMPLETED_REJECTED'} onOpenChange={(v) => !v && setStatusAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprovar OS</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da reprovação. O técnico será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo da reprovação..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStatusAction(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatus}
              disabled={!reason.trim() || updateStatus.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
