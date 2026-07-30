'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useState } from 'react'
import { Cpu, AlertTriangle, ShieldOff, TrendingUp, LayoutDashboard, ShieldAlert } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { SectionEquipmentWarranty } from './section-equipment-warranty'
import {
  useEquipmentOverview,
  useEquipmentTopFailures,
  useEquipmentWithoutPreventive,
  useEquipmentOsTimeline,
} from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'
import { cn } from '@/lib/utils'

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtHours(h: number | null | undefined) {
  if (h == null) return '–'
  if (h < 1) return `${Math.round(h * 60)}min`
  return `${h.toFixed(1)}h`
}

// Recharts entrega o valor do tooltip como number | string | array.
type ChartValue = number | string | ReadonlyArray<number | string> | undefined
type ChartName = number | string | undefined
const asNum = (v: ChartValue) => (typeof v === 'number' ? v : Number(v ?? 0))

const CRITICALITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', critical: '#ef4444',
  HIGH: '#f97a1f',     high: '#f97a1f',
  MEDIUM: '#f59e0b',   medium: '#f59e0b',
  LOW: '#10b981',      low: '#10b981',
}

const CRITICALITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica', critical: 'Crítica',
  HIGH: 'Alta',        high: 'Alta',
  MEDIUM: 'Média',     medium: 'Média',
  LOW: 'Baixa',        low: 'Baixa',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  underMaintenance: '#f59e0b',
  inactive: '#94a3b8',
  scrapped: '#ef4444',
  borrowed: '#8b5cf6',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  underMaintenance: 'Em manutenção',
  inactive: 'Inativo',
  scrapped: 'Sucateado',
  borrowed: 'Emprestado',
}

interface Props {
  filters: AnalyticsFilters
}

type SubTab = 'overview' | 'warranty'

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Parque e falhas', icon: LayoutDashboard },
  { id: 'warranty', label: 'Garantias', icon: ShieldAlert },
]

