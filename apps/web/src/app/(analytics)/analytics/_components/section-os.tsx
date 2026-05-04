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
} from 'recharts'
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { useOsOverview, useOsTimeline, useOsBacklog } from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtHours(h: number | null | undefined) {
  if (h == null) return '–'
  if (h < 1) return `${Math.round(h * 60)}min`
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

const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97a1f', '#ef4444']

interface Props {
  filters: AnalyticsFilters
}

export function SectionOs({ filters }: Props) {
  const base = { startDate: filters.startDate, endDate: filters.endDate, clientId: filters.clientId, groupId: filters.groupId }

  const { data: overview, isLoading: loadingOv } = useOsOverview(base)
  const { data: timelineResult, isLoading: loadingTl } = useOsTimeline({ ...base, groupBy: 'month' })
  const { data: backlog, isLoading: loadingBk } = useOsBacklog({ clientId: filters.clientId, groupId: filters.groupId })

  const timeline = timelineResult?.series

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Total no Período"
          value={loadingOv ? '…' : fmt(overview?.total)}
          accent="blue"
          loading={loadingOv}
        />
        <KpiCard
          title="Tempo Médio Resposta"
          value={loadingOv ? '…' : fmtHours(overview?.sla.avgResponseHours)}
          subtitle="Abertura → atribuição"
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
          loading={loadingOv}
        />
        <KpiCard
          title="Backlog Atual"
          value={loadingBk ? '…' : fmt(backlogTotal)}
          subtitle="OS abertas / em andamento"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={backlogTotal > 20 ? 'red' : 'amber'}
          loading={loadingBk}
        />
        <KpiCard
          title="Taxa de Aprovação"
          value={loadingOv ? '…' : overview?.rates.approvalRate != null ? `${fmt(overview.rates.approvalRate, 0)}%` : '–'}
          subtitle="Concluídas aprovadas"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent={overview && (overview.rates.approvalRate ?? 0) >= 80 ? 'green' : 'amber'}
          loading={loadingOv}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Evolução Mensal de OS" subtitle="Corretivas vs Preventivas"
          className="lg:col-span-2" loading={loadingTl} empty={!Array.isArray(timeline) || timeline.length === 0}>
          {Array.isArray(timeline) && timeline.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="os-gC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="os-gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="period" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}
                  tickFormatter={(v)=>{const[,m]=v.split('-');const ms=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];return ms[parseInt(m)-1]??v}}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  formatter={(v:any,n:any)=>[v,n==='corrective'?'Corretivas':n==='preventive'?'Preventivas':n]}/>
                <Area type="monotone" dataKey="corrective" stroke="#3b82f6" strokeWidth={2} fill="url(#os-gC)" name="corrective"/>
                <Area type="monotone" dataKey="preventive" stroke="#10b981" strokeWidth={2} fill="url(#os-gP)" name="preventive"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por Prioridade" loading={loadingOv} empty={priorityData.length === 0}>
          {priorityData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical" margin={{top:4,right:8,bottom:4,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={60}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}/>
                <Bar dataKey="value" radius={[0,4,4,0]} maxBarSize={28}
                  fill="#3b82f6"
                  label={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Backlog aging */}
        <ChartCard title="Aging do Backlog" subtitle="OS abertas por faixa de idade" loading={loadingBk}>
          <div className="flex flex-col gap-3 h-full justify-center pt-2">
            {(backlog?.buckets ?? []).map((bucket, i) => {
              const pct = backlogTotal > 0 ? (bucket.count / backlogTotal) * 100 : 0
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6c7c93] dark:text-zinc-400 font-medium">{bucket.bucket}</span>
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
