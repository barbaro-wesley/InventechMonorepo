"use client";

import { useEffect, useState } from "react";
import { Printer, Loader2 } from "lucide-react";
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
import { labelTemplatesService } from "@/services/label-templates/label-templates.service";
import { useLabelTemplates } from "@/hooks/label-templates/use-label-templates";

export function OsQrLabelModal({
  open,
  os,
  onClose,
}: {
  open: boolean;
  os: { id: string; number: number; title: string } | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useLabelTemplates({ referenceType: "SERVICE_ORDER", isActive: true });
  const templates = data?.data ?? [];
  const [templateId, setTemplateId] = useState<string>("");

  useEffect(() => {
    if (open && templates.length > 0) {
      const def = templates.find((t) => t.isDefault);
      setTemplateId(def?.id ?? templates[0].id);
    }
  }, [open, data]);

  if (!os) return null;

  const selected = templates.find((t) => t.id === templateId) ?? null;

  function handlePrint() {
    if (!templateId) return;
    const url = labelTemplatesService.getRenderUrl(templateId, os!.id);
    window.open(url, "_blank");
    onClose();
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4 text-[#0d4da5] dark:text-blue-400" />
            Imprimir etiqueta da OS #{os.number}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Escolha o modelo de etiqueta QR para esta Ordem de Serviço. O PDF é gerado e aberto para impressão.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[#6c7c93]" />
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-400">
            Nenhum modelo de etiqueta ativo encontrado para Ordens de Serviço. Crie ou ative um modelo em <span className="font-semibold">Etiquetas QR</span>.
          </div>
        ) : (
          <>
            {/* Seletor de template */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Modelo de etiqueta</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}{t.isDefault ? " (padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prévia */}
            <div className="flex justify-center py-2">
              {selected ? (
                <div className="rounded border border-gray-200 dark:border-zinc-800 bg-white p-2 shadow-sm">
                  <LabelCanvas
                    layout={selected.layout}
                    scale={fitScale(selected.layout.width, selected.layout.height)}
                    interactive={false}
                  />
                </div>
              ) : (
                <div
                  className="flex flex-col items-center overflow-hidden rounded border border-gray-300 dark:border-zinc-700 bg-white shadow-sm"
                  style={{ width: 120, height: 80, padding: 6, gap: 4 }}
                >
                  <p style={{ fontSize: 8, fontWeight: 800, textAlign: "center" }}>
                    OS #{os.number}
                  </p>
                  <p style={{ fontSize: 6, color: "#4b5563", textAlign: "center" }} className="line-clamp-2">
                    {os.title}
                  </p>
                  <div className="mt-auto flex w-full items-center justify-center rounded border border-gray-200 bg-gray-100 py-1">
                    <p style={{ fontSize: 6, color: "#9ca3af" }}>QR CODE</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} className="h-8 text-xs">Cancelar</AlertDialogCancel>
          <Button
            onClick={handlePrint}
            disabled={!templateId || templates.length === 0}
            className="h-8 text-xs gap-1.5 bg-[#0d4da5] hover:bg-[#0a3d84] dark:bg-blue-600 text-white"
          >
            <Printer className="h-3.5 w-3.5" />
            Abrir PDF e imprimir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function fitScale(width: number, height: number) {
  return Math.max(2, Math.min(150 / width, 170 / height));
}
