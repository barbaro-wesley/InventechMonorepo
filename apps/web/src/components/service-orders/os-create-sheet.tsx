'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Loader2, Wrench, Search, X, Paperclip, AlertTriangle, Plus,
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
import { serviceOrdersService } from '@/services/service-orders/service-orders.service'
import { AttachmentEntity } from '@/services/storage/storage.service'
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

type FormData = {
  clientId: string
  technicianId?: string
  title: string
  description: string
  maintenanceType: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  alertAfterHours: number
  costCenterId?: string
  locationId?: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OsCreateSheet({ open, onClose, preselectedEquipment }: OsCreateSheetProps) {
  const currentUser = useCurrentUser()
  const { canAccess } = usePermissions()

  const canChooseClient = canAccess('client', 'list')
  const canCreateWithoutEquipment = canAccess('service-order', 'create-without-equipment')

  const fixedClientId = canChooseClient ? null : (currentUser?.clientId ?? null)
  const defaultClientId = fixedClientId ?? currentUser?.clientId ?? ''

  // Listas
  const [clients, setClients] = useState<SimpleOption[]>([])
  const [technicians, setTechnicians] = useState<SimpleOption[]>([])
  const [costCenters, setCostCenters] = useState<SimpleOption[]>([])
  const [locations, setLocations] = useState<SimpleOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId)

  // Equipamento selecionado
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentOption | null>(null)
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [equipmentResults, setEquipmentResults] = useState<EquipmentOption[]>([])
  const [searchingEquipment, setSearchingEquipment] = useState(false)
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Arquivos anexados
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createOs = useCreateServiceOrder()

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      alertAfterHours: 2,
      clientId: defaultClientId,
    },
  })

  // ── Inicialização ao abrir ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return

    setSelectedClientId(defaultClientId)
    setFiles([])
    setEquipmentSearch('')
    setEquipmentResults([])
    setSelectedEquipment(preselectedEquipment ? { ...preselectedEquipment, patrimonyNumber: null, brand: null, model: null } : null)

    form.reset({
      priority: 'MEDIUM',
      alertAfterHours: 2,
      clientId: defaultClientId,
    })

    if (canChooseClient) {
      api.get('/clients', { params: { limit: 100 } }).then(({ data }) => {
        setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
      })
    }

    api.get('/cost-centers', { params: { limit: 100 } }).then(({ data }) => {
      setCostCenters((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
    }).catch(() => {})

    api.get('/locations', { params: { limit: 200 } }).then(({ data }) => {
      setLocations((data?.data ?? []).map((l: any) => ({ id: l.id, name: l.name })))
    }).catch(() => {})
  }, [open])

  // ── Técnicos ao mudar cliente ─────────────────────────────────────────────

  useEffect(() => {
    if (!selectedClientId) { setTechnicians([]); return }
    api.get(`/clients/${selectedClientId}/technicians`).then(({ data }) => {
      setTechnicians((Array.isArray(data) ? data : []).map((u: any) => ({ id: u.id, name: u.name })))
    })
  }, [selectedClientId])

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

  // Fecha dropdown ao clicar fora
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
        title: values.title,
        description: values.description,
        maintenanceType: values.maintenanceType as any,
        priority: values.priority,
        technicianId: values.technicianId || undefined,
        alertAfterHours: values.alertAfterHours,
      },
      {
        onSuccess: async (os) => {
          // Upload de arquivos após criação
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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle>Nova Ordem de Serviço</SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

          {/* ── Equipamento (opcional) ─────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Equipamento
              <span className="ml-1 text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>

            {selectedEquipment ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #f97316)' }}>
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedEquipment.name}</p>
                  {selectedEquipment.patrimonyNumber && (
                    <p className="text-xs text-muted-foreground">Patrimônio: {selectedEquipment.patrimonyNumber}</p>
                  )}
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={clearEquipment}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchRef}
                  value={equipmentSearch}
                  onChange={(e) => setEquipmentSearch(e.target.value)}
                  placeholder="Buscar por nome ou número de patrimônio..."
                  className="pl-8 pr-8"
                />
                {searchingEquipment && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                )}

                {showEquipmentDropdown && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-popover shadow-md overflow-hidden"
                  >
                    {equipmentResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-3 py-2.5">Nenhum equipamento encontrado</p>
                    ) : (
                      equipmentResults.map((eq) => (
                        <button
                          key={eq.id}
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                          onClick={() => selectEquipment(eq)}
                        >
                          <Wrench className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{eq.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[eq.patrimonyNumber && `Patrimônio: ${eq.patrimonyNumber}`, eq.brand, eq.model].filter(Boolean).join(' · ')}
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
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p>Você não tem permissão para criar OS sem equipamento. Busque e selecione um equipamento acima.</p>
              </div>
            )}
          </div>

          {/* ── Centro de custo + Localização (quando sem equipamento) ─ */}
          {noEquipment && canCreateWithoutEquipment && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Centro de Custo</Label>
                <Select onValueChange={(v) => form.setValue('costCenterId', v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Localização</Label>
                <Select onValueChange={(v) => form.setValue('locationId', v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Prestador ─────────────────────────────────────────────── */}
          <input type="hidden" {...form.register('clientId')} />
          {!fixedClientId && (
            <div className="space-y-1.5">
              <Label>Prestador <span className="text-red-500">*</span></Label>
              <Select
                onValueChange={(v) => { setSelectedClientId(v); form.setValue('clientId', v) }}
                value={selectedClientId || undefined}
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

          {/* ── Técnico ────────────────────────────────────────────────── */}
          {selectedClientId && (
            <div className="space-y-1.5">
              <Label>Técnico Responsável</Label>
              <Select onValueChange={(v) => form.setValue('technicianId', v === 'none' ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem técnico definido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem técnico definido</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Título ─────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Título <span className="text-red-500">*</span></Label>
            <Input
              {...form.register('title', { required: 'Título obrigatório' })}
              placeholder="Ex: Falha no sistema de refrigeração"
              className={form.formState.errors.title ? 'border-red-500' : ''}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* ── Descrição ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Descrição <span className="text-red-500">*</span></Label>
            <Textarea
              {...form.register('description', { required: 'Descrição obrigatória' })}
              placeholder="Descreva o problema ou serviço a ser realizado..."
              rows={4}
              className={form.formState.errors.description ? 'border-red-500' : ''}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>
            )}
          </div>

          {/* ── Tipo + Prioridade ──────────────────────────────────────── */}
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

          {/* ── Alerta ─────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Alertar após (horas sem técnico)</Label>
            <Input
              type="number" min={1} max={72}
              {...form.register('alertAfterHours', { valueAsNumber: true })}
              className="w-24"
            />
          </div>

          {/* ── Anexos ─────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Anexos</Label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-xs">
                  <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {files.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar arquivo
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={handleFileAdd}
            />
            <p className="text-xs text-muted-foreground">Imagens, PDF, Word, Excel — máx. 10 arquivos, 20 MB cada</p>
          </div>

          {/* ── Botões ─────────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createOs.isPending || (!selectedEquipment && !canCreateWithoutEquipment)}
              className="flex-1"
            >
              {createOs.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar OS
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
