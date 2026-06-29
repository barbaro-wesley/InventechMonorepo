'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, Layers, CheckCircle2, ClipboardList, Wrench } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCreateBatchServiceOrders } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { usePermissions } from '@/hooks/auth/use-permissions'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { BatchServiceOrderResult } from '@/services/service-orders/service-orders.types'

interface SimpleOption { id: string; name: string }

interface OsBatchCreateSheetProps {
  open: boolean
  onClose: () => void
  clientId?: string
  preselectedEquipment?: { id: string; name: string }[]
}

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Corretiva',
  PREVENTIVE: 'Preventiva',
  INITIAL_ACCEPTANCE: 'Aceitação Inicial',
  EXTERNAL_SERVICE: 'Serviço Externo',
  TECHNOVIGILANCE: 'Tecnovigilância',
  TRAINING: 'Treinamento',
  IMPROPER_USE: 'Uso Indevido',
  DEACTIVATION: 'Desativação',
}

const PRIORITY_OPTIONS = [
  { value: 'LOW',    label: 'Baixa',      emoji: '🟢', desc: '5 dias úteis'  },
  { value: 'MEDIUM', label: 'Média',      emoji: '🔵', desc: '3 dias úteis'  },
  { value: 'HIGH',   label: 'Alta',       emoji: '🟠', desc: '1 dia útil'    },
  { value: 'URGENT', label: 'Muito Alta', emoji: '🔴', desc: 'até 1 hora'    },
]

type FormData = {
  clientId: string
  equipmentTypeId: string
  equipmentSubtypeId?: string
  locationId?: string
  costCenterId?: string
  maintenanceType: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  title: string
  description: string
  groupId?: string
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  )
}

