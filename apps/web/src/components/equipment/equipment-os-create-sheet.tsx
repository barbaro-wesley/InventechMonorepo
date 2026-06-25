'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, Wrench, AlertTriangle, Paperclip, X, ClipboardList, Check } from 'lucide-react'
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
import { usePermissions } from '@/hooks/auth/use-permissions'
import { api } from '@/lib/api'
import { storageService } from '@/services/storage/storage.service'
import type { Equipment } from '@/services/equipment/equipment.service'
import { cn } from '@/lib/utils'

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Corretiva',
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
  technicianId?: string
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

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-orange-500', 'bg-rose-500', 'bg-teal-500',
]

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function getAvatarColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

interface EquipmentOsCreateSheetProps {
  equipment: Equipment | null
  open: boolean
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  )
}

function Field({
  label, required, hint, error, children,
}: {
  label: string
  required?: boolean
  hint?: string
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
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EquipmentOsCreateSheet({ equipment, open, onClose }: EquipmentOsCreateSheetProps) {
  const currentUser = useCurrentUser()
  const { canAccess } = usePermissions()
  const [clients, setClients] = useState<SimpleOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [technicians, setTechnicians] = useState<SimpleOption[]>([])
  const [selectedTechnician, setSelectedTechnician] = useState<SimpleOption | null>(null)
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedClient, setSelectedClient] = useState<SimpleOption | null>(null)
  const [editingClient, setEditingClient] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createOs = useCreateServiceOrder()

  const equipmentGroup = equipment?.type?.group ?? null
  const canChooseClient = canAccess('client', 'list')
  const fixedClientId = canChooseClient ? null : (currentUser?.clientId ?? null)
  const defaultClientId = fixedClientId ?? currentUser?.clientId ?? ''

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      maintenanceType: 'CORRECTIVE',
      alertAfterHours: 2,
      clientId: defaultClientId,
    },
  })

  const watchedPriority = form.watch('priority')

  useEffect(() => {
    if (!open) return
    setSelectedClientId(defaultClientId)
    setSelectedClient(null)
    setSelectedTechnician(null)
    setEditingClient(false)
    setEditingTechnician(false)
    setFiles([])
    form.reset({
      priority: 'MEDIUM',
      maintenanceType: 'CORRECTIVE',
      alertAfterHours: 2,
      clientId: defaultClientId,
    })
    if (canChooseClient) {
      setLoadingClients(true)
      api.get('/clients', { params: { limit: 100 } })
        .then(({ data }) => setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
        .finally(() => setLoadingClients(false))
    }
  }, [open])

  useEffect(() => {
    setSelectedTechnician(null)
    setEditingTechnician(false)
    form.setValue('technicianId', undefined)
    if (!selectedClientId) {
      setTechnicians([])
      return
    }
    setLoadingTechnicians(true)
    api.get('/users', { params: { clientId: selectedClientId, limit: 100 } })
      .then(({ data }) => setTechnicians((data?.data ?? []).map((u: any) => ({ id: u.id, name: u.name }))))
      .catch(() => setTechnicians([]))
      .finally(() => setLoadingTechnicians(false))
  }, [selectedClientId])

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

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
        groupId: equipmentGroup?.id ?? undefined,
        technicianId: values.technicianId || undefined,
        alertAfterHours: values.alertAfterHours,
      },
      {
        onSuccess: async (os) => {
          if (files.length > 0) {
            await Promise.allSettled(
              files.map((file) => storageService.upload(file, 'SERVICE_ORDER', os.id))
            )
          }
          form.reset()
          setFiles([])
          onClose()
        },
      },
    )
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl lg:max-w-2xl overflow-hidden p-0 flex flex-col gap-0"
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold leading-tight">Nova Ordem de Serviço</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados para registrar a solicitação</p>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <input type="hidden" {...form.register('clientId')} />

          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ── Seção: Equipamento ───────────────────────────────── */}
            <div className="px-6 py-5 border-b border-border/60">
              <SectionHeader>Equipamento</SectionHeader>
              <div className="mt-3 space-y-3">
                {equipment && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #f97316)' }}
                    >
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{equipment.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[equipment.type?.name, equipment.subtype?.name].filter(Boolean).join(' › ') || 'Equipamento selecionado'}
                      </p>
                    </div>
                    {equipmentGroup && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                        {equipmentGroup.name}
                      </span>
                    )}
                  </div>
                )}

                {equipment && !equipmentGroup && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>
                      O tipo deste equipamento não tem grupo de manutenção vinculado.
                      A OS será criada sem grupo e qualquer técnico poderá assumir.
                      Configure o grupo no cadastro de tipos para rotear corretamente.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Seção: Detalhes ──────────────────────────────────── */}
            <div className="px-6 py-5 border-b border-border/60">
              <SectionHeader>Detalhes</SectionHeader>
              <div className="mt-3 space-y-4">
                <Field label="Título" required error={form.formState.errors.title?.message}>
                  <Input
                    {...form.register('title', { required: 'Título obrigatório' })}
                    placeholder="Ex: Falha no compressor do ar condicionado"
                    className={cn('h-11 text-sm', form.formState.errors.title && 'border-red-500')}
                  />
                </Field>

                <Field label="Descrição" required error={form.formState.errors.description?.message}>
                  <Textarea
                    {...form.register('description', { required: 'Descrição obrigatória' })}
                    placeholder="Descreva o problema ou serviço a ser realizado..."
                    rows={4}
                    className={cn(
                      'text-sm resize-none min-h-[100px]',
                      form.formState.errors.description && 'border-red-500',
                    )}
                  />
                </Field>
              </div>
            </div>

            {/* ── Seção: Encaminhamento ────────────────────────────── */}
            <div className="px-6 py-5 border-b border-border/60">
              <SectionHeader>Encaminhamento</SectionHeader>
              <div className={cn('mt-3', !fixedClientId ? 'grid grid-cols-2 gap-4' : '')}>

                {/* ── Prestador ──────────────────────────────────────── */}
                {!fixedClientId && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Prestador <span className="text-red-500">*</span>
                    </Label>

                    {selectedClient && !editingClient ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/20 bg-primary/5">
                        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0', getAvatarColor(selectedClient.name))}>
                          {getInitials(selectedClient.name)}
                        </div>
                        <span className="flex-1 text-xs font-semibold truncate">{selectedClient.name}</span>
                        <button type="button" onClick={() => setEditingClient(true)}
                          className="text-xs text-primary hover:underline shrink-0 font-medium">
                          Trocar
                        </button>
                      </div>
                    ) : loadingClients ? (
                      <div className="flex flex-col gap-1">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/20 animate-pulse">
                            <div className="w-7 h-7 rounded-md bg-muted/60 shrink-0" />
                            <div className="h-2.5 w-20 rounded-full bg-muted/60" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                        {clients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedClientId(c.id); setSelectedClient(c); form.setValue('clientId', c.id); setEditingClient(false) }}
                            className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 hover:border-border text-left transition-all duration-150 w-full"
                          >
                            <div className={cn('w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0', getAvatarColor(c.name))}>
                              {getInitials(c.name)}
                            </div>
                            <span className="flex-1 text-xs font-medium truncate">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {form.formState.errors.clientId && (
                      <p className="text-xs text-red-500">{form.formState.errors.clientId.message}</p>
                    )}
                  </div>
                )}

                {/* ── Técnico ────────────────────────────────────────── */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Técnico Responsável</Label>

                  {!selectedClientId ? (
                    <div className="p-2.5 rounded-lg border border-dashed border-border/60 bg-muted/10 h-[42px] flex items-center">
                      <p className="text-xs text-muted-foreground">Selecione o prestador primeiro</p>
                    </div>
                  ) : selectedTechnician && !editingTechnician ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/20 bg-primary/5">
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', getAvatarColor(selectedTechnician.name))}>
                        {getInitials(selectedTechnician.name)}
                      </div>
                      <span className="flex-1 text-xs font-semibold truncate">{selectedTechnician.name}</span>
                      <button type="button" onClick={() => setEditingTechnician(true)}
                        className="text-xs text-primary hover:underline shrink-0 font-medium">
                        Trocar
                      </button>
                    </div>
                  ) : loadingTechnicians ? (
                    <div className="flex flex-col gap-1">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/20 animate-pulse">
                          <div className="w-7 h-7 rounded-full bg-muted/60 shrink-0" />
                          <div className="h-2.5 w-16 rounded-full bg-muted/60" />
                        </div>
                      ))}
                    </div>
                  ) : technicians.length === 0 ? (
                    <div className="p-2.5 rounded-lg border border-dashed border-border/60 bg-muted/10 h-[42px] flex items-center">
                      <p className="text-xs text-muted-foreground">Nenhum usuário encontrado</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => { setSelectedTechnician(null); form.setValue('technicianId', undefined); setEditingTechnician(false) }}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 hover:border-border text-left transition-all duration-150 w-full"
                      >
                        <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">—</div>
                        <span className="text-xs text-muted-foreground">Sem técnico</span>
                      </button>
                      {technicians.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setSelectedTechnician(t); form.setValue('technicianId', t.id); setEditingTechnician(false) }}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 hover:border-border text-left transition-all duration-150 w-full"
                        >
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', getAvatarColor(t.name))}>
                            {getInitials(t.name)}
                          </div>
                          <span className="flex-1 text-xs font-medium truncate">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ── Seção: Classificação ─────────────────────────────── */}
            <div className="px-6 py-5 border-b border-border/60">
              <SectionHeader>Classificação</SectionHeader>
              <div className="mt-3 space-y-5">
                <Field label="Tipo de Manutenção" required error={form.formState.errors.maintenanceType?.message}>
                  <Select
                    defaultValue="CORRECTIVE"
                    onValueChange={(v) => form.setValue('maintenanceType', v)}
                  >
                    <SelectTrigger className={cn('h-11 text-sm', form.formState.errors.maintenanceType && 'border-red-500')}>
                      <SelectValue placeholder="Selecione" />
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

            {/* ── Seção: Configuração ──────────────────────────────── */}
            <div className="px-6 py-5 border-b border-border/60">
              <SectionHeader>Configuração</SectionHeader>
              <div className="mt-3">
                <Field
                  label="Alertar após (horas sem técnico)"
                  hint="Notificação enviada caso nenhum técnico assuma a OS no prazo"
                >
                  <Input
                    type="number"
                    min={1}
                    max={72}
                    {...form.register('alertAfterHours', { valueAsNumber: true })}
                    className="h-11 text-sm w-36"
                  />
                </Field>
              </div>
            </div>

            {/* ── Seção: Anexos ────────────────────────────────────── */}
            <div className="px-6 py-5">
              <SectionHeader>
                Anexos
                <span className="ml-1.5 font-normal normal-case text-muted-foreground/50">(opcional)</span>
              </SectionHeader>
              <div className="mt-3 space-y-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-4 rounded-xl border border-dashed border-border/80 bg-muted/10 cursor-pointer hover:bg-muted/30 hover:border-primary/40 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Paperclip className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Adicionar arquivos</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Imagens, PDF, Word, Excel · máx 10 · 20MB cada</p>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-card">
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="w-6 h-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={handleFileAdd}
                />
              </div>
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────── */}
          <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/10 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createOs.isPending}
              className="flex-1 h-11 font-semibold shadow-sm"
            >
              {createOs.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Ordem de Serviço
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
