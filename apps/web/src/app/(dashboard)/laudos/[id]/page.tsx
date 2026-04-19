"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  FileText, ArrowLeft, CheckCircle2, XCircle, Loader2,
  Download, User, Building2, Calendar, Hash, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { LaudoFieldDefinition, LaudoReferenceType } from "@/services/laudo-templates/laudo-templates.types";
import { REFERENCE_TYPE_LABELS } from "@/services/laudo-templates/laudo-templates.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type LaudoStatus = "DRAFT" | "PENDING_REVIEW" | "PENDING_SIGNATURE" | "SIGNED" | "APPROVED" | "CANCELLED";

const STATUS_CONFIG: Record<LaudoStatus, { label: string; className: string }> = {
  DRAFT:             { label: "Rascunho",              className: "bg-slate-100 text-slate-600 border-slate-200" },
  PENDING_REVIEW:    { label: "Aguardando revisão",    className: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_SIGNATURE: { label: "Aguardando assinatura", className: "bg-blue-50 text-blue-700 border-blue-200" },
  SIGNED:            { label: "Assinado",              className: "bg-violet-50 text-violet-700 border-violet-200" },
  APPROVED:          { label: "Aprovado",              className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED:         { label: "Cancelado",             className: "bg-rose-50 text-rose-600 border-rose-200" },
};

interface LaudoDetail {
  id: string;
  number: number;
  title: string;
  status: LaudoStatus;
  referenceType: LaudoReferenceType;
  fields: (LaudoFieldDefinition & { value?: any })[];
  notes?: string | null;
  pdfUrl?: string | null;
  serviceOrderId?: string | null;
  maintenanceId?: string | null;
  templateId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  signedAt?: string | null;
  client?: { id: string; name: string } | null;
  template?: { id: string; title: string } | null;
  createdBy?: { id: string; name: string } | null;
  technician?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  serviceOrder?: { id: string; number: number; title: string } | null;
}

// ─── Field value renderer ─────────────────────────────────────────────────────

function FieldValue({ field }: { field: LaudoFieldDefinition & { value?: any } }) {
  if (field.type === "HEADING") {
    return (
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-1 col-span-2">
        {field.label}
      </h3>
    );
  }
  if (field.type === "DIVIDER") {
    return <hr className="border-slate-200 dark:border-slate-700 col-span-2 my-1" />;
  }

  const value = field.value;
  const isEmpty = value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0);

  return (
    <div className={cn("space-y-0.5", field.width === "half" ? "" : "col-span-2 sm:col-span-1")}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {field.label}
        {field.required && <span className="text-rose-400 ml-0.5">*</span>}
      </p>
      {isEmpty ? (
        <p className="text-sm text-slate-300 dark:text-slate-600 italic">Não preenchido</p>
      ) : field.type === "CHECKBOX" ? (
        <p className="text-sm text-slate-800 dark:text-slate-200">{value ? "Sim" : "Não"}</p>
      ) : field.type === "MULTI_SELECT" ? (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(value) ? value : []).map((v: string) => (
            <span key={v} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
              {v}
            </span>
          ))}
        </div>
      ) : field.type === "TABLE" ? (
        <TableView value={value} field={field} />
      ) : (
        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{String(value)}</p>
      )}
    </div>
  );
}

