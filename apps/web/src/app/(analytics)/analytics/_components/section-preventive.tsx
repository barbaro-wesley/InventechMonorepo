'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts'
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import {
  usePreventiveAdherence,
  usePreventiveUpcoming,
  usePreventiveOverdue,
} from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  CUSTOM: 'Personalizada',
}

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

interface Props {
  filters: AnalyticsFilters
}

export function SectionPreventive({ filters }: Props) {
  const base = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    clientId: filters.clientId,
    groupId: filters.groupId,
  }

  const { data: adherence, isLoading: loadingAd } = usePreventiveAdherence(base)
  const { data: upcomingResult, isLoading: loadingUp } = usePreventiveUpcoming({ clientId: filters.clientId, groupId: filters.groupId, daysAhead: 30 })
  const { data: overdue, isLoading: loadingOd } = usePreventiveOverdue({ clientId: filters.clientId, groupId: filters.groupId })

  const upcoming = upcomingResult?.items
  const adherenceRate = adherence?.rates.adherenceRate ?? 0
  const overdueTotal = overdue?.count ?? 0

  const gaugeData = adherence
    ? [{ name: 'Aderência', value: adherenceRate, fill: adherenceRate >= 80 ? '#10b981' : adherenceRate >= 60 ? '#f59e0b' : '#ef4444' }]
    : [{ name: 'Aderência', value: 0, fill: '#e8ecf1' }]

  const adherenceBars = adherence?.byRecurrence.map((r) => ({
    name: RECURRENCE_LABELS[r.recurrenceType] ?? r.recurrenceType,
    'No prazo': r.onTime,
    'Com atraso': r.executed - r.onTime,
    'Não executado': r.total - r.executed,
  })) ?? []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Taxa de Aderência"
          value={loadingAd ? '…' : adherence ? `${fmt(adherenceRate, 1)}%` : '–'}
          subtitle="Executadas no prazo / total"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent={adherence && adherenceRate >= 80 ? 'green' : adherence && adherenceRate >= 60 ? 'amber' : 'red'}
          loading={loadingAd}
        />
        <KpiCard
          title="Preventivas Atrasadas"
          value={loadingOd ? '…' : fmt(overdueTotal)}
          subtitle="Com nextRunAt no passado"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={overdueTotal > 0 ? 'red' : 'green'}
          loading={loadingOd}
        />
        <KpiCard
          title="Próximas (30 dias)"
          value={loadingUp ? '…' : fmt(upcomingResult?.count)}
          subtitle="Preventivas agendadas"
          icon={<Calendar className="h-4 w-4" />}
          accent="blue"
          loading={loadingUp}
        />
        <KpiCard
          title="Total Programadas"
          value={loadingAd ? '…' : fmt(adherence?.summary.total)}
          subtitle={adherence ? `${fmt(adherence.summary.onTime)} no prazo` : ''}
          icon={<Clock className="h-4 w-4" />}
          accent="purple"
          loading={loadingAd}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Gauge de Aderência" subtitle="Taxa de execução no prazo" loading={loadingAd} height={240}>
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0}
                data={gaugeData}>
                <PolarAngleAxis type="number" domain={[0,100]} angleAxisId={0} tick={false}/>
                <RadialBar background={{fill:'#f3f4f7'}} dataKey="value" cornerRadius={6} angleAxisId={0}/>
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-center -mt-6">
              <p className="text-3xl font-bold text-[#1d2530] dark:text-zinc-100">{adherence ? `${fmt(adherenceRate, 1)}%` : '–'}</p>
              <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-1">{adherence ? `${fmt(adherence.summary.onTime)} de ${fmt(adherence.summary.total)} no prazo` : ''}</p>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Aderência por Recorrência" className="lg:col-span-2" loading={loadingAd} height={240} empty={adherenceBars.length === 0}>
          {adherenceBars.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={adherenceBars} margin={{top:4,right:8,bottom:0,left:-10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}/>
                <Bar dataKey="No prazo" stackId="a" fill="#10b981" radius={[0,0,0,0]} maxBarSize={40}/>
                <Bar dataKey="Com atraso" stackId="a" fill="#f59e0b" maxBarSize={40}/>
                <Bar dataKey="Não executado" stackId="a" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={40}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Próximas Preventivas</p>
              <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Próximos 30 dias</p>
            </div>
            {upcomingResult && upcomingResult.count > 0 && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                {upcomingResult.count} agendadas
              </span>
            )}
          </div>
          <div className="overflow-auto" style={{ maxHeight: 260 }}>
            {loadingUp ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                  <tr className="border-b border-[#f3f4f7]">
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Equipamento</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Próxima Exec.</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {(upcoming ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-2">
                        <p className="font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[140px]">{item.equipment_name}</p>
                        <p className="text-[#6c7c93] dark:text-zinc-400 truncate">{item.title}</p>
                      </td>
                      <td className="px-4 py-2 text-[#1d2530] dark:text-zinc-100 whitespace-nowrap">
                        {new Date(item.next_run_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-2 text-[#6c7c93] dark:text-zinc-400 truncate max-w-[100px]">
                        {item.technician_name ?? '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Preventivas Atrasadas</p>
              <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Por criticidade do equipamento</p>
            </div>
            {overdue && overdue.count > 0 && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                {overdue.count} em atraso
              </span>
            )}
          </div>
          {overdue && (
            <div className="flex gap-2 px-5 py-3 border-b border-[#f3f4f7] flex-wrap">
              {Object.entries(overdue.byCriticality).filter(([, v]) => v > 0).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: (CRITICALITY_COLORS[k] ?? '#94a3b8') + '20', color: CRITICALITY_COLORS[k] ?? '#94a3b8' }}>
                  {CRITICALITY_LABELS[k] ?? k}: {v}
                </span>
              ))}
            </div>
          )}
          <div className="overflow-auto" style={{ maxHeight: 220 }}>
            {loadingOd ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            ) : overdue?.count === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-sm text-[#6c7c93] dark:text-zinc-400">Nenhuma preventiva atrasada</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                  <tr className="border-b border-[#f3f4f7]">
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Equipamento</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Crit.</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {(overdue?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-2 font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[160px]">{item.equipment_name}</td>
                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: (CRITICALITY_COLORS[item.criticality] ?? '#94a3b8') + '20', color: CRITICALITY_COLORS[item.criticality] ?? '#94a3b8' }}>
                          {CRITICALITY_LABELS[item.criticality] ?? item.criticality}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-red-500">{item.days_overdue}d</td>
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
