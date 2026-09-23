'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Building2, Wrench, ShieldCheck, DollarSign, ArrowDown, ArrowUp } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { useProvidersComparison, useProvidersTimeline } from '@/hooks/analytics/use-analytics'
import type { ProviderComparisonItem } from '@/services/analytics/analytics.service'
import type { AnalyticsFilters } from './filter-bar'
import { cn } from '@/lib/utils'

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '–'
  return `${fmt(n, 1)}%`
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtHours(h: number | null | undefined) {
  if (h == null) return '–'
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h >= 48) return `${fmt(h / 24, 1)}d`
  return `${fmt(h, 1)}h`
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

// Paleta categórica validada (ordem fixa). Cada prestador recebe um slot ao ser
// selecionado e o mantém enquanto estiver selecionado — a cor segue o
// prestador, não a posição no ranking.
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7']
const MAX_SELECTED = SERIES_COLORS.length
const DEFAULT_SELECTED = 5

const TYPE_COLORS = { corrective: '#3b82f6', preventive: '#10b981', other: '#94a3b8' }

const INTERNAL_KEY = '__internal'
const keyOf = (p: ProviderComparisonItem) => p.providerId ?? INTERNAL_KEY

type SortKey =
  | 'providerName' | 'total' | 'completionRate' | 'slaComplianceRate' | 'tpaComplianceRate'
  | 'preventiveAdherence' | 'firstTimeFixRate' | 'rejectionRate'
  | 'avgResponseHours' | 'avgResolutionHours' | 'totalCost' | 'avgCostPerOs'

function sortValue(p: ProviderComparisonItem, key: SortKey): number | string | null {
  switch (key) {
    case 'providerName':        return p.providerName.toLocaleLowerCase('pt-BR')
    case 'total':               return p.total
    case 'completionRate':      return p.rates.completionRate
    case 'slaComplianceRate':   return p.rates.slaComplianceRate
    case 'tpaComplianceRate':   return p.rates.tpaComplianceRate
    case 'preventiveAdherence': return p.rates.preventiveAdherence
    case 'firstTimeFixRate':    return p.rates.firstTimeFixRate
    case 'rejectionRate':       return p.rates.rejectionRate
    case 'avgResponseHours':    return p.avgResponseHours
    case 'avgResolutionHours':  return p.avgResolutionHours
    case 'totalCost':           return p.totalCost
    case 'avgCostPerOs':        return p.avgCostPerOs
  }
}

interface Props {
  filters: AnalyticsFilters
}

