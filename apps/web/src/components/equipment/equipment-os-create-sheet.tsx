'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, Wrench, AlertTriangle } from 'lucide-react'
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
import { useCreateServiceOrder } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { api } from '@/lib/api'
import type { Equipment } from '@/services/equipment/equipment.service'

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Corretiva',
  INITIAL_ACCEPTANCE: 'Aceitação Inicial',
  EXTERNAL_SERVICE: 'Serviço Externo',
  TECHNOVIGILANCE: 'Tecnovigilância',
  TRAINING: 'Treinamento',
  IMPROPER_USE: 'Uso Indevido',
  DEACTIVATION: 'Desativação',
}

type FormData = {
  clientId: string
  title: string
  description: string
  maintenanceType: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  alertAfterHours: number
}

interface SimpleOption {
  id: string
  name: string
}

interface EquipmentOsCreateSheetProps {
  equipment: Equipment | null
  open: boolean
  onClose: () => void
}

export function EquipmentOsCreateSheet({ equipment, open, onClose }: EquipmentOsCreateSheetProps) {
  const currentUser = useCurrentUser()
  const [clients, setClients] = useState<SimpleOption[]>([])

  const createOs = useCreateServiceOrder()

  // The group comes directly from the equipment's type — no user selection needed
  const equipmentGroup = equipment?.type?.group ?? null
  // If the logged-in user is client-scoped, clientId is already known
  const fixedClientId = currentUser?.clientId ?? null

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      alertAfterHours: 2,
      clientId: fixedClientId ?? '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      priority: 'MEDIUM',
      alertAfterHours: 2,
      clientId: fixedClientId ?? '',
    })

    // Only fetch clients if user doesn't have a fixed clientId
    if (!fixedClientId) {
      api.get('/clients', { params: { limit: 100 } }).then(({ data }) => {
        setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
      })
    }
  }, [open])

  const onSubmit = (values: FormData) => {
    if (!equipment) return
    createOs.mutate(
      {
        clientId: values.clientId,
        equipmentId: equipment.id,
        title: values.title,
        description: values.description,
        maintenanceType: values.maintenanceType as any,
        priority: values.priority,
        // Auto-inject the equipment's type group — prevents the backend validation error
        groupId: equipmentGroup?.id ?? undefined,
        alertAfterHours: values.alertAfterHours,
      },
      {
        onSuccess: () => {
          form.reset()
          onClose()
        },
      },
    )
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[520px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Nova Ordem de Serviço</SheetTitle>
        </SheetHeader>

        {/* Equipment info (read-only) */}
        {equipment && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #f97316)' }}
            >
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{equipment.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[equipment.type?.name, equipment.subtype?.name].filter(Boolean).join(' › ')}
              </p>
            </div>
            {/* Group badge */}
            {equipmentGroup && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
                {equipmentGroup.name}
              </span>
            )}
          </div>
        )}

        {/* Warning: equipment type has no group */}
        {equipment && !equipmentGroup && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-5">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              O tipo deste equipamento não tem grupo de manutenção vinculado.
              A OS será criada sem grupo e qualquer técnico poderá assumir.
              Configure o grupo no cadastro de tipos para rotear corretamente.
            </p>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Cliente — oculto se o usuário já tem clientId fixo */}
          {fixedClientId ? (
            <input type="hidden" {...form.register('clientId')} value={fixedClientId} />
          ) : (
            <div className="space-y-1.5">
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
              {form.formState.errors.clientId && (
                <p className="text-xs text-red-500">{form.formState.errors.clientId.message}</p>
              )}
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <Label>Título <span className="text-red-500">*</span></Label>
            <Input
              {...form.register('title', { required: 'Título obrigatório' })}
              placeholder="Ex: Falha no compressor do ar condicionado"
              className={form.formState.errors.title ? 'border-red-500' : ''}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição <span className="text-red-500">*</span></Label>
            <Textarea
              {...form.register('description', { required: 'Descrição obrigatória' })}
              placeholder="Descreva o problema ou serviço a ser realizado..."
              rows={3}
              className={form.formState.errors.description ? 'border-red-500' : ''}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>
            )}
          </div>

          {/* Tipo + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo <span className="text-red-500">*</span></Label>
              <Select onValueChange={(v) => form.setValue('maintenanceType', v)}>
                <SelectTrigger className={form.formState.errors.maintenanceType ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.maintenanceType && (
                <p className="text-xs text-red-500">{form.formState.errors.maintenanceType.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select defaultValue="MEDIUM" onValueChange={(v) => form.setValue('priority', v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">⚪ Baixa</SelectItem>
                  <SelectItem value="MEDIUM">🔵 Média</SelectItem>
                  <SelectItem value="HIGH">🟠 Alta</SelectItem>
                  <SelectItem value="URGENT">🔴 Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Alerta */}
          <div className="space-y-1.5">
            <Label>Alertar após (horas sem técnico)</Label>
            <Input
              type="number"
              min={1}
              max={72}
              {...form.register('alertAfterHours', { valueAsNumber: true })}
              className="w-24"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={createOs.isPending} className="flex-1">
              {createOs.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar OS
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
