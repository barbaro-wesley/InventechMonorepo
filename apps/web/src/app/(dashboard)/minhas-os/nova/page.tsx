'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wrench, Search, X, Paperclip,
  AlertTriangle, Loader2, ChevronRight, Tag,
} from 'lucide-react'
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

// ─── Opções fixas ────────────────────────────────────────────────────────────

const MAINTENANCE_TYPE_OPTIONS = [
  { value: 'CORRECTIVE',         label: 'Corretiva' },
  { value: 'INITIAL_ACCEPTANCE', label: 'Aceitação Inicial' },
  { value: 'EXTERNAL_SERVICE',   label: 'Serviço Externo' },
  { value: 'TECHNOVIGILANCE',    label: 'Tecnovigilância' },
  { value: 'TRAINING',           label: 'Treinamento' },
  { value: 'IMPROPER_USE',       label: 'Uso Indevido' },
  { value: 'DEACTIVATION',       label: 'Desativação' },
]

const PRIORITY_OPTIONS = [
  { value: 'LOW',    label: 'Baixa',   color: 'bg-slate-400' },
  { value: 'MEDIUM', label: 'Média',   color: 'bg-blue-500' },
  { value: 'HIGH',   label: 'Alta',    color: 'bg-orange-500' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-500' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface Option { id: string; name: string }

interface EquipmentOption {
  id: string
  name: string
  patrimonyNumber: string | null
  brand: string | null
  model: string | null
  location?: { name: string } | null
  costCenter?: { name: string } | null
}

type FormValues = {
  clientId: string
  title: string
  description: string
  maintenanceType: string
  priority: string
  groupId: string
  costCenterId: string
  locationId: string
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-5 py-3.5 border-b border-border">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
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
    <div className="space-y-1.5">
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NovaOsPage() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const { canAccess } = usePermissions()
  const createOs = useCreateServiceOrder()

  const canChooseClient = canAccess('client', 'list')
  const canCreateWithoutEquipment = canAccess('service-order', 'create-without-equipment')
  const fixedClientId = canChooseClient ? null : (currentUser?.clientId ?? null)
  const defaultClientId = fixedClientId ?? currentUser?.clientId ?? ''

  // Listas carregadas do backend
  const [clients, setClients] = useState<Option[]>([])
  const [groups, setGroups] = useState<Option[]>([])
  const [costCenters, setCostCenters] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])

  // Equipamento selecionado
  const [equipment, setEquipment] = useState<EquipmentOption | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EquipmentOption[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Anexos
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      clientId: defaultClientId,
      maintenanceType: 'CORRECTIVE',
      priority: 'MEDIUM',
      groupId: '',
      costCenterId: '',
      locationId: '',
    },
  })

  const watchedType = watch('maintenanceType')
  const watchedPriority = watch('priority')
  const watchedGroup = watch('groupId')

  // ── Carrega listas ────────────────────────────────────────────────────────

  useEffect(() => {
    if (canChooseClient) {
      api.get('/clients', { params: { limit: 100 } })
        .then(({ data }) => setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
        .catch(() => {})
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
  }, [canChooseClient])

  // ── Busca de equipamento ─────────────────────────────────────────────────

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get('/equipment', { params: { search: query, limit: 10 } })
        setResults((data?.data ?? []).map((e: any) => ({
          id: e.id,
          name: e.name,
          patrimonyNumber: e.patrimonyNumber ?? null,
          brand: e.brand ?? null,
          model: e.model ?? null,
          location: e.location ?? null,
          costCenter: e.costCenter ?? null,
        })))
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    createOs.mutate(
      {
        clientId: values.clientId || defaultClientId,
        equipmentId: equipment?.id || undefined,
        costCenterId: values.costCenterId || undefined,
        locationId: values.locationId || undefined,
        groupId: values.groupId || undefined,
        title: values.title,
        description: values.description,
        maintenanceType: values.maintenanceType as any,
        priority: values.priority as any,
      },
      {
        onSuccess: async (os) => {
          if (files.length > 0) {
            await Promise.allSettled(files.map((file) => {
              const fd = new FormData()
              fd.append('file', file)
              fd.append('entity', 'SERVICE_ORDER')
              fd.append('entityId', os.id)
              return api.post('/storage/upload', fd)
            }))
          }
          router.push('/minhas-os')
        },
      },
    )
  }

  const canSubmit = equipment || canCreateWithoutEquipment
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === watchedPriority)?.label ?? 'Média'
  const typeLabel = MAINTENANCE_TYPE_OPTIONS.find(t => t.value === watchedType)?.label ?? 'Corretiva'
  const groupLabel = groups.find(g => g.id === watchedGroup)?.name

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-background">

      {/* ── Topbar sticky ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <Link href="/minhas-os" className="hover:text-foreground transition-colors whitespace-nowrap">
              Minhas OS
            </Link>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-foreground font-medium truncate">Nova Ordem de Serviço</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push('/minhas-os')}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={createOs.isPending || !canSubmit}
              onClick={handleSubmit(onSubmit)}
            >
              {createOs.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Criar OS
            </Button>
          </div>
        </div>
      </div>

      {/* ── Layout principal ─────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ══ Coluna esquerda ══════════════════════════════════════════ */}
          <div className="space-y-5">

            {/* Equipamento */}
            <SectionCard title="Equipamento">
              {equipment ? (
                /* Equipamento selecionado */
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#f97316)' }}
                  >
                    <Wrench className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{equipment.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {equipment.patrimonyNumber && (
                        <span className="text-xs text-muted-foreground">
                          Patrimônio: <span className="font-mono font-medium text-foreground">{equipment.patrimonyNumber}</span>
                        </span>
                      )}
                      {equipment.brand && <span className="text-xs text-muted-foreground">{equipment.brand}</span>}
                      {equipment.model && <span className="text-xs text-muted-foreground">{equipment.model}</span>}
                      {equipment.location?.name && (
                        <span className="text-xs text-muted-foreground">{equipment.location.name}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="text-muted-foreground hover:text-destructive h-8 px-2 flex-shrink-0"
                    onClick={() => { setEquipment(null); setQuery('') }}
                  >
                    <X className="w-4 h-4 mr-1" /> Remover
                  </Button>
                </div>
              ) : (
                /* Campo de busca */
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Digite o nome ou número de patrimônio..."
                      className="pl-9 pr-9 h-10"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}

                    {/* Dropdown de resultados */}
                    {open && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                      >
                        {results.length === 0 ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                            <Search className="w-4 h-4" />
                            Nenhum equipamento encontrado para "{query}"
                          </div>
                        ) : (
                          results.map((eq, i) => (
                            <button
                              key={eq.id}
                              type="button"
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                                i < results.length - 1 && 'border-b border-border',
                              )}
                              onClick={() => { setEquipment(eq); setQuery(''); setOpen(false) }}
                            >
                              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <Wrench className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{eq.name}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                  {eq.patrimonyNumber && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-medium">
                                      <Tag className="w-3 h-3" />
                                      {eq.patrimonyNumber}
                                    </span>
                                  )}
                                  {eq.brand && (
                                    <span className="text-xs text-muted-foreground">{eq.brand}</span>
                                  )}
                                  {eq.model && (
                                    <span className="text-xs text-muted-foreground">{eq.model}</span>
                                  )}
                                  {eq.location?.name && (
                                    <span className="text-xs text-muted-foreground">· {eq.location.name}</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {!canCreateWithoutEquipment ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">Você precisa selecionar um equipamento para abrir uma OS.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Opcional — a OS pode ser aberta sem vínculo com equipamento.
                    </p>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Informações */}
            <SectionCard title="Informações da OS">
              <Field label="Título" required error={errors.title?.message}>
                <Input
                  {...register('title', { required: 'Título obrigatório' })}
                  placeholder="Ex: Falha no sistema de refrigeração"
                  className={cn('h-10', errors.title && 'border-red-500')}
                />
              </Field>

              <Field label="Descrição" required error={errors.description?.message}>
                <Textarea
                  {...register('description', { required: 'Descrição obrigatória' })}
                  placeholder="Descreva o problema ou serviço a ser realizado com o máximo de detalhes possível..."
                  rows={6}
                  className={cn(errors.description && 'border-red-500')}
                />
              </Field>
            </SectionCard>

            {/* Anexos */}
            <SectionCard title="Anexos">
              <div
                role="button"
                tabIndex={0}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              >
                <Paperclip className="w-7 h-7 text-muted-foreground mx-auto mb-2.5" />
                <p className="text-sm font-medium">Clique para adicionar arquivos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Imagens, PDF, Word, Excel · máx. 10 arquivos, 20 MB cada
                </p>
              </div>

              {files.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-muted/20">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileRef} type="file" multiple className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 10))
                  if (fileRef.current) fileRef.current.value = ''
                }}
              />
            </SectionCard>
          </div>

          {/* ══ Coluna direita ═══════════════════════════════════════════ */}
          <div className="space-y-5">

            {/* Classificação */}
            <SectionCard title="Classificação">
              <Field label="Tipo de Manutenção">
                <Controller
                  control={control}
                  name="maintenanceType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_TYPE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Prioridade">
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            <div className="flex items-center gap-2">
                              <div className={cn('w-2 h-2 rounded-full', o.color)} />
                              {o.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Grupo de Manutenção" hint={groups.length === 0 ? 'Nenhum grupo cadastrado' : undefined}>
                <Controller
                  control={control}
                  name="groupId"
                  render={({ field }) => (
                    <Select
                      value={field.value || '__none'}
                      onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
                      disabled={groups.length === 0}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Sem grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sem grupo</SelectItem>
                        {groups.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </SectionCard>

            {/* Localização */}
            <SectionCard title="Localização">
              <Field label="Centro de Custo" hint={costCenters.length === 0 ? 'Nenhum centro cadastrado' : undefined}>
                <Controller
                  control={control}
                  name="costCenterId"
                  render={({ field }) => (
                    <Select
                      value={field.value || '__none'}
                      onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
                      disabled={costCenters.length === 0}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Nenhum</SelectItem>
                        {costCenters.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Localização" hint={locations.length === 0 ? 'Nenhuma localização cadastrada' : undefined}>
                <Controller
                  control={control}
                  name="locationId"
                  render={({ field }) => (
                    <Select
                      value={field.value || '__none'}
                      onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
                      disabled={locations.length === 0}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Nenhuma</SelectItem>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </SectionCard>

            {/* Prestador */}
            {!fixedClientId && clients.length > 0 && (
              <SectionCard title="Prestador">
                <input type="hidden" {...register('clientId')} />
                <Controller
                  control={control}
                  name="clientId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione o prestador" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </SectionCard>
            )}

            {/* Resumo */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>
              <div className="space-y-2">
                {[
                  { label: 'Equipamento', value: equipment?.name ?? '—' },
                  { label: 'Tipo', value: typeLabel },
                  { label: 'Prioridade', value: priorityLabel },
                  { label: 'Grupo', value: groupLabel ?? '—' },
                  { label: 'Status inicial', value: equipment ? 'Aberta' : 'Ag. Assumção' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-right truncate max-w-[160px]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}