export function SectionEquipment({ filters }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const range = { startDate: filters.startDate, endDate: filters.endDate }

  const { data: overview, isLoading: loadingOv, error: errorOv } = useEquipmentOverview({})
  const { data: topFailuresResult, isLoading: loadingTf, error: errorTf } = useEquipmentTopFailures(range)
  const { data: withoutPrevResult, isLoading: loadingWp, error: errorWp } = useEquipmentWithoutPreventive({})
  const { data: osTimelineResult, isLoading: loadingTl, error: errorTl } = useEquipmentOsTimeline(range)

  const topFailures = topFailuresResult
  const withoutPrev = withoutPrevResult?.items
  const osTimeline = osTimelineResult?.series

  const statusPie = overview
    ? Object.entries(overview.byStatus)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v as number, color: STATUS_COLORS[k] ?? '#94a3b8' }))
    : []

  const subNav = (
    <div className="flex items-center gap-1 border-b border-[#e8ecf1] dark:border-zinc-800 -mx-1 px-1">
      {SUB_TABS.map((t) => {
        const Icon = t.icon
        const isActive = subTab === t.id
        return (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              isActive
                ? 'border-[#1162d4] text-[#0a3776] dark:text-blue-400'
                : 'border-transparent text-[#6c7c93] dark:text-zinc-400 hover:text-[#1d2530] dark:hover:text-zinc-100',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
            {t.id === 'warranty' && overview && overview.warranty.expiringSoon30 > 0 && (
              <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {overview.warranty.expiringSoon30}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  if (subTab === 'warranty') {
    return (
      <div className="space-y-5">
        {subNav}
        <SectionEquipmentWarranty />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {subNav}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Total de Equipamentos"
          value={loadingOv ? '…' : fmt(overview?.total)}
          subtitle={overview ? `${fmt(overview.byStatus.active)} ativos` : ''}
          icon={<Cpu className="h-4 w-4" />}
          accent="blue"
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Disponibilidade"
          value={loadingOv ? '…' : overview ? `${fmt(overview.availabilityRate, 1)}%` : '–'}
          subtitle="Ativos / total"
          accent="green"
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Sem Preventiva Ativa"
          value={loadingOv ? '…' : fmt(overview?.withoutActiveSchedule)}
          subtitle="Equipamentos ativos"
          icon={<ShieldOff className="h-4 w-4" />}
          accent={overview && overview.withoutActiveSchedule > 0 ? 'amber' : 'green'}
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Garantias a Vencer (30d)"
          value={loadingOv ? '…' : fmt(overview?.warranty.expiringSoon30)}
          subtitle={overview ? `${fmt(overview.warranty.expiringSoon90)} em 90 dias` : ''}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={overview && overview.warranty.expiringSoon30 > 0 ? 'amber' : 'green'}
          loading={loadingOv}
          error={errorOv}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="OS por Mês (Equipamentos)" subtitle="Corretivas vs Preventivas"
          className="lg:col-span-2" loading={loadingTl} error={errorTl} empty={!Array.isArray(osTimeline) || osTimeline.length === 0}>
          {Array.isArray(osTimeline) && osTimeline.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={osTimeline} margin={{top:4,right:8,bottom:0,left:-10}}>
                <defs>
                  <linearGradient id="eq-gC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="eq-gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                  tickFormatter={(v)=>{const[,m]=v.split('-');const ms=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];return ms[parseInt(m)-1]??v}}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  formatter={(v:ChartValue,n:ChartName)=>[asNum(v),n==='corrective'?'Corretivas':n==='preventive'?'Preventivas':n]}/>
                <Legend formatter={(v)=><span style={{fontSize:11}}>{v==='corrective'?'Corretivas':'Preventivas'}</span>}/>
                <Area type="monotone" dataKey="corrective" stroke="#3b82f6" strokeWidth={2} fill="url(#eq-gC)"/>
                <Area type="monotone" dataKey="preventive" stroke="#10b981" strokeWidth={2} fill="url(#eq-gP)"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Status dos Equipamentos" loading={loadingOv} error={errorOv} empty={statusPie.length === 0}>
          {statusPie.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                  {statusPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}/>
                <Legend iconType="circle" iconSize={8} formatter={(v)=><span style={{fontSize:11,color:'#6c7c93'}}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top failures */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7]">
            <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Top Equipamentos com Falhas</p>
            <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">
              {topFailures ? `MTTR global: ${fmtHours(topFailures.globalMttrHours)}` : 'Maior nº de OS no período'}
            </p>
          </div>
          <div className="overflow-auto" style={{ maxHeight: 260 }}>
            {loadingTf ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            ) : errorTf ? (
              <p className="p-6 text-xs text-red-500 text-center font-medium">Falha ao carregar o ranking de falhas</p>
            ) : (topFailures?.items ?? []).length === 0 ? (
              <p className="p-6 text-xs text-[#6c7c93] dark:text-zinc-400 text-center">Nenhuma OS de equipamento no período</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                  <tr className="border-b border-[#f3f4f7]">
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Equipamento</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">OS</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">MTTR</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {(topFailures?.items ?? []).map((item, i) => (
                    <tr key={item.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[#6c7c93] dark:text-zinc-400 w-4 shrink-0">{i + 1}.</span>
                          <span className="font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[140px]">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-[#0a3776]">{item.total_os}</td>
                      <td className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{fmtHours(item.mttr_hours)}</td>
                      <td className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{fmtCurrency(item.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Without preventive */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Sem Manutenção Preventiva</p>
              <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Equipamentos ativos sem agenda ativa</p>
            </div>
            {withoutPrevResult && withoutPrevResult.count > 0 && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                {withoutPrevResult.count} equipamentos
              </span>
            )}
          </div>
          <div className="overflow-auto" style={{ maxHeight: 260 }}>
            {loadingWp ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            ) : errorWp ? (
              <p className="p-6 text-xs text-red-500 text-center font-medium">Falha ao carregar a lista</p>
            ) : !withoutPrev || withoutPrev.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
                <TrendingUp className="h-8 w-8 text-emerald-400" />
                <p className="text-sm text-[#6c7c93] dark:text-zinc-400">Todos os equipamentos têm preventiva ativa</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                  <tr className="border-b border-[#f3f4f7]">
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Equipamento</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Criticidade</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Local</th>
                  </tr>
                </thead>
                <tbody>
                  {withoutPrev.map((eq) => (
                    <tr key={eq.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-2 font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[160px]">{eq.name}</td>
                      <td className="px-4 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: (CRITICALITY_COLORS[eq.criticality] ?? '#94a3b8') + '20',
                            color: CRITICALITY_COLORS[eq.criticality] ?? '#94a3b8',
                          }}
                        >
                          {CRITICALITY_LABELS[eq.criticality] ?? eq.criticality}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[#6c7c93] dark:text-zinc-400 truncate max-w-[120px]">{eq.currentLocation?.name ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
