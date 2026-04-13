'use client'

import { useState } from 'react'
import {
  Plus, Trash2, Pencil, Check, X, Loader2,
  Wrench, Package, ExternalLink, Car, HelpCircle, TrendingUp, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { CostItemType, ServiceOrderCostItem } from '@/services/service-orders/service-orders.types'
import {
  useCostItems,
  useCreateCostItem,
  useUpdateCostItem,
  useDeleteCostItem,
} from '@/hooks/service-orders/use-service-orders'

// ── Configuração dos tipos de custo ─────────────────────────────────────────

const COST_TYPE_CONFIG: Record<
  CostItemType,
  { label: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  LABOR: {
    label: 'Mão de obra',
    icon: <Wrench className="h-3 w-3" />,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  MATERIAL: {
    label: 'Material / Peça',
    icon: <Package className="h-3 w-3" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  EXTERNAL: {
    label: 'Serviço externo',
    icon: <ExternalLink className="h-3 w-3" />,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  TRAVEL: {
    label: 'Deslocamento',
    icon: <Car className="h-3 w-3" />,
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  OTHER: {
    label: 'Outros',
    icon: <HelpCircle className="h-3 w-3" />,
    color: 'text-[#6c7c93]',
    bg: 'bg-[#f3f4f7]',
    border: 'border-[#e0e5eb]',
  },
}

// ── Utilitários ─────────────────────────────────────────────────────────────

function formatBRL(value: string | number) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function TypeBadge({ type }: { type: CostItemType }) {
  const cfg = COST_TYPE_CONFIG[type]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ── Linha de item (visualização + edição inline) ─────────────────────────────

function CostItemRow({
  item,
  clientId,
  osId,
}: {
  item: ServiceOrderCostItem
  clientId: string | null
  osId: string
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    description: item.description,
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    notes: item.notes ?? '',
  })

  const updateItem = useUpdateCostItem(clientId, osId)
  const deleteItem = useDeleteCostItem(clientId, osId)

  const handleSave = () => {
    updateItem.mutate(
      {
        costId: item.id,
        dto: {
          description: form.description,
          type: form.type as CostItemType,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          notes: form.notes || undefined,
        },
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  const handleCancel = () => {
    setForm({
      description: item.description,
      type: item.type,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes ?? '',
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-[#0d4da5]/30 bg-[#f0f5ff] p-3 space-y-3">
        {/* Tipo + Descrição */}
        <div className="flex gap-2">
          <Select
            value={form.type}
            onValueChange={(v) => setForm((p) => ({ ...p, type: v as CostItemType }))}
          >
            <SelectTrigger className="h-8 text-xs w-40 shrink-0 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COST_TYPE_CONFIG) as CostItemType[]).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    {COST_TYPE_CONFIG[t].icon}
                    {COST_TYPE_CONFIG[t].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Descrição"
            className="h-8 text-xs bg-white flex-1"
          />
        </div>

        {/* Qtd × Valor unit */}
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="text-[10px] text-[#6c7c93] mb-1 block">Quantidade</label>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              className="h-8 text-xs bg-white"
            />
          </div>
          <span className="text-[#6c7c93] text-sm mt-4">×</span>
          <div className="flex-1">
            <label className="text-[10px] text-[#6c7c93] mb-1 block">Valor unitário (R$)</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))}
              className="h-8 text-xs bg-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-[#6c7c93] mb-1 block">Total</label>
            <div className="h-8 flex items-center text-xs font-semibold text-[#1d2530] px-3 rounded-lg bg-white border border-[#e0e5eb]">
              {formatBRL(Number(form.quantity) * Number(form.unitPrice))}
            </div>
          </div>
        </div>

        {/* Observação */}
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Observação (opcional)"
          rows={2}
          className="text-xs bg-white resize-none"
        />

        {/* Ações */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-7 text-xs text-[#6c7c93]"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!form.description.trim() || !form.quantity || !form.unitPrice || updateItem.isPending}
            className="h-7 text-xs bg-[#0d4da5] hover:bg-[#0a3776] text-white"
          >
            {updateItem.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Check className="h-3.5 w-3.5 mr-1" />Salvar</>
            }
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-[#f8f9fb] group transition-colors">
      {/* Tipo badge */}
      <div className="mt-0.5 shrink-0">
        <TypeBadge type={item.type} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#1d2530] font-medium truncate">{item.description}</p>
        <p className="text-[11px] text-[#6c7c93] mt-0.5">
          {Number(item.quantity) % 1 === 0
            ? Number(item.quantity).toFixed(0)
            : Number(item.quantity).toString()}{' '}
          × {formatBRL(item.unitPrice)}
        </p>
        {item.notes && (
          <p className="text-[11px] text-[#6c7c93] mt-0.5 italic truncate">{item.notes}</p>
        )}
      </div>

      {/* Total + ações */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-[#1d2530]">
          {formatBRL(item.totalPrice)}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="text-[#6c7c93] hover:text-[#0d4da5] transition-colors"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteItem.mutate(item.id)}
            disabled={deleteItem.isPending}
            className="text-[#6c7c93] hover:text-red-500 transition-colors"
            title="Remover"
          >
            {deleteItem.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Formulário de novo item ──────────────────────────────────────────────────

const EMPTY_FORM = {
  description: '',
  type: 'LABOR' as CostItemType,
  quantity: '',
  unitPrice: '',
  notes: '',
}

function NewCostItemForm({
  clientId,
  osId,
  onCancel,
}: {
  clientId: string | null
  osId: string
  onCancel: () => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const create = useCreateCostItem(clientId, osId)

  const previewTotal = form.quantity && form.unitPrice
    ? Number(form.quantity) * Number(form.unitPrice)
    : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim() || !form.quantity || !form.unitPrice) return
    create.mutate(
      {
        description: form.description.trim(),
        type: form.type,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
        notes: form.notes.trim() || undefined,
      },
      { onSuccess: () => { setForm(EMPTY_FORM); onCancel() } },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#0d4da5]/30 bg-[#f0f5ff] p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-[#0d4da5]">Novo item de custo</p>

      {/* Tipo + Descrição */}
      <div className="flex gap-2">
        <Select
          value={form.type}
          onValueChange={(v) => setForm((p) => ({ ...p, type: v as CostItemType }))}
        >
          <SelectTrigger className="h-8 text-xs w-40 shrink-0 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(COST_TYPE_CONFIG) as CostItemType[]).map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                <span className="flex items-center gap-1.5">
                  {COST_TYPE_CONFIG[t].icon}
                  {COST_TYPE_CONFIG[t].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Descrição do item"
          className="h-8 text-xs bg-white flex-1"
          required
        />
      </div>

      {/* Quantidade × Valor */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[10px] text-[#6c7c93] mb-1 block">Quantidade</label>
          <Input
            type="number"
            min="0.001"
            step="0.001"
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
            placeholder="1"
            className="h-8 text-xs bg-white"
            required
          />
        </div>
        <span className="text-[#6c7c93] text-sm pb-1.5">×</span>
        <div className="flex-1">
          <label className="text-[10px] text-[#6c7c93] mb-1 block">Valor unitário (R$)</label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))}
            placeholder="0,00"
            className="h-8 text-xs bg-white"
            required
          />
        </div>
        {previewTotal !== null && (
          <div className="flex-1">
            <label className="text-[10px] text-[#6c7c93] mb-1 block">Total</label>
            <div className="h-8 flex items-center text-xs font-bold text-emerald-700 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
              {formatBRL(previewTotal)}
            </div>
          </div>
        )}
      </div>

      {/* Observação */}
      <Textarea
        value={form.notes}
        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        placeholder="Observação (opcional)"
        rows={2}
        className="text-xs bg-white resize-none"
      />

      {/* Ações */}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs text-[#6c7c93]"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={
            !form.description.trim() ||
            !form.quantity ||
            !form.unitPrice ||
            create.isPending
          }
          className="h-7 text-xs bg-[#0d4da5] hover:bg-[#0a3776] text-white"
        >
          {create.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</>
          }
        </Button>
      </div>
    </form>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

interface OsCostsTabProps {
  clientId: string | null
  osId: string
  equipment: {
    name: string
    currentValue?: string | number | null
    purchaseValue?: string | number | null
  } | null
}

// Agrupa os itens por tipo para o sumário
function groupByType(items: ServiceOrderCostItem[]) {
  return (Object.keys(COST_TYPE_CONFIG) as CostItemType[])
    .map((type) => {
      const typeItems = items.filter((i) => i.type === type)
      const subtotal = typeItems.reduce((s, i) => s + Number(i.totalPrice), 0)
      return { type, count: typeItems.length, subtotal }
    })
    .filter((g) => g.count > 0)
}

export function OsCostsTab({ clientId, osId, equipment }: OsCostsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const { data, isLoading } = useCostItems(clientId, osId)

  const items = data?.items ?? []
  const total = Number(data?.total ?? 0)
  const groups = groupByType(items)

  const currentValue = equipment?.currentValue ? Number(equipment.currentValue) : null
  const purchaseValue = equipment?.purchaseValue ? Number(equipment.purchaseValue) : null
  const costRatio = currentValue && currentValue > 0 ? (total / currentValue) * 100 : null
  const overThreshold = costRatio !== null && costRatio >= 80

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[#6c7c93]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 py-1">

      {/* Card de total */}
      {items.length > 0 && (
        <div className="rounded-xl border border-[#e0e5eb] bg-white overflow-hidden">
          {/* Total principal */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#0d4da5]" />
              <span className="text-sm font-medium text-[#1d2530]">Total desta OS</span>
            </div>
            <span className="text-lg font-bold text-[#1d2530]">{formatBRL(total)}</span>
          </div>

          {/* Breakdown por tipo */}
          {groups.length > 1 && (
            <div className="border-t border-[#f3f4f7] px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
              {groups.map((g) => (
                <div key={g.type} className="flex items-center gap-1.5">
                  <TypeBadge type={g.type} />
                  <span className="text-xs text-[#6c7c93]">{formatBRL(g.subtotal)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Análise vs equipamento */}
          {currentValue !== null && (
            <div
              className={`border-t px-4 py-3 flex items-start gap-2.5 ${
                overThreshold
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-[#f3f4f7] bg-[#f8f9fb]'
              }`}
            >
              {overThreshold && (
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${overThreshold ? 'text-amber-800' : 'text-[#1d2530]'}`}>
                  {overThreshold
                    ? 'Custo de manutenção elevado — avalie a substituição'
                    : 'Custo vs. equipamento'
                  }
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1 h-2 bg-[#e0e5eb] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overThreshold ? 'bg-amber-500' : 'bg-[#0d4da5]'
                      }`}
                      style={{ width: `${Math.min(costRatio ?? 0, 100)}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold shrink-0 ${overThreshold ? 'text-amber-700' : 'text-[#6c7c93]'}`}>
                    {costRatio?.toFixed(1)}%
                  </span>
                </div>
                <div className="flex gap-4 mt-1">
                  <span className="text-[10px] text-[#6c7c93]">
                    Valor atual: <strong>{formatBRL(currentValue)}</strong>
                  </span>
                  {purchaseValue && (
                    <span className="text-[10px] text-[#6c7c93]">
                      Compra: <strong>{formatBRL(purchaseValue)}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão ou formulário de novo item */}
      {showForm ? (
        <NewCostItemForm
          clientId={clientId}
          osId={osId}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed border-[#e0e5eb] text-xs text-[#6c7c93] hover:border-[#0d4da5] hover:text-[#0d4da5] hover:bg-[#f0f5ff] transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar item de custo
        </button>
      )}

      {/* Lista de itens */}
      {items.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#6c7c93]">
          <TrendingUp className="h-8 w-8 mb-2.5 opacity-20" />
          <p className="text-sm font-medium text-[#1d2530]">Nenhum custo registrado</p>
          <p className="text-xs mt-1 text-center max-w-[200px]">
            Adicione peças, mão de obra e serviços externos para análise de custo
          </p>
        </div>
      ) : (
        <div className="space-y-0.5 -mx-1">
          {items.map((item) => (
            <CostItemRow key={item.id} item={item} clientId={clientId} osId={osId} />
          ))}
        </div>
      )}
    </div>
  )
}
