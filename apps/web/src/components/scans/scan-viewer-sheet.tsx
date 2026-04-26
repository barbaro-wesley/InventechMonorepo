"use client";

import { ExternalLink, User, FileDigit, CreditCard, Hash, Calendar, Printer, Building2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { scansService } from "@/services/printers/scans.service";
import type { Scan, OcrStatus } from "@/services/printers/scans.service";

interface ScanViewerSheetProps {
  scan: Scan | null;
  onClose: () => void;
}

function OcrBadge({ status }: { status: OcrStatus }) {
  if (status === "SUCCESS")
    return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Extraído</Badge>;
  if (status === "FAILED")
    return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Falhou</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Pendente</Badge>;
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value ?? <span className="text-muted-foreground font-normal italic">Não identificado</span>}</p>
      </div>
    </div>
  );
}

function formatCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return cpf;
}

export function ScanViewerSheet({ scan, onClose }: ScanViewerSheetProps) {
  const downloadUrl = scan ? scansService.getDownloadUrl(scan.id) : "";
  const meta = scan?.metadata;

  return (
    <Sheet open={!!scan} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-5xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between">
          <SheetTitle className="text-sm font-mono truncate max-w-sm">
            {scan?.fileName}
          </SheetTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 flex-shrink-0"
            onClick={() => window.open(downloadUrl, "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir em nova aba
          </Button>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar com metadados ── */}
          <aside className="w-64 flex-shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                OCR
              </p>
              <div className="flex items-center gap-2">
                {meta ? <OcrBadge status={meta.ocrStatus} /> : <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">Sem dados</Badge>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Dados do Paciente
              </p>
              <div className="divide-y divide-border rounded-lg border border-border bg-muted/30 px-3">
                <MetaRow icon={User} label="Paciente" value={meta?.paciente} />
                <MetaRow icon={CreditCard} label="CPF" value={formatCpf(meta?.cpf ?? null)} />
                <MetaRow icon={FileDigit} label="Prontuário" value={meta?.prontuario} />
                <MetaRow icon={Hash} label="Nº Atendimento" value={meta?.numeroAtendimento} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Origem
              </p>
              <div className="divide-y divide-border rounded-lg border border-border bg-muted/30 px-3">
                <MetaRow icon={Printer} label="Impressora" value={scan?.printer.name} />
                <MetaRow icon={Building2} label="Centro de Custo" value={scan?.printer.costCenter?.name} />
                <MetaRow
                  icon={Calendar}
                  label="Data"
                  value={
                    scan
                      ? new Date(scan.scannedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null
                  }
                />
              </div>
            </div>
          </aside>

          {/* ── Visualizador de PDF ── */}
          <main className="flex-1 bg-gray-100 overflow-hidden">
            {scan?.status === "PROCESSED" ? (
              <iframe
                key={scan.id}
                src={downloadUrl}
                className="w-full h-full border-0"
                title={scan.fileName}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Arquivo ainda não disponível para visualização.
              </div>
            )}
          </main>
        </div>
      </SheetContent>
    </Sheet>
  );
}
