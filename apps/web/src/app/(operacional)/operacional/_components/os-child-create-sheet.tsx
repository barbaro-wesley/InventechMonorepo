'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { GitBranch, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateChildServiceOrder } from '@/hooks/service-orders/use-service-orders'
import { api } from '@/lib/api'
import { MAINTENANCE_TYPE_LABELS } from './os-utils'
import type { MaintenanceType, RecurrenceType } from '@/services/service-orders/service-orders.types'

// Tipos de filha permitidos por tipo de pai (espelho da matriz do backend)
const CHILD_ALLOWED_TYPES: Record<MaintenanceType, MaintenanceType[]> = {
  CORRECTIVE:         ['PREVENTIVE', 'CORRECTIVE', 'DEACTIVATION'],
  INITIAL_ACCEPTANCE: ['PREVENTIVE', 'CORRECTIVE'],
  PREVENTIVE:         ['CORRECTIVE', 'DEACTIVATION'],
  EXTERNAL_SERVICE:   ['CORRECTIVE'],
  TECHNOVIGILANCE:    ['CORRECTIVE'],
  IMPROPER_USE:       ['CORRECTIVE', 'DEACTIVATION'],
  DEACTIVATION:       [],
  TRAINING:           [],
}

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  DAILY:      'Diária',
  WEEKLY:     'Semanal',
  BIWEEKLY:   'Quinzenal',
  MONTHLY:    'Mensal',
  QUARTERLY:  'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL:     'Anual',
  CUSTOM:     'Intervalo personalizado',
}

interface SimpleOption { id: string; name: string }

type ChildType = 'SERVICE_ORDER' | 'MAINTENANCE_SCHEDULE'

type FormData = {
  title: string
  description: string
  maintenanceType: MaintenanceType
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  groupId: string
  technicianId: string
  scheduledFor: string
  recurrenceType: RecurrenceType
  customIntervalDays: number
  startDate: string
  endDate: string
}

interface OsChildCreateSheetProps {
  open: boolean
  onClose: () => void
  parentId: string
  parentNumber: number
  parentMaintenanceType: MaintenanceType
  clientId: string | null
}

