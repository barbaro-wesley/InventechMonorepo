'use client'

import { useState } from 'react'
import { Mail, Clock, DollarSign, Package, Calendar, MessageSquare, Paperclip, Printer } from 'lucide-react'
import { useCostItems, useOsMaterials } from '@/hooks/service-orders/use-service-orders'
import type { ServiceOrderDetail } from '@/services/service-orders/service-orders.types'
import { OsQrLabelModal } from '@/components/service-orders/os-qr-label-modal'
import { formatDuration, timeAgo } from '../os-utils'

export type WorkspaceTab =
  | 'summary' | 'tasks' | 'materials' | 'costs' | 'comments' | 'attachments' | 'history' | 'checklist'

interface OsSidePanelProps {
  os: ServiceOrderDetail
  clientId: string | null
  osId: string
  canManageMaterials: boolean
  onNavigate: (tab: WorkspaceTab) => void
}

function fmtCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function PanelCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 ${className}`}>
      {children}
    </div>
  )
}

export function OsSidePanel({ os, clientId, osId, onNavigate }: OsSidePanelProps) {
  const [labelModalOpen, setLabelModalOpen] = useState(false)
  const { data: costs } = useCostItems(clientId, osId)
  const { data: materials } = useOsMaterials(clientId, osId)

  const lead = os.technicians.find((t) => t.role === 'LEAD') ?? os.technicians[0]
  const respName = lead?.technician.name ?? os.client?.name ?? 'Não atribuído'
  const respEmail = lead?.technician.email ?? null

  const totalCost = costs?.total ?? 0
  const materialsCount = materials?.items.length ?? 0
  const elapsedTime = formatDuration(os.startedAt ?? os.createdAt, os.completedAt)

  return (
    <>
      <aside className="w-full lg:w-80 shrink-0 space-y-3">
        {/* Cabeçalho do Painel */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-[#1d2530] dark:text-zinc-100 uppercase tracking-wider">Painel da OS</h3>
        </div>

        {/* Responsável */}
        <PanelCard>
          <p className="text-[11px] font-medium text-[#6c7c93] dark:text-zinc-400 mb-2.5">Responsável</p>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#114b9f] dark:bg-blue-600">
              <span className="text-white text-xs font-semibold">{initials(respName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1d2530] dark:text-zinc-100 truncate">{respName}</p>
              {respEmail && (
                <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 truncate">{respEmail}</p>
              )}
            </div>
            {respEmail && (
              <a
                href={`mailto:${respEmail}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e0e5eb] dark:border-zinc-800 text-[#6c7c93] dark:text-zinc-400 hover:text-[#0d4da5] dark:hover:text-blue-400 hover:border-[#0d4da5] dark:hover:border-blue-500 transition-colors"
                title="Enviar e-mail"
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </PanelCard>

        {/* Tempo */}
        <PanelCard>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 leading-none mb-1">Tempo</p>
              <p className="text-sm font-bold text-[#1d2530] dark:text-zinc-100 leading-tight">{elapsedTime}</p>
              <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400 leading-none mt-0.5">Tempo total registrado</p>
            </div>
          </div>
        </PanelCard>

        {/* Custos totais */}
        <PanelCard>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 leading-none mb-1">Custos totais</p>
              <p className="text-sm font-bold text-[#1d2530] dark:text-zinc-100 leading-tight">{fmtCurrency(totalCost)}</p>
              <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400 leading-none mt-0.5">Custo acumulado</p>
            </div>
          </div>
        </PanelCard>

        {/* Materiais utilizados */}
        <PanelCard>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
              <Package className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 leading-none mb-1">Materiais utilizados</p>
              <p className="text-sm font-bold text-[#1d2530] dark:text-zinc-100 leading-tight">
                {materialsCount} {materialsCount === 1 ? 'item' : 'itens'}
              </p>
              <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400 leading-none mt-0.5">Quantidade total</p>
            </div>
          </div>
        </PanelCard>

        {/* Última atualização */}
        <PanelCard>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800 text-[#6c7c93] dark:text-zinc-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 leading-none mb-1">Última atualização</p>
              <p className="text-xs font-semibold text-[#1d2530] dark:text-zinc-100 leading-tight">
                {new Date(os.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              <p className="text-[10px] text-[#6c7c93] dark:text-zinc-400 leading-none mt-0.5">{timeAgo(os.updatedAt)}</p>
            </div>
          </div>
        </PanelCard>

        {/* Ações rápidas */}
        <PanelCard>
          <h4 className="text-xs font-bold text-[#1d2530] dark:text-zinc-100 mb-2.5">Ações rápidas</h4>
          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('comments')}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[#4a5568] dark:text-zinc-300 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5 text-[#6c7c93] shrink-0" />
              <span>Adicionar comentário</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('materials')}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[#4a5568] dark:text-zinc-300 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 transition-colors"
            >
              <Package className="h-3.5 w-3.5 text-[#6c7c93] shrink-0" />
              <span>Adicionar material</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('costs')}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[#4a5568] dark:text-zinc-300 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 transition-colors"
            >
              <Clock className="h-3.5 w-3.5 text-[#6c7c93] shrink-0" />
              <span>Registrar tempo / custo</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('attachments')}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[#4a5568] dark:text-zinc-300 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5 text-[#6c7c93] shrink-0" />
              <span>Anexar arquivo</span>
            </button>
            <button
              type="button"
              onClick={() => setLabelModalOpen(true)}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[#4a5568] dark:text-zinc-300 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 transition-colors"
            >
              <Printer className="h-3.5 w-3.5 text-[#6c7c93] shrink-0" />
              <span>Imprimir etiqueta da OS</span>
            </button>
          </div>
        </PanelCard>
      </aside>

      <OsQrLabelModal
        open={labelModalOpen}
        os={os}
        onClose={() => setLabelModalOpen(false)}
      />
    </>
  )
}

