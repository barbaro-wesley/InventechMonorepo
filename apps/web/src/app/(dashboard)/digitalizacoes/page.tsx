"use client";

import { useState, useEffect, useRef } from "react";
import {
  Trash2,
  RefreshCw,
  ScanLine,
  FileText,
  Image as ImageIcon,
  Search,
  X,
  ExternalLink,
  Filter,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Download,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useScans, useDeleteScan } from "@/hooks/printers/use-scans";
import { useScansSocket } from "@/hooks/printers/use-scans-socket";
import { usePrinters } from "@/hooks/printers/use-printers";
import { scansService } from "@/services/printers/scans.service";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { ScanViewerSheet } from "@/components/scans/scan-viewer-sheet";
import type { Scan, ScanStatus } from "@/services/printers/scans.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  return d.length === 11
    ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : cpf;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function FileTypeIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf")
    return (
      <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-red-500" />
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
      <ImageIcon className="w-4 h-4 text-blue-500" />
    </div>
  );
}

function StatusBadge({ status, errorMsg }: { status: ScanStatus; errorMsg: string | null }) {
  if (status === "PROCESSED")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        Processado
      </span>
    );
  if (status === "ERROR")
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200 cursor-help"
        title={errorMsg ?? undefined}
      >
        <AlertCircle className="w-3 h-3" />
        Erro
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
      <Clock className="w-3 h-3" />
      Pendente
    </span>
  );
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: "blue" | "emerald" | "amber" | "red";
  active?: boolean;
  onClick?: () => void;
}

const colorMap = {
  blue:    { bg: "bg-blue-50",    icon: "bg-blue-100 text-blue-600",    border: "border-blue-200",    text: "text-blue-700",    ring: "ring-blue-300" },
  emerald: { bg: "bg-emerald-50", icon: "bg-emerald-100 text-emerald-600", border: "border-emerald-200", text: "text-emerald-700", ring: "ring-emerald-300" },
  amber:   { bg: "bg-amber-50",   icon: "bg-amber-100 text-amber-600",   border: "border-amber-200",   text: "text-amber-700",   ring: "ring-amber-300" },
  red:     { bg: "bg-red-50",     icon: "bg-red-100 text-red-600",       border: "border-red-200",     text: "text-red-700",     ring: "ring-red-300" },
};

