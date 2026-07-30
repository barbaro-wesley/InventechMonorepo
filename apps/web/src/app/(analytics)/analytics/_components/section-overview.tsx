'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Wrench, CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { useOsOverview, useOsTimeline, useOsComparison, useEquipmentOverview } from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'
import type { OsComparisonDelta } from '@/services/analytics/analytics.service'

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6', inProgress: '#f59e0b', awaitingPickup: '#8b5cf6',
  completed: '#10b981', approved: '#059669', rejected: '#ef4444', cancelled: '#94a3b8',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Abertas', inProgress: 'Em andamento', awaitingPickup: 'Aguard. retirada',
  // "Concluídas" seria ambíguo ao lado de "Aprovadas": este status é a OS
  // entregue pelo técnico que ainda espera o aval.
  completed: 'Aguard. aprovação', approved: 'Aprovadas', rejected: 'Rejeitadas', cancelled: 'Canceladas',
}

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
function deltaToKpi(d: OsComparisonDelta | null | undefined) {
  if (!d) return undefined
  return { absolute: d.absolute, percent: d.percent }
}
function invertDelta(d: OsComparisonDelta | null | undefined) {
  if (!d) return undefined
  return { absolute: -d.absolute, percent: d.percent != null ? -d.percent : null }
}

// Recharts entrega o valor do tooltip como number | string | array. Estreitar
// aqui evita `any` nos formatters e mantém o lint limpo.
type ChartValue = number | string | ReadonlyArray<number | string> | undefined
type ChartName = number | string | undefined
const asNum = (v: ChartValue) => (typeof v === 'number' ? v : Number(v ?? 0))

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

/** O formato do rótulo acompanha a granularidade escolhida pelo backend. */
function periodLabel(v: string, granularity: string | undefined) {
  if (granularity === 'day') { const [,m,d] = v.split('-'); return d && m ? `${d}/${m}` : v }
  if (granularity === 'week') { const [,w] = v.split('-W'); return w ? `S${w}` : v }
  const [,m] = v.split('-'); return MONTHS[parseInt(m)-1] ?? v
}

interface Props { filters: AnalyticsFilters }

