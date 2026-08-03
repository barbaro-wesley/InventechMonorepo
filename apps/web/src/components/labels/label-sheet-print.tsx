"use client";

import React, { useMemo, useState } from "react";
import { X, Printer, Loader2, CheckSquare, Square as SquareIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LabelCanvas } from "./label-canvas";
import { labelTemplatesService } from "@/services/label-templates/label-templates.service";
import { getErrorMessage } from "@/lib/api";
import {
  DEFAULT_SHEET, PAPER_SIZE_LABELS, getPaperDimensions,
} from "@/services/label-templates/label-templates.types";
import type {
  LabelTemplate, LabelSheet, PaperSize, LabelElement,
} from "@/services/label-templates/label-templates.types";

const MAX_LABELS = 500;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Rótulo curto para a coluna de um elemento variável na tabela. */
function fieldLabel(el: LabelElement): string {
  const raw =
    el.type === "text" ? (el.content ?? "").trim()
      : el.type === "qrcode" ? (el.value ?? "").trim()
        : "";
  const fallback = el.type === "qrcode" ? "QR Code" : "Texto";
  const base = raw || fallback;
  return base.length > 24 ? `${base.slice(0, 24)}…` : base;
}

/** Valor padrão de um elemento variável (o que está no design). */
function defaultValue(el: LabelElement): string {
  if (el.type === "text") return el.content ?? "";
  if (el.type === "qrcode") return el.value ?? "";
  return "";
}

