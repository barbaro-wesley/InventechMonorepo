'use client'

import { useState } from 'react'
import { Calendar, Clock, Wrench, User, Building2, Tag, Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ServiceOrderDetail } from '@/services/service-orders/service-orders.types'
import { useAddTechnician, useRemoveTechnician } from '@/hooks/service-orders/use-service-orders'
import { useUsers } from '@/hooks/users/use-users'
import { PRIORITY_CONFIG, STATUS_CONFIG, MAINTENANCE_TYPE_LABELS, timeAgo, formatDuration } from '../os-utils'

interface OsDetailTabProps {
  os: ServiceOrderDetail
  clientId: string
  osId: string
  canManage: boolean
}

function InfoRow({ icon: Icon, label, children }: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#f3f4f7]">
        <Icon className="h-3 w-3 text-[#6c7c93]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#6c7c93] mb-0.5">{label}</p>
        <div className="text-sm text-[#1d2530]">{children}</div>
      </div>
    </div>
  )
}

function TechAvatar({ name }: { name: string }) {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const color = colors[Math.abs(hash) % colors.length]
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  return (
    <div className={`h-7 w-7 rounded-full ${color} flex items-center justify-center shrink-0`}>
      <span className="text-white text-xs font-semibold">{initials}</span>
    </div>
  )
}