function Field({
  label, required, error, children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function OsBatchCreateSheet({ open, onClose, clientId, preselectedEquipment }: OsBatchCreateSheetProps) {
  const currentUser = useCurrentUser()
  const { isCompanyLevel, canAccess } = usePermissions()
  const hasPreselected = !!preselectedEquipment?.length
  const canChooseClient = !clientId && (isCompanyLevel || canAccess('client', 'list'))
  const fixedClientId = clientId ?? (canChooseClient ? null : (currentUser?.clientId ?? null))

  const [clients, setClients] = useState<SimpleOption[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<SimpleOption[]>([])
  const [equipmentSubtypes, setEquipmentSubtypes] = useState<SimpleOption[]>([])
  const [locations, setLocations] = useState<SimpleOption[]>([])
  const [costCenters, setCostCenters] = useState<SimpleOption[]>([])
  const [groups, setGroups] = useState<SimpleOption[]>([])
  const [result, setResult] = useState<BatchServiceOrderResult | null>(null)

  const createBatch = useCreateBatchServiceOrders()

  const defaultClientId = fixedClientId ?? currentUser?.clientId ?? ''

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      maintenanceType: 'CORRECTIVE',
      clientId: defaultClientId,
    },
  })

  const watchedPriority = form.watch('priority')
  const watchedTypeId = form.watch('equipmentTypeId')

  useEffect(() => {
    if (!open) return
    setResult(null)
    form.reset({ priority: 'MEDIUM', maintenanceType: 'CORRECTIVE', clientId: defaultClientId })
    setEquipmentSubtypes([])

    if (canChooseClient) {
      api.get('/clients', { params: { limit: 100 } })
        .then(({ data }) => setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
        .catch(() => {})
    }

    if (!hasPreselected) {
      api.get('/equipment-types', { params: { limit: 200 } })
        .then(({ data }) => setEquipmentTypes((data?.data ?? data ?? []).map((t: any) => ({ id: t.id, name: t.name }))))
        .catch(() => {})

      api.get('/locations', { params: { limit: 200 } })
        .then(({ data }) => setLocations((data?.data ?? []).map((l: any) => ({ id: l.id, name: l.name }))))
        .catch(() => {})

      api.get('/cost-centers', { params: { limit: 100 } })
        .then(({ data }) => setCostCenters((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
        .catch(() => {})
    }

    api.get('/maintenance-groups', { params: { limit: 100 } })
      .then(({ data }) => setGroups((data?.data ?? []).map((g: any) => ({ id: g.id, name: g.name }))))
      .catch(() => {})
  }, [open, hasPreselected, canChooseClient, defaultClientId])

  useEffect(() => {
    if (!watchedTypeId) { setEquipmentSubtypes([]); return }
    api.get('/equipment-subtypes', { params: { typeId: watchedTypeId, limit: 200 } })
      .then(({ data }) => setEquipmentSubtypes((data?.data ?? data ?? []).map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => setEquipmentSubtypes([]))
  }, [watchedTypeId])

  function handleClose() {
    setResult(null)
    onClose()
  }

  async function onSubmit(values: FormData) {
    if (!values.clientId) {
      toast.error('Selecione o prestador responsável pela OS')
      return
    }
    createBatch.mutate(
      {
        clientId: values.clientId,
        dto: {
          ...(hasPreselected
            ? { equipmentIds: preselectedEquipment!.map((e) => e.id) }
            : {
                equipmentTypeId: values.equipmentTypeId,
                equipmentSubtypeId: values.equipmentSubtypeId || undefined,
                locationId: values.locationId || undefined,
                costCenterId: values.costCenterId || undefined,
              }),
          maintenanceType: values.maintenanceType as any,
          priority: values.priority,
          title: values.title,
          description: values.description,
          groupId: values.groupId || undefined,
        },
      },
      { onSuccess: (res) => setResult(res) },
    )
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl lg:max-w-2xl overflow-hidden p-0 flex flex-col gap-0"
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold leading-tight">Criação de OS em Lote</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasPreselected
                  ? `Cria uma OS para cada um dos ${preselectedEquipment!.length} equipamentos selecionados`
                  : 'Cria OS para todos os equipamentos ativos do tipo selecionado'}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* ── Resultado ─────────────────────────────────────────────── */}
        {result ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {result.created} OS criadas com sucesso
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Todos os equipamentos ativos foram colocados em manutenção
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Equipamentos com OS criada
                </p>
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                  {result.results.map((item) => (
                    <div key={item.serviceOrderId} className="flex items-center justify-between px-4 py-2.5 bg-card">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClipboardList className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{item.equipmentName}</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground shrink-0 ml-3">OS #{item.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/10 flex-shrink-0">
              <Button variant="outline" onClick={handleClose} className="flex-1 h-11">
                Fechar
              </Button>
              <Button
                onClick={() => { setResult(null); form.reset({ priority: 'MEDIUM', maintenanceType: 'CORRECTIVE', clientId: defaultClientId }) }}
                className="flex-1 h-11 font-semibold"
              >
                Criar Novo Lote
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0">

              {/* ── Seção: Encaminhamento (prestador + grupo) ─────────── */}
              <div className="px-6 py-5 border-b border-border/60">
                <SectionHeader>Encaminhamento</SectionHeader>
                <div className="mt-3 space-y-4">
                  {fixedClientId ? (
                    <input type="hidden" {...form.register('clientId')} value={fixedClientId} />
                  ) : (
                    <Field label="Prestador" required error={form.formState.errors.clientId?.message}>
                      <Select
                        defaultValue={defaultClientId || undefined}
                        onValueChange={(v) => form.setValue('clientId', v)}
                      >
                        <SelectTrigger className={cn('h-11 text-sm', form.formState.errors.clientId && 'border-red-500')}>
                          <SelectValue placeholder="Selecione o prestador" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {groups.length > 0 && (
                    <Field label="Grupo de Manutenção">
                      <Select onValueChange={(v) => form.setValue('groupId', v === 'none' ? undefined : v)}>
                        <SelectTrigger className="h-11 text-sm">
                          <SelectValue placeholder="Sem grupo definido" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem grupo definido</SelectItem>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </div>
              </div>

              {/* ── Seção: Equipamentos selecionados ─────────────────── */}
              {hasPreselected ? (
                <div className="px-6 py-5 border-b border-border/60">
                  <SectionHeader>Equipamentos selecionados ({preselectedEquipment!.length})</SectionHeader>
                  <div className="mt-3 rounded-xl border border-border overflow-hidden divide-y divide-border/60 max-h-48 overflow-y-auto">
                    {preselectedEquipment!.map((eq) => (
                      <div key={eq.id} className="flex items-center gap-2.5 px-4 py-2.5 bg-card">
                        <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{eq.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-6 py-5 border-b border-border/60">
                  <SectionHeader>Filtros de Equipamento</SectionHeader>
                  <div className="mt-3 space-y-4">
                    <Field label="Tipo de Equipamento" required error={form.formState.errors.equipmentTypeId?.message}>
                      <Select
                        onValueChange={(v) => {
                          form.setValue('equipmentTypeId', v)
                          form.setValue('equipmentSubtypeId', undefined)
                        }}
                      >
                        <SelectTrigger className={cn('h-11 text-sm', form.formState.errors.equipmentTypeId && 'border-red-500')}>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipmentTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    {equipmentSubtypes.length > 0 && (
                      <Field label="Subtipo">
                        <Select onValueChange={(v) => form.setValue('equipmentSubtypeId', v === 'all' ? undefined : v)}>
                          <SelectTrigger className="h-11 text-sm">
                            <SelectValue placeholder="Todos os subtipos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os subtipos</SelectItem>
                            {equipmentSubtypes.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Setor / Local">
                        <Select onValueChange={(v) => form.setValue('locationId', v === 'all' ? undefined : v)}>
                          <SelectTrigger className="h-11 text-sm">
                            <SelectValue placeholder="Todos os setores" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os setores</SelectItem>
                            {locations.map((l) => (
                              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Centro de Custo">
                        <Select onValueChange={(v) => form.setValue('costCenterId', v === 'all' ? undefined : v)}>
                          <SelectTrigger className="h-11 text-sm">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {costCenters.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Seção: Detalhes ──────────────────────────────────── */}
              <div className="px-6 py-5 border-b border-border/60">
                <SectionHeader>Detalhes</SectionHeader>
                <div className="mt-3 space-y-4">
                  <Field label="Título" required error={form.formState.errors.title?.message}>
                    <Input
                      {...form.register('title', { required: 'Título obrigatório' })}
                      placeholder="Ex: Manutenção preventiva anual"
                      className={cn('h-11 text-sm', form.formState.errors.title && 'border-red-500')}
                    />
                  </Field>

                  <Field label="Descrição" required error={form.formState.errors.description?.message}>
                    <Textarea
                      {...form.register('description', { required: 'Descrição obrigatória' })}
                      placeholder="Descreva o serviço a ser realizado em todos os equipamentos do lote..."
                      rows={4}
                      className={cn(
                        'text-sm resize-none min-h-[100px]',
                        form.formState.errors.description && 'border-red-500',
                      )}
                    />
                  </Field>
                </div>
              </div>

              {/* ── Seção: Classificação ─────────────────────────────── */}
              <div className="px-6 py-5">
                <SectionHeader>Classificação</SectionHeader>
                <div className="mt-3 space-y-5">
                  <Field label="Tipo de Manutenção">
                    <Select defaultValue="CORRECTIVE" onValueChange={(v) => form.setValue('maintenanceType', v)}>
                      <SelectTrigger className="h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Prioridade <span className="text-red-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => form.setValue('priority', opt.value as any)}
                          className={cn(
                            'flex flex-col items-center gap-1 px-3 py-3 rounded-xl border font-medium transition-all duration-150',
                            watchedPriority === opt.value
                              ? 'border-primary bg-primary/8 text-primary shadow-sm ring-1 ring-primary/20'
                              : 'border-border/60 bg-card text-foreground hover:bg-muted/50 hover:border-border',
                          )}
                        >
                          <span className="text-xl">{opt.emoji}</span>
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <span className={cn(
                            'text-[10px]',
                            watchedPriority === opt.value ? 'text-primary/70' : 'text-muted-foreground',
                          )}>
                            {opt.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/10 flex-shrink-0">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-11">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createBatch.isPending}
                className="flex-1 h-11 font-semibold shadow-sm"
              >
                {createBatch.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar OS em Lote
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
