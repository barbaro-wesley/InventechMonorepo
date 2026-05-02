'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { useFinancialOverview, useFinancialTrend, useFinancialTco } from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'
import type { FinancialDelta } from '@/services/analytics/analytics.service'

function fmtCurrency(n: number | null | undefined, compact = false) {
  if (n == null) return '–'
  if (compact && Math.abs(n) >= 1000) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })
  }
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmt(n: number | null | undefined, digits = 1) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const ITEM_TYPE_COLORS: Record<string, string> = {
  labor: '#3b82f6',
  material: '#10b981',
  external: '#f97a1f',
  travel: '#8b5cf6',
  other: '#94a3b8',
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  labor: 'Mão de Obra',
  material: 'Material',
  external: 'Externo',
  travel: 'Deslocamento',
  other: 'Outros',
}

interface Props {
  filters: AnalyticsFilters
}

export function SectionFinancial({ filters }: Props) {
  const base = { startDate: filters.startDate, endDate: filters.endDate, clientId: filters.clientId, groupId: filters.groupId }

  const { data: overview, isLoading: loadingOv } = useFinancialOverview(base)
  const { data: trendResult, isLoading: loadingTr } = useFinancialTrend({ ...base, groupBy: 'month' })
  const { data: tcoResult, isLoading: loadingTco } = useFinancialTco({ limit: 15 })

  const trend = trendResult?.series
  const tco = tcoResult?.items

  const deltaIcon = (delta: FinancialDelta | null | undefined, inverse = false) => {
    if (!delta) return null
    const isPositive = delta.absolute > 0
    const isGood = inverse ? !isPositive : isPositive
    if (delta.absolute === 0) return <Minus className="h-3 w-3 text-[#6c7c93] dark:text-zinc-400" />
    return isGood
      ? <TrendingUp className="h-3 w-3 text-emerald-600" />
      : <TrendingDown className="h-3 w-3 text-red-500" />
  }

  return (
    <div className="space-y-5">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Custo Total no Período"
          value={loadingOv ? '…' : fmtCurrency(overview?.current.totalCost)}
          icon={<DollarSign className="h-4 w-4" />}
          accent="blue"
          loading={loadingOv}
          delta={overview?.delta.totalCost ?? undefined}
          deltaLabel="vs período anterior"
        />
        <KpiCard
          title="Custo Médio por OS"
          value={loadingOv ? '…' : fmtCurrency(overview?.current.avgCostPerOs)}
          subtitle="Custo / OS com custo"
          accent="amber"
          loading={loadingOv}
        />
        <KpiCard
          title="Mão de Obra"
          value={loadingOv ? '…' : fmtCurrency(overview?.current.byItemType.labor)}
          subtitle={overview?.delta.labor?.percent != null ? `${fmt(overview.delta.labor.percent)}% vs ant.` : ''}
          accent="blue"
          loading={loadingOv}
          delta={overview?.delta.labor ?? undefined}
        />
        <KpiCard
          title="Materiais"
          value={loadingOv ? '…' : fmtCurrency(overview?.current.byItemType.material)}
          subtitle={overview?.delta.material?.percent != null ? `${fmt(overview.delta.material.percent)}% vs ant.` : ''}
          accent="green"
          loading={loadingOv}
          delta={overview?.delta.material ?? undefined}
        />
      </div>

      {/* Cost breakdown cards */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['labor', 'material', 'external', 'travel', 'other'] as const).map((key) => {
            const cur = overview.current.byItemType[key]
            const total = overview.current.totalCost
            const pct = total > 0 ? (cur / total) * 100 : 0
            const dlt: FinancialDelta | null = key in overview.delta
              ? (overview.delta[key as keyof typeof overview.delta] as FinancialDelta | null)
              : null
            return (
              <div key={key} className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#6c7c93] dark:text-zinc-400 font-medium">{ITEM_TYPE_LABELS[key]}</p>
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ITEM_TYPE_COLORS[key] }} />
                </div>
                <p className="text-xl font-bold text-[#1d2530] dark:text-zinc-100">{fmtCurrency(cur, true)}</p>
                <div className="mt-2 h-1 bg-[#f3f4f7] dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: ITEM_TYPE_COLORS[key] }} />
                </div>
                <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-1">{fmt(pct)}% do total</p>
                {dlt && (
                  <div className={`flex items-center gap-1 text-xs mt-1 font-medium ${dlt.absolute > 0 ? 'text-red-500' : dlt.absolute < 0 ? 'text-emerald-600' : 'text-[#6c7c93] dark:text-zinc-400'}`}>
                    {deltaIcon(dlt, true)}
                    {dlt.percent !== null ? `${dlt.percent > 0 ? '+' : ''}${fmt(dlt.percent)}%` : '–'}
                    <span className="text-[#6c7c93] dark:text-zinc-400 font-normal">vs ant.</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ChartCard title="Evolução de Custos" subtitle="Custo mensal por tipo de item"
        loading={loadingTr} height={280} empty={!Array.isArray(trend) || trend.length === 0}>
        {Array.isArray(trend) && trend.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{top:4,right:8,bottom:0,left:-10}}>
              <defs>
                {(['labor','material','external','travel'] as const).map(k=>(
                  <linearGradient key={k} id={`fin-g-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ITEM_TYPE_COLORS[k]} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={ITEM_TYPE_COLORS[k]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="period" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                tickFormatter={(v)=>{const p=v.split('-');if(p.length>=2){const ms=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];return ms[parseInt(p[1])-1]??v}return v}}/>
              <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                tickFormatter={(v)=>v>=1000?`R$${(v/1000).toFixed(0)}k`:`R$${v}`}/>
              <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                formatter={(v:any,n:any)=>[fmtCurrency(v as number),ITEM_TYPE_LABELS[n as string]??(n as string)]}/>
              <Legend formatter={(v)=><span style={{fontSize:11}}>{ITEM_TYPE_LABELS[v]??v}</span>}/>
              {(['labor','material','external','travel'] as const).map(k=>(
                <Area key={k} type="monotone" dataKey={k} stroke={ITEM_TYPE_COLORS[k]} strokeWidth={2} fill={`url(#fin-g-${k})`}/>
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* TCO table */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7]">
          <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">TCO por Equipamento</p>
          <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Custo Total de Propriedade — valor de compra + custo de manutenção acumulado</p>
        </div>
        <div className="overflow-x-auto">
          {loadingTco ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#f3f4f7]">
                  {['#', 'Equipamento', 'Tipo', 'Valor Compra', 'Custo Manutenção', 'TCO Total', 'Índice Custo'].map((h) => (
                    <th key={h} className={`px-4 py-2 text-[#6c7c93] dark:text-zinc-400 font-medium whitespace-nowrap ${h === '#' || h === 'Equipamento' || h === 'Tipo' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(tco ?? []).map((item, i) => {
                  const highCost = item.cost_ratio != null && item.cost_ratio > 50
                  return (
                    <tr key={item.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-2.5 text-[#6c7c93] dark:text-zinc-400">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[180px]">{item.name}</p>
                        {item.serial_number && <p className="text-[#6c7c93] dark:text-zinc-400">{item.serial_number}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-[#6c7c93] dark:text-zinc-400 truncate max-w-[120px]">{item.type_name ?? '–'}</td>
                      <td className="px-4 py-2.5 text-right text-[#6c7c93] dark:text-zinc-400">{fmtCurrency(item.purchase_value)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#1d2530] dark:text-zinc-100">{fmtCurrency(item.maintenance_cost)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#0a3776]">{fmtCurrency(item.tco)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {item.cost_ratio != null ? (
                          <span className={`font-semibold px-1.5 py-0.5 rounded ${highCost ? 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                            {fmt(item.cost_ratio)}%
                          </span>
                        ) : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
