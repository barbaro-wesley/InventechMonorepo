'use client'

import { useState } from 'react'
import {
  Loader2, CheckCircle2, ClipboardList, RotateCcw, Save,
} from 'lucide-react'
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
  useServiceOrderChecklist,
  useFillChecklist,
  useCompleteChecklist,
  useReopenChecklist,
} from '@/hooks/checklist-templates/use-checklist-templates'
import { useCurrentUser } from '@/store/auth.store'
import type { ChecklistFieldDefinition } from '@/services/checklist-templates/checklist-templates.types'

interface OsChecklistTabProps {
  clientId: string | null
  osId: string
}

// ─── Field renderers ──────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ChecklistFieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled: boolean
}) {
  if (field.type === 'HEADING') {
    return (
      <h3 className="text-sm font-semibold text-foreground mt-2">{field.label}</h3>
    )
  }

  if (field.type === 'DIVIDER') {
    return <hr className="border-border" />
  }

  if (field.type === 'CHECKBOX') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={field.id}
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-border accent-emerald-600"
        />
        <label htmlFor={field.id} className="text-sm cursor-pointer select-none">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>
    )
  }

  if (field.type === 'SINGLE_SELECT') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground/80">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <Select
          value={(value as string) ?? ''}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={field.placeholder ?? 'Selecione...'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.type === 'MULTI_SELECT') {
    const selected = (value as string[]) ?? []
    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt]
      onChange(next)
    }
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground/80">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                selected.includes(opt)
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-zinc-950 text-foreground border-border hover:bg-muted'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'LONG_TEXT') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground/80">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <Textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          disabled={disabled}
          className="text-sm resize-none"
        />
      </div>
    )
  }

  if (field.type === 'TABLE') {
    const cols = field.tableColumns ?? []
    const rows = (value as Record<string, string>[]) ?? [{}]

    const updateCell = (rowIdx: number, key: string, val: string) => {
      const next = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: val } : r))
      onChange(next)
    }

    const addRow = () => onChange([...rows, {}])
    const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx))

    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                {cols.map((col) => (
                  <th key={col.key} className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground">
                    {col.label}
                  </th>
                ))}
                {!disabled && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-t border-border">
                  {cols.map((col) => (
                    <td key={col.key} className="px-2 py-1">
                      <Input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={row[col.key] ?? ''}
                        onChange={(e) => updateCell(rIdx, col.key, e.target.value)}
                        disabled={disabled}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1 px-1"
                      />
                    </td>
                  ))}
                  {!disabled && (
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(rIdx)}
                        className="text-muted-foreground hover:text-red-500 text-xs"
                        title="Remover linha"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={addRow}
            className="text-xs text-emerald-600 hover:underline"
          >
            + Adicionar linha
          </button>
        )}
      </div>
    )
  }

  // SHORT_TEXT, NUMBER, DATE, IMAGE (fallback to input)
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground/80">
        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <Input
        type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        className="h-9 text-sm"
      />
    </div>
  )
}

// ─── Tab component ────────────────────────────────────────────────────────────

export function OsChecklistTab({ clientId, osId }: OsChecklistTabProps) {
  const user = useCurrentUser()
  const canFill = user?.permissions?.includes('checklist:fill') ?? false
  const canComplete = user?.permissions?.includes('checklist:complete') ?? false
  const canReopen = user?.permissions?.includes('checklist:reopen') ?? false

  const { data: checklist, isLoading, error } = useServiceOrderChecklist(clientId, osId)
  const fillMutation = useFillChecklist(clientId ?? '', osId)
  const completeMutation = useCompleteChecklist(clientId ?? '', osId)
  const reopenMutation = useReopenChecklist(clientId ?? '', osId)

  const [fields, setFields] = useState<ChecklistFieldDefinition[] | null>(null)

  const activeFields = fields ?? checklist?.fields ?? []
  const isCompleted = !!checklist?.completedAt
  const isDirty = fields !== null

  const setFieldValue = (id: string, value: unknown) => {
    setFields((prev) => {
      const base = prev ?? checklist?.fields ?? []
      return base.map((f) => (f.id === id ? { ...f, value } : f))
    })
  }

  const handleSave = () => {
    fillMutation.mutate(activeFields, {
      onSuccess: () => setFields(null),
    })
  }

  const handleComplete = () => {
    completeMutation.mutate(isDirty ? activeFields : undefined, {
      onSuccess: () => setFields(null),
    })
  }

  const handleReopen = () => {
    reopenMutation.mutate(undefined, {
      onSuccess: () => setFields(null),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const is404 = (error as any)?.response?.status === 404

  if (!checklist && is404) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
        <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sem checklist vinculado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Esta OS não possui um checklist. Vincule um template ao agendamento preventivo.
          </p>
        </div>
      </div>
    )
  }

  if (!checklist) return null

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {isCompleted ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Checklist concluído</span>
            {checklist.completedBy && (
              <span className="text-emerald-600 ml-1">por {checklist.completedBy.name}</span>
            )}
          </div>
          {canReopen && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-emerald-700 hover:bg-emerald-100"
              onClick={handleReopen}
              disabled={reopenMutation.isPending}
            >
              {reopenMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <><RotateCcw className="h-3 w-3 mr-1" />Reabrir</>
              )}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <ClipboardList className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">Checklist pendente</span>
          {checklist.template && (
            <span className="text-amber-600 ml-1">— {checklist.template.title}</span>
          )}
        </div>
      )}

      {/* Fields */}
      <div className="space-y-3">
        {activeFields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={field.value}
            onChange={(v) => setFieldValue(field.id, v)}
            disabled={isCompleted || !canFill}
          />
        ))}
      </div>

      {/* Actions */}
      {!isCompleted && (canFill || canComplete) && (
        <div className="flex gap-2 pt-2 border-t border-border">
          {canFill && isDirty && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={fillMutation.isPending}
              className="h-8 text-xs"
            >
              {fillMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Salvar rascunho
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {completeMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              Concluir checklist
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
