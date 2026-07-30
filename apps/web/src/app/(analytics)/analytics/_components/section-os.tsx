'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts'
import { Clock, AlertTriangle, CheckCircle2, Wrench, Timer, GitBranch, DollarSign, Flame } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { useOsOverview, useOsTimeline, useOsBacklog, useOsCosts } from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '–'
  return `${fmt(n, 0)}%`
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtHours(h: number | null | undefined) {
  if (h == null) return '–'
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h >= 48) return `${(h / 24).toFixed(1)}d`
  return `${h.toFixed(1)}h`
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97a1f',
  medium: '#f59e0b',
  low: '#94a3b8',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const TYPE_COLORS: Record<string, string> = {
  corrective: '#3b82f6',
  preventive: '#10b981',
  initialAcceptance: '#8b5cf6',
  externalService: '#f59e0b',
  technovigilance: '#06b6d4',
  training: '#84cc16',
  improperUse: '#f97a1f',
  deactivation: '#94a3b8',
}

const TYPE_LABELS: Record<string, string> = {
  corrective: 'Corretiva',
  preventive: 'Preventiva',
  initialAcceptance: 'Aceit. inicial',
  externalService: 'Serv. externo',
  technovigilance: 'Tecnovigilância',
  training: 'Treinamento',
  improperUse: 'Uso inadequado',
  deactivation: 'Desativação',
}

// Rótulos do enum do backend, usados no breakdown de custo
const TYPE_LABELS_ENUM: Record<string, string> = {
  CORRECTIVE: 'Corretiva',
  PREVENTIVE: 'Preventiva',
  INITIAL_ACCEPTANCE: 'Aceit. inicial',
  EXTERNAL_SERVICE: 'Serv. externo',
  TECHNOVIGILANCE: 'Tecnovigilância',
  TRAINING: 'Treinamento',
  IMPROPER_USE: 'Uso inadequado',
  DEACTIVATION: 'Desativação',
}

const COST_ITEM_LABELS: Record<string, string> = {
  LABOR: 'Mão de obra',
  MATERIAL: 'Material',
  EXTERNAL_SERVICE: 'Serviço externo',
  TRAVEL: 'Deslocamento',
  OTHER: 'Outros',
}

// Recharts entrega o valor do tooltip como number | string | array. Estreitar
// aqui evita `any` nos formatters e mantém o lint limpo.
type ChartValue = number | string | ReadonlyArray<number | string> | undefined
type ChartName = number | string | undefined
const asNum = (v: ChartValue) => (typeof v === 'number' ? v : Number(v ?? 0))

const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97a1f', '#ef4444']

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * O backend escolhe a granularidade conforme o tamanho da janela, então o
 * rótulo do eixo precisa seguir o formato devolvido — assumir sempre `YYYY-MM`
 * fazia todos os dias de um mês virarem o mesmo rótulo.
 */
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

interface Props {
  filters: AnalyticsFilters
}

