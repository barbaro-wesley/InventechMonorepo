'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
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
import { api } from '@/lib/api'
import { MAINTENANCE_TYPE_LABELS } from './os-utils'


type FormData = {
  clientId: string
  equipmentId: string
  title: string
  description: string
  maintenanceType: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  groupId?: string
  technicianId?: string
  alertAfterHours: number
}

interface OsCreateSheetProps {
  open: boolean
  onClose: () => void
}

interface SimpleOption {
  id: string
  name: string
}

export function OsCreateSheet({ open, onClose }: OsCreateSheetProps) {
  const [clients, setClients] = useState<SimpleOption[]>([])
  const [equipment, setEquipment] = useState<SimpleOption[]>([])
  const [groups, setGroups] = useState<SimpleOption[]>([])
  const [technicians, setTechnicians] = useState<SimpleOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')

  const createOs = useCreateServiceOrder()

  const form = useForm<FormData>({
    defaultValues: {
      priority: 'MEDIUM',
      alertAfterHours: 2,
    },
  })

  // Carrega clientes, grupos e técnicos
  useEffect(() => {
    if (!open) return
    api.get('/clients', { params: { limit: 100 } }).then(({ data }) => {
      setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
    })
    api.get('/maintenance-groups', { params: { limit: 100 } }).then(({ data }) => {
      setGroups((data?.data ?? []).map((g: any) => ({ id: g.id, name: g.name })))
    })
    api.get('/users', { params: { role: 'TECHNICIAN', limit: 100 } }).then(({ data }) => {
      setTechnicians((data?.data ?? []).map((u: any) => ({ id: u.id, name: u.name })))
    })
  }, [open])

  // Carrega equipamentos quando muda o cliente
  useEffect(() => {
    if (!selectedClientId) {
      setEquipment([])
      return
    }
    api
      .get(`/clients/${selectedClientId}/equipment`, { params: { limit: 100 } })
      .then(({ data }) => {
        setEquipment((data?.data ?? []).map((e: any) => ({ id: e.id, name: e.name })))
      })
  }, [selectedClientId])

  const onSubmit = (values: FormData) => {
    createOs.mutate(
      {
        clientId: values.clientId,
        equipmentId: values.equipmentId,
        title: values.title,
        description: values.description,
        maintenanceType: values.maintenanceType as any,
        priority: values.priority,
        groupId: values.groupId || undefined,
        technicianId: values.technicianId || undefined,
        alertAfterHours: values.alertAfterHours,
      },
      {
        onSuccess: () => {
          form.reset()
          setSelectedClientId('')
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

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Prestador */}
          <div className="space-y-1.5">
            <Label>Prestador <span className="text-red-500">*</span></Label>
            <Select
              onValueChange={(v) => {
                setSelectedClientId(v)
                form.setValue('clientId', v)
                form.setValue('equipmentId', '')
                form.setValue('technicianId', undefined)
              }}
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

          {/* Equipamento */}
          <div className="space-y-1.5">
            <Label>Equipamento <span className="text-red-500">*</span></Label>
            <Select
              onValueChange={(v) => form.setValue('equipmentId', v)}
              disabled={!selectedClientId}
            >
              <SelectTrigger className={form.formState.errors.equipmentId ? 'border-red-500' : ''}>
                <SelectValue placeholder={selectedClientId ? 'Selecione o equipamento' : 'Selecione um prestador primeiro'} />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.equipmentId && (
              <p className="text-xs text-red-500">{form.formState.errors.equipmentId.message}</p>
            )}
          </div>

          {/* Técnico */}
          {selectedClientId && (
            <div className="space-y-1.5">
              <Label>Técnico Responsável</Label>
              <Select
                onValueChange={(v) => form.setValue('technicianId', v === 'none' ? undefined : v)}
              >
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
              <p className="text-xs text-[#6c7c93]">
                Opcional — se não definido, a OS ficará aguardando assumção no painel
              </p>
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <Label>Título <span className="text-red-500">*</span></Label>
            <Input
              {...form.register('title')}
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
              {...form.register('description')}
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
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
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
              <Select
                defaultValue="MEDIUM"
                onValueChange={(v) => form.setValue('priority', v as any)}
              >
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

          {/* Grupo */}
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label>Grupo de Manutenção</Label>
              <Select onValueChange={(v) => form.setValue('groupId', v === 'none' ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#6c7c93]">
                Se sem técnico, só membros do grupo poderão assumir no painel
              </p>
            </div>
          )}

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
          <div className="flex gap-2 pt-4 border-t border-[#e0e5eb]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createOs.isPending}
              className="flex-1 bg-[#0d4da5] hover:bg-[#0a3776] text-white"
            >
              {createOs.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Criar OS
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
