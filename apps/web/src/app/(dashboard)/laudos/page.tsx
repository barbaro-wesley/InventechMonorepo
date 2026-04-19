"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { FileText, Search, Loader2, Plus, Eye } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LaudoReferenceType } from "@/services/laudo-templates/laudo-templates.types";
import { REFERENCE_TYPE_LABELS } from "@/services/laudo-templates/laudo-templates.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type LaudoStatus = "DRAFT" | "PENDING_REVIEW" | "PENDING_SIGNATURE" | "SIGNED" | "APPROVED" | "CANCELLED";

const STATUS_CONFIG: Record<LaudoStatus, { label: string; className: string }> = {
  DRAFT:              { label: "Rascunho",           className: "bg-slate-100 text-slate-600 border-slate-200" },
  PENDING_REVIEW:     { label: "Aguardando revisão", className: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_SIGNATURE:  { label: "Aguardando assinatura", className: "bg-blue-50 text-blue-700 border-blue-200" },
  SIGNED:             { label: "Assinado",           className: "bg-violet-50 text-violet-700 border-violet-200" },
  APPROVED:           { label: "Aprovado",           className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED:          { label: "Cancelado",          className: "bg-rose-50 text-rose-600 border-rose-200" },
};

const REFERENCE_TYPE_ACCENT: Record<LaudoReferenceType, string> = {
  MAINTENANCE:   "bg-blue-500",
  SERVICE_ORDER: "bg-violet-500",
  CUSTOM:        "bg-slate-400",
};

interface LaudoItem {
  id: string;
  number: number;
  title: string;
  status: LaudoStatus;
  referenceType: LaudoReferenceType;
  createdAt: string;
  client?: { id: string; name: string } | null;
  template?: { id: string; title: string } | null;
  createdBy?: { id: string; name: string } | null;
  technician?: { id: string; name: string } | null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse">
      <div className="w-1 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
      </div>
      <div className="h-6 w-24 bg-slate-100 dark:bg-slate-800 rounded-full" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LaudosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LaudoStatus | "ALL">("ALL");
  const [refTypeFilter, setRefTypeFilter] = useState<LaudoReferenceType | "ALL">("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["laudos", "list", { search, statusFilter, refTypeFilter }],
    queryFn: async () => {
      const params: Record<string, any> = { limit: 50 };
      if (search) params.search = search;
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (refTypeFilter !== "ALL") params.referenceType = refTypeFilter;
      const { data } = await api.get("/laudos", { params });
      return data as { data: LaudoItem[]; total: number };
    },
  });

  const laudos = data?.data ?? [];
  const total = data?.total ?? 0;

  const STATUS_FILTERS: (LaudoStatus | "ALL")[] = [
    "ALL", "DRAFT", "PENDING_REVIEW", "PENDING_SIGNATURE", "SIGNED", "APPROVED",
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-500/25">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              Laudos Técnicos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isLoading
                ? "Carregando..."
                : `${total} laudo${total !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar por título..."
              className="pl-9 bg-white dark:bg-slate-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {(["ALL", "MAINTENANCE", "SERVICE_ORDER", "CUSTOM"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRefTypeFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  refTypeFilter === f
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent"
                    : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                )}
              >
                {f === "ALL" ? "Todos" : REFERENCE_TYPE_LABELS[f as LaudoReferenceType]}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const cfg = f !== "ALL" ? STATUS_CONFIG[f] : null;
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs border transition-all",
                  statusFilter === f
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent"
                    : cfg
                    ? cn(cfg.className, "hover:opacity-80")
                    : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                )}
              >
                {f === "ALL" ? "Todos os status" : cfg?.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : laudos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Nenhum laudo encontrado
          </h3>
          <p className="text-sm text-slate-400 max-w-xs">
            {search || statusFilter !== "ALL" || refTypeFilter !== "ALL"
              ? "Tente ajustar os filtros."
              : "Os laudos criados nas ordens de serviço aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {laudos.map((laudo) => {
            const statusCfg = STATUS_CONFIG[laudo.status];
            return (
              <div
                key={laudo.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all"
              >
                {/* Accent bar */}
                <div className={cn("w-1 h-10 rounded-full flex-shrink-0", REFERENCE_TYPE_ACCENT[laudo.referenceType])} />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 flex-shrink-0">#{laudo.number}</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {laudo.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {laudo.template && (
                      <span className="text-xs text-slate-400 truncate">
                        {laudo.template.title}
                      </span>
                    )}
                    {laudo.client && (
                      <span className="text-xs text-slate-400">
                        · {laudo.client.name}
                      </span>
                    )}
                    {laudo.technician && (
                      <span className="text-xs text-slate-400">
                        · Téc: {laudo.technician.name}
                      </span>
                    )}
                    <span className="text-xs text-slate-300">
                      {new Date(laudo.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn("text-xs flex-shrink-0 hidden sm:inline-flex", statusCfg.className)}
                >
                  {statusCfg.label}
                </Badge>

                {/* Reference type badge */}
                <Badge
                  variant="outline"
                  className="text-xs flex-shrink-0 hidden md:inline-flex"
                >
                  {REFERENCE_TYPE_LABELS[laudo.referenceType]}
                </Badge>

                {/* Action */}
                <Link
                  href={`/laudos/${laudo.id}`}
                  className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Ver laudo"
                >
                  <Eye className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