export function SectionOverview({ filters }: Props) {
  const base = { startDate: filters.startDate, endDate: filters.endDate, clientId: filters.clientId, groupId: filters.groupId }
  const { data: osOverview, isLoading: loadingOs, error: errorOs } = useOsOverview(base)
  // Granularidade automática no backend conforme o tamanho da janela.
  const { data: timeline, isLoading: loadingTimeline, error: errorTimeline } = useOsTimeline(base)
  const { data: cmp, isLoading: loadingCmp, error: errorCmp } = useOsComparison(base)
  const { data: eqOverview, isLoading: loadingEq, error: errorEq } = useEquipmentOverview({})

  const statusPie = osOverview
    ? Object.entries(osOverview.byStatus).filter(([,v]) => v > 0)
        .map(([k,v]) => ({ name: STATUS_LABELS[k]??k, value: v, color: STATUS_COLORS[k]??'#94a3b8' }))
    : []

  const timelineSeries = timeline?.series
  const hasTimeline = Array.isArray(timelineSeries) && timelineSeries.length > 0
  const hasPie = statusPie.length > 0

  // Convenience accessors into the real response shape
  const cur = cmp?.current
  const d   = cmp?.delta

  return (
    <div className="space-y-5">
      {/* Row 1 — OS KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard title="Total de OS" value={loadingOs ? '…' : fmt(osOverview?.total)} subtitle="No período"
          icon={<Wrench className="h-4 w-4"/>} accent="blue" loading={loadingOs} error={errorOs}
          delta={deltaToKpi(d?.total)} deltaLabel="vs período anterior" />

        {/* Concluídas = recorte por data de conclusão. Antes usava
            byStatus.completed, que conta apenas o status COMPLETED (aguardando
            aprovação) da safra aberta no período — zerava o cartão em empresas
            que aprovam a OS na sequência. */}
        <KpiCard title="OS Concluídas" value={loadingOs ? '…' : fmt(osOverview?.concludedInPeriod.total)}
          subtitle="Concluídas no período"
          icon={<CheckCircle2 className="h-4 w-4"/>} accent="green" loading={loadingOs} error={errorOs}
          delta={deltaToKpi(d?.completed)} deltaLabel="vs período anterior" />

        <KpiCard title="Tempo Médio Resolução" value={loadingOs ? '…' : fmtHours(osOverview?.sla.avgResolutionHours)} subtitle="MTTR"
          icon={<Clock className="h-4 w-4"/>} accent="amber" loading={loadingOs} error={errorOs}
          delta={invertDelta(d?.avgResolutionHours)} deltaLabel="vs período anterior" />

        <KpiCard title="First-Time Fix Rate"
          value={loadingCmp ? '…' : cur?.firstTimeFixRate != null ? `${fmt(cur.firstTimeFixRate, 1)}%` : '–'}
          subtitle="OS sem OS filha" icon={<TrendingUp className="h-4 w-4"/>} accent="green" loading={loadingCmp} error={errorCmp}
          delta={deltaToKpi(d?.firstTimeFixRate)} deltaLabel="vs período anterior" />
      </div>

      {/* Row 2 — Equipment KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard title="Total de Equipamentos" value={loadingEq ? '…' : fmt(eqOverview?.total)}
          subtitle={eqOverview ? `${fmt(eqOverview.byStatus.active)} ativos` : ''} accent="blue" loading={loadingEq} error={errorEq} />

        <KpiCard title="Disponibilidade" value={loadingEq ? '…' : eqOverview ? `${fmt(eqOverview.availabilityRate, 1)}%` : '–'}
          subtitle="Taxa de disponibilidade" accent="green" loading={loadingEq} error={errorEq} />

        <KpiCard title="Custo Total OS" value={loadingOs ? '…' : fmtCurrency(osOverview?.totalCost)} subtitle="No período"
          accent="amber" loading={loadingOs} error={errorOs} delta={deltaToKpi(d?.totalCost)} deltaLabel="vs período anterior" />

        <KpiCard title="Garantias a Vencer" value={loadingEq ? '…' : fmt(eqOverview?.warranty.expiringSoon30)} subtitle="Próximos 30 dias"
          icon={<AlertTriangle className="h-4 w-4"/>}
          accent={eqOverview && eqOverview.warranty.expiringSoon30 > 0 ? 'amber' : 'green'} loading={loadingEq} error={errorEq} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Evolução de OS" subtitle="Abertas vs concluídas" className="lg:col-span-2"
          loading={loadingTimeline} error={errorTimeline} empty={!hasTimeline}>
          {hasTimeline && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineSeries} margin={{top:4,right:8,bottom:0,left:-10}}>
                <defs>
                  <linearGradient id="ov-gT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ov-gD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="period" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                  minTickGap={16} tickFormatter={(v)=>periodLabel(v, timeline?.granularity)}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  labelFormatter={(v)=>periodLabel(String(v), timeline?.granularity)}
                  formatter={(v:ChartValue,n:ChartName)=>[asNum(v),n==='total'?'Abertas':n==='completed'?'Concluídas':n]}/>
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#ov-gT)" name="total"/>
                <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fill="url(#ov-gD)" name="completed"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="OS por Status" subtitle="Safra aberta no período" loading={loadingOs} error={errorOs} empty={!hasPie}>
          {hasPie && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                  {statusPie.map((e,i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}/>
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{fontSize:11,color:'#6c7c93'}}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Period comparison cards */}
      {cmp && cur && d && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {([
            { label: 'OS Abertas',      cur: cur.total,              delta: d.total },
            { label: 'Concluídas',      cur: cur.completed,          delta: d.completed },
            { label: 'Custo Total',     cur: cur.totalCost,          delta: d.totalCost,           currency: true },
            { label: 'Tempo Resposta',  cur: cur.avgResponseHours,   delta: d.avgResponseHours,    hours: true, lowerBetter: true },
            { label: 'Tempo Resolução', cur: cur.avgResolutionHours, delta: d.avgResolutionHours,  hours: true, lowerBetter: true },
            { label: 'First-Time Fix',  cur: cur.firstTimeFixRate,   delta: d.firstTimeFixRate,    pct: true },
          ] as const).map(({ label, cur: val, delta: dlt, ...flags }) => {
            const isGood = dlt == null ? true
              : ('lowerBetter' in flags) ? dlt.absolute <= 0
              : ('currency' in flags) ? dlt.absolute <= 0
              : dlt.absolute >= 0

            return (
              <div key={label} className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm p-4">
                <p className="text-xs text-[#6c7c93] dark:text-zinc-400 font-medium mb-2">{label}</p>
                <p className="text-lg font-bold text-[#1d2530] dark:text-zinc-100">
                  {'currency' in flags ? fmtCurrency(val as number) : 'hours' in flags ? fmtHours(val as number | null) : 'pct' in flags ? `${fmt(val as number | null, 1)}%` : fmt(val as number)}
                </p>
                {dlt && (
                  <div className={`flex items-center gap-1 text-xs mt-1 font-medium ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isGood ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
                    {dlt.percent != null ? `${dlt.percent > 0 ? '+' : ''}${dlt.percent.toFixed(1)}%` : dlt.absolute > 0 ? `+${dlt.absolute}` : String(dlt.absolute)}
                    <span className="text-[#6c7c93] dark:text-zinc-400 font-normal ml-0.5">vs ant.</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