function StatCard({ label, value, icon: Icon, color, active, onClick }: StatCardProps) {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-200 group
        ${active
          ? `${c.bg} ${c.border} ring-2 ${c.ring} shadow-sm`
          : "bg-white border-border hover:border-gray-300 hover:shadow-sm"
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.icon}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {active && (
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${c.text}`}>
            Filtrado
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </button>
  );
}

// ─── Loading Skeleton Row ─────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[40, 24, 20, 20, 20, 16, 10].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-4 rounded bg-muted/60 animate-pulse"
            style={{ width: `${w}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScansPage() {
  const [search, setSearch] = useState("");
  const [filterPrinter, setFilterPrinter] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [deleteScan, setDeleteScan] = useState<Scan | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 400);

  const permissions = usePermissions();
  const canDelete = permissions.canSeeNav(["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"]);

  useScansSocket();

  const queryParams = {
    ...(filterPrinter ? { printerId: filterPrinter } : {}),
    ...(filterStatus ? { status: filterStatus as ScanStatus } : {}),
    ...(debouncedSearch.trim().length >= 2 ? { search: debouncedSearch.trim() } : {}),
  };

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useScans(queryParams);

  // Stats sem filtros
  const { data: allData } = useScans({});

  const scans = data?.scans ?? [];
  const allScans = allData?.scans ?? [];
  const { data: printers = [] } = usePrinters();
  const remove = useDeleteScan();

  const hasActiveFilters = filterPrinter || filterStatus;

  const totalProcessed = allScans.filter((s) => s.status === "PROCESSED").length;
  const totalPending   = allScans.filter((s) => s.status === "PENDING").length;
  const totalError     = allScans.filter((s) => s.status === "ERROR").length;

  function clearFilters() {
    setFilterPrinter("");
    setFilterStatus("");
  }

  function toggleStatusFilter(status: ScanStatus) {
    setFilterStatus((prev) => (prev === status ? "" : status));
  }

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { threshold: 0.5 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Digitalizações
            </h1>
          </div>
          <p className="text-sm text-muted-foreground pl-10">
            Documentos recebidos pelas impressoras via SFTP com extração OCR automática.
          </p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total carregado"
          value={allScans.length}
          icon={LayoutGrid}
          color="blue"
        />
        <StatCard
          label="Processados"
          value={totalProcessed}
          icon={CheckCircle2}
          color="emerald"
          active={filterStatus === "PROCESSED"}
          onClick={() => toggleStatusFilter("PROCESSED")}
        />
        <StatCard
          label="Pendentes"
          value={totalPending}
          icon={Clock}
          color="amber"
          active={filterStatus === "PENDING"}
          onClick={() => toggleStatusFilter("PENDING")}
        />
        <StatCard
          label="Com erro"
          value={totalError}
          icon={AlertCircle}
          color="red"
          active={filterStatus === "ERROR"}
          onClick={() => toggleStatusFilter("ERROR")}
        />
      </div>

      {/* ── Search + Filters ── */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              id="scan-search"
              placeholder="Buscar por paciente, CPF, prontuário ou nº atendimento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-10 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors rounded-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters inline */}
          <div className="flex gap-2 flex-shrink-0">
            <Select value={filterPrinter || "all"} onValueChange={(v) => setFilterPrinter(v === "all" ? "" : v)}>
              <SelectTrigger id="filter-printer" className="h-10 text-sm w-44">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Impressora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as impressoras</SelectItem>
                {printers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {search.trim().length === 1 && (
          <p className="text-xs text-muted-foreground pl-1 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
            Digite pelo menos 2 caracteres para buscar.
          </p>
        )}
      </div>

      {/* ── Table Area ── */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Documento / Paciente", "CPF", "Prontuário", "Origem", "Data", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      ) : scans.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <ScanLine className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {debouncedSearch ? "Nenhum resultado encontrado" : "Nenhuma digitalização"}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
            {debouncedSearch
              ? `Não encontramos resultados para "${debouncedSearch}". Tente outros termos.`
              : "Ajuste os filtros ou aguarde novos documentos chegarem via SFTP."}
          </p>
          {(debouncedSearch || hasActiveFilters) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs"
              onClick={() => { setSearch(""); clearFilters(); }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Documento / Paciente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    CPF
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Prontuário
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Nº Atendimento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Origem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scans.map((scan) => {
                  const dt = formatDateTime(scan.scannedAt);
                  const hasPatient = !!scan.metadata?.paciente;
                  return (
                    <tr
                      key={scan.id}
                      onClick={() => setSelectedScan(scan)}
                      className="group hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer"
                    >
                      {/* Documento / Paciente */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <FileTypeIcon fileName={scan.fileName} />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold leading-tight truncate max-w-[200px] ${hasPatient ? "text-foreground" : "text-muted-foreground italic"}`}>
                              {scan.metadata?.paciente ?? "Paciente não identificado"}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                              {scan.fileName}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-sm tabular-nums text-foreground/80">
                          {formatCpf(scan.metadata?.cpf)}
                        </span>
                      </td>

                      {/* Prontuário */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className={`text-sm font-mono ${scan.metadata?.prontuario ? "text-foreground/80" : "text-muted-foreground/40"}`}>
                          {scan.metadata?.prontuario ?? "—"}
                        </span>
                      </td>

                      {/* Nº Atendimento */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className={`text-sm font-mono ${scan.metadata?.numeroAtendimento ? "text-foreground/80" : "text-muted-foreground/40"}`}>
                          {scan.metadata?.numeroAtendimento ?? "—"}
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <p className="text-sm font-medium text-foreground/80 leading-tight">
                          {scan.printer.name}
                        </p>
                        {scan.printer.costCenter && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {scan.printer.costCenter.name}
                          </p>
                        )}
                      </td>

                      {/* Data */}
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        <p className="text-sm tabular-nums text-foreground/80">{dt.date}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{dt.time}</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={scan.status} errorMsg={scan.errorMsg} />
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {scan.status === "PROCESSED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 opacity-0 group-hover:opacity-100 transition-all"
                              title="Baixar PDF"
                              onClick={() => window.open(scansService.getDownloadUrl(scan.id), "_blank")}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">PDF</span>
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                              title="Excluir digitalização"
                              onClick={() => setDeleteScan(scan)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{scans.length}</span> digitalização(ões) exibida(s)
                {hasNextPage && " · Role para carregar mais"}
              </span>
            </div>
            {isFetchingNextPage && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Carregando mais...
              </span>
            )}
          </div>

          {/* Sentinel */}
          <div ref={loadMoreRef} className="h-1" />
        </div>
      )}

      {/* ── Viewer Sheet ── */}
      <ScanViewerSheet
        scan={selectedScan}
        onClose={() => setSelectedScan(null)}
      />

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteScan} onOpenChange={(o) => !o && setDeleteScan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover digitalização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{" "}
              <strong>{deleteScan?.metadata?.paciente ?? deleteScan?.fileName}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() =>
                deleteScan &&
                remove.mutate(deleteScan.id, { onSuccess: () => setDeleteScan(null) })
              }
            >
              {remove.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
