"use client";

import React, { useState } from "react";
import {
  Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Search,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SHEET, PAPER_SIZE_LABELS, getPaperDimensions,
} from "@/services/label-templates/label-templates.types";
import type {
  LabelElement, LabelLayout, LabelVariable, LabelReferenceType,
  LabelTableElement, LabelTableColumn, LabelTableColumnKey,
  LabelSheet, LabelTextElement, PaperSize,
} from "@/services/label-templates/label-templates.types";

// Catálogo de colunas da tabela de OS preventivas (ordem canônica de exibição).
const OS_TABLE_CATALOG: { key: LabelTableColumnKey; label: string; defaultWidth: number }[] = [
  { key: "number", label: "Nº", defaultWidth: 1 },
  { key: "createdAt", label: "Criada", defaultWidth: 2 },
  { key: "description", label: "Descrição", defaultWidth: 4 },
  { key: "status", label: "Status", defaultWidth: 2 },
  { key: "client", label: "Prestador", defaultWidth: 3 },
  { key: "technician", label: "Técnico", defaultWidth: 3 },
];

interface ElementPatch {
  id: string;
  patch: Partial<LabelElement>;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function NumberField({
  label, value, onChange, min, max, step = 1, suffix,
}: {
  label: string; value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-8"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function LabelPropertiesPanel({
  layout,
  selectedElements,
  variables,
  referenceType,
  onLayoutChange,
  onElementChange,
  onElementsChange,
  onDeleteElements,
}: {
  layout: LabelLayout;
  selectedElements: LabelElement[];
  variables: LabelVariable[];
  referenceType: LabelReferenceType;
  onLayoutChange: (patch: Partial<LabelLayout>) => void;
  onElementChange: (id: string, patch: Partial<LabelElement>) => void;
  onElementsChange: (patches: ElementPatch[]) => void;
  onDeleteElements: (ids: string[]) => void;
}) {
  const [varSearch, setVarSearch] = useState("");

  const selected = selectedElements.length === 1 ? selectedElements[0] : null;

  const varQuery = varSearch.trim().toLowerCase();
  const filteredVars = variables.filter(
    (v) => !varQuery || v.label.toLowerCase().includes(varQuery) || v.key.toLowerCase().includes(varQuery),
  );

  function insertVariable(key: string) {
    if (!selected) return;
    if (selected.type === "text") {
      onElementChange(selected.id, { content: `${selected.content ?? ""}${key}` });
    } else if (selected.type === "qrcode") {
      onElementChange(selected.id, { value: `${selected.value ?? ""}${key}` });
    }
  }

  function toggleTableColumn(el: LabelTableElement, key: LabelTableColumnKey) {
    const cols = el.columns ?? [];
    const on = cols.some((c) => c.key === key);
    let next: LabelTableColumn[];
    if (on) {
      next = cols.filter((c) => c.key !== key);
    } else {
      const cat = OS_TABLE_CATALOG.find((c) => c.key === key)!;
      const added = [...cols, { key, label: cat.label, width: cat.defaultWidth }];
      // Reordena pelo catálogo para a ordem das colunas ficar estável.
      next = OS_TABLE_CATALOG
        .filter((c) => added.some((a) => a.key === c.key))
        .map((c) => added.find((a) => a.key === c.key)!);
    }
    onElementChange(el.id, { columns: next });
  }

  function setTableColumnWidth(el: LabelTableElement, key: LabelTableColumnKey, width: number) {
    onElementChange(el.id, {
      columns: (el.columns ?? []).map((c) => (c.key === key ? { ...c, width } : c)),
    });
  }

  // ── Alinhamento em lote (relativo ao bounding box da seleção) ──
  function alignSelection(kind: "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom") {
    const els = selectedElements;
    if (els.length < 2) return;
    const minX = Math.min(...els.map((e) => e.x));
    const maxR = Math.max(...els.map((e) => e.x + e.width));
    const cX = (minX + maxR) / 2;
    const minY = Math.min(...els.map((e) => e.y));
    const maxB = Math.max(...els.map((e) => e.y + e.height));
    const cY = (minY + maxB) / 2;
    const patches: ElementPatch[] = els.map((e) => {
      switch (kind) {
        case "left": return { id: e.id, patch: { x: round1(minX) } };
        case "hcenter": return { id: e.id, patch: { x: round1(cX - e.width / 2) } };
        case "right": return { id: e.id, patch: { x: round1(maxR - e.width) } };
        case "top": return { id: e.id, patch: { y: round1(minY) } };
        case "vmiddle": return { id: e.id, patch: { y: round1(cY - e.height / 2) } };
        case "bottom": return { id: e.id, patch: { y: round1(maxB - e.height) } };
      }
    });
    onElementsChange(patches);
  }

  // Aplica um patch a todos os elementos de texto selecionados (edição em lote).
  function applyToTexts(patch: Partial<LabelTextElement>) {
    const patches: ElementPatch[] = selectedElements
      .filter((e) => e.type === "text")
      .map((e) => ({ id: e.id, patch }));
    if (patches.length) onElementsChange(patches);
  }

  return (
    <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-muted/30 p-4">
      {/* ── Etiqueta (canvas) ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Etiqueta</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Largura" suffix="mm" min={5} max={500}
            value={layout.width}
            onChange={(n) => onLayoutChange({ width: n })}
          />
          <NumberField
            label="Altura" suffix="mm" min={5} max={500}
            value={layout.height}
            onChange={(n) => onLayoutChange({ height: n })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fundo</Label>
          <input
            type="color"
            value={layout.background || "#FFFFFF"}
            onChange={(e) => onLayoutChange({ background: e.target.value })}
            className="h-8 w-full cursor-pointer rounded border"
          />
        </div>
      </section>

      <div className="border-t" />

      {/* ── Folha de impressão ── */}
      <SheetSection layout={layout} onLayoutChange={onLayoutChange} />

      <div className="border-t" />

      {/* ── Seleção ── */}
      {selectedElements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Selecione um elemento no canvas para editar. Segure Shift para selecionar vários, ou
          arraste um retângulo no fundo.
        </p>
      ) : selectedElements.length > 1 ? (
        /* ── Edição em lote ── */
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{selectedElements.length} elementos</h3>
            <Button
              variant="ghost" size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onDeleteElements(selectedElements.map((e) => e.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Alinhar</Label>
            <div className="flex flex-wrap gap-1">
              <IconBtn title="Alinhar à esquerda" onClick={() => alignSelection("left")}><AlignStartVertical className="h-4 w-4" /></IconBtn>
              <IconBtn title="Centralizar horizontal" onClick={() => alignSelection("hcenter")}><AlignCenterVertical className="h-4 w-4" /></IconBtn>
              <IconBtn title="Alinhar à direita" onClick={() => alignSelection("right")}><AlignEndVertical className="h-4 w-4" /></IconBtn>
              <div className="mx-0.5 h-8 w-px bg-border" />
              <IconBtn title="Alinhar ao topo" onClick={() => alignSelection("top")}><AlignStartHorizontal className="h-4 w-4" /></IconBtn>
              <IconBtn title="Centralizar vertical" onClick={() => alignSelection("vmiddle")}><AlignCenterHorizontal className="h-4 w-4" /></IconBtn>
              <IconBtn title="Alinhar à base" onClick={() => alignSelection("bottom")}><AlignEndHorizontal className="h-4 w-4" /></IconBtn>
            </div>
          </div>

          {(() => {
            const firstText = selectedElements.find((e) => e.type === "text") as LabelTextElement | undefined;
            if (!firstText) return null;
            return (
            <div className="space-y-2 rounded-md border bg-background/60 p-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                Texto (aplica a todos os textos selecionados)
              </p>
              <NumberField label="Fonte (pt)" min={3} max={72} value={firstText.fontSize}
                onChange={(n) => applyToTexts({ fontSize: n })} />
              <div className="flex items-center gap-1">
                <ToggleBtn active={false} onClick={() => applyToTexts({ fontWeight: "bold" })}>
                  <Bold className="h-4 w-4" />
                </ToggleBtn>
                <ToggleBtn active={false} onClick={() => applyToTexts({ fontWeight: "normal" })}>
                  <span className="text-xs">N</span>
                </ToggleBtn>
                <ToggleBtn active={false} onClick={() => applyToTexts({ italic: true })}>
                  <Italic className="h-4 w-4" />
                </ToggleBtn>
                <div className="mx-1 h-5 w-px bg-border" />
                <ToggleBtn active={false} onClick={() => applyToTexts({ align: "left" })}><AlignLeft className="h-4 w-4" /></ToggleBtn>
                <ToggleBtn active={false} onClick={() => applyToTexts({ align: "center" })}><AlignCenter className="h-4 w-4" /></ToggleBtn>
                <ToggleBtn active={false} onClick={() => applyToTexts({ align: "right" })}><AlignRight className="h-4 w-4" /></ToggleBtn>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <input type="color" defaultValue={firstText.color || "#000000"}
                  onChange={(e) => applyToTexts({ color: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded border" />
              </div>
            </div>
            );
          })()}
        </section>
      ) : selected ? (
        /* ── Elemento único ── */
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {selected.type === "text" ? "Texto"
                : selected.type === "qrcode" ? "QR Code"
                : selected.type === "table" ? "Tabela de OS"
                : selected.type === "line" ? "Linha"
                : selected.type === "rect" ? "Retângulo" : "Logo"}
            </h3>
            <Button
              variant="ghost" size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onDeleteElements([selected.id])}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Posição/tamanho */}
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" suffix="mm" step={0.5} value={selected.x}
              onChange={(n) => onElementChange(selected.id, { x: n })} />
            <NumberField label="Y" suffix="mm" step={0.5} value={selected.y}
              onChange={(n) => onElementChange(selected.id, { y: n })} />
            <NumberField label="Largura" suffix="mm" step={0.5} value={selected.width}
              onChange={(n) => onElementChange(selected.id, { width: n })} />
            <NumberField label="Altura" suffix="mm" step={0.5} value={selected.height}
              onChange={(n) => onElementChange(selected.id, { height: n })} />
          </div>

          {/* Texto */}
          {selected.type === "text" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Conteúdo</Label>
                <textarea
                  value={selected.content}
                  onChange={(e) => onElementChange(selected.id, { content: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-md border bg-background px-2 py-1 text-sm"
                  placeholder="Texto ou {variavel}"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Fonte (pt)" min={3} max={72} value={selected.fontSize}
                  onChange={(n) => onElementChange(selected.id, { fontSize: n })} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor</Label>
                  <input type="color" value={selected.color || "#000000"}
                    onChange={(e) => onElementChange(selected.id, { color: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded border" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ToggleBtn active={selected.fontWeight === "bold"}
                  onClick={() => onElementChange(selected.id, { fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}>
                  <Bold className="h-4 w-4" />
                </ToggleBtn>
                <ToggleBtn active={!!selected.italic}
                  onClick={() => onElementChange(selected.id, { italic: !selected.italic })}>
                  <Italic className="h-4 w-4" />
                </ToggleBtn>
                <div className="mx-1 h-5 w-px bg-border" />
                {(["left", "center", "right"] as const).map((a) => (
                  <ToggleBtn key={a} active={(selected.align ?? "left") === a}
                    onClick={() => onElementChange(selected.id, { align: a })}>
                    {a === "left" ? <AlignLeft className="h-4 w-4" />
                      : a === "center" ? <AlignCenter className="h-4 w-4" />
                        : <AlignRight className="h-4 w-4" />}
                  </ToggleBtn>
                ))}
              </div>
              {referenceType === "STANDALONE" && (
                <PerCellToggle
                  checked={selected.perCell !== false}
                  onChange={(v) => onElementChange(selected.id, { perCell: v })}
                />
              )}
            </>
          )}

          {/* QR Code */}
          {selected.type === "qrcode" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor / URL</Label>
                <textarea
                  value={selected.value}
                  onChange={(e) => onElementChange(selected.id, { value: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-md border bg-background px-2 py-1 text-sm"
                  placeholder={referenceType === "STANDALONE" ? "Texto ou link do QR" : "{qr_url}"}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Correção de erro</Label>
                <Select
                  value={selected.errorCorrectionLevel ?? "M"}
                  onValueChange={(v) => onElementChange(selected.id, { errorCorrectionLevel: v as "L" | "M" | "Q" | "H" })}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Baixa (L)</SelectItem>
                    <SelectItem value="M">Média (M)</SelectItem>
                    <SelectItem value="Q">Alta (Q)</SelectItem>
                    <SelectItem value="H">Máxima (H)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {referenceType === "STANDALONE" && (
                <PerCellToggle
                  checked={selected.perCell !== false}
                  onChange={(v) => onElementChange(selected.id, { perCell: v })}
                />
              )}
            </>
          )}

          {/* Imagem/Logo */}
          {selected.type === "image" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ajuste</Label>
              <Select
                value={selected.fit ?? "contain"}
                onValueChange={(v) => onElementChange(selected.id, { fit: v as "contain" | "cover" })}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contain">Conter (sem cortar)</SelectItem>
                  <SelectItem value="cover">Preencher (pode cortar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tabela de OS preventivas */}
          {selected.type === "table" && (
            <>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Lista as OS de manutenção preventiva do equipamento (mais recentes primeiro).
                Os dados são preenchidos na impressão.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Fonte (pt)" min={3} max={24} value={selected.fontSize}
                  onChange={(n) => onElementChange(selected.id, { fontSize: n })} />
                <NumberField label="Máx. linhas" min={1} max={50} value={selected.maxRows ?? 8}
                  onChange={(n) => onElementChange(selected.id, { maxRows: n })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cor do texto</Label>
                <input type="color" value={selected.color || "#000000"}
                  onChange={(e) => onElementChange(selected.id, { color: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selected.showHeader !== false}
                    onChange={(e) => onElementChange(selected.id, { showHeader: e.target.checked })}
                    className="h-3.5 w-3.5" />
                  Mostrar cabeçalho
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selected.showBorders !== false}
                    onChange={(e) => onElementChange(selected.id, { showBorders: e.target.checked })}
                    className="h-3.5 w-3.5" />
                  Mostrar bordas
                </label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Colunas</Label>
                <div className="space-y-1">
                  {OS_TABLE_CATALOG.map((cat) => {
                    const tableEl = selected;
                    const col = (tableEl.columns ?? []).find((c) => c.key === cat.key);
                    return (
                      <div key={cat.key} className="flex items-center gap-2">
                        <input type="checkbox" checked={!!col}
                          onChange={() => toggleTableColumn(tableEl, cat.key)}
                          className="h-3.5 w-3.5" />
                        <span className="flex-1 text-xs">{cat.label}</span>
                        {col && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">larg.</span>
                            <Input
                              type="number" min={0.5} max={20} step={0.5} value={col.width}
                              onChange={(e) => setTableColumnWidth(tableEl, cat.key, parseFloat(e.target.value))}
                              className="h-7 w-14 px-1 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  A largura é um peso relativo entre as colunas.
                </p>
              </div>
            </>
          )}

          {/* Linha */}
          {selected.type === "line" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Orientação</Label>
                <Select
                  value={selected.orientation ?? "horizontal"}
                  onValueChange={(v) => onElementChange(selected.id, { orientation: v as "horizontal" | "vertical" })}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Espessura" suffix="mm" min={0.1} max={10} step={0.1}
                  value={selected.thickness ?? 0.3}
                  onChange={(n) => onElementChange(selected.id, { thickness: n })} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor</Label>
                  <input type="color" value={selected.color || "#000000"}
                    onChange={(e) => onElementChange(selected.id, { color: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded border" />
                </div>
              </div>
            </>
          )}

          {/* Retângulo */}
          {selected.type === "rect" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preenchimento</Label>
                  <input type="color" value={selected.fill || "#FFFFFF"}
                    onChange={(e) => onElementChange(selected.id, { fill: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor da borda</Label>
                  <input type="color" value={selected.borderColor || "#000000"}
                    onChange={(e) => onElementChange(selected.id, { borderColor: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded border" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onElementChange(selected.id, { fill: undefined })}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Sem preenchimento (transparente)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Borda" suffix="mm" min={0} max={10} step={0.1}
                  value={selected.borderWidth ?? 0.3}
                  onChange={(n) => onElementChange(selected.id, { borderWidth: n })} />
                <NumberField label="Cantos" suffix="mm" min={0} max={50} step={0.5}
                  value={selected.radius ?? 0}
                  onChange={(n) => onElementChange(selected.id, { radius: n })} />
              </div>
            </>
          )}

          {/* Inserir variáveis (texto e QR) */}
          {(selected.type === "text" || selected.type === "qrcode") && variables.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Variáveis</Label>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Clique para inserir no {selected.type === "qrcode" ? "valor do QR" : "texto"}.
                Ao imprimir, cada variável é trocada pelo dado real do item.
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={varSearch}
                  onChange={(e) => setVarSearch(e.target.value)}
                  placeholder="Buscar variável…"
                  className="h-8 pl-7"
                />
              </div>
              <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border bg-background p-1">
                {filteredVars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-blue-50"
                  >
                    <span className="text-xs font-medium text-foreground">{v.label}</span>
                    <span className="font-mono text-[10px] text-blue-600">{v.key}</span>
                  </button>
                ))}
                {filteredVars.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    Nenhuma variável encontrada.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

// ─── Seção de folha de impressão ────────────────────────────────────────────

function SheetSection({
  layout,
  onLayoutChange,
}: {
  layout: LabelLayout;
  onLayoutChange: (patch: Partial<LabelLayout>) => void;
}) {
  const sheet: LabelSheet = layout.sheet ?? DEFAULT_SHEET;

  function patchSheet(patch: Partial<LabelSheet>) {
    onLayoutChange({ sheet: { ...sheet, ...patch } });
  }

  const paper = getPaperDimensions(sheet.paperSize, sheet.orientation);
  const usableW = paper.width - sheet.marginLeft - sheet.marginRight;
  const usableH = paper.height - sheet.marginTop - sheet.marginBottom;
  const neededW = sheet.columns * layout.width + Math.max(0, sheet.columns - 1) * sheet.gapX;
  const neededH = sheet.rows * layout.height + Math.max(0, sheet.rows - 1) * sheet.gapY;
  const fits = neededW <= usableW + 0.01 && neededH <= usableH + 0.01;
  const perSheet = sheet.columns * sheet.rows;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Folha de impressão</h3>
        <Switch
          checked={sheet.enabled}
          onCheckedChange={(v) => patchSheet({ enabled: v })}
        />
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        Imprime várias etiquetas numa folha A4/A3/A5. Usado como padrão na tela de impressão.
      </p>

      {sheet.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Papel</Label>
              <Select value={sheet.paperSize} onValueChange={(v) => patchSheet({ paperSize: v as PaperSize })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAPER_SIZE_LABELS) as PaperSize[]).map((p) => (
                    <SelectItem key={p} value={p}>{PAPER_SIZE_LABELS[p]}</SelectItem>
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
            <NumberField label="Colunas" min={1} max={50} value={sheet.columns}
              onChange={(n) => patchSheet({ columns: Math.round(n) })} />
            <NumberField label="Linhas" min={1} max={50} value={sheet.rows}
              onChange={(n) => patchSheet({ rows: Math.round(n) })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Espaço X" suffix="mm" min={0} max={100} step={0.5} value={sheet.gapX}
              onChange={(n) => patchSheet({ gapX: n })} />
            <NumberField label="Espaço Y" suffix="mm" min={0} max={100} step={0.5} value={sheet.gapY}
              onChange={(n) => patchSheet({ gapY: n })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Margem sup." suffix="mm" min={0} max={100} step={0.5} value={sheet.marginTop}
              onChange={(n) => patchSheet({ marginTop: n })} />
            <NumberField label="Margem inf." suffix="mm" min={0} max={100} step={0.5} value={sheet.marginBottom}
              onChange={(n) => patchSheet({ marginBottom: n })} />
            <NumberField label="Margem esq." suffix="mm" min={0} max={100} step={0.5} value={sheet.marginLeft}
              onChange={(n) => patchSheet({ marginLeft: n })} />
            <NumberField label="Margem dir." suffix="mm" min={0} max={100} step={0.5} value={sheet.marginRight}
              onChange={(n) => patchSheet({ marginRight: n })} />
          </div>

          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {perSheet} etiqueta{perSheet !== 1 ? "s" : ""} por folha ({sheet.columns} × {sheet.rows})
          </p>
          {!fits && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-tight text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              As etiquetas não cabem na folha com essas margens/espaçamentos. Reduza colunas, linhas,
              margens ou o tamanho da etiqueta.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function PerCellToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md bg-blue-50/60 px-2 py-1.5 text-xs dark:bg-blue-950/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5"
      />
      Varia por etiqueta (mala-direta)
    </label>
  );
}

function ToggleBtn({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded border",
        active ? "border-blue-500 bg-blue-50 text-blue-600" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  title, onClick, children,
}: {
  title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded border bg-background hover:bg-muted"
    >
      {children}
    </button>
  );
}
