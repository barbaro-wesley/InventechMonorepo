"use client";

import React, { useRef } from "react";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";
import type { LabelElement, LabelLayout } from "@/services/label-templates/label-templates.types";

// 1 pt = 1/72 pol = 0.352778 mm — converte fontSize (pt) para mm ao renderizar na tela.
const PT_TO_MM = 0.352778;

type DragMode = "move" | "resize";

interface DragState {
  id: string;
  mode: DragMode;
  startPx: { x: number; y: number };
  orig: { x: number; y: number; width: number; height: number };
}

export function LabelCanvas({
  layout,
  scale,
  selectedId,
  onSelect,
  onElementChange,
  interactive = true,
}: {
  layout: LabelLayout;
  scale: number; // px por mm
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementChange: (id: string, patch: Partial<LabelElement>) => void;
  interactive?: boolean;
}) {
  const dragRef = useRef<DragState | null>(null);
  const canvasW = layout.width * scale;
  const canvasH = layout.height * scale;

  function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }

  function handlePointerDown(
    e: React.PointerEvent,
    el: LabelElement,
    mode: DragMode,
  ) {
    if (!interactive) return;
    e.stopPropagation();
    onSelect(el.id);
    dragRef.current = {
      id: el.id,
      mode,
      startPx: { x: e.clientX, y: e.clientY },
      orig: { x: el.x, y: el.y, width: el.width, height: el.height },
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dxMm = (e.clientX - drag.startPx.x) / scale;
    const dyMm = (e.clientY - drag.startPx.y) / scale;

    if (drag.mode === "move") {
      const x = clamp(drag.orig.x + dxMm, 0, layout.width - drag.orig.width);
      const y = clamp(drag.orig.y + dyMm, 0, layout.height - drag.orig.height);
      onElementChange(drag.id, {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      });
    } else {
      const width = clamp(drag.orig.width + dxMm, 2, layout.width - drag.orig.x);
      const height = clamp(drag.orig.height + dyMm, 2, layout.height - drag.orig.y);
      onElementChange(drag.id, {
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
      });
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  return (
    <div
      className="relative overflow-hidden bg-white shadow-md ring-1 ring-gray-300"
      style={{
        width: canvasW,
        height: canvasH,
        background: layout.background || "#FFFFFF",
      }}
      onPointerDown={() => interactive && onSelect(null)}
    >
      {layout.elements.map((el) => {
        const selected = el.id === selectedId;
        return (
          <div
            key={el.id}
            onPointerDown={(e) => handlePointerDown(e, el, "move")}
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

            {interactive && selected && (
              <div
                onPointerDown={(e) => handlePointerDown(e, el, "resize")}
                className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-blue-500"
              />
            )}
          </div>
        );
      })}
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
