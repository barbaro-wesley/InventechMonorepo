'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Loader2, Wrench, Search, X, Paperclip, AlertTriangle, ClipboardList,
} from 'lucide-react'
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
import { useCreateServiceOrder } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { usePermissions } from '@/hooks/auth/use-permissions'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SimpleOption { id: string; name: string }

interface EquipmentOption {
  id: string
  name: string
  patrimonyNumber: string | null
  brand: string | null
  model: string | null
  location?: { name: string } | null
}

interface OsCreateSheetProps {
  open: boolean
  onClose: () => void
  /** Pré-seleciona um equipamento (ao abrir via página de equipamentos) */
  preselectedEquipment?: { id: string; name: string } | null
}

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
  groupId?: string
  title: string
  description: string
  maintenanceType: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  costCenterId?: string
  locationId?: string
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  )
}

// ─── Field Wrapper ───────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export function OsCreateSheet({ open, onClose, preselectedEquipment }: OsCreateSheetProps) {
  const currentUser = useCurrentUser()
  const { isCompanyLevel, canAccess } = usePermissions()

  const canChooseClient = isCompanyLevel || canAccess('client', 'list')
  const canCreateWithoutEquipment = isCompanyLevel || canAccess('service-order', 'create-without-equipment')

  const fixedClientId = canChooseClient ? null : (currentUser?.clientId ?? null)
  const defaultClientId = fixedClientId ?? currentUser?.clientId ?? ''

  const [clients, setClients] = useState<SimpleOption[]>([])
  const [groups, setGroups] = useState<SimpleOption[]>([])
  const [costCenters, setCostCenters] = useState<SimpleOption[]>([])
  const [locations, setLocations] = useState<SimpleOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId)

  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentOption | null>(null)
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [equipmentResults, setEquipmentResults] = useState<EquipmentOption[]>([])
  const [searchingEquipment, setSearchingEquipment] = useState(false)
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createOs = useCreateServiceOrder()

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      maintenanceType: 'CORRECTIVE',
      clientId: defaultClientId,
    },
  })

  const watchedPriority = form.watch('priority')

  // ── Inicialização ao abrir ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return

    setSelectedClientId(defaultClientId)
    setFiles([])
    setEquipmentSearch('')
    setEquipmentResults([])
    setSelectedEquipment(
      preselectedEquipment
        ? { ...preselectedEquipment, patrimonyNumber: null, brand: null, model: null }
        : null,
    )

    form.reset({ priority: 'MEDIUM', maintenanceType: 'CORRECTIVE', clientId: defaultClientId })

    if (canChooseClient) {
      api.get('/clients', { params: { limit: 100 } }).then(({ data }) => {
        setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
      })
    }

    api.get('/maintenance-groups', { params: { limit: 100 } })
      .then(({ data }) => setGroups((data?.data ?? []).map((g: any) => ({ id: g.id, name: g.name }))))
      .catch(() => {})

    api.get('/cost-centers', { params: { limit: 100 } })
      .then(({ data }) => setCostCenters((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {})

    api.get('/locations', { params: { limit: 200 } })
      .then(({ data }) => setLocations((data?.data ?? []).map((l: any) => ({ id: l.id, name: l.name }))))
      .catch(() => {})
  }, [open])

  // ── Busca de equipamento com debounce ────────────────────────────────────

  useEffect(() => {
    if (!equipmentSearch.trim()) {
      setEquipmentResults([])
      setShowEquipmentDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearchingEquipment(true)
      try {
        const { data } = await api.get('/equipment', {
          params: { search: equipmentSearch, limit: 8 },
        })
        const items = (data?.data ?? []).map((e: any) => ({
          id: e.id,
          name: e.name,
          patrimonyNumber: e.patrimonyNumber ?? null,
          brand: e.brand ?? null,
          model: e.model ?? null,
          location: e.location ?? null,
        }))
        setEquipmentResults(items)
        setShowEquipmentDropdown(true)
      } catch {
        setEquipmentResults([])
      } finally {
        setSearchingEquipment(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [equipmentSearch])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowEquipmentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function selectEquipment(eq: EquipmentOption) {
    setSelectedEquipment(eq)
    setEquipmentSearch('')
    setShowEquipmentDropdown(false)
  }

  function clearEquipment() {
    setSelectedEquipment(null)
    setEquipmentSearch('')
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(values: FormData) {
    createOs.mutate(
      {
        clientId: values.clientId,
        equipmentId: selectedEquipment?.id || undefined,
        costCenterId: values.costCenterId || undefined,
        locationId: values.locationId || undefined,
        groupId: values.groupId || undefined,
        title: values.title,
        description: values.description,
        maintenanceType: values.maintenanceType as any,
        priority: values.priority,
      },
      {
        onSuccess: async (os) => {
          if (files.length > 0) {
            await Promise.allSettled(
              files.map((file) => {
                const fd = new FormData()
                fd.append('file', file)
                fd.append('entity', 'SERVICE_ORDER')
                fd.append('entityId', os.id)
                return api.post('/storage/upload', fd)
              }),
            )
          }
          form.reset()
          setFiles([])
          setSelectedEquipment(null)
          onClose()
        },
      },
    )
  }

  const noEquipment = !selectedEquipment
  const hasEncaminhamento = fixedClientId === null || groups.length > 0

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
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ── Seção: Equipamento ───────────────────────────────── */}
            <div className="px-6 py-5 border-b border-border/60">
              <SectionHeader>
                Equipamento
                {!canCreateWithoutEquipment && (
                  <span className="ml-1.5 text-red-500">*</span>
                )}
                {canCreateWithoutEquipment && (
                  <span className="ml-1.5 font-normal normal-case text-muted-foreground/50">(opcional)</span>
                )}
              </SectionHeader>

              <div className="mt-3 space-y-2">
                {selectedEquipment ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #f97316)' }}
                    >
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{selectedEquipment.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[
                          selectedEquipment.patrimonyNumber && `Patrimônio: ${selectedEquipment.patrimonyNumber}`,
                          selectedEquipment.brand,
                          selectedEquipment.model,
                        ].filter(Boolean).join(' · ') || 'Equipamento selecionado'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={clearEquipment}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={searchRef}
                      value={equipmentSearch}
                      onChange={(e) => setEquipmentSearch(e.target.value)}
                      placeholder="Buscar por nome ou número de patrimônio..."
                      className="pl-10 pr-10 h-11 text-sm"
                    />
                    {searchingEquipment && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}

                    {showEquipmentDropdown && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
                      >
                        {equipmentResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground px-4 py-3">Nenhum equipamento encontrado</p>
                        ) : (
                          equipmentResults.map((eq) => (
                            <button
                              key={eq.id}
                              type="button"
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left transition-colors border-b border-border/40 last:border-0"
                              onClick={() => selectEquipment(eq)}
                            >
                              <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{eq.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {[
                                    eq.patrimonyNumber && `Patrimônio: ${eq.patrimonyNumber}`,
                                    eq.brand,
                                    eq.model,
                                  ].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {noEquipment && !canCreateWithoutEquipment && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>Você não tem permissão para criar OS sem equipamento. Busque e selecione um equipamento acima.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Seção: Encaminhamento ────────────────────────────── */}
            {hasEncaminhamento && (
              <div className="px-6 py-5 border-b border-border/60">
                <SectionHeader>Encaminhamento</SectionHeader>
                <div className="mt-3 space-y-4">
                  {fixedClientId ? (
                    <input type="hidden" {...form.register('clientId')} value={fixedClientId} />
                  ) : (
                    <Field label="Prestador" required error={form.formState.errors.clientId?.message}>
                      <Select
                        onValueChange={(v) => { setSelectedClientId(v); form.setValue('clientId', v) }}
                        value={selectedClientId || undefined}
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
            )}

            {/* ── Seção: Localização (somente sem equipamento) ─────── */}
            {noEquipment && canCreateWithoutEquipment && (
              <div className="px-6 py-5 border-b border-border/60">
                <SectionHeader>Localização</SectionHeader>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Centro de Custo">
                    <Select onValueChange={(v) => form.setValue('costCenterId', v)}>
                      <SelectTrigger className="h-11 text-sm">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCenters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Setor / Local">
                    <Select onValueChange={(v) => form.setValue('locationId', v)}>
                      <SelectTrigger className="h-11 text-sm">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
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
                    placeholder="Ex: Falha no sistema de refrigeração"
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

            {/* ── Seção: Classificação ─────────────────────────────── */}
            <div className="px-6 py-5 border-b border-border/60">
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
              disabled={createOs.isPending || (!selectedEquipment && !canCreateWithoutEquipment)}
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
