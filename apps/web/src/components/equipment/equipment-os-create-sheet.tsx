'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, Wrench, AlertTriangle, Paperclip, Plus, X } from 'lucide-react'
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
  const { canAccess } = usePermissions()
  const [clients, setClients] = useState<SimpleOption[]>([])
  const [technicians, setTechnicians] = useState<SimpleOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createOs = useCreateServiceOrder()

  // The group comes directly from the equipment's type — no user selection needed
  const equipmentGroup = equipment?.type?.group ?? null
  // Usuários com permissão de listar prestadores podem escolher — os demais ficam fixos no seu clientId
  const canChooseClient = canAccess('client', 'list')
  const fixedClientId = canChooseClient ? null : (currentUser?.clientId ?? null)
  // Quando pode escolher mas já tem um cliente próprio, pré-seleciona o dele
  const defaultClientId = fixedClientId ?? currentUser?.clientId ?? ''

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      alertAfterHours: 2,
      clientId: defaultClientId,
    },
  })

  useEffect(() => {
    if (!open) return
    setSelectedClientId(defaultClientId)
    setFiles([])
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
  }, [open])

  // Carrega técnicos vinculados ao cliente (por clientId direto ou por grupos)
  useEffect(() => {
    if (!selectedClientId) {
      setTechnicians([])
      return
    }
    api.get(`/clients/${selectedClientId}/technicians`).then(({ data }) => {
      setTechnicians((Array.isArray(data) ? data : []).map((u: any) => ({ id: u.id, name: u.name })))
    })
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
      <SheetContent side="right" className="overflow-y-auto" style={{ width: '100%', maxWidth: '680px' }}>
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
          {/* clientId sempre registrado — garante que vai no payload */}
          <input type="hidden" {...form.register('clientId')} />

          {/* Cliente — oculto se o usuário NÃO pode escolher */}
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
              {form.formState.errors.clientId && (
                <p className="text-xs text-red-500">{form.formState.errors.clientId.message}</p>
              )}
            </div>
          )}

          {/* Técnico */}
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
              <p className="text-xs text-muted-foreground">
                Opcional — se não definido, a OS ficará aguardando assumção no painel
              </p>
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
              rows={5}
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

          {/* Anexos */}
          <div className="space-y-2">
            <Label>
              Anexos <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-xs">
                  <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="max-w-[140px] truncate">{f.name}</span>
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
            <p className="text-xs text-muted-foreground">Imagens, PDF, Word, Excel — máx. 10 arquivos</p>
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
