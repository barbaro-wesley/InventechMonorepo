'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Plus,
  CheckCircle2,
  Circle,
  Loader2,
  Trash2,
  Clock,
  GripVertical,
  User,
  CalendarDays,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  ServiceOrderTask,
  TaskStatus,
} from '@/services/service-orders/service-orders.types'
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from '@/hooks/service-orders/use-service-orders'

interface OsTasksTabProps {
  clientId: string | null
  osId: string
  tasks: ServiceOrderTask[]
}

const COLUMNS: { status: TaskStatus; label: string; color: string; bgHeader: string; dotColor: string; borderColor: string; iconColor: string }[] = [
  {
    status: 'TODO',
    label: 'A Fazer',
    color: 'text-slate-600',
    bgHeader: 'bg-slate-50',
    dotColor: 'bg-slate-400',
    borderColor: 'border-slate-200',
    iconColor: 'text-slate-400',
  },
  {
    status: 'IN_PROGRESS',
    label: 'Em Andamento',
    color: 'text-indigo-600',
    bgHeader: 'bg-indigo-50',
    dotColor: 'bg-indigo-500',
    borderColor: 'border-indigo-200',
    iconColor: 'text-indigo-500',
  },
  {
    status: 'DONE',
    label: 'Concluída',
    color: 'text-emerald-600',
    bgHeader: 'bg-emerald-50',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-500',
  },
]

const TASK_STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  TODO: <Circle className="h-3.5 w-3.5 text-slate-400" />,
  IN_PROGRESS: <Loader2 className="h-3.5 w-3.5 text-indigo-500 animate-spin" />,
  DONE: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
}

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
}

const STATUS_NEXT_LABEL: Record<TaskStatus, string> = {
  TODO: 'Iniciar',
  IN_PROGRESS: 'Concluir',
  DONE: 'Reabrir',
}