export function SectionProviders({ filters }: Props) {
  const base = { startDate: filters.startDate, endDate: filters.endDate, groupId: filters.groupId }

  const { data: comparison, isLoading: loadingCmp, error: errorCmp } = useProvidersComparison(base)
  const { data: timelineResult, isLoading: loadingTl, error: errorTl } = useProvidersTimeline(base)

  const items = useMemo(() => comparison?.items ?? [], [comparison])

  // Seleção: null = padrão (os maiores prestadores por volume). A primeira
  // interação parte da seleção efetiva, então nada "pula" na tela.
  const [userSelection, setUserSelection] = useState<Record<string, number> | null>(null)
  const defaultSelection = useMemo(() => {
    const sel: Record<string, number> = {}
    items.filter((i) => !i.isInternal).slice(0, DEFAULT_SELECTED).forEach((p, idx) => { sel[keyOf(p)] = idx })
    return sel
  }, [items])
  const selection = userSelection ?? defaultSelection

  function toggle(key: string) {
    const current = { ...selection }
    if (key in current) {
      delete current[key]
    } else {
      const used = new Set(Object.values(current))
      const free = SERIES_COLORS.findIndex((_, i) => !used.has(i))
      if (free === -1) return
      current[key] = free
    }
    setUserSelection(current)
  }

  const selected = items.filter((p) => keyOf(p) in selection)
  const colorOf = (p: ProviderComparisonItem) => SERIES_COLORS[selection[keyOf(p)]] ?? '#94a3b8'

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'total', dir: 'desc' })
  const sorted = [...items].sort((a, b) => {
    const va = sortValue(a, sort.key)
    const vb = sortValue(b, sort.key)
    // Sem dado vai sempre para o fim, independente da direção.
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sort.dir === 'asc' ? cmp : -cmp
  })

  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'providerName' ? 'asc' : 'desc' }))
  }

  // ── Dados dos gráficos ────────────────────────────────────────────────────
  const volumeBars = selected.map((p) => ({
    name: p.providerName,
    Corretivas: p.byType.corrective,
    Preventivas: p.byType.preventive,
    Outras: p.byType.other,
  }))

  const RATE_METRICS: { label: string; get: (p: ProviderComparisonItem) => number | null }[] = [
    { label: 'Conclusão',         get: (p) => p.rates.completionRate },
    { label: 'SLA no prazo',      get: (p) => p.rates.slaComplianceRate },
    { label: '1º atend. no prazo', get: (p) => p.rates.tpaComplianceRate },
    { label: 'Aderência prev.',   get: (p) => p.rates.preventiveAdherence },
    { label: 'Resolvida na 1ª',   get: (p) => p.rates.firstTimeFixRate },
  ]
  const rateBars = RATE_METRICS.map((m) => {
    const row: Record<string, string | number | null> = { metric: m.label }
    for (const p of selected) row[keyOf(p)] = m.get(p)
    return row
  })

  const TIME_METRICS: { label: string; get: (p: ProviderComparisonItem) => number | null }[] = [
    { label: '1º atendimento',      get: (p) => p.avgResponseHours },
    { label: 'Execução',            get: (p) => p.avgResolutionHours },
    { label: 'Abertura → conclusão', get: (p) => p.avgTotalHours },
  ]
  const timeBars = TIME_METRICS.map((m) => {
    const row: Record<string, string | number | null> = { metric: m.label }
    for (const p of selected) row[keyOf(p)] = m.get(p)
    return row
  })

  const costBars = selected.map((p) => ({ key: keyOf(p), name: p.providerName, value: p.avgCostPerOs ?? 0, color: colorOf(p) }))

  const [timelineMetric, setTimelineMetric] = useState<'concluded' | 'opened'>('concluded')
  const granularity = timelineResult?.granularity
  const timeline = useMemo(() => {
    const byPeriod = new Map<string, Record<string, string | number>>()
    for (const s of timelineResult?.series ?? []) {
      const key = s.providerId ?? INTERNAL_KEY
      if (!(key in selection)) continue
      const row = byPeriod.get(s.period) ?? { period: s.period }
      row[key] = timelineMetric === 'concluded' ? s.concluded : s.opened
      byPeriod.set(s.period, row)
    }
    return [...byPeriod.values()]
  }, [timelineResult, selection, timelineMetric])

  const hasSelection = selected.length > 0
  const bestSla = items
    .filter((p) => !p.isInternal && p.rates.slaComplianceRate != null && p.sla.judged >= 3)
    .sort((a, b) => (b.rates.slaComplianceRate ?? 0) - (a.rates.slaComplianceRate ?? 0))[0]

  const nameOf = (key: string) => items.find((p) => keyOf(p) === key)?.providerName ?? key

  const header = (label: string, key: SortKey, align: 'left' | 'right' = 'right') => (
    <th className={cn('px-3 py-2 font-medium text-[#6c7c93] dark:text-zinc-400 whitespace-nowrap', align === 'left' ? 'text-left' : 'text-right')}>
      <button type="button" onClick={() => onSort(key)}
        className={cn('inline-flex items-center gap-1 hover:text-[#1d2530] dark:hover:text-zinc-100', sort.key === key && 'text-[#1d2530] dark:text-zinc-100')}>
        {label}
        {sort.key === key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Prestadores Atuantes"
          value={loadingCmp ? '…' : fmt(comparison?.summary.providersWithOs)}
          subtitle="Com OS no período"
          icon={<Building2 className="h-4 w-4" />}
          accent="blue"
          loading={loadingCmp}
          error={errorCmp}
        />
        <KpiCard
          title="OS por Prestadores"
          value={loadingCmp ? '…' : fmt(comparison?.summary.providerOs)}
          subtitle={comparison ? `${fmtPct(comparison.summary.providerShare)} de ${fmt(comparison.summary.totalOs)} OS` : ''}
          icon={<Wrench className="h-4 w-4" />}
          accent="purple"
          loading={loadingCmp}
          error={errorCmp}
        />
        <KpiCard
          title="Melhor SLA"
          value={loadingCmp ? '…' : bestSla ? fmtPct(bestSla.rates.slaComplianceRate) : '–'}
          subtitle={bestSla ? bestSla.providerName : 'Mín. 3 OS concluídas com SLA'}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="green"
          loading={loadingCmp}
          error={errorCmp}
        />
        <KpiCard
          title="Custo dos Prestadores"
          value={loadingCmp ? '…' : fmtCurrency(comparison?.summary.providerCost)}
          subtitle="Itens de custo lançados nas OS"
          icon={<DollarSign className="h-4 w-4" />}
          accent="amber"
          loading={loadingCmp}
          error={errorCmp}
        />
      </div>

      {/* Seleção para os gráficos comparativos */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm px-5 py-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Comparar prestadores</p>
          <p className="text-xs text-[#6c7c93] dark:text-zinc-400">
            {selected.length}/{MAX_SELECTED} selecionados · clique para incluir ou remover dos gráficos
          </p>
        </div>
        {loadingCmp ? (
          <div className="flex gap-2 mt-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 w-28 bg-[#f3f4f7] dark:bg-zinc-800 rounded-full animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-3">Nenhuma OS no período</p>
        ) : (
          <div className="flex gap-2 mt-3 flex-wrap">
            {items.map((p) => {
              const key = keyOf(p)
              const isOn = key in selection
              const full = !isOn && selected.length >= MAX_SELECTED
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  disabled={full}
                  aria-pressed={isOn}
                  title={full ? `Máximo de ${MAX_SELECTED} prestadores nos gráficos` : undefined}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                    isOn
                      ? 'border-[#1162d4] bg-blue-50 text-[#0a3776] dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
                      : 'border-[#e8ecf1] text-[#6c7c93] hover:border-[#c8d1dc] dark:border-zinc-800 dark:text-zinc-400',
                    full && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: isOn ? colorOf(p) : '#d4dae3' }} />
                  {p.providerName}
                  <span className="text-[#6c7c93] dark:text-zinc-500">({p.total})</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Indicadores de Desempenho"
          subtitle="Taxas por prestador (%)"
          loading={loadingCmp}
          error={errorCmp}
          empty={!hasSelection}
          height={280}
        >
          {hasSelection && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rateBars} margin={{ top: 4, right: 8, bottom: 0, left: -10 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="metric" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false} interval={0}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`}/>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: ChartValue, n) => [v == null ? 'sem dado' : fmtPct(asNum(v)), nameOf(String(n))]}/>
                <Legend iconType="circle" iconSize={8} itemSorter={null} formatter={(v: string) => legendFormatter(nameOf(v))}/>
                {selected.map((p) => (
                  <Bar key={keyOf(p)} dataKey={keyOf(p)} fill={colorOf(p)} radius={[4,4,0,0]} maxBarSize={18}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Tempos Médios"
          subtitle="Quanto menor, melhor"
          loading={loadingCmp}
          error={errorCmp}
          empty={!hasSelection}
          height={280}
        >
          {hasSelection && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeBars} margin={{ top: 4, right: 8, bottom: 0, left: -4 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="metric" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false} interval={0}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} tickFormatter={(v) => fmtHours(Number(v))}/>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: ChartValue, n) => [v == null ? 'sem dado' : fmtHours(asNum(v)), nameOf(String(n))]}/>
                <Legend iconType="circle" iconSize={8} itemSorter={null} formatter={(v: string) => legendFormatter(nameOf(v))}/>
                {selected.map((p) => (
                  <Bar key={keyOf(p)} dataKey={keyOf(p)} fill={colorOf(p)} radius={[4,4,0,0]} maxBarSize={18}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Evolução por Prestador"
          subtitle={timelineMetric === 'concluded' ? 'OS concluídas em cada período' : 'OS abertas em cada período'}
          className="lg:col-span-2"
          loading={loadingTl}
          error={errorTl}
          empty={!hasSelection || timeline.length === 0}
          height={280}
          action={
            <div className="flex rounded-lg border border-[#e8ecf1] dark:border-zinc-800 overflow-hidden text-xs">
              {(['concluded', 'opened'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setTimelineMetric(m)}
                  aria-pressed={timelineMetric === m}
                  className={cn('px-2.5 py-1', timelineMetric === m ? 'bg-[#0a3776] text-white' : 'text-[#6c7c93] dark:text-zinc-400')}>
                  {m === 'concluded' ? 'Concluídas' : 'Abertas'}
                </button>
              ))}
            </div>
          }
        >
          {hasSelection && timeline.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="period" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                  minTickGap={16} tickFormatter={(v) => periodLabel(v, granularity)}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={tooltipStyle}
                  labelFormatter={(v) => periodLabel(String(v), granularity)}
                  formatter={(v: ChartValue, n) => [asNum(v), nameOf(String(n))]}/>
                <Legend iconType="circle" iconSize={8} itemSorter={null} formatter={(v: string) => legendFormatter(nameOf(v))}/>
                {selected.map((p) => (
                  <Line key={keyOf(p)} type="monotone" dataKey={keyOf(p)} stroke={colorOf(p)} strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Custo por OS Concluída"
          subtitle="Custo lançado ÷ OS concluídas"
          loading={loadingCmp}
          error={errorCmp}
          empty={!hasSelection}
          height={280}
        >
          {hasSelection && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBars} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCurrency(Number(v))}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={100} interval={0}/>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: ChartValue) => [fmtCurrency(asNum(v)), 'Custo por OS']}/>
                <Bar dataKey="value" radius={[0,4,4,0]} maxBarSize={18}>
                  {costBars.map((c) => <Cell key={c.key} fill={c.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Volume por Tipo de Manutenção"
        subtitle="OS abertas no período por prestador"
        loading={loadingCmp}
        error={errorCmp}
        empty={!hasSelection}
        height={Math.max(180, 48 + selected.length * 36)}
      >
        {hasSelection && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeBars} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={120} interval={0}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Legend iconType="circle" iconSize={8} itemSorter={null} formatter={legendFormatter}/>
              <Bar dataKey="Corretivas" stackId="t" fill={TYPE_COLORS.corrective} maxBarSize={18}/>
              <Bar dataKey="Preventivas" stackId="t" fill={TYPE_COLORS.preventive} maxBarSize={18}/>
              <Bar dataKey="Outras" stackId="t" fill={TYPE_COLORS.other} radius={[0,4,4,0]} maxBarSize={18}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Tabela comparativa completa */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7]">
          <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Comparativo Detalhado</p>
          <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">
            Clique no cabeçalho para ordenar. OS de grupo assumidas do painel contam para o prestador do técnico.
          </p>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 420 }}>
          {loadingCmp ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
            </div>
          ) : errorCmp ? (
            <p className="p-6 text-xs text-red-500 text-center font-medium">Falha ao carregar o comparativo</p>
          ) : sorted.length === 0 ? (
            <p className="p-6 text-xs text-[#6c7c93] dark:text-zinc-400 text-center">Nenhuma OS no período</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                <tr className="border-b border-[#f3f4f7]">
                  {header('Prestador', 'providerName', 'left')}
                  {header('OS', 'total')}
                  {header('Conclusão', 'completionRate')}
                  {header('SLA', 'slaComplianceRate')}
                  {header('1º atend.', 'tpaComplianceRate')}
                  {header('Aderência prev.', 'preventiveAdherence')}
                  {header('Resolvida na 1ª', 'firstTimeFixRate')}
                  {header('Reprovação', 'rejectionRate')}
                  {header('T. resposta', 'avgResponseHours')}
                  {header('T. execução', 'avgResolutionHours')}
                  {header('Custo', 'totalCost')}
                  {header('Custo/OS', 'avgCostPerOs')}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const key = keyOf(p)
                  const isOn = key in selection
                  return (
                    <tr key={key} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] dark:hover:bg-zinc-900 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: isOn ? colorOf(p) : 'transparent', border: isOn ? 'none' : '1px solid #d4dae3' }} />
                          <span className={cn('font-medium truncate max-w-[180px]', p.isInternal ? 'text-[#6c7c93] dark:text-zinc-400 italic' : 'text-[#1d2530] dark:text-zinc-100')}>
                            {p.providerName}
                          </span>
                          {!p.isActive && <span className="text-[10px] text-[#6c7c93] border border-[#e8ecf1] rounded px-1">inativo</span>}
                        </div>
                        <p className="text-[#6c7c93] dark:text-zinc-500 ml-4">
                          {p.byType.corrective} corr. · {p.byType.preventive} prev. · {p.technicians} téc. · {p.equipments} equip.
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#1d2530] dark:text-zinc-100">
                        {p.total}
                        <span className="block font-normal text-[#6c7c93] dark:text-zinc-500">{p.open} {p.open === 1 ? 'aberta' : 'abertas'}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-[#1d2530] dark:text-zinc-100">{fmtPct(p.rates.completionRate)}</td>
                      <td className="px-3 py-2 text-right text-[#1d2530] dark:text-zinc-100">{fmtPct(p.rates.slaComplianceRate)}</td>
                      <td className="px-3 py-2 text-right text-[#1d2530] dark:text-zinc-100">{fmtPct(p.rates.tpaComplianceRate)}</td>
                      <td className="px-3 py-2 text-right text-[#1d2530] dark:text-zinc-100">
                        {fmtPct(p.rates.preventiveAdherence)}
                        {p.preventive.overdueNow > 0 && (
                          <span className="block text-red-500">{p.preventive.overdueNow} {p.preventive.overdueNow === 1 ? 'vencida' : 'vencidas'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-[#1d2530] dark:text-zinc-100">{fmtPct(p.rates.firstTimeFixRate)}</td>
                      <td className="px-3 py-2 text-right text-[#1d2530] dark:text-zinc-100">
                        {fmtPct(p.rates.rejectionRate)}
                        {p.rejected > 0 && <span className="block text-[#6c7c93] dark:text-zinc-500">{p.rejected} OS</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{fmtHours(p.avgResponseHours)}</td>
                      <td className="px-3 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{fmtHours(p.avgResolutionHours)}</td>
                      <td className="px-3 py-2 text-right text-[#1d2530] dark:text-zinc-100">{fmtCurrency(p.totalCost)}</td>
                      <td className="px-3 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{fmtCurrency(p.avgCostPerOs)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#f3f4f7] text-[11px] text-[#6c7c93] dark:text-zinc-500 leading-relaxed">
          <strong>SLA</strong>: concluídas dentro do prazo de resolução · <strong>1º atend.</strong>: OS com prazo de TPA sem estouro ·{' '}
          <strong>Aderência prev.</strong>: preventivas no prazo dos parâmetros ÷ (executadas + vencidas) ·{' '}
          <strong>Resolvida na 1ª</strong>: concluídas sem OS filha · <strong>Reprovação</strong>: OS reprovadas ao menos uma vez ÷ OS entregues.
        </div>
      </div>
    </div>
  )
}
