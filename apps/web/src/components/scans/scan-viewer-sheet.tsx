"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  ExternalLink,
  User,
  FileDigit,
  CreditCard,
  Hash,
  Calendar,
  Printer,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  FileText,
  Image as ImageIcon,
  HardDrive,
  Pencil,
  X,
  Loader2,
  Save,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scansService } from "@/services/printers/scans.service";
import { useUpdateScanMetadata } from "@/hooks/printers/use-scans";
import type { Scan, OcrStatus, ScanStatus } from "@/services/printers/scans.service";

interface ScanViewerSheetProps {
  scan: Scan | null;
  onClose: () => void;
  onUpdate?: (updated: Scan) => void;
  canEdit?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length === 11)
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return cpf;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OcrBadge({ status }: { status: OcrStatus }) {
  if (status === "SUCCESS")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        Extraído com sucesso
      </span>
    );
  if (status === "FAILED")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
        <AlertCircle className="w-3 h-3" />
        Falhou na extração
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
      <Clock className="w-3 h-3" />
      Pendente
    </span>
  );
}

function ScanStatusBadge({ status }: { status: ScanStatus }) {
  if (status === "PROCESSED")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">
        Processado
      </span>
    );
  if (status === "ERROR")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-700">
        Erro
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700">
      Pendente
    </span>
  );
}

function FileTypeIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf")
    return (
      <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-red-500" />
      </div>
    );
  return (
    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
      <ImageIcon className="w-5 h-5 text-blue-500" />
    </div>
  );
}

interface MetaRowProps {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

function MetaRow({ icon: Icon, label, value, mono }: MetaRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        {value ? (
          <p className={`text-sm font-medium text-foreground leading-tight ${mono ? "font-mono" : ""}`}>
            {value}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">Não identificado</p>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormValues {
  paciente: string;
  cpf: string;
  prontuario: string;
  numeroAtendimento: string;
}

interface EditPanelProps {
  scan: Scan;
  onCancel: () => void;
  onSaved: (updated: Scan) => void;
}

function EditPanel({ scan, onCancel, onSaved }: EditPanelProps) {
  const update = useUpdateScanMetadata();
  const meta = scan.metadata;

  const { register, handleSubmit } = useForm<EditFormValues>({
    defaultValues: {
      paciente: meta?.paciente ?? "",
      cpf: meta?.cpf ? meta.cpf.replace(/\D/g, "") : "",
      prontuario: meta?.prontuario ?? "",
      numeroAtendimento: meta?.numeroAtendimento ?? "",
    },
  });

  function onSubmit(values: EditFormValues) {
    update.mutate(
      {
        id: scan.id,
        payload: {
          paciente: values.paciente.trim() || null,
          cpf: values.cpf.trim() || null,
          prontuario: values.prontuario.trim() || null,
          numeroAtendimento: values.numeroAtendimento.trim() || null,
        },
      },
      { onSuccess: (updated) => onSaved(updated) }
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SectionTitle>Editar Paciente</SectionTitle>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3 h-3" /> Nome
            </Label>
            <Input
              {...register("paciente")}
              placeholder="Nome do paciente"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="w-3 h-3" /> CPF
            </Label>
            <Input
              {...register("cpf")}
              placeholder="Somente números"
              maxLength={11}
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileDigit className="w-3 h-3" /> Prontuário
            </Label>
            <Input
              {...register("prontuario")}
              placeholder="Nº do prontuário"
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Hash className="w-3 h-3" /> Nº Atendimento
            </Label>
            <Input
              {...register("numeroAtendimento")}
              placeholder="Nº do atendimento"
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <Button
          type="submit"
          size="sm"
          className="flex-1 h-8 text-xs gap-1.5"
          disabled={update.isPending}
        >
          {update.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
          ) : (
            <><Save className="w-3.5 h-3.5" /> Salvar</>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={onCancel}
          disabled={update.isPending}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScanViewerSheet({ scan, onClose, onUpdate, canEdit = true }: ScanViewerSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const downloadUrl = scan ? scansService.getDownloadUrl(scan.id) : "";
  const meta = scan?.metadata;

  // Reset edit mode when the sheet closes or scan changes
  useEffect(() => {
    setIsEditing(false);
  }, [scan?.id]);

  function handleSaved(updated: Scan) {
    setIsEditing(false);
    onUpdate?.(updated);
  }

  return (
    <Sheet open={!!scan} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-5xl p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* ── Top Bar ── */}
        <SheetHeader className="px-5 py-3.5 border-b border-border bg-muted/20 flex-row items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileTypeIcon fileName={scan?.fileName ?? ""} />
            <div className="min-w-0">
              <SheetTitle className="text-sm font-semibold font-mono truncate max-w-xs text-foreground">
                {scan?.fileName}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {scan && <ScanStatusBadge status={scan.status} />}
                {scan?.sizeBytes != null && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    {formatBytes(scan.sizeBytes)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && scan && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar campos
              </Button>
            )}
            {scan?.status === "PROCESSED" && !isEditing && (
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => window.open(downloadUrl, "_blank")}
              >
                <Download className="w-3.5 h-3.5" />
                Baixar PDF
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar ── */}
          <aside className="w-64 flex-shrink-0 border-r border-border overflow-hidden bg-muted/10 flex flex-col">
            {isEditing && scan ? (
              <EditPanel
                scan={scan}
                onCancel={() => setIsEditing(false)}
                onSaved={handleSaved}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* OCR */}
                <div>
                  <SectionTitle>OCR</SectionTitle>
                  <div className="bg-white rounded-lg border border-border p-3">
                    {meta ? (
                      <OcrBadge status={meta.ocrStatus} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground ring-1 ring-border">
                        Sem metadados
                      </span>
                    )}
                    {meta?.extractedAt && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Extraído em{" "}
                        {new Date(meta.extractedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dados do Paciente */}
                <div>
                  <SectionTitle>Paciente</SectionTitle>
                  <div className="bg-white rounded-lg border border-border divide-y divide-border px-3">
                    <MetaRow icon={User} label="Nome" value={meta?.paciente} />
                    <MetaRow icon={CreditCard} label="CPF" value={formatCpf(meta?.cpf ?? null)} mono />
                    <MetaRow icon={FileDigit} label="Prontuário" value={meta?.prontuario} mono />
                    <MetaRow icon={Hash} label="Nº Atendimento" value={meta?.numeroAtendimento} mono />
                  </div>
                </div>

                {/* Origem */}
                <div>
                  <SectionTitle>Origem</SectionTitle>
                  <div className="bg-white rounded-lg border border-border divide-y divide-border px-3">
                    <MetaRow icon={Printer} label="Impressora" value={scan?.printer.name} />
                    <MetaRow icon={Building2} label="Centro de Custo" value={scan?.printer.costCenter?.name} />
                    <MetaRow
                      icon={Calendar}
                      label="Data / Hora"
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
              </div>
            )}
          </aside>

          {/* ── Preview Area ── */}
          <main className="flex-1 bg-zinc-100 overflow-hidden relative">
            {scan?.status === "PROCESSED" ? (
              <iframe
                key={scan.id}
                src={downloadUrl}
                className="w-full h-full border-0"
                title={scan.fileName}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/80 border border-border flex items-center justify-center">
                  <FileText className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    Visualização não disponível
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    O arquivo ainda não foi processado.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </SheetContent>
    </Sheet>
  );
}