/* ───────────────── Task card ───────────────── */
function TaskCard({
  task,
  clientId,
  osId,
  isDragging,
  onDragStart,
}: {
  task: ServiceOrderTask
  clientId: string | null
  osId: string
  isDragging: boolean
  onDragStart: (e: React.DragEvent, taskId: string) => void
}) {
  const updateTask = useUpdateTask(clientId, osId)
  const deleteTask = useDeleteTask(clientId, osId)

  const handleAdvance = () => {
    updateTask.mutate({
      taskId: task.id,
      dto: { status: STATUS_NEXT[task.status] },
    })
  }

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`
        group relative rounded-xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]
        hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-40 scale-[0.97] ring-2 ring-indigo-300' : ''}
        ${task.status === 'DONE' ? 'border-emerald-100 bg-emerald-50/30' : 'border-[#e0e5eb]'}
      `}
    >
      {/* Grip handle */}
      <div className="absolute top-2.5 left-1.5 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical className="h-3.5 w-3.5 text-slate-400" />
      </div>

      <div className="px-3.5 pt-3 pb-2.5 pl-5">
        {/* Title */}
        <p
          className={`text-[13px] font-medium leading-snug ${
            task.status === 'DONE'
              ? 'line-through text-slate-400'
              : 'text-[#1d2530]'
          }`}
        >
          {task.title}
        </p>

        {/* Description */}
        {task.description && (
          <p className="text-[11px] text-[#6c7c93] mt-1 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                isOverdue
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}
          {task.assignedTo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200">
              <User className="h-3 w-3" />
              {task.assignedTo.name.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-dashed border-slate-100">
          <button
            onClick={handleAdvance}
            disabled={updateTask.isPending}
            className={`
              inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg
              transition-colors
              ${task.status === 'TODO'
                ? 'text-indigo-600 hover:bg-indigo-50'
                : task.status === 'IN_PROGRESS'
                  ? 'text-emerald-600 hover:bg-emerald-50'
                  : 'text-slate-500 hover:bg-slate-50'
              }
            `}
          >
            {updateTask.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <ArrowRight className="h-3 w-3" />
                {STATUS_NEXT_LABEL[task.status]}
              </>
            )}
          </button>

          <button
            onClick={() => deleteTask.mutate(task.id)}
            disabled={deleteTask.isPending}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50"
          >
            {deleteTask.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────── Kanban Column ───────────────── */
function KanbanColumn({
  column,
  tasks,
  clientId,
  osId,
  draggingId,
  onDragStart,
  onDrop,
}: {
  column: (typeof COLUMNS)[number]
  tasks: ServiceOrderTask[]
  clientId: string | null
  osId: string
  draggingId: string | null
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDrop: (status: TaskStatus) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`
        flex flex-col rounded-xl border transition-all duration-200 min-h-[200px]
        ${dragOver ? `${column.borderColor} bg-opacity-60 ring-2 ring-offset-1 ring-indigo-200` : 'border-[#e8eaef] bg-[#fafbfc]'}
      `}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onDrop(column.status)
      }}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-t-xl ${column.bgHeader}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${column.dotColor}`} />
          <span className={`text-xs font-semibold ${column.color}`}>
            {column.label}
          </span>
        </div>
        <span
          className={`
            text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center
            rounded-full ${column.bgHeader} ${column.color}
          `}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[400px]">
        {tasks.length === 0 ? (
          <div
            className={`
              flex flex-col items-center justify-center py-6 text-slate-300
              ${dragOver ? 'opacity-100' : 'opacity-50'}
              transition-opacity
            `}
          >
            <div className={`h-8 w-8 rounded-full border-2 border-dashed ${column.borderColor} flex items-center justify-center mb-2`}>
              {column.status === 'TODO' && <Circle className="h-3.5 w-3.5 text-slate-300" />}
              {column.status === 'IN_PROGRESS' && <Clock className="h-3.5 w-3.5 text-indigo-300" />}
              {column.status === 'DONE' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
            </div>
            <span className="text-[11px]">
              {dragOver ? 'Solte aqui' : 'Nenhuma tarefa'}
            </span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              clientId={clientId}
              osId={osId}
              isDragging={draggingId === task.id}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ───────────────── Main component ───────────────── */
export function OsTasksTab({ clientId, osId, tasks }: OsTasksTabProps) {
  const [newTitle, setNewTitle] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const createTask = useCreateTask(clientId, osId)
  const updateTask = useUpdateTask(clientId, osId)

  const todo = tasks.filter((t) => t.status === 'TODO')
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS')
  const done = tasks.filter((t) => t.status === 'DONE')

  const tasksByStatus: Record<TaskStatus, ServiceOrderTask[]> = {
    TODO: todo,
    IN_PROGRESS: inProgress,
    DONE: done,
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    createTask.mutate(
      { title: newTitle.trim() },
      { onSuccess: () => setNewTitle('') },
    )
  }

  const handleDragStart = useCallback(
    (e: React.DragEvent, taskId: string) => {
      e.dataTransfer.setData('text/plain', taskId)
      e.dataTransfer.effectAllowed = 'move'
      setDraggingId(taskId)
    },
    [],
  )

  const handleDrop = useCallback(
    (newStatus: TaskStatus) => {
      if (!draggingId) return
      const task = tasks.find((t) => t.id === draggingId)
      if (task && task.status !== newStatus) {
        updateTask.mutate({ taskId: draggingId, dto: { status: newStatus } })
      }
      setDraggingId(null)
    },
    [draggingId, tasks, updateTask],
  )

  const progress =
    tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0

  return (
    <div className="space-y-4 py-1">
      {/* Progress bar */}
      {tasks.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-[#6c7c93]">
              {done.length} de {tasks.length} concluídas
            </span>
            <span className="text-xs font-medium text-[#1d2530]">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-[#f3f4f7] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  progress === 100
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #6366f1, #818cf8)',
              }}
            />
          </div>
        </div>
      )}

      {/* New task form */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="Nova tarefa..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-9 text-sm bg-[#f3f4f7] border-transparent focus:border-[#0d4da5] focus:bg-white rounded-lg"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newTitle.trim() || createTask.isPending}
          className="h-9 shrink-0 bg-[#0d4da5] hover:bg-[#0a3776] text-white rounded-lg px-3.5"
        >
          {createTask.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </form>

      {/* Kanban board */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#6c7c93]">
          <div className="h-14 w-14 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 opacity-30" />
          </div>
          <p className="text-sm font-medium text-slate-400">Nenhuma tarefa ainda</p>
          <p className="text-xs text-slate-300 mt-1">
            Adicione tarefas para organizar o trabalho
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-3 gap-3"
          onDragEnd={() => setDraggingId(null)}
        >
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              column={col}
              tasks={tasksByStatus[col.status]}
              clientId={clientId}
              osId={osId}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}
