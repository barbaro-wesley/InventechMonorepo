'use client'

import { useMemo } from 'react'
import {
  ArrowRight,
  MessageSquare,
  CheckSquare,
  UserPlus,
  Paperclip,
  Circle,
  Plus,
  LogIn,
} from 'lucide-react'
import type { ServiceOrderDetail, ServiceOrderStatus } from '@/services/service-orders/service-orders.types'
import { STATUS_CONFIG, timeAgo } from '../os-utils'

interface OsHistoryTabProps {
  os: ServiceOrderDetail
}

type EventKind =
  | 'status'
  | 'comment'
  | 'task_created'
  | 'task_completed'
  | 'technician_added'
  | 'technician_assumed'
  | 'attachment'
  | 'created'

interface ActivityEvent {
  id: string
  kind: EventKind
  date: string
  actor?: string
  // status
  statusFrom?: ServiceOrderStatus | null
  statusTo?: ServiceOrderStatus
  reason?: string
  // comment
  commentContent?: string
  isInternal?: boolean
  // task
  taskTitle?: string
  // technician
  technicianName?: string
  // attachment
  attachmentName?: string
}

function buildTimeline(os: ServiceOrderDetail): ActivityEvent[] {
  const events: ActivityEvent[] = []

  // OS criada
  events.push({
    id: `created-${os.id}`,
    kind: 'created',
    date: os.createdAt,
    actor: os.requester?.name,
  })

  // Mudanças de status
  for (const h of os.statusHistory ?? []) {
    events.push({
      id: h.id,
      kind: 'status',
      date: h.createdAt,
      actor: h.changedBy?.name,
      statusFrom: h.fromStatus,
      statusTo: h.toStatus,
      reason: h.reason ?? undefined,
    })
  }

  // Comentários
  for (const c of os.comments ?? []) {
    events.push({
      id: `comment-${c.id}`,
      kind: 'comment',
      date: c.createdAt,
      actor: c.author?.name,
      commentContent: c.content,
      isInternal: c.isInternal,
    })
  }

  // Tarefas
  for (const t of os.tasks ?? []) {
    events.push({
      id: `task-created-${t.id}`,
      kind: 'task_created',
      date: t.createdAt,
      taskTitle: t.title,
    })
    if (t.completedAt) {
      events.push({
        id: `task-done-${t.id}`,
        kind: 'task_completed',
        date: t.completedAt,
        actor: t.assignedTo?.name,
        taskTitle: t.title,
      })
    }
  }

  // Técnicos adicionados / assumiram
  for (const tech of os.technicians ?? []) {
    events.push({
      id: `tech-added-${tech.id}`,
      kind: 'technician_added',
      date: tech.assignedAt,
      technicianName: tech.technician.name,
    })
    if (tech.assumedAt) {
      events.push({
        id: `tech-assumed-${tech.id}`,
        kind: 'technician_assumed',
        date: tech.assumedAt,
        actor: tech.technician.name,
        technicianName: tech.technician.name,
      })
    }
  }

  // Anexos
  for (const a of os.attachments ?? []) {
    events.push({
      id: `attach-${a.id}`,
      kind: 'attachment',
      date: a.createdAt,
      attachmentName: a.fileName,
    })
  }

  // Ordena por data decrescente (mais recente primeiro)
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function EventIcon({ kind }: { kind: EventKind }) {
  const base = 'h-3 w-3'
  switch (kind) {
    case 'created':       return <Plus className={`${base} text-[#6c7c93]`} />
    case 'status':        return <Circle className={`${base} text-[#6c7c93]`} />
    case 'comment':       return <MessageSquare className={`${base} text-blue-500`} />
    case 'task_created':  return <CheckSquare className={`${base} text-slate-400`} />
    case 'task_completed':return <CheckSquare className={`${base} text-emerald-500`} />
    case 'technician_added':  return <UserPlus className={`${base} text-violet-500`} />
    case 'technician_assumed':return <LogIn className={`${base} text-indigo-500`} />
    case 'attachment':    return <Paperclip className={`${base} text-amber-500`} />
  }
}

function dotColor(kind: EventKind): string {
  switch (kind) {
    case 'created':           return 'bg-[#6c7c93]'
    case 'status':            return 'bg-[#6c7c93]'
    case 'comment':           return 'bg-blue-400'
    case 'task_created':      return 'bg-slate-300'
    case 'task_completed':    return 'bg-emerald-400'
    case 'technician_added':  return 'bg-violet-400'
    case 'technician_assumed':return 'bg-indigo-400'
    case 'attachment':        return 'bg-amber-400'
  }
}

function EventBody({ ev }: { ev: ActivityEvent }) {
  switch (ev.kind) {
    case 'created':
      return (
        <p className="text-xs text-[#1d2530]">
          OS criada{ev.actor ? ` por ${ev.actor}` : ''}
        </p>
      )

    case 'status': {
      const toStatus = STATUS_CONFIG[ev.statusTo!]
      const fromStatus = ev.statusFrom ? STATUS_CONFIG[ev.statusFrom] : null
      return (
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {fromStatus && (
              <>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${fromStatus.bg} ${fromStatus.color}`}>
                  {fromStatus.label}
                </span>
                <ArrowRight className="h-3 w-3 text-[#6c7c93] shrink-0" />
              </>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${toStatus.bg} ${toStatus.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${toStatus.dot}`} />
              {toStatus.label}
            </span>
          </div>
          {ev.reason && (
            <p className="text-xs text-[#6c7c93] mt-1 leading-relaxed">"{ev.reason}"</p>
          )}
        </div>
      )
    }

    case 'comment':
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-[#1d2530]">
              {ev.actor ? `${ev.actor} adicionou um comentário` : 'Comentário adicionado'}
            </p>
            {ev.isInternal && (
              <span className="text-[9px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                Interno
              </span>
            )}
          </div>
          {ev.commentContent && (
            <p className="text-xs text-[#6c7c93] mt-0.5 line-clamp-2 leading-relaxed">
              "{ev.commentContent}"
            </p>
          )}
        </div>
      )

    case 'task_created':
      return (
        <p className="text-xs text-[#1d2530]">
          Tarefa criada: <span className="font-medium">{ev.taskTitle}</span>
        </p>
      )

    case 'task_completed':
      return (
        <p className="text-xs text-[#1d2530]">
          Tarefa concluída: <span className="font-medium">{ev.taskTitle}</span>
          {ev.actor ? ` por ${ev.actor}` : ''}
        </p>
      )

    case 'technician_added':
      return (
        <p className="text-xs text-[#1d2530]">
          Técnico adicionado: <span className="font-medium">{ev.technicianName}</span>
        </p>
      )

    case 'technician_assumed':
      return (
        <p className="text-xs text-[#1d2530]">
          <span className="font-medium">{ev.technicianName}</span> assumiu a OS
        </p>
      )

    case 'attachment':
      return (
        <p className="text-xs text-[#1d2530]">
          Anexo adicionado: <span className="font-medium">{ev.attachmentName}</span>
        </p>
      )
  }
}

export function OsHistoryTab({ os }: OsHistoryTabProps) {
  const events = useMemo(() => buildTimeline(os), [os])

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[#6c7c93]">
        <p className="text-sm">Nenhuma atividade registrada</p>
      </div>
    )
  }

  return (
    <div className="py-1">
      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-3.5 top-3 bottom-3 w-px bg-[#e0e5eb]" />

        <div className="space-y-1">
          {events.map((ev) => (
            <div key={ev.id} className="flex gap-4 relative">
              {/* Dot */}
              <div className={`h-3 w-3 rounded-full border-2 border-white shadow-sm shrink-0 mt-3.5 z-10 ${dotColor(ev.kind)}`} />

              {/* Conteúdo */}
              <div className="flex-1 pb-3">
                <div className="bg-white rounded-lg border border-[#e0e5eb] p-3">
                  <div className="flex items-start gap-2">
                    <EventIcon kind={ev.kind} />
                    <div className="flex-1 min-w-0">
                      <EventBody ev={ev} />
                      <div className="flex items-center gap-2 mt-1.5">
                        {ev.actor && ev.kind !== 'comment' && ev.kind !== 'technician_assumed' && ev.kind !== 'task_completed' && (
                          <span className="text-[11px] font-medium text-[#1d2530]">{ev.actor}</span>
                        )}
                        <span className="text-[10px] text-[#6c7c93]">{timeAgo(ev.date)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
