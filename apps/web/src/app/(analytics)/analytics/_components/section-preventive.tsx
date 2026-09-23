'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts'
import { Calendar, Clock, AlertTriangle, CheckCircle2, Timer, Hourglass } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import {
  usePreventiveAdherence,
  usePreventiveTimeline,
  usePreventiveByTechnician,
  usePreventiveByEquipmentType,
  usePreventiveUpcoming,
  usePreventiveOverdue,
} from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '–'
  return `${fmt(n, 1)}%`
}

function fmtHours(h: number | null | undefined) {
  if (h == null) return '–'
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h >= 48) return `${fmt(h / 24, 1)}d`
  return `${fmt(h, 1)}h`
}

/** Prazo dos parâmetros: horas exatas viram dias quando fecham o dia. */
function fmtDeadline(h: number | null | undefined) {
  if (h == null) return '–'
  if (h >= 24 && h % 24 === 0) return `${h / 24}d`
  return fmtHours(h)
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
  AVULSA: 'Avulsa',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberta',
  AWAITING_PICKUP: 'Aguardando técnico',
  IN_PROGRESS: 'Em execução',
  COMPLETED: 'Concluída (aguard. aprovação)',
  COMPLETED_APPROVED: 'Aprovada',
  COMPLETED_REJECTED: 'Reprovada',
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

// Desfecho de cada preventiva em relação ao prazo configurado nos parâmetros.
// Cores de status, sempre acompanhadas de legenda.
const OUTCOME = {
  onTime:         { label: 'No prazo',            color: '#10b981' },
  late:           { label: 'Executada com atraso', color: '#f59e0b' },
  overdueNow:     { label: 'Vencida sem execução', color: '#ef4444' },
  withinDeadline: { label: 'Em aberto no prazo',   color: '#93c5fd' },
} as const

// Consumo do prazo: um só tom, do claro ao escuro; acima de 100% é estouro.
const USAGE_BUCKETS: Record<string, { label: string; color: string }> = {
  '0-25':   { label: 'até 25%',  color: '#a7f3d0' },
  '25-50':  { label: '25–50%',   color: '#6ee7b7' },
  '50-75':  { label: '50–75%',   color: '#34d399' },
  '75-100': { label: '75–100%',  color: '#059669' },
  '>100':   { label: 'acima do prazo', color: '#ef4444' },
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function periodLabel(value: string, granularity: string | undefined) {
  if (granularity === 'day') {
    const [, m, d] = value.split('-')
    return d && m ? `${d}/${m}` : value
  }
  if (granularity === 'week') {
    const [, w] = value.split('-W')
    return w ? `S${w}` : value
  }
  const [, m] = value.split('-')
  return MONTHS[parseInt(m) - 1] ?? value
}

type ChartValue = number | string | ReadonlyArray<number | string> | undefined
const asNum = (v: ChartValue) => (typeof v === 'number' ? v : Number(v ?? 0))

const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e8ecf1' }
const legendFormatter = (v: string) => <span style={{ fontSize: 11, color: '#6c7c93' }}>{v}</span>

function rateAccent(rate: number | null | undefined): 'green' | 'amber' | 'red' {
  if (rate == null) return 'amber'
  return rate >= 80 ? 'green' : rate >= 60 ? 'amber' : 'red'
}

function rateColor(rate: number | null | undefined) {
  if (rate == null) return '#94a3b8'
  return rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444'
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
  const scope = { clientId: filters.clientId, groupId: filters.groupId }

  const { data: adherence, isLoading: loadingAd, error: errorAd } = usePreventiveAdherence(base)
  const { data: timelineResult, isLoading: loadingTl, error: errorTl } = usePreventiveTimeline(base)
  const { data: byTech, isLoading: loadingTech, error: errorTech } = usePreventiveByTechnician(base)
  const { data: byType, isLoading: loadingType, error: errorType } = usePreventiveByEquipmentType(base)
  const { data: upcomingResult, isLoading: loadingUp } = usePreventiveUpcoming({ ...scope, daysAhead: 30 })
  const { data: overdue, isLoading: loadingOd, error: errorOd } = usePreventiveOverdue(scope)

  const upcoming = upcomingResult?.items
  const adherenceRate = adherence?.rates.adherenceRate ?? null
  const overdueTotal = overdue?.count ?? 0
  const summary = adherence?.summary

  // Prazo de referência: MEDIUM é a prioridade com que o agendador gera as preventivas.
  const deadlineMedium = adherence?.deadlineConfig.find((c) => c.priority === 'MEDIUM')?.hours
  const deadlineVaries = adherence
    ? new Set(adherence.deadlineConfig.map((c) => c.hours)).size > 1
    : false
  const deadlineText = deadlineMedium != null
    ? `Prazo nos parâmetros: ${fmtDeadline(deadlineMedium)}${deadlineVaries ? ' (prioridade média)' : ''}`
    : 'Prazo configurado nos parâmetros'

  const gaugeData = adherence && adherenceRate != null
    ? [{ name: 'Aderência', value: adherenceRate, fill: rateColor(adherenceRate) }]
    : [{ name: 'Aderência', value: 0, fill: '#e8ecf1' }]

  const outcomeBars = (adherence?.byRecurrence ?? []).map((r) => ({
    name: RECURRENCE_LABELS[r.recurrenceType] ?? r.recurrenceType,
    [OUTCOME.onTime.label]: r.onTime,
    [OUTCOME.late.label]: r.late,
    [OUTCOME.overdueNow.label]: r.overdueNow,
    [OUTCOME.withinDeadline.label]: r.withinDeadline,
    adherenceRate: r.adherenceRate,
  }))

  const granularity = timelineResult?.granularity
  const timeline = (timelineResult?.series ?? []).map((p) => ({
    period: p.period,
    [OUTCOME.onTime.label]: p.onTime,
    [OUTCOME.late.label]: p.late,
    [OUTCOME.overdueNow.label]: p.overdueNow,
    [OUTCOME.withinDeadline.label]: p.withinDeadline,
    executed: p.executed,
    adherenceRate: p.adherenceRate,
  }))
  const hasTimeline = (timelineResult?.series ?? []).some((p) => p.generated > 0 || p.executed > 0)

  const statusBars = (adherence?.byStatus ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    total: s.total,
  }))

  const usageBars = (adherence?.deadlineUsage ?? []).map((u) => ({
    bucket: u.bucket,
    name: USAGE_BUCKETS[u.bucket]?.label ?? u.bucket,
    total: u.total,
  }))
  const hasUsage = usageBars.some((u) => u.total > 0)

  const typeBars = (byType?.items ?? []).map((t) => ({
    name: t.typeName,
    [OUTCOME.onTime.label]: t.onTime,
    [OUTCOME.late.label]: t.late,
    [OUTCOME.overdueNow.label]: t.overdueNow,
    [OUTCOME.withinDeadline.label]: Math.max(t.total - t.executed - t.overdueNow, 0),
  }))

  const outcomeKeys = [OUTCOME.onTime, OUTCOME.late, OUTCOME.overdueNow, OUTCOME.withinDeadline]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Taxa de Aderência"
          value={loadingAd ? '…' : fmtPct(adherenceRate)}
          subtitle="No prazo / (executadas + vencidas)"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent={rateAccent(adherenceRate)}
          loading={loadingAd}
          error={errorAd}
        />
        <KpiCard
          title="Executadas"
          value={loadingAd ? '…' : summary ? `${fmt(summary.executed)} / ${fmt(summary.total)}` : '–'}
          subtitle={adherence ? `Execução: ${fmtPct(adherence.rates.executionRate)} das geradas` : 'Preventivas do período'}
          icon={<Clock className="h-4 w-4" />}
          accent="purple"
          loading={loadingAd}
          error={errorAd}
        />
        <KpiCard
          title="Preventivas Atrasadas"
          value={loadingOd ? '…' : fmt(overdueTotal)}
          subtitle={deadlineText}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={overdueTotal > 0 ? 'red' : 'green'}
          loading={loadingOd}
          error={errorOd}
        />
        <KpiCard
          title="Tempo Médio de Execução"
          value={loadingAd ? '…' : fmtHours(adherence?.times.avgExecutionHours)}
          subtitle={adherence ? `1º atendimento: ${fmtHours(adherence.times.avgResponseHours)}` : 'Abertura → conclusão'}
          icon={<Timer className="h-4 w-4" />}
          accent="blue"
          loading={loadingAd}
          error={errorAd}
        />
        <KpiCard
          title="Em Aberto no Prazo"
          value={loadingAd ? '…' : fmt(summary?.withinDeadline)}
          subtitle={summary ? `${fmt(summary.inProgress)} em execução` : ''}
          icon={<Hourglass className="h-4 w-4" />}
          accent="amber"
          loading={loadingAd}
          error={errorAd}
        />
        <KpiCard
          title="Próximas (30 dias)"
          value={loadingUp ? '…' : fmt(upcomingResult?.count)}
          subtitle="Agendas a gerar OS"
          icon={<Calendar className="h-4 w-4" />}
          accent="blue"
          loading={loadingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Aderência ao Prazo" subtitle={deadlineText} loading={loadingAd} error={errorAd} height={260}>
          <div className="flex flex-col items-center justify-center h-full gap-2 w-full">
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0}
                data={gaugeData}>
                <PolarAngleAxis type="number" domain={[0,100]} angleAxisId={0} tick={false}/>
                <RadialBar background={{fill:'#f3f4f7'}} dataKey="value" cornerRadius={6} angleAxisId={0}/>
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-center -mt-6">
              <p className="text-3xl font-bold text-[#1d2530] dark:text-zinc-100">{fmtPct(adherenceRate)}</p>
              {summary && (
                <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-1">
                  {fmt(summary.onTime)} no prazo · {fmt(summary.late)} com atraso · {fmt(summary.overdueNow)} vencidas
                </p>
              )}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Evolução das Preventivas"
          subtitle="Desfecho das OS geradas em cada período"
          className="lg:col-span-2"
          loading={loadingTl}
          error={errorTl}
          empty={!hasTimeline}
          height={260}
        >
          {hasTimeline && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="period" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                  minTickGap={16} tickFormatter={(v) => periodLabel(v, granularity)}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v, payload) => {
                    const row = payload?.[0]?.payload as { adherenceRate: number | null; executed: number } | undefined
                    const extra = row ? ` · aderência ${fmtPct(row.adherenceRate)} · ${row.executed} executadas no período` : ''
                    return `${periodLabel(String(v), granularity)}${extra}`
                  }}
                  formatter={(v: ChartValue, n) => [asNum(v), n]}
                />
                <Legend iconType="circle" iconSize={8} itemSorter={null} formatter={legendFormatter}/>
                {outcomeKeys.map((o, i) => (
                  <Bar key={o.label} dataKey={o.label} stackId="a" fill={o.color} maxBarSize={32}
                    radius={i === outcomeKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Aderência por Recorrência"
          subtitle="Avulsa = OS preventiva aberta sem agendamento"
          className="lg:col-span-2"
          loading={loadingAd}
          error={errorAd}
          empty={outcomeBars.length === 0}
          height={260}
        >
          {outcomeBars.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outcomeBars} margin={{top:4,right:8,bottom:0,left:-10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v, payload) => {
                    const row = payload?.[0]?.payload as { adherenceRate: number | null } | undefined
                    return row ? `${v} · aderência ${fmtPct(row.adherenceRate)}` : String(v)
                  }}
                />
                <Legend iconType="circle" iconSize={8} itemSorter={null} formatter={legendFormatter}/>
                {outcomeKeys.map((o, i) => (
                  <Bar key={o.label} dataKey={o.label} stackId="a" fill={o.color} maxBarSize={40}
                    radius={i === outcomeKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Situação Atual"
          subtitle="Status das OS preventivas do período"
          loading={loadingAd}
          error={errorAd}
          empty={statusBars.length === 0}
          height={260}
        >
          {statusBars.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBars} layout="vertical" margin={{top:4,right:24,bottom:4,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={120}/>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: ChartValue) => [asNum(v), 'OS']}/>
                <Bar dataKey="total" fill="#3b82f6" radius={[0,4,4,0]} maxBarSize={18}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Consumo do Prazo"
          subtitle="Tempo de execução das concluídas em relação ao prazo dos parâmetros"
          loading={loadingAd}
          error={errorAd}
          empty={!hasUsage}
          height={260}
        >
          {hasUsage && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageBars} margin={{top:4,right:8,bottom:0,left:-10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: ChartValue) => [asNum(v), 'Preventivas']}/>
                <Bar dataKey="total" radius={[4,4,0,0]} maxBarSize={48}>
                  {usageBars.map((u) => (
                    <Cell key={u.bucket} fill={USAGE_BUCKETS[u.bucket]?.color ?? '#94a3b8'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Por Tipo de Equipamento"
          subtitle="Desfecho das preventivas do período"
          loading={loadingType}
          error={errorType}
          empty={typeBars.length === 0}
          height={260}
        >
          {typeBars.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeBars} layout="vertical" margin={{top:4,right:16,bottom:4,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={110}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Legend iconType="circle" iconSize={8} itemSorter={null} formatter={legendFormatter}/>
                {outcomeKeys.map((o, i) => (
                  <Bar key={o.label} dataKey={o.label} stackId="a" fill={o.color} maxBarSize={18}
                    radius={i === outcomeKeys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Por técnico */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7] flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Preventivas por Técnico</p>
            <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">OS preventivas do período por técnico vinculado</p>
          </div>
          {byTech && byTech.unassigned.total > 0 && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 shrink-0">
              {byTech.unassigned.total} sem técnico{byTech.unassigned.overdueNow > 0 ? ` · ${byTech.unassigned.overdueNow} vencidas` : ''}
            </span>
          )}
        </div>
        <div className="overflow-auto" style={{ maxHeight: 320 }}>
          {loadingTech ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
            </div>
          ) : errorTech ? (
            <p className="p-6 text-xs text-red-500 text-center font-medium">Falha ao carregar os técnicos</p>
          ) : (byTech?.items ?? []).length === 0 ? (
            <p className="p-6 text-xs text-[#6c7c93] dark:text-zinc-400 text-center">Nenhuma preventiva com técnico no período</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                <tr className="border-b border-[#f3f4f7]">
                  <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Técnico</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Total</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Executadas</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">No prazo</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Com atraso</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Vencidas</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Tempo médio</th>
                  <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium w-40">Aderência</th>
                </tr>
              </thead>
              <tbody>
                {(byTech?.items ?? []).map((t) => (
                  <tr key={t.technicianId} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] dark:hover:bg-zinc-900 transition-colors">
                    <td className="px-4 py-2 font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[180px]">{t.technicianName}</td>
                    <td className="px-4 py-2 text-right text-[#1d2530] dark:text-zinc-100">{t.total}</td>
                    <td className="px-4 py-2 text-right text-[#1d2530] dark:text-zinc-100">{t.executed}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{t.onTime}</td>
                    <td className="px-4 py-2 text-right text-amber-600 dark:text-amber-400">{t.late}</td>
                    <td className="px-4 py-2 text-right text-red-500 font-semibold">{t.overdueNow}</td>
                    <td className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{fmtHours(t.avgExecutionHours)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[#f3f4f7] dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${t.adherenceRate ?? 0}%`, backgroundColor: rateColor(t.adherenceRate) }} />
                        </div>
                        <span className="text-[#1d2530] dark:text-zinc-100 w-12 text-right">{fmtPct(t.adherenceRate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Próximas Preventivas</p>
              <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Agendas que geram OS nos próximos 30 dias</p>
            </div>
            {upcomingResult && upcomingResult.count > 0 && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                {upcomingResult.count} {upcomingResult.count === 1 ? 'agendada' : 'agendadas'}
              </span>
            )}
          </div>
          <div className="overflow-auto" style={{ maxHeight: 300 }}>
            {loadingUp ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            ) : (upcoming ?? []).length === 0 ? (
              <p className="p-6 text-xs text-[#6c7c93] dark:text-zinc-400 text-center">Nenhuma preventiva agendada para os próximos 30 dias</p>
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
                    <tr key={item.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] dark:hover:bg-zinc-900 transition-colors">
                      <td className="px-4 py-2">
                        <p className="font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[160px]">{item.equipment_name}</p>
                        <p className="text-[#6c7c93] dark:text-zinc-400 truncate max-w-[160px]">
                          {item.title} · {RECURRENCE_LABELS[item.recurrence_type] ?? item.recurrence_type}
                        </p>
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
              <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">OS em aberto além do prazo dos parâmetros</p>
            </div>
            {overdue && overdue.count > 0 && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                {overdue.count} em atraso
              </span>
            )}
          </div>
          {overdue && overdue.count > 0 && (
            <div className="flex gap-2 px-5 py-3 border-b border-[#f3f4f7] flex-wrap items-center">
              {Object.entries(overdue.byCriticality).filter(([, v]) => v > 0).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: (CRITICALITY_COLORS[k] ?? '#94a3b8') + '20', color: CRITICALITY_COLORS[k] ?? '#94a3b8' }}>
                  {CRITICALITY_LABELS[k] ?? k}: {v}
                </span>
              ))}
              <span className="text-xs text-[#6c7c93] dark:text-zinc-400 ml-auto">
                ≤7d: {overdue.byDelay.upTo7} · 8–30d: {overdue.byDelay.upTo30} · 31–90d: {overdue.byDelay.upTo90} · &gt;90d: {overdue.byDelay.over90}
              </span>
            </div>
          )}
          <div className="overflow-auto" style={{ maxHeight: 260 }}>
            {loadingOd ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
              </div>
            ) : errorOd ? (
              <p className="p-6 text-xs text-red-500 text-center font-medium">Falha ao carregar as preventivas atrasadas</p>
            ) : overdue?.count === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-sm text-[#6c7c93] dark:text-zinc-400">Nenhuma preventiva atrasada</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                  <tr className="border-b border-[#f3f4f7]">
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Equipamento / OS</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Crit.</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Venceu em</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {(overdue?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] dark:hover:bg-zinc-900 transition-colors">
                      <td className="px-4 py-2">
                        <p className="font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[180px]">{item.equipment_name}</p>
                        <p className="text-[#6c7c93] dark:text-zinc-400 truncate max-w-[180px]">
                          OS #{item.number} · {STATUS_LABELS[item.status] ?? item.status}
                          {item.technician_name ? ` · ${item.technician_name}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: (CRITICALITY_COLORS[item.criticality] ?? '#94a3b8') + '20', color: CRITICALITY_COLORS[item.criticality] ?? '#94a3b8' }}>
                          {CRITICALITY_LABELS[item.criticality] ?? item.criticality}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[#1d2530] dark:text-zinc-100 whitespace-nowrap">
                        {new Date(item.due_at).toLocaleDateString('pt-BR')}
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
