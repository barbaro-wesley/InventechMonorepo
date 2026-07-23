"use client";

import React, { useState } from "react";
import { Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  LabelElement, LabelLayout, LabelVariable,
  LabelTableElement, LabelTableColumn, LabelTableColumnKey,
} from "@/services/label-templates/label-templates.types";

// Catálogo de colunas da tabela de OS preventivas (ordem canônica de exibição).
const OS_TABLE_CATALOG: { key: LabelTableColumnKey; label: string; defaultWidth: number }[] = [
  { key: "number", label: "Nº", defaultWidth: 1 },
  { key: "createdAt", label: "Criada", defaultWidth: 2 },
  { key: "description", label: "Descrição", defaultWidth: 4 },
  { key: "status", label: "Status", defaultWidth: 2 },
];

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
  selected,
  variables,
  onLayoutChange,
  onElementChange,
  onDeleteElement,
}: {
  layout: LabelLayout;
  selected: LabelElement | null;
  variables: LabelVariable[];
  onLayoutChange: (patch: Partial<LabelLayout>) => void;
  onElementChange: (id: string, patch: Partial<LabelElement>) => void;
  onDeleteElement: (id: string) => void;
}) {
  const [varSearch, setVarSearch] = useState("");

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

      {/* ── Elemento selecionado ── */}
      {!selected ? (
        <p className="text-sm text-muted-foreground">
          Selecione um elemento no canvas para editar suas propriedades.
        </p>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {selected.type === "text" ? "Texto"
                : selected.type === "qrcode" ? "QR Code"
                : selected.type === "table" ? "Tabela de OS" : "Logo"}
            </h3>
            <Button
              variant="ghost" size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onDeleteElement(selected.id)}
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
                  placeholder="{qr_url}"
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
      )}
    </div>
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
