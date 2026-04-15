'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Paperclip, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCreateServiceOrder } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Opções ───────────────────────────────────────────────────────────────────

const MAINTENANCE_TYPE_OPTIONS = [
  { value: 'CORRECTIVE', label: 'Corretiva' },

]

const PRIORITY_OPTIONS = [
  { value: 'URGENT', emoji: '🔴', label: 'Muito Alta', desc: 'até 2h' },
  { value: 'HIGH', emoji: '🟠', label: 'Alta', desc: 'até 4h' },
  { value: 'MEDIUM', emoji: '🟡', label: 'Média', desc: 'até 8h' },
  { value: 'LOW', emoji: '🟢', label: 'Baixa', desc: 'até 24h' },
  { value: 'VERY_LOW', emoji: '🔵', label: 'Muito Baixa', desc: 'até 48h' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option { id: string; name: string }

type FormValues = {
  title: string
  description: string
  maintenanceType: string
  priority: string
  groupId: string
  costCenterId: string
  locationId: string
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

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
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground/70">{hint}</p>}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NovaOsPage() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const createOs = useCreateServiceOrder()
  const clientId = currentUser?.clientId ?? currentUser?.client?.id ?? null

  const [groups, setGroups] = useState<Option[]>([])
  const [costCenters, setCostCenters] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      maintenanceType: 'CORRECTIVE',
      priority: 'MEDIUM',
      groupId: '',
      costCenterId: '',
      locationId: '',
    },
  })

  // ── Carrega listas ─────────────────────────────────────────────────────────

  useEffect(() => {
    api.get('/maintenance-groups', { params: { limit: 100 } })
      .then(({ data }) => setGroups((data?.data ?? []).map((g: any) => ({ id: g.id, name: g.name }))))
      .catch(() => { })
    api.get('/cost-centers', { params: { limit: 100 } })
      .then(({ data }) => setCostCenters((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => { })
    api.get('/locations', { params: { limit: 200 } })
      .then(({ data }) => setLocations((data?.data ?? []).map((l: any) => ({ id: l.id, name: l.name }))))
      .catch(() => { })
  }, [])

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    const priority = values.priority === 'VERY_LOW' ? 'LOW' : values.priority

    createOs.mutate(
      {
        clientId: clientId ?? undefined,
        costCenterId: values.costCenterId || undefined,
        locationId: values.locationId || undefined,
        groupId: values.groupId || undefined,
        title: values.title,
        description: values.description,
        maintenanceType: values.maintenanceType as any,
        priority: priority as any,
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-muted/20">

      {/* Topbar */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md shadow-sm">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 -ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/minhas-os')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold leading-none truncate">Novo Chamado</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">Minhas Ordens de Serviço</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex text-sm"
              onClick={() => router.push('/minhas-os')}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="font-semibold px-4 sm:px-5 shadow-sm"
              disabled={createOs.isPending}
              onClick={handleSubmit(onSubmit)}
            >
              {createOs.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              <span className="hidden sm:inline">Abrir Chamado</span>
              <span className="sm:hidden">Abrir</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="w-full px-4 sm:px-6 py-6 space-y-4">

          {/* Cabeçalho */}
          <div className="pt-2">
            <h1 className="text-lg font-bold text-foreground">Abertura de Chamado</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Preencha os dados abaixo para registrar sua solicitação de manutenção.</p>
          </div>

          {/* ── Card principal ─────────────────────────────────────── */}
          <div className="rounded-xl border bg-card shadow-sm divide-y divide-border/60">

            {/* Título + Descrição */}
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Detalhes</p>

              <Field label="Título" required error={errors.title?.message}>
                <Input
                  {...register('title', { required: 'Título obrigatório' })}
                  placeholder="Ex: Ar condicionado com vazamento na sala 02"
                  className={cn(
                    'h-10 bg-muted/30',
                    errors.title && 'border-red-500/60 focus-visible:ring-red-500'
                  )}
                />
              </Field>

              <Field label="Descrição" required error={errors.description?.message}>
                <Textarea
                  {...register('description', { required: 'Descrição obrigatória' })}
                  placeholder="Descreva o problema com detalhes..."
                  rows={3}
                  className={cn(
                    'resize-y bg-muted/30 text-sm min-h-[80px]',
                    errors.description && 'border-red-500/60 focus-visible:ring-red-500'
                  )}
                />
              </Field>
            </div>

            {/* Tipo + Grupo + Local + CC */}
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Classificação & Encaminhamento</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tipo de Solicitação">
                  <Controller
                    control={control}
                    name="maintenanceType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-10 bg-muted/30">
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

                <Field
                  label="Grupo de Atendimento"
                  hint={groups.length === 0 ? 'Nenhum grupo cadastrado' : undefined}
                >
                  <Controller
                    control={control}
                    name="groupId"
                    render={({ field }) => (
                      <Select
                        value={field.value || '__none'}
                        onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
                        disabled={groups.length === 0}
                      >
                        <SelectTrigger className="h-10 bg-muted/30">
                          <SelectValue placeholder="Automático" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Automático (sem grupo)</SelectItem>
                          {groups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field
                  label="Localização / Setor"
                  hint={locations.length === 0 ? 'Nenhuma localização cadastrada' : undefined}
                >
                  <Controller
                    control={control}
                    name="locationId"
                    render={({ field }) => (
                      <Select
                        value={field.value || '__none'}
                        onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
                        disabled={locations.length === 0}
                      >
                        <SelectTrigger className="h-10 bg-muted/30">
                          <SelectValue placeholder="Opcional" />
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

                <Field
                  label="Centro de Custo"
                  hint={costCenters.length === 0 ? 'Nenhum centro cadastrado' : undefined}
                >
                  <Controller
                    control={control}
                    name="costCenterId"
                    render={({ field }) => (
                      <Select
                        value={field.value || '__none'}
                        onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
                        disabled={costCenters.length === 0}
                      >
                        <SelectTrigger className="h-10 bg-muted/30">
                          <SelectValue placeholder="Opcional" />
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
              </div>
            </div>

            {/* Prioridade */}
            <div className="p-4 sm:p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Prioridade <span className="text-red-500">*</span>
              </p>

              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-150',
                          field.value === opt.value
                            ? 'border-primary bg-primary/8 text-primary shadow-sm ring-1 ring-primary/20'
                            : 'border-border/60 bg-card text-foreground hover:bg-muted/60 hover:border-border'
                        )}
                      >
                        <span>{opt.emoji}</span>
                        <span>{opt.label}</span>
                        <span className={cn(
                          'text-xs',
                          field.value === opt.value ? 'text-primary/70' : 'text-muted-foreground'
                        )}>
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Anexos */}
            <div className="p-4 sm:p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Anexos <span className="font-normal normal-case text-muted-foreground/50">(opcional)</span></p>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border/80 bg-muted/10 cursor-pointer hover:bg-muted/30 hover:border-primary/40 transition-all group"
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Paperclip className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Adicionar arquivos</p>
                  <p className="text-xs text-muted-foreground">Imagens, PDF, Word, Excel · máx 10 arquivos · 20MB cada</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-foreground font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="w-6 h-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 10))
                  if (fileRef.current) fileRef.current.value = ''
                }}
              />
            </div>

          </div>

          {/* Rodapé de ação */}
          <div className="flex items-center justify-between gap-3 pt-2 pb-6 border-t border-border/40">
            <p className="text-xs text-muted-foreground hidden sm:block">
              Os campos marcados com <span className="text-red-500">*</span> são obrigatórios
            </p>
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/minhas-os')}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-semibold px-6 shadow-sm"
                disabled={createOs.isPending}
              >
                {createOs.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Abrir Chamado
              </Button>
            </div>
          </div>

        </div>
      </form>

    </div>
  )
}