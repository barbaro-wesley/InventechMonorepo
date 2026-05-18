'use client'

import {
  Package, AlertTriangle, TrendingUp, TrendingDown,
  ArrowDown, ArrowUp, ArrowLeftRight, Wrench,
  Activity, Boxes, DollarSign, Loader2,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useInventoryDashboard } from '@/hooks/inventory/use-inventory'
import type { InventoryDashboard } from '@/services/inventory/inventory.service'

// ── Utilitários ──────────────────────────────────────────────────────────────

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNum(v: number) {
  return v.toLocaleString('pt-BR')
}

const MOVEMENT_COLORS: Record<string, string> = {
  ENTRY: '#10b981',
  EXIT: '#ef4444',
  ADJUSTMENT: '#f59e0b',
  TRANSFER: '#6366f1',
}
const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY: 'Entrada', EXIT: 'Saída', ADJUSTMENT: 'Ajuste', TRANSFER: 'Transferência',
}
const MOVEMENT_ICONS: Record<string, React.ReactNode> = {
  ENTRY: <ArrowDown className="h-3 w-3" />,
  EXIT: <ArrowUp className="h-3 w-3" />,
  ADJUSTMENT: <Activity className="h-3 w-3" />,
  TRANSFER: <ArrowLeftRight className="h-3 w-3" />,
}

const PIE_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#6366f1',
  '#14b8a6', '#ec4899', '#84cc16', '#64748b',
]

