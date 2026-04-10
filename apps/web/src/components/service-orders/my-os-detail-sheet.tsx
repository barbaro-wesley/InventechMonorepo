'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Loader2, MessageSquare, CheckCircle2, XCircle,
  Clock, ChevronRight, Send, Pencil, X,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useServiceOrder,
  useUpdateServiceOrderStatus,
  useAddComment,
  useUpdateServiceOrder,
  serviceOrderKeys,
} from '@/hooks/service-orders/use-service-orders'
import { usePermissions } from '@/hooks/auth/use-permissions'
import { useQueryClient } from '@tanstack/react-query'
import type { ServiceOrderStatus } from '@/services/service-orders/service-orders.types'

// ─── Labels ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  OPEN: 'Aberta',
  AWAITING_PICKUP: 'Aguardando Assumção',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
  COMPLETED_APPROVED: 'Aprovada',
  COMPLETED_REJECTED: 'Reprovada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700',
  AWAITING_PICKUP: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-violet-100 text-violet-700',
  COMPLETED_APPROVED: 'bg-emerald-100 text-emerald-700',
  COMPLETED_REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
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

const MAINTENANCE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Corretiva',
  PREVENTIVE: 'Preventiva',
  INITIAL_ACCEPTANCE: 'Aceitação Inicial',
  EXTERNAL_SERVICE: 'Serviço Externo',
  TECHNOVIGILANCE: 'Tecnovigilância',
  TRAINING: 'Treinamento',
  IMPROPER_USE: 'Uso Indevido',
  DEACTIVATION: 'Desativação',
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface MyOsDetailSheetProps {
  osId: string | null
  open: boolean
  onClose: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MyOsDetailSheet({ osId, open, onClose }: MyOsDetailSheetProps) {
  const { canAccess } = usePermissions()
  const qc = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)

  const { data: os, isLoading } = useServiceOrder(null, osId ?? '')
  const updateStatus = useUpdateServiceOrderStatus(null, osId ?? '')
  const updateOs = useUpdateServiceOrder(osId ?? '')
  const addComment = useAddComment(null, osId ?? '')

  const commentForm = useForm<{ content: string }>()
  const editForm = useForm<{ title: string; description: string; priority: string }>()

  const canApprove = canAccess('service-order', 'update-status')
  const canEdit = canAccess('service-order', 'update')
  const canComment = canAccess('service-order', 'comment')

  function handleApprove() {
    updateStatus.mutate(
      { status: 'COMPLETED_APPROVED' },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: serviceOrderKeys.myStats() })
          qc.invalidateQueries({ queryKey: serviceOrderKeys.mine() })
        },
      },
    )
  }

  function handleReject() {
    if (!rejectReason.trim()) return
    updateStatus.mutate(
      { status: 'COMPLETED_REJECTED', reason: rejectReason },
      {
        onSuccess: () => {
          setShowRejectInput(false)
          setRejectReason('')
          qc.invalidateQueries({ queryKey: serviceOrderKeys.myStats() })
          qc.invalidateQueries({ queryKey: serviceOrderKeys.mine() })
        },
      },
    )
  }

  function handleComment(values: { content: string }) {
    if (!values.content.trim()) return
    addComment.mutate(
      { content: values.content },
      { onSuccess: () => commentForm.reset() },
    )
  }

  function handleEdit(values: { title: string; description: string; priority: string }) {
    updateOs.mutate(
      { title: values.title, description: values.description, priority: values.priority },
      { onSuccess: () => setEditMode(false) },
    )
  }

  function openEdit() {
    if (!os) return
    editForm.reset({ title: os.title, description: os.description, priority: os.priority })
    setEditMode(true)
  }

  if (!osId) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto flex flex-col gap-0 p-0">
        {isLoading || !os ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <SheetHeader className="mb-3">
                <SheetTitle className="text-base font-semibold">
                  OS #{os.number}
                </SheetTitle>
              </SheetHeader>

              {editMode ? (
                <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Título</Label>
                    <Input {...editForm.register('title', { required: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Textarea {...editForm.register('description', { required: true })} rows={3} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prioridade</Label>
                    <Select
                      defaultValue={os.priority}
                      onValueChange={(v) => editForm.setValue('priority', v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Baixa</SelectItem>
                        <SelectItem value="MEDIUM">Média</SelectItem>
                        <SelectItem value="HIGH">Alta</SelectItem>
                        <SelectItem value="URGENT">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={updateOs.isPending}>
                      {updateOs.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                      Salvar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditMode(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-medium leading-snug">{os.title}</h2>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canEdit && !['COMPLETED_APPROVED', 'CANCELLED'].includes(os.status) && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openEdit}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[os.status])}>
                      {STATUS_LABELS[os.status]}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[os.priority])}>
                      {PRIORITY_LABELS[os.priority]}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {MAINTENANCE_LABELS[os.maintenanceType] ?? os.maintenanceType}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Info */}
              <div className="px-6 py-4 space-y-3 border-b border-border">
                <InfoRow label="Equipamento" value={os.equipment?.name ?? '—'} />
                <InfoRow label="Prestador" value={os.client?.name ?? '—'} />
                {os.group && <InfoRow label="Grupo" value={os.group.name} />}
                {os.technicians?.length > 0 && (
                  <InfoRow
                    label="Técnico(s)"
                    value={os.technicians.map((t) => t.technician.name).join(', ')}
                  />
                )}
                <InfoRow
                  label="Criada em"
                  value={new Date(os.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                />
                {os.completedAt && (
                  <InfoRow
                    label="Concluída em"
                    value={new Date(os.completedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  />
                )}
              </div>

              {/* Descrição */}
              <div className="px-6 py-4 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Descrição</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{os.description}</p>
                {os.resolution && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground mt-3 mb-1.5">Resolução</p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{os.resolution}</p>
                  </>
                )}
              </div>

              {/* Aprovação (se COMPLETED) */}
              {os.status === 'COMPLETED' && canApprove && (
                <div className="px-6 py-4 border-b border-border bg-violet-50 dark:bg-violet-950/20">
                  <p className="text-xs font-semibold text-violet-700 mb-3">
                    Esta OS foi concluída e aguarda sua aprovação
                  </p>
                  {showRejectInput ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Motivo da reprovação..."
                        rows={2}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!rejectReason.trim() || updateStatus.isPending}
                          onClick={handleReject}
                        >
                          {updateStatus.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                          Confirmar Reprovação
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowRejectInput(false); setRejectReason('') }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={updateStatus.isPending}
                        onClick={handleApprove}
                      >
                        {updateStatus.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        }
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setShowRejectInput(true)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Reprovar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Histórico de status */}
              {os.statusHistory?.length > 0 && (
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Histórico</p>
                  <div className="space-y-2">
                    {os.statusHistory.map((h) => (
                      <div key={h.id} className="flex items-start gap-2 text-xs">
                        <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            {h.fromStatus && (
                              <>
                                <span className={cn('px-1.5 py-0.5 rounded text-xs', STATUS_COLORS[h.fromStatus as ServiceOrderStatus])}>
                                  {STATUS_LABELS[h.fromStatus as ServiceOrderStatus]}
                                </span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              </>
                            )}
                            <span className={cn('px-1.5 py-0.5 rounded text-xs', STATUS_COLORS[h.toStatus as ServiceOrderStatus])}>
                              {STATUS_LABELS[h.toStatus as ServiceOrderStatus]}
                            </span>
                            {h.changedBy && (
                              <span className="text-muted-foreground">por {h.changedBy.name}</span>
                            )}
                          </div>
                          {h.reason && (
                            <p className="text-muted-foreground mt-0.5 italic">"{h.reason}"</p>
                          )}
                          <p className="text-muted-foreground mt-0.5">
                            {new Date(h.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comentários */}
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Comentários ({os.comments?.length ?? 0})
                  </p>
                </div>

                {os.comments?.length === 0 && (
                  <p className="text-xs text-muted-foreground italic mb-3">Nenhum comentário ainda.</p>
                )}

                <div className="space-y-3 mb-4">
                  {os.comments?.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">
                        {c.author.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
                        <p className="text-xs font-medium mb-0.5">{c.author.name}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(c.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {canComment && (
                  <form onSubmit={commentForm.handleSubmit(handleComment)} className="flex gap-2">
                    <Textarea
                      {...commentForm.register('content', { required: true })}
                      placeholder="Adicionar comentário..."
                      rows={2}
                      className="flex-1 text-sm resize-none"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={addComment.isPending}
                      className="self-end h-9 w-9 flex-shrink-0"
                    >
                      {addComment.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />
                      }
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground text-xs flex-shrink-0">{label}</span>
      <span className="text-xs font-medium text-right truncate">{value}</span>
    </div>
  )
}
