"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { equipmentService } from "@/services/equipment/equipment.service";
import type { Equipment } from "@/services/equipment/equipment.service";

export function EquipmentQrLabelModal({
  open,
  equipment,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}) {
  if (!equipment) return null;

  function handlePrint() {
    window.open(equipmentService.getLabelUrl(equipment!.id), "_blank");
    onClose();
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimir etiqueta
          </AlertDialogTitle>
          <AlertDialogDescription>
            PDF vertical 30 × 50 mm gerado pela API. Selecione a Zebra no diálogo de impressão.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Prévia da etiqueta vertical */}
        <div className="flex justify-center py-2">
          <div
            className="bg-white border border-gray-300 shadow-sm rounded flex flex-col items-center overflow-hidden"
            style={{ width: 90, height: 150, padding: 5, gap: 3 }}
          >
            {/* Logo placeholder */}
            <div className="w-7 h-7 rounded border border-gray-200 bg-gray-50 flex-shrink-0" />
            {/* Patrimônio */}
            {equipment.patrimonyNumber && (
              <p style={{ fontSize: 7, fontWeight: 800, color: "#000", textAlign: "center", lineHeight: 1.1, wordBreak: "break-all" }}>
                N° {equipment.patrimonyNumber}
              </p>
            )}
            {/* Tipo */}
            {equipment.type?.name && (
              <p style={{ fontSize: 5.5, color: "#111827", textAlign: "center", lineHeight: 1.1 }}>
                {equipment.type.name}
              </p>
            )}
            {/* Subtipo */}
            {equipment.subtype?.name && (
              <p style={{ fontSize: 5, color: "#6B7280", textAlign: "center", lineHeight: 1.1 }}>
                {equipment.subtype.name}
              </p>
            )}
            {/* QR placeholder */}
            <div className="flex-1 w-full border border-gray-200 bg-gray-100 rounded flex items-center justify-center mt-auto">
              <p style={{ fontSize: 5, color: "#9ca3af" }}>QR</p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Abrir PDF e imprimir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
