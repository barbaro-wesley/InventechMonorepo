"use client";

import React, { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";
import type { LabelElement, LabelLayout } from "@/services/label-templates/label-templates.types";

// 1 pt = 1/72 pol = 0.352778 mm — converte fontSize (pt) para mm ao renderizar na tela.
const PT_TO_MM = 0.352778;

type DragMode = "move" | "resize" | "marquee";

interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  mode: DragMode;
  startPx: { x: number; y: number };
  origs: Record<string, ElementBox>; // move: posição original de cada selecionado
  resizeId?: string;
  resizeOrig?: ElementBox;
  additive?: boolean; // marquee somando à seleção
  prevSelection?: string[];
}

interface ElementPatch {
  id: string;
  patch: Partial<LabelElement>;
}

export function LabelCanvas({
  layout,
  scale,
  selectedIds = [],
  onSelectionChange = () => {},
  onElementsChange = () => {},
  interactive = true,
}: {
  layout: LabelLayout;
  scale: number; // px por mm
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onElementsChange?: (patches: ElementPatch[]) => void;
  interactive?: boolean;
}) {
  const dragRef = useRef<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const canvasW = layout.width * scale;
  const canvasH = layout.height * scale;

  function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }

  function round1(n: number) {
    return Math.round(n * 10) / 10;
  }

  // ── Início de arraste em um elemento (mover, ou selecionar) ──
  function onElementPointerDown(e: React.PointerEvent, el: LabelElement) {
    if (!interactive) return;
    e.stopPropagation();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;

    if (additive) {
      const next = selectedIds.includes(el.id)
        ? selectedIds.filter((id) => id !== el.id)
        : [...selectedIds, el.id];
      onSelectionChange(next);
      return;
    }

    const ids = selectedIds.includes(el.id) ? selectedIds : [el.id];
    if (!selectedIds.includes(el.id)) onSelectionChange(ids);

    const origs: Record<string, ElementBox> = {};
    for (const id of ids) {
      const found = layout.elements.find((x) => x.id === id);
      if (found) origs[id] = { x: found.x, y: found.y, width: found.width, height: found.height };
    }
    dragRef.current = { mode: "move", startPx: { x: e.clientX, y: e.clientY }, origs };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  // ── Início de redimensionamento (apenas com um elemento selecionado) ──
  function onResizePointerDown(e: React.PointerEvent, el: LabelElement) {
    if (!interactive) return;
    e.stopPropagation();
    dragRef.current = {
      mode: "resize",
      startPx: { x: e.clientX, y: e.clientY },
      origs: {},
      resizeId: el.id,
      resizeOrig: { x: el.x, y: el.y, width: el.width, height: el.height },
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  // ── Início de seleção por retângulo (marquee) no fundo do canvas ──
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (!interactive) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!additive) onSelectionChange([]);
    dragRef.current = {
      mode: "marquee",
      startPx: { x: e.clientX, y: e.clientY },
      origs: {},
      additive,
      prevSelection: selectedIds,
    };
    setMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === "move") {
      const dxMm = (e.clientX - drag.startPx.x) / scale;
      const dyMm = (e.clientY - drag.startPx.y) / scale;
      // Limita o deslocamento para que TODOS os selecionados fiquem dentro da etiqueta.
      let minDx = -Infinity, maxDx = Infinity, minDy = -Infinity, maxDy = Infinity;
      for (const id of Object.keys(drag.origs)) {
        const o = drag.origs[id];
        minDx = Math.max(minDx, -o.x);
        maxDx = Math.min(maxDx, layout.width - o.width - o.x);
        minDy = Math.max(minDy, -o.y);
        maxDy = Math.min(maxDy, layout.height - o.height - o.y);
      }
      const dx = clamp(dxMm, minDx, maxDx);
      const dy = clamp(dyMm, minDy, maxDy);
      const patches: ElementPatch[] = Object.keys(drag.origs).map((id) => ({
        id,
        patch: { x: round1(drag.origs[id].x + dx), y: round1(drag.origs[id].y + dy) },
      }));
      onElementsChange(patches);
      return;
    }

    if (drag.mode === "resize" && drag.resizeId && drag.resizeOrig) {
      const dxMm = (e.clientX - drag.startPx.x) / scale;
      const dyMm = (e.clientY - drag.startPx.y) / scale;
      const o = drag.resizeOrig;
      const width = clamp(o.width + dxMm, 2, layout.width - o.x);
      const height = clamp(o.height + dyMm, 2, layout.height - o.y);
      onElementsChange([{ id: drag.resizeId, patch: { width: round1(width), height: round1(height) } }]);
      return;
    }

    if (drag.mode === "marquee") {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x0 = drag.startPx.x - rect.left;
      const y0 = drag.startPx.y - rect.top;
      const x1 = e.clientX - rect.left;
      const y1 = e.clientY - rect.top;
      setMarquee({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      });
    }
  }

  function onPointerUp(e: PointerEvent) {
    const drag = dragRef.current;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    dragRef.current = null;

    if (drag?.mode === "marquee") {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        // Retângulo do marquee em mm (coordenadas da etiqueta).
        const mx = Math.min(drag.startPx.x, e.clientX) - rect.left;
        const my = Math.min(drag.startPx.y, e.clientY) - rect.top;
        const mw = Math.abs(e.clientX - drag.startPx.x);
        const mh = Math.abs(e.clientY - drag.startPx.y);
        const ax = mx / scale, ay = my / scale, aw = mw / scale, ah = mh / scale;
        const hits = layout.elements
          .filter((el) => !(el.x > ax + aw || el.x + el.width < ax || el.y > ay + ah || el.y + el.height < ay))
          .map((el) => el.id);
        if (mw > 3 || mh > 3) {
          const base = drag.additive ? (drag.prevSelection ?? []) : [];
          onSelectionChange(Array.from(new Set([...base, ...hits])));
        }
      }
      setMarquee(null);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-white shadow-md ring-1 ring-gray-300"
      style={{
        width: canvasW,
        height: canvasH,
        background: layout.background || "#FFFFFF",
      }}
      onPointerDown={onCanvasPointerDown}
    >
      {layout.elements.map((el) => {
        const selected = selectedIds.includes(el.id);
        return (
          <div
            key={el.id}
            onPointerDown={(e) => onElementPointerDown(e, el)}
            className={cn(
              "absolute box-border select-none",
              interactive && "cursor-move",
              selected
                ? "ring-2 ring-blue-500"
                : interactive && "hover:ring-1 hover:ring-blue-300",
            )}
            style={{
              left: el.x * scale,
              top: el.y * scale,
              width: el.width * scale,
              height: el.height * scale,
            }}
          >
            <ElementContent el={el} scale={scale} />

            {interactive && selected && selectedIds.length === 1 && (
              <div
                onPointerDown={(e) => onResizePointerDown(e, el)}
                className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-blue-500"
              />
            )}
          </div>
        );
      })}

      {/* Retângulo de seleção (marquee) */}
      {interactive && marquee && (marquee.w > 0 || marquee.h > 0) && (
        <div
          className="pointer-events-none absolute border border-blue-500 bg-blue-500/10"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}
    </div>
  );
}

