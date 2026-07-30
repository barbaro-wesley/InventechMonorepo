'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ShieldCheck, ShieldAlert, ShieldOff, CircleDollarSign, TriangleAlert } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { useEquipmentWarranty } from '@/hooks/analytics/use-analytics'
import type { EquipmentWarrantyItem } from '@/services/analytics/analytics.service'
import { cn } from '@/lib/utils'

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '–'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '–'
  // A data vem como `date` puro do Postgres; cortar antes de virar Date evita
  // que o fuso empurre o dia para trás.
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const CRITICALITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97a1f', MEDIUM: '#f59e0b', LOW: '#10b981',
}
const CRITICALITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa',
}

const SEVERITY_COLORS: Record<string, string> = {
  expired: '#991b1b',
  critical: '#ef4444',
  high: '#f97a1f',
  medium: '#f59e0b',
  low: '#3b82f6',
  ok: '#10b981',
}

// Recharts entrega o valor do tooltip como number | string | array. Estreitar
// aqui evita `any` nos formatters e mantém o lint limpo.
type ChartValue = number | string | ReadonlyArray<number | string> | undefined
const asNum = (v: ChartValue) => (typeof v === 'number' ? v : Number(v ?? 0))

const WINDOWS = [
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
  { label: '180 dias', days: 180 },
  { label: '1 ano', days: 365 },
]

const SCOPES = [
  { id: 'expiring', label: 'A vencer' },
  { id: 'expired', label: 'Vencidas' },
  { id: 'all', label: 'Todas' },
] as const

/** Cor do prazo restante: quanto menos dias, mais urgente. */
function daysTone(days: number) {
  if (days < 0) return 'text-red-700 dark:text-red-400'
  if (days <= 30) return 'text-red-500'
  if (days <= 60) return 'text-orange-500'
  if (days <= 90) return 'text-amber-500'
  return 'text-[#6c7c93] dark:text-zinc-400'
}

function daysLabel(item: EquipmentWarrantyItem) {
  // Anos digitados errado (ex.: 0025 em vez de 2025) produzem prazos absurdos.
  // Mostrar "-730708 dias" só confunde; o cadastro é que precisa de correção.
  if (item.suspect_date) return 'cadastro inválido'
  const d = item.days_remaining
  if (d < 0) return `vencida há ${fmt(Math.abs(d))}d`
  if (d === 0) return 'vence hoje'
  return `${fmt(d)}d`
}