export function SectionOs({ filters }: Props) {
  const base = { startDate: filters.startDate, endDate: filters.endDate, clientId: filters.clientId, groupId: filters.groupId }

  const { data: overview, isLoading: loadingOv, error: errorOv } = useOsOverview(base)
  // Sem `groupBy`: o backend escolhe dia/semana/mês pelo tamanho da janela.
  const { data: timelineResult, isLoading: loadingTl, error: errorTl } = useOsTimeline(base)
  const { data: backlog, isLoading: loadingBk, error: errorBk } = useOsBacklog({ clientId: filters.clientId, groupId: filters.groupId })
  const { data: costs, isLoading: loadingCt, error: errorCt } = useOsCosts({ ...base, groupBy: 'maintenanceType' })

  const timeline = timelineResult?.series
  const granularity = timelineResult?.granularity

  const priorityData = overview
    ? Object.entries(overview.byPriority).map(([k, v]) => ({
        name: PRIORITY_LABELS[k] ?? k,
        value: v as number,
        fill: PRIORITY_COLORS[k] ?? '#94a3b8',
      }))
    : []

  const typeData = overview
    ? Object.entries(overview.byMaintenanceType).filter(([, v]) => (v as number) > 0).map(([k, v]) => ({
        name: TYPE_LABELS[k] ?? k,
        value: v as number,
        fill: TYPE_COLORS[k] ?? '#94a3b8',
      }))
    : []

  const backlogTotal = backlog?.buckets.reduce((a, b) => a + b.count, 0) ?? 0
  const hasPriority = priorityData.some((d) => d.value > 0)

  const costItems = costs
    ? Object.entries(costs.byItemType)
        .map(([type, v]) => ({ name: COST_ITEM_LABELS[type] ?? type, total: v.total, osCount: v.osCount }))
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total)
    : []

  const costByType = (costs?.breakdown ?? [])
    .filter((r) => r.totalCost > 0)
    .map((r) => ({ ...r, label: TYPE_LABELS_ENUM[r.name] ?? r.name }))

  const concluded = overview?.concludedInPeriod

  return (
    <div className="space-y-5">
      {/* Volume e vazão */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Abertas no Período"
          value={loadingOv ? '…' : fmt(overview?.total)}
          subtitle="Por data de abertura"
          icon={<Wrench className="h-4 w-4" />}
          accent="blue"
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Concluídas no Período"
          value={loadingOv ? '…' : fmt(concluded?.total)}
          subtitle={
            concluded && concluded.awaitingApproval > 0
              ? `${fmt(concluded.awaitingApproval)} aguardando aprovação`
              : 'Por data de conclusão'
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Backlog Atual"
          value={loadingBk ? '…' : fmt(backlogTotal)}
          subtitle="OS abertas / em andamento"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={backlogTotal > 20 ? 'red' : 'amber'}
          loading={loadingBk}
          error={errorBk}
        />
        <KpiCard
          title="Tempo Médio Resolução"
          value={loadingOv ? '…' : fmtHours(concluded?.avgResolutionHours)}
          subtitle="Início → conclusão (MTTR)"
          icon={<Timer className="h-4 w-4" />}
          accent="amber"
          loading={loadingOv}
          error={errorOv}
        />
      </div>

      {/* Qualidade de atendimento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Tempo Médio Resposta"
          value={loadingOv ? '…' : fmtHours(overview?.sla.avgResponseHours)}
          subtitle="Abertura → início do atendimento"
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Cumprimento de TPA"
          value={loadingOv ? '…' : fmtPct(overview?.sla.tpaComplianceRate)}
          subtitle={
            overview
              ? overview.sla.tpaApplicable > 0
                ? `${fmt(overview.sla.tpaBreached)} de ${fmt(overview.sla.tpaApplicable)} estouraram`
                : 'Nenhuma OS com prazo de TPA'
              : ''
          }
          icon={<Flame className="h-4 w-4" />}
          accent={
            overview?.sla.tpaComplianceRate == null ? 'blue'
              : overview.sla.tpaComplianceRate >= 90 ? 'green'
              : overview.sla.tpaComplianceRate >= 70 ? 'amber'
              : 'red'
          }
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Taxa de Conclusão"
          value={loadingOv ? '…' : fmtPct(overview?.rates.completionRate)}
          subtitle="Da safra aberta no período"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent={
            overview?.rates.completionRate == null ? 'blue'
              : overview.rates.completionRate >= 80 ? 'green'
              : 'amber'
          }
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Retrabalho (OS Filhas)"
          value={loadingOv ? '…' : fmtPct(overview?.rates.childOsRate)}
          subtitle={overview ? `${fmt(overview.rates.childOsCount)} OS geraram filha` : ''}
          icon={<GitBranch className="h-4 w-4" />}
          accent={overview && overview.rates.childOsRate > 15 ? 'red' : 'green'}
          loading={loadingOv}
          error={errorOv}
        />
      </div>

      {/* Aprovação e custo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Taxa de Aprovação"
          value={loadingOv ? '…' : fmtPct(overview?.rates.approvalRate)}
          subtitle="Aprovadas / avaliadas"
          accent={overview && (overview.rates.approvalRate ?? 0) >= 80 ? 'green' : 'amber'}
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="OS Urgentes Ativas"
          value={loadingOv ? '…' : fmt(overview?.rates.urgentActive)}
          subtitle="Urgentes ainda em aberto"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={overview && overview.rates.urgentActive > 0 ? 'red' : 'green'}
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Custo Total"
          value={loadingOv ? '…' : fmtCurrency(overview?.totalCost)}
          subtitle="OS abertas no período"
          icon={<DollarSign className="h-4 w-4" />}
          accent="purple"
          loading={loadingOv}
          error={errorOv}
        />
        <KpiCard
          title="Ciclo Total Médio"
          value={loadingOv ? '…' : fmtHours(concluded?.avgTotalHours)}
          subtitle="Abertura → conclusão"
          icon={<Timer className="h-4 w-4" />}
          accent="blue"
          loading={loadingOv}
          error={errorOv}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Entrada x Vazão de OS"
          subtitle="Abertas vs concluídas no período"
          className="lg:col-span-2"
          loading={loadingTl}
          error={errorTl}
          empty={!Array.isArray(timeline) || timeline.length === 0}
        >
          {Array.isArray(timeline) && timeline.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="os-gT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="os-gD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="period" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                  minTickGap={16} tickFormatter={(v) => periodLabel(v, granularity)}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  labelFormatter={(v) => periodLabel(String(v), granularity)}
                  formatter={(v:ChartValue,n:ChartName)=>[asNum(v), n === 'total' ? 'Abertas' : 'Concluídas']}/>
                <Legend iconType="circle" iconSize={8}
                  formatter={(v)=><span style={{fontSize:11,color:'#6c7c93'}}>{v === 'total' ? 'Abertas' : 'Concluídas'}</span>}/>
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#os-gT)" name="total"/>
                <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fill="url(#os-gD)" name="completed"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por Prioridade" subtitle="OS abertas no período"
          loading={loadingOv} error={errorOv} empty={!hasPriority}>
          {hasPriority && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical" margin={{top:4,right:16,bottom:4,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={60}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  formatter={(v:ChartValue)=>[asNum(v),'OS']}/>
                <Bar dataKey="value" radius={[0,4,4,0]} maxBarSize={28}>
                  {priorityData.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Backlog aging */}
        <ChartCard title="Aging do Backlog" subtitle="OS abertas por faixa de idade"
          loading={loadingBk} error={errorBk} empty={backlogTotal === 0}>
          <div className="flex flex-col gap-3 h-full justify-center pt-2 w-full">
            {(backlog?.buckets ?? []).map((bucket, i) => {
              const pct = backlogTotal > 0 ? (bucket.count / backlogTotal) * 100 : 0
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6c7c93] dark:text-zinc-400 font-medium">
                      {bucket.bucket}
                      <span className="ml-1.5 text-[#a0abbb]">média {fmt(bucket.avg_days_open, 1)}d</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {bucket.urgent_count > 0 && (
                        <span className="text-xs text-red-500 font-semibold">{bucket.urgent_count} urgentes</span>
                      )}
                      <span className="text-xs font-bold text-[#1d2530] dark:text-zinc-100">{bucket.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-[#f3f4f7] dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: BUCKET_COLORS[i] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>

        {/* Oldest backlog */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7]">
            <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">OS mais antigas</p>
            <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Top 10 em aberto há mais tempo</p>
          </div>
          <div className="overflow-auto" style={{ maxHeight: 220 }}>
            {loadingBk ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />
                ))}
              </div>
            ) : errorBk ? (
              <p className="p-6 text-xs text-red-500 text-center font-medium">Falha ao carregar o backlog</p>
            ) : (backlog?.oldest ?? []).length === 0 ? (
              <p className="p-6 text-xs text-[#6c7c93] dark:text-zinc-400 text-center">Nenhuma OS em aberto</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                  <tr className="border-b border-[#f3f4f7]">
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">OS</th>
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Título</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Idade</th>
                  </tr>
                </thead>
                <tbody>
                  {(backlog?.oldest ?? []).slice(0, 10).map((os) => (
                    <tr key={os.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-2 font-semibold text-[#0a3776]">#{os.number}</td>
                      <td className="px-4 py-2 text-[#1d2530] dark:text-zinc-100 max-w-[180px] truncate">{os.title}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`font-semibold ${os.days_open > 90 ? 'text-red-500' : os.days_open > 30 ? 'text-amber-500' : 'text-[#6c7c93] dark:text-zinc-400'}`}>
                          {os.days_open}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Custo por tipo de item e por tipo de manutenção */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Custo por Tipo de Item" subtitle={costs ? `Total ${fmtCurrency(costs.totalCost)}` : 'Composição do gasto'}
          loading={loadingCt} error={errorCt} empty={costItems.length === 0}>
          {costItems.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costItems} layout="vertical" margin={{top:4,right:16,bottom:4,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                  tickFormatter={(v:number)=>fmtCurrency(v)}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={92}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  formatter={(v:ChartValue)=>[fmtCurrency(asNum(v)),'Custo']}/>
                <Bar dataKey="total" radius={[0,4,4,0]} maxBarSize={24} fill="#8b5cf6"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7]">
            <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Custo por Tipo de Manutenção</p>
            <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Custo médio por OS em cada tipo</p>
          </div>
          <div className="overflow-auto" style={{ maxHeight: 220 }}>
            {loadingCt ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />
                ))}
              </div>
            ) : errorCt ? (
              <p className="p-6 text-xs text-red-500 text-center font-medium">Falha ao carregar os custos</p>
            ) : costByType.length === 0 ? (
              <p className="p-6 text-xs text-[#6c7c93] dark:text-zinc-400 text-center">Nenhum custo lançado no período</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                  <tr className="border-b border-[#f3f4f7]">
                    <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Tipo</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">OS</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Total</th>
                    <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {costByType.map((row) => (
                    <tr key={row.name} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-2 font-medium text-[#1d2530] dark:text-zinc-100">{row.label}</td>
                      <td className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{row.osCount}</td>
                      <td className="px-4 py-2 text-right font-semibold text-[#0a3776]">{fmtCurrency(row.totalCost)}</td>
                      <td className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400">{fmtCurrency(row.avgCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance type breakdown */}
      {typeData.length > 0 && (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm p-5">
          <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100 mb-4">OS por Tipo de Manutenção</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {typeData.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                <div>
                  <p className="text-xs text-[#6c7c93] dark:text-zinc-400">{item.name}</p>
                  <p className="text-sm font-bold text-[#1d2530] dark:text-zinc-100">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
