'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, CalendarClock, AlertTriangle, Wrench } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetFooter,
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
import {
  useCreateMaintenanceSchedule,
  useCreateBatchMaintenanceSchedule,
} from '@/hooks/maintenance/use-maintenance-schedule'
import { useCurrentUser } from '@/store/auth.store'
import { api } from '@/lib/api'
import type { Equipment } from '@/services/equipment/equipment.service'

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  CUSTOM: 'Personalizada',
}

type FormData = {
  clientId: string
  title: string
  description: string
  recurrenceType: string
  customIntervalDays: number
  estimatedDurationMin: number
  startDate: string
}

interface SimpleOption {
  id: string
  name: string
}

interface EquipmentScheduleCreateSheetProps {
  equipment?: Equipment | null
  batchEquipment?: { id: string; name: string }[]
  open: boolean
  onClose: () => void
}

export function EquipmentScheduleCreateSheet({
  equipment,
  batchEquipment,
  open,
  onClose,
}: EquipmentScheduleCreateSheetProps) {
  const currentUser = useCurrentUser()
  const [clients, setClients] = useState<SimpleOption[]>([])

  const isBatch = !!batchEquipment?.length

  const createSchedule = useCreateMaintenanceSchedule()
  const createBatchSchedule = useCreateBatchMaintenanceSchedule()

  const isPending = isBatch ? createBatchSchedule.isPending : createSchedule.isPending

  const equipmentGroup = equipment?.type?.group ?? null
  const fixedClientId = currentUser?.clientId ?? null

  const form = useForm<FormData>({
    defaultValues: {
      clientId: fixedClientId ?? '',
      recurrenceType: 'MONTHLY',
      estimatedDurationMin: 60,
      startDate: new Date().toISOString().split('T')[0],
    },
  })

  const recurrenceType = form.watch('recurrenceType')

  useEffect(() => {
    if (!open) return
    form.reset({
      clientId: fixedClientId ?? '',
      recurrenceType: 'MONTHLY',
      estimatedDurationMin: 60,
      startDate: new Date().toISOString().split('T')[0],
    })

    if (!fixedClientId) {
      api.get('/clients', { params: { limit: 100 } }).then(({ data }) => {
        setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
      })
    }
  }, [open])

  const onSubmit = (values: FormData) => {
    const commonFields = {
      clientId: values.clientId,
      title: values.title,
      description: values.description,
      maintenanceType: 'PREVENTIVE' as const,
      recurrenceType: values.recurrenceType as any,
      ...(values.recurrenceType === 'CUSTOM' && {
        customIntervalDays: Number(values.customIntervalDays),
      }),
      estimatedDurationMin: Number(values.estimatedDurationMin),
      startDate: values.startDate,
    }

    if (isBatch) {
      createBatchSchedule.mutate(
        {
          ...commonFields,
          equipmentIds: batchEquipment!.map((e) => e.id),
        },
        {
          onSuccess: () => {
            form.reset()
            onClose()
          },
        },
      )
    } else {
      if (!equipment) return
      createSchedule.mutate(
        {
          ...commonFields,
          equipmentId: equipment.id,
          groupId: equipmentGroup?.id ?? undefined,
        },
        {
          onSuccess: () => {
            form.reset()
            onClose()
          },
        },
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="overflow-y-auto p-6" style={{ width: '100%', maxWidth: '520px' }}>
        <SheetHeader>
          <SheetTitle>{isBatch ? 'Agendar Preventiva em Lote' : 'Agendar Preventiva'}</SheetTitle>
          {isBatch && (
            <p className="text-xs text-muted-foreground">
              Cria um agendamento para cada um dos {batchEquipment!.length} equipamentos selecionados
            </p>
          )}
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 mt-6 pb-6">
          {/* Equipment info — single mode */}
          {!isBatch && equipment && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}
              >
                <CalendarClock className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{equipment.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[equipment.type?.name, equipment.subtype?.name].filter(Boolean).join(' › ')}
                </p>
              </div>
              {equipmentGroup && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
                  {equipmentGroup.name}
                </span>
              )}
            </div>
          )}

          {/* Equipment list — batch mode */}
          {isBatch && (
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60 max-h-48 overflow-y-auto">
              {batchEquipment!.map((eq) => (
                <div key={eq.id} className="flex items-center gap-2.5 px-4 py-2.5 bg-card">
                  <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{eq.name}</span>
                </div>
              ))}
            </div>
          )}

          {!isBatch && equipment && !equipmentGroup && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                O tipo deste equipamento não tem grupo de manutenção vinculado.
                As OS geradas automaticamente não serão roteadas para nenhum grupo.
                Configure o grupo no cadastro de tipos.
              </p>
            </div>
          )}

          {/* Cliente */}
          {fixedClientId ? (
            <input type="hidden" {...form.register('clientId')} value={fixedClientId} />
          ) : (
            <div className="space-y-2">
              <Label>Prestador <span className="text-red-500">*</span></Label>
              <Select
                onValueChange={(v) => form.setValue('clientId', v)}
                defaultValue={form.getValues('clientId') || undefined}
              >
                <SelectTrigger className={form.formState.errors.clientId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione o prestador" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seção: Identificação */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identificação</p>

            <div className="space-y-2">
              <Label>Título <span className="text-red-500">*</span></Label>
              <Input
                {...form.register('title', { required: 'Título obrigatório' })}
                placeholder="Ex: Preventiva mensal — Ar condicionado"
                className={form.formState.errors.title ? 'border-red-500' : ''}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                {...form.register('description')}
                placeholder="Descreva o que deve ser feito na preventiva..."
                rows={3}
              />
            </div>
          </div>

          {/* Seção: Agendamento */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agendamento</p>

            <div className="space-y-2">
              <Label>Recorrência <span className="text-red-500">*</span></Label>
              <Select
                defaultValue="MONTHLY"
                onValueChange={(v) => form.setValue('recurrenceType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {recurrenceType === 'CUSTOM' && (
              <div className="space-y-2">
                <Label>Intervalo (dias) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register('customIntervalDays', {
                    required: 'Obrigatório para recorrência personalizada',
                    valueAsNumber: true,
                  })}
                  placeholder="Ex: 45"
                  className={form.formState.errors.customIntervalDays ? 'border-red-500' : ''}
                />
                {form.formState.errors.customIntervalDays && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.customIntervalDays.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de início <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  {...form.register('startDate', { required: 'Data obrigatória' })}
                  className={form.formState.errors.startDate ? 'border-red-500' : ''}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-red-500">{form.formState.errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Duração estimada (min)</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register('estimatedDurationMin', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="mt-auto pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isBatch ? 'Agendar em Lote' : 'Agendar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
