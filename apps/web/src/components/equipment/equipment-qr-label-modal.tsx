"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LabelCanvas } from "@/components/labels/label-canvas";
import { equipmentService } from "@/services/equipment/equipment.service";
import type { Equipment } from "@/services/equipment/equipment.service";
import { labelTemplatesService } from "@/services/label-templates/label-templates.service";
import { useLabelTemplates } from "@/hooks/label-templates/use-label-templates";

const DEFAULT_OPTION = "__default__";

export function EquipmentQrLabelModal({
  open,
  equipment,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}) {
  const { data } = useLabelTemplates({ referenceType: "EQUIPMENT", isActive: true });
  const templates = data?.data ?? [];
  const [templateId, setTemplateId] = useState<string>(DEFAULT_OPTION);

  // Ao abrir, seleciona o template padrão (isDefault) se houver.
  useEffect(() => {
    if (open) {
      const def = templates.find((t) => t.isDefault);
      setTemplateId(def?.id ?? DEFAULT_OPTION);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  if (!equipment) return null;

  const selected = templates.find((t) => t.id === templateId) ?? null;

  function handlePrint() {
    const url =
      templateId === DEFAULT_OPTION
        ? equipmentService.getLabelUrl(equipment!.id)
        : labelTemplatesService.getRenderUrl(templateId, equipment!.id);
    window.open(url, "_blank");
    onClose();
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Imprimir etiqueta
          </AlertDialogTitle>
          <AlertDialogDescription>
            Escolha o modelo de etiqueta. O PDF é gerado pela API — selecione a impressora no diálogo de impressão.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Seletor de template */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Modelo</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_OPTION}>Padrão da empresa</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.isDefault ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prévia */}
        <div className="flex justify-center py-2">
          {selected ? (
            <div className="rounded border border-gray-200 bg-white p-2 shadow-sm">
              <LabelCanvas
                layout={selected.layout}
                scale={fitScale(selected.layout.width, selected.layout.height)}
                interactive={false}
              />
            </div>
          ) : (
            <div
              className="flex flex-col items-center overflow-hidden rounded border border-gray-300 bg-white shadow-sm"
              style={{ width: 90, height: 150, padding: 5, gap: 3 }}
            >
              <div className="h-7 w-7 shrink-0 rounded border border-gray-200 bg-gray-50" />
              {equipment.patrimonyNumber && (
                <p style={{ fontSize: 7, fontWeight: 800, textAlign: "center", lineHeight: 1.1, wordBreak: "break-all" }}>
                  N° {equipment.patrimonyNumber}
                </p>
              )}
              {equipment.type?.name && (
                <p style={{ fontSize: 5.5, color: "#111827", textAlign: "center", lineHeight: 1.1 }}>
                  {equipment.type.name}
                </p>
              )}
              <div className="mt-auto flex w-full flex-1 items-center justify-center rounded border border-gray-200 bg-gray-100">
                <p style={{ fontSize: 5, color: "#9ca3af" }}>QR</p>
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Abrir PDF e imprimir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Escala (px/mm) para caber a prévia num espaço confortável. */
function fitScale(width: number, height: number) {
  return Math.max(2, Math.min(150 / width, 170 / height));
}