export function LabelSheetPrint({
  template,
  onClose,
}: {
  template: LabelTemplate;
  onClose: () => void;
}) {
  const layout = template.layout;

  // Elementos que variam por etiqueta (viram colunas da tabela).
  const varElements = useMemo(
    () =>
      layout.elements.filter(
        (e) => (e.type === "text" || e.type === "qrcode") && e.perCell !== false,
      ),
    [layout.elements],
  );

  const defaultRow = useMemo(() => {
    const row: Record<string, string> = {};
    for (const el of varElements) row[el.id] = defaultValue(el);
    return row;
  }, [varElements]);

  const initialSheet: LabelSheet = { ...(layout.sheet ?? DEFAULT_SHEET), enabled: true };
  const [sheet, setSheet] = useState<LabelSheet>(initialSheet);

  const perSheet = Math.max(1, sheet.columns * sheet.rows);
  const [count, setCount] = useState<number>(clamp(perSheet, 1, MAX_LABELS));
  const [rows, setRows] = useState<Record<string, string>[]>(
    Array.from({ length: clamp(perSheet, 1, MAX_LABELS) }, () => ({ ...defaultRow })),
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkField, setBulkField] = useState<string>(varElements[0]?.id ?? "");
  const [bulkValue, setBulkValue] = useState("");
  const [printing, setPrinting] = useState(false);

  function patchSheet(patch: Partial<LabelSheet>) {
    setSheet((prev) => ({ ...prev, ...patch }));
  }

  function updateCount(n: number) {
    const c = clamp(Math.round(n) || 1, 1, MAX_LABELS);
    setCount(c);
    setRows((prev) => {
      if (c <= prev.length) return prev.slice(0, c);
      const extra = Array.from({ length: c - prev.length }, () => ({ ...defaultRow }));
      return [...prev, ...extra];
    });
    setSelected((prev) => new Set([...prev].filter((i) => i < c)));
  }

  function setCell(rowIndex: number, elId: string, value: string) {
    setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [elId]: value } : r)));
  }

  function applyToAll() {
    if (!bulkField) return;
    setRows((prev) => prev.map((r) => ({ ...r, [bulkField]: bulkValue })));
    toast.success(`Aplicado a ${count} etiqueta${count !== 1 ? "s" : ""}.`);
  }

  function applyToSelected() {
    if (!bulkField || selected.size === 0) return;
    setRows((prev) => prev.map((r, i) => (selected.has(i) ? { ...r, [bulkField]: bulkValue } : r)));
    toast.success(`Aplicado a ${selected.size} etiqueta${selected.size !== 1 ? "s" : ""}.`);
  }

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(Array.from({ length: count }, (_, i) => i)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handlePrint() {
    setPrinting(true);
    try {
      await labelTemplatesService.printSheet(template.id, {
        sheet: { ...sheet, enabled: true },
        cells: rows.map((r) => ({ overrides: r })),
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPrinting(false);
    }
  }

  // Info da folha / aviso de encaixe.
  const paper = getPaperDimensions(sheet.paperSize, sheet.orientation);
  const usableW = paper.width - sheet.marginLeft - sheet.marginRight;
  const usableH = paper.height - sheet.marginTop - sheet.marginBottom;
  const neededW = sheet.columns * layout.width + Math.max(0, sheet.columns - 1) * sheet.gapX;
  const neededH = sheet.rows * layout.height + Math.max(0, sheet.rows - 1) * sheet.gapY;
  const fits = neededW <= usableW + 0.01 && neededH <= usableH + 0.01;
  const pages = Math.ceil(count / perSheet);
  const previewScale = Math.max(1.5, Math.min(180 / layout.width, 120 / layout.height));

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col rounded-lg border bg-background">
      {/* ── Barra superior ── */}
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Imprimir em folha
          </h2>
          <p className="text-xs text-muted-foreground">{template.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={printing}>
            <X className="mr-1 h-4 w-4" /> Fechar
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={printing}>
            {printing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Printer className="mr-1 h-4 w-4" />}
            Imprimir ({count})
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── Config da folha ── */}
        <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-r bg-muted/30 p-4">
          <div className="flex items-center justify-center rounded-lg border bg-white p-3 dark:bg-slate-900">
            <LabelCanvas layout={layout} scale={previewScale} interactive={false} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Papel</Label>
              <Select value={sheet.paperSize} onValueChange={(v) => patchSheet({ paperSize: v as PaperSize })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAPER_SIZE_LABELS) as PaperSize[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Orientação</Label>
              <Select value={sheet.orientation} onValueChange={(v) => patchSheet({ orientation: v as "portrait" | "landscape" })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Retrato</SelectItem>
                  <SelectItem value="landscape">Paisagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SmallNumber label="Colunas" min={1} max={50} value={sheet.columns}
              onChange={(n) => patchSheet({ columns: clamp(Math.round(n), 1, 50) })} />
            <SmallNumber label="Linhas" min={1} max={50} value={sheet.rows}
              onChange={(n) => patchSheet({ rows: clamp(Math.round(n), 1, 50) })} />
            <SmallNumber label="Espaço X" min={0} max={100} step={0.5} value={sheet.gapX}
              onChange={(n) => patchSheet({ gapX: n })} />
            <SmallNumber label="Espaço Y" min={0} max={100} step={0.5} value={sheet.gapY}
              onChange={(n) => patchSheet({ gapY: n })} />
            <SmallNumber label="Margem sup." min={0} max={100} step={0.5} value={sheet.marginTop}
              onChange={(n) => patchSheet({ marginTop: n })} />
            <SmallNumber label="Margem inf." min={0} max={100} step={0.5} value={sheet.marginBottom}
              onChange={(n) => patchSheet({ marginBottom: n })} />
            <SmallNumber label="Margem esq." min={0} max={100} step={0.5} value={sheet.marginLeft}
              onChange={(n) => patchSheet({ marginLeft: n })} />
            <SmallNumber label="Margem dir." min={0} max={100} step={0.5} value={sheet.marginRight}
              onChange={(n) => patchSheet({ marginRight: n })} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Quantidade de etiquetas</Label>
            <Input type="number" min={1} max={MAX_LABELS} value={count}
              onChange={(e) => updateCount(parseInt(e.target.value, 10))} className="h-8" />
          </div>

          <div className="rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {perSheet} por folha · {pages} página{pages !== 1 ? "s" : ""}
          </div>
          {!fits && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-tight text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              As etiquetas não cabem na folha com essas margens/espaçamentos. Ajuste colunas, linhas ou margens.
            </p>
          )}
        </div>

        {/* ── Dados das etiquetas ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {varElements.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                Este modelo não tem campos que variam por etiqueta. Todas as {count} etiquetas serão
                iguais ao design. Ajuste a quantidade e clique em Imprimir. Para preencher valores
                diferentes, marque textos/QR como “Varia por etiqueta” no editor.
              </p>
            </div>
          ) : (
            <>
              {/* Barra de preenchimento em massa */}
              <div className="flex flex-wrap items-end gap-2 border-b p-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Campo</Label>
                  <Select value={bulkField} onValueChange={setBulkField}>
                    <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {varElements.map((el) => (
                        <SelectItem key={el.id} value={el.id}>{fieldLabel(el)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-40 flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}
                    placeholder="Texto a aplicar" className="h-8" />
                </div>
                <Button variant="outline" size="sm" onClick={applyToAll}>
                  Aplicar a todas
                </Button>
                <Button variant="outline" size="sm" onClick={applyToSelected} disabled={selected.size === 0}>
                  Aplicar às selecionadas ({selected.size})
                </Button>
              </div>

              {/* Ações de seleção */}
              <div className="flex items-center gap-3 border-b px-3 py-2 text-xs text-muted-foreground">
                <button type="button" onClick={selectAll} className="inline-flex items-center gap-1 hover:text-foreground">
                  <CheckSquare className="h-3.5 w-3.5" /> Selecionar todas
                </button>
                <button type="button" onClick={clearSelection} className="inline-flex items-center gap-1 hover:text-foreground">
                  <SquareIcon className="h-3.5 w-3.5" /> Limpar seleção
                </button>
                <span className="ml-auto">{selected.size} selecionada{selected.size !== 1 ? "s" : ""}</span>
              </div>

              {/* Tabela de etiquetas */}
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <tr>
                      <th className="w-10 border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                      <th className="w-10 border-b px-2 py-2"></th>
                      {varElements.map((el) => (
                        <th key={el.id} className="border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                          {fieldLabel(el)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={selected.has(i) ? "bg-blue-50/60 dark:bg-blue-950/20" : undefined}>
                        <td className="border-b px-2 py-1 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="border-b px-2 py-1">
                          <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)}
                            className="h-3.5 w-3.5" />
                        </td>
                        {varElements.map((el) => (
                          <td key={el.id} className="border-b px-1 py-1">
                            <Input
                              value={row[el.id] ?? ""}
                              onChange={(e) => setCell(i, el.id, e.target.value)}
                              className="h-7 text-sm"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SmallNumber({
  label, value, onChange, min, max, step = 1,
}: {
  label: string; value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-8"
      />
    </div>
  );
}