export function OsDetailTab({ os, clientId, osId, canManage }: OsDetailTabProps) {
  const priority = PRIORITY_CONFIG[os.priority]
  const status = STATUS_CONFIG[os.status]

  const [selectedTechId, setSelectedTechId] = useState('')
  const addTechnician = useAddTechnician(clientId, osId)
  const removeTechnician = useRemoveTechnician(clientId, osId)

  // Busca técnicos do mesmo prestador da OS
  const { data: techData } = useUsers({ role: 'TECHNICIAN', clientId: os.client.id, limit: 100 })
  const linkedIds = new Set(os.technicians.map((t) => t.technician.id))
  const availableTechs = (techData?.data ?? []).filter((u) => !linkedIds.has(u.id))

  const isTerminal = os.status === 'COMPLETED_APPROVED' || os.status === 'CANCELLED'

  const handleAddTechnician = () => {
    if (!selectedTechId) return
    addTechnician.mutate(
      { technicianId: selectedTechId, role: 'ASSISTANT' },
      { onSuccess: () => setSelectedTechId('') },
    )
  }

  return (
    <div className="space-y-5 py-1">
      {/* Descrição */}
      <div>
        <p className="text-[11px] text-[#6c7c93] mb-1.5 font-medium uppercase tracking-wide">Descrição</p>
        <p className="text-sm text-[#1d2530] leading-relaxed bg-[#f8f9fb] rounded-lg p-3 border border-[#e0e5eb]">
          {os.description}
        </p>
      </div>

      {/* Informações principais */}
      <div>
        <p className="text-[11px] text-[#6c7c93] mb-3 font-medium uppercase tracking-wide">Informações</p>
        <div className="space-y-3">
          <InfoRow icon={Tag} label="Status">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${status.bg} ${status.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </InfoRow>

          <InfoRow icon={Tag} label="Prioridade">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${priority.badge}`}>
              {priority.label}
            </span>
          </InfoRow>

          <InfoRow icon={Wrench} label="Tipo de manutenção">
            <span>{MAINTENANCE_TYPE_LABELS[os.maintenanceType]}</span>
          </InfoRow>

          <InfoRow icon={Building2} label="Prestador">
            <span>{os.client.name}</span>
          </InfoRow>

          <InfoRow icon={Wrench} label="Equipamento">
            <div>
              <p>{os.equipment.name}</p>
              {(os.equipment.brand || os.equipment.model) && (
                <p className="text-[11px] text-[#6c7c93]">
                  {[os.equipment.brand, os.equipment.model].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </InfoRow>

          {os.group && (
            <InfoRow icon={Tag} label="Grupo">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: os.group.color ?? '#94a3b8' }}
                />
                <span>{os.group.name}</span>
              </div>
            </InfoRow>
          )}

          {os.requester && (
            <InfoRow icon={User} label="Solicitante">
              <span>{os.requester.name}</span>
            </InfoRow>
          )}

          <InfoRow icon={Clock} label="Criada">
            <span>{timeAgo(os.createdAt)}</span>
          </InfoRow>

          {os.startedAt && (
            <InfoRow icon={Clock} label="Iniciada">
              <span>
                {timeAgo(os.startedAt)}
                {!os.completedAt && (
                  <span className="ml-2 text-[#6c7c93] text-xs">
                    ({formatDuration(os.startedAt)} em andamento)
                  </span>
                )}
              </span>
            </InfoRow>
          )}

          {os.completedAt && (
            <InfoRow icon={Clock} label="Concluída">
              <span>
                {timeAgo(os.completedAt)}
                <span className="ml-2 text-[#6c7c93] text-xs">
                  (duração: {formatDuration(os.startedAt ?? os.createdAt, os.completedAt)})
                </span>
              </span>
            </InfoRow>
          )}

          {os.scheduledFor && (
            <InfoRow icon={Calendar} label="Agendada para">
              <span>{new Date(os.scheduledFor).toLocaleDateString('pt-BR')}</span>
            </InfoRow>
          )}

          {(os.estimatedHours || os.actualHours) && (
            <InfoRow icon={Clock} label="Horas">
              <div className="flex gap-4">
                {os.estimatedHours && (
                  <span className="text-xs">
                    <span className="text-[#6c7c93]">Estimado: </span>
                    {os.estimatedHours}h
                  </span>
                )}
                {os.actualHours && (
                  <span className="text-xs">
                    <span className="text-[#6c7c93]">Real: </span>
                    {os.actualHours}h
                  </span>
                )}
              </div>
            </InfoRow>
          )}
        </div>
      </div>

      {/* Técnicos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-[#6c7c93] font-medium uppercase tracking-wide">Técnicos</p>
        </div>

        <div className="space-y-2">
          {os.technicians.length === 0 && (
            <p className="text-xs text-[#6c7c93] italic">Nenhum técnico vinculado</p>
          )}
          {os.technicians.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#f8f9fb] border border-[#e0e5eb]">
              <TechAvatar name={t.technician.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1d2530]">{t.technician.name}</p>
                <p className="text-xs text-[#6c7c93]">{t.technician.email}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                t.role === 'LEAD'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}>
                {t.role === 'LEAD' ? 'Responsável' : 'Auxiliar'}
              </span>
              {canManage && !isTerminal && t.role !== 'LEAD' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#6c7c93] hover:text-red-500 shrink-0"
                  disabled={removeTechnician.isPending}
                  onClick={() => removeTechnician.mutate(t.technician.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

          {/* Adicionar técnico auxiliar */}
          {canManage && !isTerminal && availableTechs.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                <SelectTrigger className="h-8 text-xs flex-1 bg-[#f3f4f7] border-transparent">
                  <SelectValue placeholder="Adicionar técnico auxiliar..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTechs.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs px-3 shrink-0"
                disabled={!selectedTechId || addTechnician.isPending}
                onClick={handleAddTechnician}
              >
                {addTechnician.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Resolução */}
      {os.resolution && (
        <div>
          <p className="text-[11px] text-[#6c7c93] mb-1.5 font-medium uppercase tracking-wide">Resolução</p>
          <p className="text-sm text-[#1d2530] leading-relaxed bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            {os.resolution}
          </p>
        </div>
      )}

      {/* Notas internas */}
      {os.internalNotes && (
        <div>
          <p className="text-[11px] text-[#6c7c93] mb-1.5 font-medium uppercase tracking-wide">Notas Internas</p>
          <p className="text-sm text-[#1d2530] leading-relaxed bg-amber-50 rounded-lg p-3 border border-amber-200">
            {os.internalNotes}
          </p>
        </div>
      )}
    </div>
  )
}