export function OsChildCreateSheet({
  open,
  onClose,
  parentId,
  parentNumber,
  parentMaintenanceType,
  clientId,
}: OsChildCreateSheetProps) {
  const [childType, setChildType] = useState<ChildType>('SERVICE_ORDER')
  const [groups, setGroups] = useState<SimpleOption[]>([])
  const [technicians, setTechnicians] = useState<SimpleOption[]>([])

  const createChild = useCreateChildServiceOrder(clientId, parentId)
  const allowedTypes = CHILD_ALLOWED_TYPES[parentMaintenanceType] ?? []

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      recurrenceType: 'MONTHLY',
    },
  })

  const recurrenceType = form.watch('recurrenceType')

  useEffect(() => {
    if (!open) return
    api.get('/maintenance-groups', { params: { limit: 100 } }).then(({ data }) =>
      setGroups((data?.data ?? []).map((g: any) => ({ id: g.id, name: g.name }))),
    )
    api.get('/users', { params: { role: 'TECHNICIAN', limit: 100 } }).then(({ data }) =>
      setTechnicians((data?.data ?? []).map((u: any) => ({ id: u.id, name: u.name }))),
    )
  }, [open])

  const handleClose = () => {
    form.reset()
    setChildType('SERVICE_ORDER')
    onClose()
  }

  const onSubmit = form.handleSubmit((values) => {
    createChild.mutate(
      {
        childType,
        title: values.title,
        description: values.description,
        maintenanceType: values.maintenanceType,
        groupId: values.groupId || undefined,
        technicianId: values.technicianId || undefined,
        ...(childType === 'SERVICE_ORDER' && {
          priority: values.priority,
          scheduledFor: values.scheduledFor || undefined,
        }),
        ...(childType === 'MAINTENANCE_SCHEDULE' && {
          recurrenceType: values.recurrenceType,
          customIntervalDays: values.recurrenceType === 'CUSTOM' ? Number(values.customIntervalDays) : undefined,
          startDate: values.startDate,
          endDate: values.endDate || undefined,
        }),
      },
      { onSuccess: handleClose },
    )
  })

  if (allowedTypes.length === 0) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:!w-[480px] sm:!max-w-[480px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-[#e0e5eb]">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="h-4 w-4 text-violet-500" />
            <span className="text-xs text-[#6c7c93]">OS Vinculada à OS #{parentNumber}</span>
          </div>
          <SheetTitle className="text-base text-[#1d2530]">Nova OS Vinculada</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Toggle tipo de filho */}
          <div className="flex rounded-lg border border-[#e0e5eb] overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setChildType('SERVICE_ORDER')}
              className={`flex-1 py-2 text-center transition-colors ${
                childType === 'SERVICE_ORDER'
                  ? 'bg-[#0d4da5] text-white font-medium'
                  : 'bg-white text-[#6c7c93] hover:bg-[#f8f9fc]'
              }`}
            >
              OS Avulsa
            </button>
            <button
              type="button"
              onClick={() => setChildType('MAINTENANCE_SCHEDULE')}
              className={`flex-1 py-2 text-center transition-colors ${
                childType === 'MAINTENANCE_SCHEDULE'
                  ? 'bg-[#0d4da5] text-white font-medium'
                  : 'bg-white text-[#6c7c93] hover:bg-[#f8f9fc]'
              }`}
            >
              Agendamento Recorrente
            </button>
          </div>

          {/* Tipo de manutenção */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de Manutenção</Label>
            <Select
              value={form.watch('maintenanceType')}
              onValueChange={(v) => form.setValue('maintenanceType', v as MaintenanceType)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {MAINTENANCE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.maintenanceType && (
              <p className="text-xs text-red-500">Obrigatório</p>
            )}
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              className="h-9 text-sm"
              placeholder="Título da OS vinculada"
              {...form.register('title', { required: true })}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-red-500">Obrigatório</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              className="text-sm resize-none"
              rows={3}
              placeholder="Descreva o que deve ser feito"
              {...form.register('description', { required: true })}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-red-500">Obrigatório</p>
            )}
          </div>

          {/* Campos específicos de OS avulsa */}
          {childType === 'SERVICE_ORDER' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select
                  value={form.watch('priority')}
                  onValueChange={(v) => form.setValue('priority', v as FormData['priority'])}
                >
                  <SelectTrigger className="h-9 text-sm">
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

              <div className="space-y-1.5">
                <Label className="text-xs">Data de agendamento (opcional)</Label>
                <Input
                  type="datetime-local"
                  className="h-9 text-sm"
                  {...form.register('scheduledFor')}
                />
              </div>
            </>
          )}

          {/* Campos específicos de agendamento recorrente */}
          {childType === 'MAINTENANCE_SCHEDULE' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Recorrência</Label>
                <Select
                  value={form.watch('recurrenceType')}
                  onValueChange={(v) => form.setValue('recurrenceType', v as RecurrenceType)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map((r) => (
                      <SelectItem key={r} value={r}>{RECURRENCE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType === 'CUSTOM' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Intervalo (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 text-sm"
                    {...form.register('customIntervalDays', { required: recurrenceType === 'CUSTOM' })}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Data de início</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  {...form.register('startDate', { required: childType === 'MAINTENANCE_SCHEDULE' })}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-red-500">Obrigatório</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Data de encerramento (opcional)</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  {...form.register('endDate')}
                />
              </div>
            </>
          )}

          {/* Grupo e técnico — comuns */}
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Grupo responsável (herdado do pai)</Label>
              <Select
                value={form.watch('groupId') ?? ''}
                onValueChange={(v) => form.setValue('groupId', v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Manter grupo do pai" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {technicians.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Técnico (opcional)</Label>
              <Select
                value={form.watch('technicianId') ?? ''}
                onValueChange={(v) => form.setValue('technicianId', v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Nenhum — vai para o painel" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e0e5eb] flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-9 text-sm"
            onClick={handleClose}
            disabled={createChild.isPending}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 h-9 text-sm bg-[#0d4da5] hover:bg-[#0a3776]"
            onClick={onSubmit}
            disabled={createChild.isPending}
          >
            {createChild.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : null}
            {childType === 'MAINTENANCE_SCHEDULE' ? 'Criar Agendamento' : 'Criar OS'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
