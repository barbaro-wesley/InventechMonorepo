"use client";

import React from "react";
import {
  FileText,
  AlignLeft,
  AlignJustify,
  Hash,
  Calendar,
  CheckSquare,
  ListChecks,
  List,
  Table2,
  Heading,
  Minus,
  Image,
  ShieldCheck,
  Eye,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  LaudoFieldDefinition,
  LaudoFieldType,
  LaudoReferenceType,
  LaudoSignatureConfig,
} from "@/services/laudo-templates/laudo-templates.types";
import {
  REFERENCE_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  SIGNER_TYPE_LABELS,
} from "@/services/laudo-templates/laudo-templates.types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  referenceType: LaudoReferenceType;
  fields: LaudoFieldDefinition[];
  signatureConfig?: LaudoSignatureConfig | null;
}

// ─── Sample data for preview ─────────────────────────────────────────────────

const SAMPLE_DATA: Record<string, string> = {
  "{equipment_name}": "Compressor de Ar Industrial CA-500",
  "{equipment_model}": "CA-500X",
  "{equipment_brand}": "Atlas Copco",
  "{equipment_serial}": "SN-2024-001234",
  "{equipment_patrimony}": "PAT-00456",
  "{equipment_location}": "Galpão 3 — Setor B",
  "{equipment_type}": "Compressor",
  "{equipment_status}": "Em operação",
  "{client_name}": "Indústrias Reunidas S.A.",
  "{client_document}": "12.345.678/0001-90",
  "{client_phone}": "(11) 3456-7890",
  "{client_email}": "contato@industriasreunidas.com.br",
  "{company_name}": "InventechServ Ltda",
  "{company_document}": "98.765.432/0001-10",
  "{technician_name}": "Carlos A. Silva",
  "{technician_email}": "carlos.silva@inventech.com",
  "{service_order_number}": "OS-2024-0078",
  "{service_order_title}": "Manutenção Preventiva Trimestral",
  "{service_order_type}": "Preventiva",
  "{service_order_status}": "Em andamento",
  "{maintenance_type}": "Preventiva",
  "{maintenance_title}": "Revisão de Compressor Q2/2024",
  "{maintenance_scheduled_at}": "19/04/2026",
  "{date_today}": new Date().toLocaleDateString("pt-BR"),
  "{datetime_now}": new Date().toLocaleString("pt-BR"),
  "{year}": new Date().getFullYear().toString(),
  "{month}": new Date().toLocaleDateString("pt-BR", { month: "long" }),
};

function resolveVariable(variable: string | undefined): string {
  if (!variable) return "";
  return SAMPLE_DATA[variable] ?? variable;
}

// ─── Reference type styling ───────────────────────────────────────────────────

const REF_TYPE_BG: Record<LaudoReferenceType, string> = {
  MAINTENANCE: "from-blue-600 to-blue-700",
  SERVICE_ORDER: "from-violet-600 to-violet-700",
  CUSTOM: "from-slate-500 to-slate-600",
};

const REF_TYPE_BADGE: Record<LaudoReferenceType, string> = {
  MAINTENANCE: "bg-blue-50 text-blue-700 border-blue-200",
  SERVICE_ORDER: "bg-violet-50 text-violet-700 border-violet-200",
  CUSTOM: "bg-slate-50 text-slate-600 border-slate-200",
};

// ─── Field preview renderers ─────────────────────────────────────────────────

function PreviewField({ field }: { field: LaudoFieldDefinition }) {
  const resolvedValue = resolveVariable(field.variable);

  if (field.type === "HEADING") {
    return (
      <div className="col-span-2 pt-3 pb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-blue-500" />
          {field.label || "Título da seção"}
        </h3>
      </div>
    );
  }

  if (field.type === "DIVIDER") {
    return (
      <div className="col-span-2 py-1">
        <hr className="border-slate-200 dark:border-slate-700" />
      </div>
    );
  }

  const isHalf = field.width === "half";

  return (
    <div className={cn("space-y-1.5", isHalf ? "col-span-1" : "col-span-2")}>
      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
        {field.label || "Campo sem rótulo"}
        {field.required && <span className="text-rose-400">*</span>}
        {field.variable && (
          <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
            auto
          </Badge>
        )}
      </Label>
      <PreviewFieldInput field={field} resolvedValue={resolvedValue} />
    </div>
  );
}

