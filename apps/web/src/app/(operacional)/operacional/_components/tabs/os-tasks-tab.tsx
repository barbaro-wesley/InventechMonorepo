'use client'

import { useState } from 'react'
import { Plus, CheckCircle2, Circle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ServiceOrderTask, TaskStatus } from '@/services/service-orders/service-orders.types'
import { useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/service-orders/use-service-orders'

interface OsTasksTabProps {
  clientId: string | null
  osId: string
  tasks: ServiceOrderTask[]
}

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
}

function TaskRow({
  task,
  clientId,
  osId,
}: {
  task: ServiceOrderTask
  clientId: string | null
  osId: string
}) {
  const updateTask = useUpdateTask(clientId, osId)
  const deleteTask = useDeleteTask(clientId, osId)

  const handleToggle = () => {
    updateTask.mutate({
      taskId: task.id,
      dto: { status: STATUS_CYCLE[task.status] },
    })
  }

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-[#f8f9fb] group transition-colors">
      <button
        onClick={handleToggle}
        disabled={updateTask.isPending}
        className="mt-0.5 shrink-0"
      >
        {updateTask.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#6c7c93]" />
        ) : task.status === 'DONE' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : task.status === 'IN_PROGRESS' ? (
          <Loader2 className="h-4 w-4 text-indigo-500" />
        ) : (
          <Circle className="h-4 w-4 text-[#6c7c93]" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            task.status === 'DONE'
              ? 'line-through text-[#6c7c93]'
              : 'text-[#1d2530]'
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-[#6c7c93] mt-0.5">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-[#6c7c93]">
            {TASK_STATUS_LABEL[task.status]}
          </span>
          {task.dueDate && (
            <span className="text-[10px] text-[#6c7c93]">
              · Vence {new Date(task.dueDate).toLocaleDateString('pt-BR')}
            </span>
          )}
          {task.assignedTo && (
            <span className="text-[10px] text-[#6c7c93]">
              · {task.assignedTo.name}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => deleteTask.mutate(task.id)}
        disabled={deleteTask.isPending}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#6c7c93] hover:text-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function OsTasksTab({ clientId, osId, tasks }: OsTasksTabProps) {
  const [newTitle, setNewTitle] = useState('')
  const createTask = useCreateTask(clientId, osId)

  const todo = tasks.filter((t) => t.status === 'TODO')
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS')
  const done = tasks.filter((t) => t.status === 'DONE')

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    createTask.mutate(
      { title: newTitle.trim() },
      { onSuccess: () => setNewTitle('') },
    )
  }

  const progress = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0

  return (
    <div className="space-y-4 py-1">
      {/* Progresso */}
      {tasks.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-[#6c7c93]">
              {done.length} de {tasks.length} concluídas
            </span>
            <span className="text-xs font-medium text-[#1d2530]">{progress}%</span>
          </div>
          <div className="h-1.5 bg-[#f3f4f7] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Nova tarefa */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="Nova tarefa..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-8 text-sm bg-[#f3f4f7] border-transparent focus:border-[#0d4da5] focus:bg-white"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newTitle.trim() || createTask.isPending}
          className="h-8 shrink-0 bg-[#0d4da5] hover:bg-[#0a3776] text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>

      {/* Lista de tarefas */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[#6c7c93]">
          <CheckCircle2 className="h-7 w-7 mb-2 opacity-30" />
          <p className="text-sm">Nenhuma tarefa ainda</p>
        </div>
      ) : (
        <div className="space-y-0.5 -mx-1">
          {[...inProgress, ...todo, ...done].map((task) => (
            <TaskRow key={task.id} task={task} clientId={clientId} osId={osId} />
          ))}
        </div>
      )}
    </div>
  )
}