// ── Cards de resumo ───────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: InventoryDashboard['summary'] }) {
  const cards = [
    {
      label: 'Itens em estoque',
      value: formatNum(summary.totalItems),
      icon: <Boxes className="h-5 w-5" />,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: 'Valor total',
      value: formatBRL(summary.totalStockValue),
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: 'Abaixo do mínimo',
      value: formatNum(summary.belowMinimumCount),
      icon: <AlertTriangle className="h-5 w-5" />,
      color: summary.belowMinimumCount > 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-400 dark:text-slate-500',
      bg: summary.belowMinimumCount > 0
        ? 'bg-amber-50 dark:bg-amber-950/40'
        : 'bg-slate-50 dark:bg-slate-900/40',
    },
    {
      label: 'Pontos ativos',
      value: formatNum(summary.activePoints),
      icon: <Package className="h-5 w-5" />,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40',
    },
    {
      label: 'Movimentações (mês)',
      value: formatNum(summary.movementsThisMonth),
      icon: <Activity className="h-5 w-5" />,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950/40',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.color} flex items-center justify-center mb-3`}>
            {c.icon}
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{c.value}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Gráfico de tendência ──────────────────────────────────────────────────────

function TrendChart({ data }: { data: InventoryDashboard['movementTrend'] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400">
        <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm">Nenhuma movimentação nos últimos 30 dias</p>
      </div>
    )
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEntry" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradExit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={35} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(value, name) => [
            formatNum(Number(value)),
            name === 'entries' ? 'Entradas' : name === 'exits' ? 'Saídas' : 'Ajustes',
          ]}
        />
        <Legend formatter={(v) => v === 'entries' ? 'Entradas' : v === 'exits' ? 'Saídas' : 'Ajustes'} />
        <Area type="monotone" dataKey="entries" stroke="#10b981" fill="url(#gradEntry)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="exits" stroke="#ef4444" fill="url(#gradExit)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="adjustments" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Gráfico de valor por ponto ────────────────────────────────────────────────

function ValueByPointChart({ data }: { data: InventoryDashboard['valueByPoint'] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Sem dados de valor
      </div>
    )
  }

  const formatted = data.map((d) => ({
    name: d.pointName.length > 14 ? d.pointName.slice(0, 12) + '…' : d.pointName,
    fullName: d.pointName,
    value: d.totalValue,
    items: d.itemCount,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(value, _name, props: any) => [
            formatBRL(Number(value)),
            props.payload.fullName,
          ]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {formatted.map((_entry, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Gráfico de pizza por categoria ────────────────────────────────────────────

function ValueByCategoryChart({ data }: { data: InventoryDashboard['valueByCategory'] }) {
  const filtered = data.filter((d) => d.totalValue > 0)

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Sem dados de valor por categoria
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey="totalValue"
            nameKey="categoryName"
            cx="50%" cy="50%"
            innerRadius={50} outerRadius={80}
            paddingAngle={2}
          >
            {filtered.map((_entry, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value, name) => [formatBRL(Number(value)), name as string]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5 min-w-0">
        {filtered.slice(0, 7).map((d, i) => (
          <div key={d.categoryId ?? 'none'} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="truncate text-slate-600 dark:text-slate-300 flex-1">{d.categoryName}</span>
            <span className="text-slate-400 shrink-0">{d.itemCount}it</span>
            <span className="font-medium text-slate-700 dark:text-slate-200 shrink-0">{formatBRL(d.totalValue)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Alertas ───────────────────────────────────────────────────────────────────

function AlertsList({ alerts }: { alerts: InventoryDashboard['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-400">
        <AlertTriangle className="h-4 w-4 opacity-40" />
        Nenhum item abaixo do estoque mínimo
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {alerts.map((item) => {
        const deficit = item.minimumQuantity - item.currentQuantity
        const pct = Math.min((item.currentQuantity / item.minimumQuantity) * 100, 100)
        return (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {item.name}
                {item.code && <span className="ml-1 text-xs text-slate-400 font-normal">({item.code})</span>}
              </p>
              <p className="text-xs text-slate-400 truncate">{item.stockPoint.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                  {item.currentQuantity}/{item.minimumQuantity} {item.unit}
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-red-500 shrink-0">-{deficit} {item.unit}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Movimentações recentes ────────────────────────────────────────────────────

function RecentMovements({ movements }: { movements: InventoryDashboard['recentMovements'] }) {
  if (movements.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-slate-400">
        Nenhuma movimentação recente
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {movements.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0"
            style={{
              color: MOVEMENT_COLORS[m.type],
              borderColor: MOVEMENT_COLORS[m.type] + '40',
              background: MOVEMENT_COLORS[m.type] + '15',
            }}
          >
            {MOVEMENT_ICONS[m.type]}
            {MOVEMENT_LABELS[m.type] ?? m.type}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{m.item.name}</p>
            <p className="text-[10px] text-slate-400 truncate">
              {m.stockPoint.name} · {m.user.name}
              {m.serviceOrder && ` · OS #${m.serviceOrder.number}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{m.quantity} {m.item.unit}</p>
            <p className="text-[10px] text-slate-400">
              {new Date(m.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Top consumidos ────────────────────────────────────────────────────────────

function TopConsumed({ data }: { data: InventoryDashboard['topConsumed'] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-slate-400">
        Nenhum consumo registrado nos últimos 30 dias
      </div>
    )
  }

  const max = data[0]?.totalConsumed ?? 1

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={item.itemId} className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-300 dark:text-slate-600 w-4 shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{item.itemName}</p>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0 ml-2">
                {item.totalConsumed} {item.unit}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-400 to-orange-400"
                style={{ width: `${(item.totalConsumed / max) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{item.stockPoint.name}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function InventoryDashboard() {
  const { data, isLoading } = useInventoryDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">

      {/* Cards */}
      <SummaryCards summary={data.summary} />

      {/* Linha 2: tendência (largo) + alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Movimentações — últimos 30 dias</h3>
          </div>
          <TrendChart data={data.movementTrend} />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Alertas de estoque
              {data.summary.belowMinimumCount > 0 && (
                <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                  {data.summary.belowMinimumCount}
                </span>
              )}
            </h3>
          </div>
          <div className="max-h-[260px] overflow-y-auto -mx-1">
            <AlertsList alerts={data.alerts} />
          </div>
        </div>
      </div>

      {/* Linha 3: valor por ponto + valor por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Valor por ponto de estoque</h3>
          </div>
          <ValueByPointChart data={data.valueByPoint} />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Distribuição por categoria</h3>
          </div>
          <ValueByCategoryChart data={data.valueByCategory} />
        </div>
      </div>

      {/* Linha 4: top consumidos + movimentações recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Top 5 mais consumidos (30d)</h3>
          </div>
          <TopConsumed data={data.topConsumed} />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Movimentações recentes</h3>
          </div>
          <RecentMovements movements={data.recentMovements} />
        </div>
      </div>

    </div>
  )
}