function ElementContent({ el, scale }: { el: LabelElement; scale: number }) {
  if (el.type === "text") {
    const alignMap = { left: "flex-start", center: "center", right: "flex-end" } as const;
    return (
      <div
        className="flex h-full w-full overflow-hidden"
        style={{
          justifyContent: alignMap[el.align ?? "left"],
          alignItems: "flex-start",
          fontSize: Math.max(4, el.fontSize * PT_TO_MM * scale),
          fontWeight: el.fontWeight === "bold" ? 700 : 400,
          fontStyle: el.italic ? "italic" : "normal",
          color: el.color || "#000000",
          textAlign: el.align ?? "left",
          lineHeight: 1.1,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {el.content || " "}
      </div>
    );
  }

  if (el.type === "qrcode") {
    const size = Math.min(el.width, el.height) * scale;
    return (
      <div className="flex h-full w-full items-center justify-center">
        <QRCode
          value={el.value || " "}
          size={Math.max(16, size)}
          level={el.errorCorrectionLevel ?? "M"}
          style={{ width: Math.max(16, size), height: Math.max(16, size) }}
        />
      </div>
    );
  }

  if (el.type === "table") {
    const cols = el.columns ?? [];
    const fontPx = Math.max(3, el.fontSize * PT_TO_MM * scale);
    const showHeader = el.showHeader !== false;
    const showBorders = el.showBorders !== false;
    const sample: Record<string, string> = {
      number: "45",
      createdAt: "15/03/2026",
      description: "Descrição da OS…",
      status: "Concluída",
      client: "Prestador Exemplo",
      technician: "João Silva",
    };
    const cellStyle = (key: string): React.CSSProperties => ({
      padding: "0 2px",
      borderTop: showBorders ? "0.5px solid #999" : undefined,
      borderRight: showBorders ? "0.5px solid #999" : undefined,
      textAlign: key === "number" ? "center" : "left",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    });
    return (
      <div
        className="h-full w-full overflow-hidden"
        style={{ color: el.color || "#000000", fontSize: fontPx, lineHeight: 1.5 }}
      >
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: cols.map((c) => `${c.width}fr`).join(" "),
            gridAutoRows: "min-content",
            borderLeft: showBorders ? "0.5px solid #999" : undefined,
            borderBottom: showBorders ? "0.5px solid #999" : undefined,
          }}
        >
          {showHeader &&
            cols.map((c) => (
              <div key={`h-${c.key}`} style={{ ...cellStyle(c.key), fontWeight: 700 }}>
                {c.label}
              </div>
            ))}
          {Array.from({ length: 3 }).flatMap((_, r) =>
            cols.map((c) => (
              <div key={`r${r}-${c.key}`} style={cellStyle(c.key)}>
                {sample[c.key] ?? ""}
              </div>
            )),
          )}
        </div>
      </div>
    );
  }

  if (el.type === "line") {
    const vertical = el.orientation === "vertical";
    const thicknessPx = Math.max(1, (el.thickness ?? 0.3) * scale);
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div
          style={{
            width: vertical ? thicknessPx : "100%",
            height: vertical ? "100%" : thicknessPx,
            background: el.color || "#000000",
          }}
        />
      </div>
    );
  }

  if (el.type === "rect") {
    const borderPx = Math.max(0, (el.borderWidth ?? 0.3) * scale);
    const hasBorder = borderPx > 0 && !!el.borderColor;
    return (
      <div
        className="h-full w-full"
        style={{
          background: el.fill || "transparent",
          border: hasBorder ? `${borderPx}px solid ${el.borderColor}` : undefined,
          borderRadius: (el.radius ?? 0) * scale,
        }}
      />
    );
  }

  // image / company_logo (placeholder — o logo real aparece só no PDF)
  return (
    <div className="flex h-full w-full items-center justify-center rounded-sm border border-dashed border-gray-300 bg-gray-50 text-[9px] font-medium text-gray-400">
      LOGO
    </div>
  );
}