function PreviewFieldInput({
  field,
  resolvedValue,
}: {
  field: LaudoFieldDefinition;
  resolvedValue: string;
}) {
  if (field.type === "SHORT_TEXT") {
    return (
      <div className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
        {resolvedValue || field.placeholder || "Texto curto..."}
      </div>
    );
  }

  if (field.type === "LONG_TEXT") {
    return (
      <div className="min-h-[68px] rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
        {resolvedValue || field.placeholder || "Texto longo..."}
      </div>
    );
  }

  if (field.type === "NUMBER") {
    return (
      <div className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
        {resolvedValue || field.placeholder || "0"}
      </div>
    );
  }

  if (field.type === "DATE") {
    return (
      <div className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
        {resolvedValue || "dd/mm/aaaa"}
      </div>
    );
  }

  if (field.type === "CHECKBOX") {
    return (
      <div className="flex items-center gap-2">
        <Switch checked={false} onCheckedChange={() => {}} disabled />
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {field.placeholder || "Marcar"}
        </span>
      </div>
    );
  }

  if (field.type === "SINGLE_SELECT") {
    const opts = field.options ?? [];
    if (opts.length === 0) {
      return (
        <p className="text-xs text-slate-400 italic">Sem opções definidas</p>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((opt, i) => (
          <span
            key={i}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs border transition-colors",
              i === 0
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            )}
          >
            {opt}
          </span>
        ))}
      </div>
    );
  }

  if (field.type === "MULTI_SELECT") {
    const opts = field.options ?? [];
    if (opts.length === 0) {
      return (
        <p className="text-xs text-slate-400 italic">Sem opções definidas</p>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((opt, i) => (
          <span
            key={i}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors",
              i < 2
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            )}
          >
            {opt}
          </span>
        ))}
      </div>
    );
  }

  if (field.type === "TABLE") {
    const cols = field.tableColumns ?? [];
    if (cols.length === 0) {
      return (
        <p className="text-xs text-slate-400 italic">
          Tabela sem colunas definidas
        </p>
      );
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              {cols.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Sample rows */}
            {[0, 1].map((rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                {cols.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 text-slate-400 dark:text-slate-500"
                  >
                    {col.type === "number"
                      ? rowIdx === 0
                        ? "100"
                        : "250"
                      : rowIdx === 0
                        ? "Exemplo 1"
                        : "Exemplo 2"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (field.type === "IMAGE") {
    return (
      <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="text-center">
          <Image className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
          <p className="text-xs text-slate-400">Área para imagem</p>
        </div>
      </div>
    );
  }

  return null;
}

// ─── TemplatePreviewDialog ────────────────────────────────────────────────────

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  referenceType,
  fields,
  signatureConfig,
}: TemplatePreviewDialogProps) {
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  const inputFields = sortedFields.filter(
    (f) => f.type !== "HEADING" && f.type !== "DIVIDER"
  );
  const requiredCount = inputFields.filter((f) => f.required).length;
  const autoFillCount = inputFields.filter((f) => f.variable).length;
  const requiresSignature = !!signatureConfig?.requireSignature;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header band */}
        <div
          className={cn(
            "flex-shrink-0 px-6 py-5 bg-gradient-to-r text-white",
            REF_TYPE_BG[referenceType]
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogHeader className="p-0">
                <DialogTitle className="text-white text-lg font-semibold pr-8 leading-snug">
                  {title || "Template sem título"}
                </DialogTitle>
                {description && (
                  <DialogDescription className="text-white/70 text-sm mt-1">
                    {description}
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge
                  variant="outline"
                  className="bg-white/15 text-white border-white/30 text-xs backdrop-blur-sm"
                >
                  {REFERENCE_TYPE_LABELS[referenceType]}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-white/15 text-white border-white/30 text-xs backdrop-blur-sm"
                >
                  {inputFields.length} campo{inputFields.length !== 1 ? "s" : ""}
                </Badge>
                {requiredCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-white/15 text-white border-white/30 text-xs backdrop-blur-sm"
                  >
                    {requiredCount} obrigatório{requiredCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {autoFillCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-amber-200/30 text-white border-amber-300/40 text-xs backdrop-blur-sm"
                  >
                    {autoFillCount} preenchido{autoFillCount !== 1 ? "s" : ""} automaticamente
                  </Badge>
                )}
                {requiresSignature && (
                  <Badge
                    variant="outline"
                    className="bg-white/15 text-white border-white/30 text-xs backdrop-blur-sm gap-1"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Assinatura
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
          {/* Preview notice */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 mb-5">
            <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Modo preview</strong> — Esta é uma simulação de como o
              formulário será apresentado ao técnico. Campos com variáveis
              automáticas são preenchidos com dados de exemplo.
            </p>
          </div>

          {/* Fields grid */}
          {sortedFields.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {sortedFields.map((field, idx) => (
                <PreviewField key={field.id || idx} field={field} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <FileText className="w-7 h-7 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Nenhum campo adicionado
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Adicione campos ao template para visualizar o preview.
              </p>
            </div>
          )}

          {/* Notes section */}
          {sortedFields.length > 0 && (
            <div className="space-y-1.5 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Observações gerais
              </Label>
              <div className="min-h-[52px] rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
                Observações adicionais sobre este laudo...
              </div>
            </div>
          )}

          {/* Signature section preview */}
          {requiresSignature && signatureConfig && (
            <div className="mt-5 rounded-xl border border-violet-200 dark:border-violet-800 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-200 dark:border-violet-800">
                <ShieldCheck className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  Assinatura Eletrônica
                </span>
              </div>
              <div className="p-4 space-y-3">
                {signatureConfig.customMessage && (
                  <p className="text-xs text-slate-500 italic">
                    &ldquo;{signatureConfig.customMessage}&rdquo;
                  </p>
                )}
                <div className="space-y-2">
                  {signatureConfig.signers.map((signer, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                          {i + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {signer.signerRole || "Signatário"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {SIGNER_TYPE_LABELS[signer.type]}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="h-8 w-24 rounded-md border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 italic">
                            Assinatura
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {signatureConfig.expiresInDays && (
                  <p className="text-xs text-slate-400">
                    Validade: {signatureConfig.expiresInDays} dias
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
