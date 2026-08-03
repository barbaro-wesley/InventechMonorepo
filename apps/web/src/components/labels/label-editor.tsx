"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  Type, QrCode, Image as ImageIcon, ZoomIn, ZoomOut, Maximize2,
  Save, X, Loader2, Table as TableIcon, Minus, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LabelCanvas } from "./label-canvas";
import { LabelPropertiesPanel } from "./label-properties-panel";
import {
  useCreateLabelTemplate, useUpdateLabelTemplate, useLabelVariables,
} from "@/hooks/label-templates/use-label-templates";
import { REFERENCE_TYPE_LABELS } from "@/services/label-templates/label-templates.types";
import type {
  LabelTemplate, LabelLayout, LabelElement, LabelElementType, LabelReferenceType,
} from "@/services/label-templates/label-templates.types";

const DEFAULT_LAYOUT: LabelLayout = {
  width: 50, height: 30, unit: "mm", background: "#FFFFFF", elements: [],
};

interface ElementPatch {
  id: string;
  patch: Partial<LabelElement>;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `el_${Math.random().toString(36).slice(2)}`;
}

export function LabelEditor({
  template,
  onClose,
}: {
  template?: LabelTemplate | null;
  onClose: () => void;
}) {
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? "");
  const description = template?.description ?? "";
  const [referenceType, setReferenceType] = useState<LabelReferenceType>(
    template?.referenceType ?? "EQUIPMENT",
  );
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [layout, setLayout] = useState<LabelLayout>(
    template?.layout ?? DEFAULT_LAYOUT,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scale, setScale] = useState(8);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const isStandalone = referenceType === "STANDALONE";

  // Ajusta o zoom para a etiqueta preencher a área de trabalho disponível.
  const computeFitScale = useCallback(() => {
    const el = canvasAreaRef.current;
    if (!el) return null;
    const availW = el.clientWidth - 56;
    const availH = el.clientHeight - 56;
    if (availW <= 0 || availH <= 0) return null;
    const s = Math.min(availW / layout.width, availH / layout.height);
    return clamp(Math.floor(s), 2, 24);
  }, [layout.width, layout.height]);

  const fitToScreen = useCallback(() => {
    const s = computeFitScale();
    if (s) setScale(s);
  }, [computeFitScale]);

  // Auto-ajuste ao montar, ao mudar as dimensões da etiqueta e ao redimensionar a área.
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => fitToScreen());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitToScreen]);

  const { data: variables = [] } = useLabelVariables(referenceType);
  const createMutation = useCreateLabelTemplate();
  const updateMutation = useUpdateLabelTemplate(template?.id ?? "");
  const saving = createMutation.isPending || updateMutation.isPending;

  const selectedElements = useMemo(
    () => layout.elements.filter((e) => selectedIds.includes(e.id)),
    [layout.elements, selectedIds],
  );

  // ── Mutadores de layout ──
  function updateLayout(patch: Partial<LabelLayout>) {
    setLayout((prev) => ({ ...prev, ...patch }));
  }

  function updateElement(id: string, patch: Partial<LabelElement>) {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => (e.id === id ? { ...e, ...patch } as LabelElement : e)),
    }));
  }

  function updateElements(patches: ElementPatch[]) {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => {
        const p = patches.find((x) => x.id === e.id);
        return p ? ({ ...e, ...p.patch } as LabelElement) : e;
      }),
    }));
  }

  const deleteElements = useCallback((ids: string[]) => {
    setLayout((prev) => ({ ...prev, elements: prev.elements.filter((e) => !ids.includes(e.id)) }));
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
  }, []);

  // Atalhos: Delete/Backspace remove a seleção; Escape limpa. (Ignora quando digitando.)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.key === "Escape") {
        setSelectedIds([]);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        deleteElements(selectedIds);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, deleteElements]);

  function addElement(type: LabelElementType) {
    const id = newId();
    const base = { id, x: 2, y: 2, rotation: 0 };
    let el: LabelElement;
    if (type === "text") {
      el = { ...base, type: "text", width: clamp(layout.width - 4, 5, layout.width), height: 6,
        content: isStandalone ? "Texto" : "{equipment_patrimony}",
        fontSize: 8, fontWeight: "bold", align: "center", color: "#000000", perCell: true };
    } else if (type === "qrcode") {
      const size = clamp(Math.min(layout.width, layout.height) - 8, 8, 40);
      el = { ...base, type: "qrcode", x: clamp((layout.width - size) / 2, 0, layout.width), y: 8,
        width: size, height: size, value: isStandalone ? "" : "{qr_url}", errorCorrectionLevel: "M", perCell: true };
    } else if (type === "table") {
      el = { ...base, type: "table",
        width: clamp(layout.width - 4, 10, layout.width),
        height: clamp(Math.min(layout.height - 4, 30), 8, layout.height),
        source: "preventive_os",
        columns: [
          { key: "number", label: "Nº", width: 1 },
          { key: "createdAt", label: "Criada", width: 2 },
          { key: "description", label: "Descrição", width: 4 },
          { key: "status", label: "Status", width: 2 },
        ],
        fontSize: 6, headerBold: true, showHeader: true, showBorders: true, maxRows: 8, color: "#000000" };
    } else if (type === "line") {
      el = { ...base, type: "line", width: clamp(layout.width - 4, 5, layout.width), height: 1,
        color: "#000000", thickness: 0.3, orientation: "horizontal" };
    } else if (type === "rect") {
      el = { ...base, type: "rect",
        width: clamp(layout.width - 4, 5, layout.width),
        height: clamp(layout.height - 4, 5, layout.height),
        borderColor: "#000000", borderWidth: 0.3, radius: 0 };
    } else {
      el = { ...base, type: "image", width: 12, height: 12, source: "company_logo", fit: "contain" };
    }
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedIds([id]);
  }

  async function handleSave() {
    const payload = {
      name: name.trim() || "Etiqueta sem nome",
      description: description.trim() || undefined,
      referenceType,
      layout,
      isDefault,
      isActive,
    };
    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  }

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col rounded-lg border bg-background">
      {/* ── Barra superior ── */}
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da etiqueta"
          className="h-9 w-56"
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={referenceType} onValueChange={(v) => setReferenceType(v as LabelReferenceType)}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REFERENCE_TYPE_LABELS) as LabelReferenceType[]).map((rt) => (
                <SelectItem key={rt} value={rt}>{REFERENCE_TYPE_LABELS[rt]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          Padrão
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          Ativa
        </label>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            <X className="mr-1 h-4 w-4" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* ── Corpo: toolbar + canvas + propriedades ── */}
      <div className="flex min-h-0 flex-1">
        {/* Toolbar de elementos */}
        <div className="flex w-40 shrink-0 flex-col gap-2 border-r bg-muted/30 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Adicionar</p>
          <Button variant="outline" size="sm" className="justify-start" onClick={() => addElement("text")}>
            <Type className="mr-2 h-4 w-4" /> Texto
          </Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={() => addElement("qrcode")}>
            <QrCode className="mr-2 h-4 w-4" /> QR Code
          </Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={() => addElement("image")}>
            <ImageIcon className="mr-2 h-4 w-4" /> Logo
          </Button>
          {!isStandalone && (
            <Button variant="outline" size="sm" className="justify-start" onClick={() => addElement("table")}>
              <TableIcon className="mr-2 h-4 w-4" /> Tabela OS
            </Button>
          )}
          <Button variant="outline" size="sm" className="justify-start" onClick={() => addElement("line")}>
            <Minus className="mr-2 h-4 w-4" /> Linha
          </Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={() => addElement("rect")}>
            <Square className="mr-2 h-4 w-4" /> Retângulo
          </Button>

          <div className="mt-auto space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Zoom</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setScale((s) => clamp(s - 1, 2, 24))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="min-w-8 text-center text-xs">{scale}x</span>
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setScale((s) => clamp(s + 1, 2, 24))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={fitToScreen}>
              <Maximize2 className="mr-2 h-4 w-4" /> Ajustar
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={canvasAreaRef} className="flex flex-1 items-center justify-center overflow-auto bg-muted/20 p-6">
          <LabelCanvas
            layout={layout}
            scale={scale}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onElementsChange={updateElements}
          />
        </div>

        {/* Propriedades */}
        <LabelPropertiesPanel
          layout={layout}
          selectedElements={selectedElements}
          variables={variables}
          referenceType={referenceType}
          onLayoutChange={updateLayout}
          onElementChange={updateElement}
          onElementsChange={updateElements}
          onDeleteElements={deleteElements}
        />
      </div>
    </div>
  );
}
