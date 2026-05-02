'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Users, CheckCircle2, DollarSign } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { useTechnicianRanking } from '@/hooks/analytics/use-analytics'
import type { AnalyticsFilters } from './filter-bar'

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

interface Props {
  filters: AnalyticsFilters
}

export function SectionTechnicians({ filters }: Props) {
  const base = { startDate: filters.startDate, endDate: filters.endDate, clientId: filters.clientId, groupId: filters.groupId }
  const { data: rankingResult, isLoading } = useTechnicianRanking({ ...base, limit: 20 })

  const ranking = rankingResult?.technicians ?? []

  const top = ranking[0]
  const totalOs = ranking.reduce((a, t) => a + t.total_os, 0)
  const avgCompletion =
    ranking.length > 0
      ? ranking.reduce((a, t) => a + t.completionRate, 0) / ranking.length
      : null

  const barData = ranking.slice(0, 10).map((t) => ({
    name: t.name.split(' ')[0],
    fullName: t.name,
    completed: t.completed_os,
    total: t.total_os,
  }))

  const resolutionData = ranking
    .filter((t) => t.avg_resolution_hours != null)
    .slice(0, 10)
    .map((t) => ({
      name: t.name.split(' ')[0],
      fullName: t.name,
      hours: t.avg_resolution_hours!,
    }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Técnicos Ativos"
          value={isLoading ? '…' : fmt(ranking.length)}
          subtitle="No período"
          icon={<Users className="h-4 w-4" />}
          accent="blue"
          loading={isLoading}
        />
        <KpiCard
          title="OS Concluídas (total)"
          value={isLoading ? '…' : fmt(ranking.reduce((a, t) => a + t.completed_os, 0))}
          subtitle={isLoading ? '' : `de ${fmt(totalOs)} abertas`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
          loading={isLoading}
        />
        <KpiCard
          title="Taxa Média de Conclusão"
          value={isLoading ? '…' : avgCompletion != null ? `${fmt(avgCompletion, 1)}%` : '–'}
          subtitle="Média da equipe"
          accent="blue"
          loading={isLoading}
        />
        <KpiCard
          title="Custo Total M.O."
          value={isLoading ? '…' : fmtCurrency(ranking.reduce((a, t) => a + t.labor_cost, 0))}
          subtitle="Mão de obra no período"
          icon={<DollarSign className="h-4 w-4" />}
          accent="amber"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="OS por Técnico" subtitle="Top 10 — concluídas vs total" loading={isLoading} height={280} empty={barData.length === 0}>
          {barData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{top:4,right:8,bottom:0,left:-10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  formatter={(v:any,n:any)=>[v,n==='completed'?'Concluídas':'Total']}
                  labelFormatter={(l,p)=>p?.[0]?.payload?.fullName??l}/>
                <Bar dataKey="total" fill="#dbeafe" radius={[4,4,0,0]} maxBarSize={32} name="total"/>
                <Bar dataKey="completed" fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={32} name="completed"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Tempo Médio de Resolução" subtitle="Top 10 técnicos (horas)" loading={isLoading} height={280} empty={resolutionData.length === 0}>
          {resolutionData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resolutionData} layout="vertical" margin={{top:4,right:16,bottom:4,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} unit="h"/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#6c7c93'}} tickLine={false} axisLine={false} width={56}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e8ecf1'}}
                  formatter={(v:any)=>[`${(v as number).toFixed(1)}h`,'MTTR']}
                  labelFormatter={(l,p)=>p?.[0]?.payload?.fullName??l}/>
                <Bar dataKey="hours" radius={[0,4,4,0]} maxBarSize={20}>
                  {resolutionData.map((_,i)=>{
                    const cs=['#3b82f6','#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe','#f5f3ff','#f8fafc','#f1f5f9']
                    return <Cell key={i} fill={cs[i%cs.length]}/>
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Ranking table */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7]">
          <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">Ranking Completo de Técnicos</p>
          <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Performance individual no período</p>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />)}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#f3f4f7]">
                  {['#', 'Técnico', 'Total OS', 'Concluídas', 'Rejeitadas', 'Conclusão', 'T. Resposta', 'T. Resolução', 'Custo M.O.'].map((h) => (
                    <th key={h} className={`px-4 py-2 text-[#6c7c93] dark:text-zinc-400 font-medium whitespace-nowrap ${h === '#' || h === 'Técnico' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.map((tech, i) => (
                  <tr key={tech.technician_id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] transition-colors">
                    <td className="px-4 py-2.5 text-[#6c7c93] dark:text-zinc-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-[#1d2530] dark:text-zinc-100">{tech.name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#0a3776]">{fmt(tech.total_os)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">{fmt(tech.completed_os)}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{fmt(tech.rejected_os)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-[#f3f4f7] dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.min(tech.completionRate, 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[#1d2530] dark:text-zinc-100 w-10">{fmt(tech.completionRate, 1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#6c7c93] dark:text-zinc-400">{fmtHours(tech.avg_response_hours)}</td>
                    <td className="px-4 py-2.5 text-right text-[#6c7c93] dark:text-zinc-400">{fmtHours(tech.avg_resolution_hours)}</td>
                    <td className="px-4 py-2.5 text-right text-[#6c7c93] dark:text-zinc-400">{fmtCurrency(tech.labor_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