export function SectionEquipmentWarranty() {
  const [daysAhead, setDaysAhead] = useState(90)
  const [scope, setScope] = useState<'expiring' | 'expired' | 'all'>('expiring')

  const { data, isLoading, error } = useEquipmentWarranty({ daysAhead, scope, limit: 300 })

  const summary = data?.summary
  const chartData = (data?.buckets ?? []).map((b) => ({
    ...b,
    fill: SEVERITY_COLORS[b.severity] ?? '#94a3b8',
  }))
  const hasChart = chartData.some((b) => b.count > 0)

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                scope === s.id
                  ? 'bg-[#0a3776] text-white'
                  : 'bg-[#f3f4f7] dark:bg-zinc-800 text-[#6c7c93] dark:text-zinc-400 hover:bg-[#e8ecf1] hover:text-[#1d2530] dark:hover:text-zinc-100',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#e0e5eb] shrink-0" />

        <div className="flex items-center gap-1">
          <span className="text-xs text-[#6c7c93] dark:text-zinc-400 mr-1">Janela</span>
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setDaysAhead(w.days)}
              disabled={scope === 'expired'}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                daysAhead === w.days && scope !== 'expired'
                  ? 'bg-[#1162d4] text-white'
                  : 'bg-[#f3f4f7] dark:bg-zinc-800 text-[#6c7c93] dark:text-zinc-400 hover:bg-[#e8ecf1] hover:text-[#1d2530] dark:hover:text-zinc-100',
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title={`A Vencer (${daysAhead}d)`}
          value={isLoading ? '…' : fmt(summary?.expiringInWindow)}
          subtitle="Garantias dentro da janela"
          icon={<ShieldAlert className="h-4 w-4" />}
          accent={summary && summary.expiringInWindow > 0 ? 'amber' : 'green'}
          loading={isLoading}
          error={error}
        />
        <KpiCard
          title="Já Vencidas"
          value={isLoading ? '…' : fmt(summary?.expired)}
          subtitle="Sem cobertura do fornecedor"
          icon={<ShieldOff className="h-4 w-4" />}
          accent={summary && summary.expired > 0 ? 'red' : 'green'}
          loading={isLoading}
          error={error}
        />
        <KpiCard
          title="Valor em Risco"
          value={isLoading ? '…' : fmtCurrency(summary?.valueExpiring)}
          subtitle="Valor de compra saindo da garantia"
          icon={<CircleDollarSign className="h-4 w-4" />}
          accent="purple"
          loading={isLoading}
          error={error}
        />
        <KpiCard
          title="Sem Garantia Cadastrada"
          value={isLoading ? '…' : fmt(summary?.withoutWarranty)}
          subtitle={summary ? `${fmt(summary.totalTracked)} com data preenchida` : ''}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent={summary && summary.withoutWarranty > 0 ? 'amber' : 'green'}
          loading={isLoading}
          error={error}
        />
      </div>

      {summary && summary.suspectDates > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <strong>{fmt(summary.suspectDates)}</strong>{' '}
            {summary.suspectDates === 1 ? 'equipamento tem' : 'equipamentos têm'} fim de garantia anterior ao início —
            provável erro de digitação no ano. Aparecem marcados como <em>cadastro inválido</em> na lista.
          </p>
        </div>
      )}

      {/* Distribuição por faixa */}
      <ChartCard
        title="Garantias por Faixa de Vencimento"
        subtitle="Equipamentos ativos, excluindo sucateados e inativos"
        loading={isLoading}
        error={error}
        empty={!hasChart}
      >
        {hasChart && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#6c7c93' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6c7c93' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8ecf1' }}
                formatter={(v: ChartValue) => [asNum(v), 'Equipamentos']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {chartData.map((b, i) => <Cell key={i} fill={b.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Lista detalhada */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#f3f4f7] flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">
              {scope === 'expired'
                ? 'Equipamentos com garantia vencida'
                : scope === 'all'
                  ? `Vencidas e a vencer em ${daysAhead} dias`
                  : `Garantias vencendo em até ${daysAhead} dias`}
            </p>
            <p className="text-xs text-[#6c7c93] dark:text-zinc-400 mt-0.5">Ordenado pelo vencimento mais próximo</p>
          </div>
          {data && data.count > 0 && (
            <span className="text-xs font-bold text-[#0a3776] bg-[#eef4fd] px-2 py-0.5 rounded-full border border-[#cfe0f8] dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 shrink-0">
              {fmt(data.count)} {data.count === 1 ? 'equipamento' : 'equipamentos'}
            </span>
          )}
        </div>

        <div className="overflow-auto" style={{ maxHeight: 460 }}>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="p-8 text-xs text-red-500 text-center font-medium">Falha ao carregar as garantias</p>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
              <ShieldCheck className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-[#6c7c93] dark:text-zinc-400">
                {scope === 'expired'
                  ? 'Nenhuma garantia vencida'
                  : `Nenhuma garantia vencendo nos próximos ${daysAhead} dias`}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                <tr className="border-b border-[#f3f4f7]">
                  <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Equipamento</th>
                  <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Patrimônio</th>
                  <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Criticidade</th>
                  <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Local</th>
                  <th className="px-4 py-2 text-left text-[#6c7c93] dark:text-zinc-400 font-medium">Fim da garantia</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Prazo</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">Valor</th>
                  <th className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 font-medium">OS abertas</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb] dark:hover:bg-zinc-900 transition-colors">
                    <td className="px-4 py-2">
                      <p className="font-medium text-[#1d2530] dark:text-zinc-100 truncate max-w-[200px]">{item.name.trim()}</p>
                      {(item.brand || item.model) && (
                        <p className="text-[#6c7c93] dark:text-zinc-400 truncate max-w-[200px]">
                          {[item.brand, item.model].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[#6c7c93] dark:text-zinc-400">{item.patrimony_number?.trim() || '–'}</td>
                    <td className="px-4 py-2">
                      <span
                        className="px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          backgroundColor: (CRITICALITY_COLORS[item.criticality] ?? '#94a3b8') + '20',
                          color: CRITICALITY_COLORS[item.criticality] ?? '#94a3b8',
                        }}
                      >
                        {CRITICALITY_LABELS[item.criticality] ?? item.criticality}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[#6c7c93] dark:text-zinc-400 truncate max-w-[120px]">
                      {item.location_name ?? item.cost_center_name ?? '–'}
                    </td>
                    <td className="px-4 py-2 text-[#1d2530] dark:text-zinc-100">{fmtDate(item.warranty_end)}</td>
                    <td className={cn('px-4 py-2 text-right font-semibold whitespace-nowrap', item.suspect_date ? 'text-amber-600' : daysTone(item.days_remaining))}>
                      {daysLabel(item)}
                    </td>
                    <td className="px-4 py-2 text-right text-[#6c7c93] dark:text-zinc-400 whitespace-nowrap">
                      {item.purchase_value != null ? fmtCurrency(item.purchase_value) : '–'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.open_os > 0 ? (
                        <span className="font-semibold text-[#0a3776]">{item.open_os}</span>
                      ) : (
                        <span className="text-[#a0abbb]">0</span>
                      )}
                    </td>
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
