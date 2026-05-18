'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Package, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useOsMaterials,
  useAddOsMaterial,
  useRemoveOsMaterial,
} from '@/hooks/service-orders/use-service-orders'
import { useStockPoints } from '@/hooks/inventory/use-stock-points'
import { useStockPoint } from '@/hooks/inventory/use-stock-points'
import type { OsMaterial } from '@/services/service-orders/service-orders.types'

// ── Utilitários ─────────────────────────────────────────────────────────────

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Linha de material ────────────────────────────────────────────────────────

function MaterialRow({
  material,
  clientId,
  osId,
  canEdit,
}: {
  material: OsMaterial
  clientId: string | null
  osId: string
  canEdit: boolean
}) {
  const remove = useRemoveOsMaterial(clientId, osId)

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-[#f8f9fb] dark:hover:bg-zinc-900/50 group transition-colors">
      <div className="mt-0.5 shrink-0">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900">
          <Package className="h-3 w-3" />
          Estoque
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#1d2530] dark:text-zinc-100 font-medium truncate">
          {material.item.name}
          {material.item.code && (
            <span className="ml-1 text-[11px] text-[#6c7c93] dark:text-zinc-400 font-normal">
              ({material.item.code})
            </span>
          )}
        </p>
        <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 mt-0.5">
          {material.quantity} {material.item.unit} · {material.stockPoint.name}
        </p>
        {material.notes && (
          <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 mt-0.5 italic truncate">{material.notes}</p>
        )}
        <p className="text-[10px] text-[#6c7c93] dark:text-zinc-500 mt-0.5">
          por {material.user.name}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {material.unitCost !== null && (
          <span className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">
            {formatBRL(material.unitCost * material.quantity)}
          </span>
        )}
        {canEdit && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => remove.mutate(material.id)}
              disabled={remove.isPending}
              className="text-[#6c7c93] dark:text-zinc-400 hover:text-red-500 transition-colors"
              title="Remover e estornar estoque"
            >
              {remove.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Formulário de novo material ──────────────────────────────────────────────

function NewMaterialForm({
  clientId,
  osId,
  onCancel,
}: {
  clientId: string | null
  osId: string
  onCancel: () => void
}) {
  const [stockPointId, setStockPointId] = useState('')
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  const { data: stockPoints = [], isLoading: loadingPoints } = useStockPoints({ isActive: true })
  const { data: pointDetail, isLoading: loadingItems } = useStockPoint(stockPointId)

  const add = useAddOsMaterial(clientId, osId)

  const availableItems = pointDetail?.items ?? []
  const selectedItem = availableItems.find((i) => i.id === itemId)
  const maxQty = selectedItem ? Number(selectedItem.currentQuantity) : Infinity
  const qtyNum = Number(quantity)
  const insufficientStock = selectedItem !== undefined && qtyNum > 0 && qtyNum > maxQty

  const handlePointChange = (v: string) => {
    setStockPointId(v)
    setItemId('')
    setQuantity('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockPointId || !itemId || !quantity || insufficientStock) return
    add.mutate(
      { stockPointId, itemId, quantity: qtyNum, notes: notes.trim() || undefined },
      { onSuccess: () => { setStockPointId(''); setItemId(''); setQuantity(''); setNotes(''); onCancel() } },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#0d4da5] dark:border-blue-500/30 bg-[#f0f5ff] dark:bg-blue-950/20 p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-[#0d4da5] dark:text-blue-400">Registrar material utilizado</p>

      {/* Ponto de estoque */}
      <div className="space-y-1">
        <label className="text-[10px] text-[#6c7c93] dark:text-zinc-400">Ponto de estoque</label>
        <Select value={stockPointId} onValueChange={handlePointChange} disabled={loadingPoints}>
          <SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-950">
            <SelectValue placeholder={loadingPoints ? 'Carregando...' : 'Selecione o ponto'} />
          </SelectTrigger>
          <SelectContent>
            {stockPoints.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Item */}
      {stockPointId && (
        <div className="space-y-1">
          <label className="text-[10px] text-[#6c7c93] dark:text-zinc-400">Item</label>
          <Select value={itemId} onValueChange={(v) => { setItemId(v); setQuantity('') }} disabled={loadingItems}>
            <SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-950">
              <SelectValue placeholder={loadingItems ? 'Carregando...' : 'Selecione o item'} />
            </SelectTrigger>
            <SelectContent>
              {availableItems.length === 0
                ? <SelectItem value="__empty" disabled className="text-xs text-[#6c7c93]">Nenhum item neste ponto</SelectItem>
                : availableItems.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.code && <span className="text-[#6c7c93]">({item.code})</span>}
                        <span className="ml-auto text-[#6c7c93]">{Number(item.currentQuantity)} {item.unit}</span>
                      </span>
                    </SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Quantidade + disponível */}
      {itemId && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[#6c7c93] dark:text-zinc-400">Quantidade</label>
            {selectedItem && (
              <span className="text-[10px] text-[#6c7c93] dark:text-zinc-400">
                Disponível: <strong>{Number(selectedItem.currentQuantity)} {selectedItem.unit}</strong>
              </span>
            )}
          </div>
          <Input
            type="number"
            min="0.001"
            step="0.001"
            max={maxQty}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className={`h-8 text-xs bg-white dark:bg-zinc-950 ${insufficientStock ? 'border-red-400' : ''}`}
            required
          />
          {insufficientStock && (
            <p className="text-[10px] text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Quantidade superior ao estoque disponível
            </p>
          )}
        </div>
      )}

      {/* Notas */}
      {itemId && (
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observação (opcional)"
          rows={2}
          className="text-xs bg-white dark:bg-zinc-950 resize-none"
        />
      )}

      {/* Ações */}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs text-[#6c7c93] dark:text-zinc-400"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!stockPointId || !itemId || !quantity || insufficientStock || add.isPending}
          className="h-7 text-xs bg-[#0d4da5] dark:bg-blue-500 hover:bg-[#0a3776] dark:hover:bg-blue-600 text-white"
        >
          {add.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <><Plus className="h-3.5 w-3.5 mr-1" />Registrar</>
          }
        </Button>
      </div>
    </form>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

interface OsMaterialsTabProps {
  clientId: string | null
  osId: string
  canEdit: boolean
}

export function OsMaterialsTab({ clientId, osId, canEdit }: OsMaterialsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const { data, isLoading } = useOsMaterials(clientId, osId)

  const items = data?.items ?? []
  const totalCost = data?.totalCost ?? 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[#6c7c93] dark:text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4 py-1">

      {/* Total */}
      {items.length > 0 && totalCost > 0 && (
        <div className="rounded-xl border border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-[#1d2530] dark:text-zinc-100">Custo total de materiais</span>
          </div>
          <span className="text-lg font-bold text-[#1d2530] dark:text-zinc-100">{formatBRL(totalCost)}</span>
        </div>
      )}

      {/* Botão ou formulário */}
      {canEdit && (
        showForm ? (
          <NewMaterialForm clientId={clientId} osId={osId} onCancel={() => setShowForm(false)} />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed border-[#e0e5eb] dark:border-zinc-800 text-xs text-[#6c7c93] dark:text-zinc-400 hover:border-[#0d4da5] hover:text-[#0d4da5] dark:hover:text-blue-400 hover:bg-[#f0f5ff] dark:hover:bg-blue-950/20 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Registrar material utilizado
          </button>
        )
      )}

      {/* Lista */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#6c7c93] dark:text-zinc-400">
          <Package className="h-8 w-8 mb-2.5 opacity-20" />
          <p className="text-sm font-medium text-[#1d2530] dark:text-zinc-100">Nenhum material registrado</p>
          <p className="text-xs mt-1 text-center max-w-[220px]">
            Registre os itens de estoque utilizados nesta OS para controle de saídas
          </p>
        </div>
      ) : (
        <div className="space-y-0.5 -mx-1">
          {items.map((material) => (
            <MaterialRow
              key={material.id}
              material={material}
              clientId={clientId}
              osId={osId}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}