function TableView({ value, field }: { value: any; field: LaudoFieldDefinition }) {
  const cols = field.tableColumns ?? [];
  const rows: Record<string, string>[] = Array.isArray(value) ? value : [];
  if (cols.length === 0 || rows.length === 0) return <p className="text-sm text-slate-300 italic">Sem dados</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              {cols.map((c) => (
                <td key={c.key} className="px-3 py-2 text-slate-700 dark:text-slate-300">{row[c.key] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LaudoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const permissions = usePermissions();

  const { data: laudo, isLoading } = useQuery({
    queryKey: ["laudos", id],
    queryFn: async () => {
      const { data } = await api.get(`/laudos/${id}`);
      return data as LaudoDetail;
    },
  });

  const mutate = (action: string, permission: string) =>
    useMutation({
      mutationFn: () => api.post(`/laudos/${id}/${action}`),
      onSuccess: () => {
        toast.success(
          action === "approve" ? "Laudo aprovado!" :
          action === "submit"  ? "Enviado para revisão!" :
          "Laudo cancelado."
        );
        qc.invalidateQueries({ queryKey: ["laudos"] });
      },
      onError: () => toast.error("Erro ao atualizar o laudo."),
    });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/laudos/${id}/approve`),
    onSuccess: () => {
      toast.success("Laudo aprovado!");
      qc.invalidateQueries({ queryKey: ["laudos"] });
    },
    onError: () => toast.error("Erro ao aprovar o laudo."),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/laudos/${id}/cancel`),
    onSuccess: () => {
      toast.success("Laudo cancelado.");
      qc.invalidateQueries({ queryKey: ["laudos"] });
      router.push("/laudos");
    },
    onError: () => toast.error("Erro ao cancelar o laudo."),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/laudos/${id}/submit`),
    onSuccess: () => {
      toast.success("Enviado para revisão!");
      qc.invalidateQueries({ queryKey: ["laudos"] });
    },
    onError: () => toast.error("Erro ao enviar para revisão."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!laudo) {
    return (
      <div className="flex flex-col items-center py-24">
        <p className="text-sm text-slate-500">Laudo não encontrado.</p>
        <Link href="/laudos" className="mt-4 text-sm text-blue-600 hover:underline">← Voltar</Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[laudo.status];
  const canApprove  = permissions.canAccess("laudo", "approve") || permissions.isManager;
  const canCancel   = permissions.isManager || permissions.canAccess("laudo", "update");
  const canExportPdf = permissions.canAccess("laudo", "export-pdf") || permissions.isManager || permissions.isClientAdmin;
  const isPending   = laudo.status === "PENDING_REVIEW";
  const isDraft     = laudo.status === "DRAFT";

  const visibleFields = laudo.fields?.filter(
    (f) => f.type !== "HEADING" && f.type !== "DIVIDER"
  ) ?? [];
  const allFields = laudo.fields ?? [];

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/laudos" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Laudos Técnicos
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 dark:text-slate-200">#{laudo.number}</span>
      </div>

      {/* ── Header card ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">#{laudo.number}</span>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {laudo.title}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={cn("text-xs", statusCfg.className)}>
                  {statusCfg.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {REFERENCE_TYPE_LABELS[laudo.referenceType]}
                </Badge>
                {laudo.template && (
                  <span className="text-xs text-slate-400">{laudo.template.title}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {canExportPdf && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"}/laudos/${id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar PDF
                </a>
              </Button>
            )}
            {isDraft && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Enviar para revisão
              </Button>
            )}
            {isPending && canApprove && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                Aprovar laudo
              </Button>
            )}
            {(isDraft || isPending) && canCancel && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 text-rose-600 hover:text-rose-700 border-rose-200 hover:border-rose-300 hover:bg-rose-50"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <XCircle className="w-3.5 h-3.5" />}
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* ── Meta info ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {laudo.client && (
            <div className="space-y-0.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Prestador
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{laudo.client.name}</p>
            </div>
          )}
          {laudo.technician && (
            <div className="space-y-0.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" /> Técnico
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{laudo.technician.name}</p>
            </div>
          )}
          {laudo.serviceOrder && (
            <div className="space-y-0.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Ordem de Serviço
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                OS #{laudo.serviceOrder.number}
              </p>
            </div>
          )}
          <div className="space-y-0.5">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Criado em
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {new Date(laudo.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          {laudo.approvedBy && laudo.approvedAt && (
            <div className="space-y-0.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Aprovado por
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {laudo.approvedBy.name}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Fields ── */}
      {allFields.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Campos do Laudo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {allFields.map((field, idx) => (
              <FieldValue key={field.id || idx} field={field} />
            ))}
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {laudo.notes && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Observações
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{laudo.notes}</p>
        </div>
      )}
    </div>
  );
}
