"use client";

import { useState, useMemo } from "react";
import {
  Trash2,
  RefreshCw,
  ScanLine,
  FileText,
  Image,
  Search,
  X,
  ExternalLink,
  ChevronDown,
  Filter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { Scan, ScanStatus } from "@/services/printers/scans.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(str: string | null | undefined): string {
  return (str ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  const d = cpf.replace(/\D/g, "");
  return d.length === 11
    ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : cpf;
}

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  return <Image className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
}

function StatusBadge({ status, errorMsg }: { status: ScanStatus; errorMsg: string | null }) {
  if (status === "PROCESSED")
    return <Badge className="bg-green-100 text-green-700 border-0 text-xs font-medium">Processado</Badge>;
  if (status === "ERROR")
    return (
      <span title={errorMsg ?? undefined}>
        <Badge className="bg-red-100 text-red-700 border-0 text-xs font-medium cursor-help">Erro</Badge>
      </span>
    );
  return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs font-medium">Pendente</Badge>;
}

function NullCell({ children }: { children: React.ReactNode }) {
  if (children) return <>{children}</>;
  return <span className="text-muted-foreground/50 text-xs italic">—</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScansPage() {
  const [search, setSearch] = useState("");
  const [filterPrinter, setFilterPrinter] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteScan, setDeleteScan] = useState<Scan | null>(null);

  const permissions = usePermissions();
  const canDelete = permissions.canSeeNav(["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"]);

  // Escuta eventos em tempo real e invalida a lista automaticamente
  useScansSocket();

  const queryParams = {
    ...(filterPrinter ? { printerId: filterPrinter } : {}),
    ...(filterStatus ? { status: filterStatus as ScanStatus } : {}),
    ...(filterFrom ? { from: filterFrom } : {}),
    ...(filterTo ? { to: filterTo } : {}),
  };

  const { data: scans = [], isLoading } = useScans(queryParams);
  const { data: printers = [] } = usePrinters();
  const remove = useDeleteScan();

  const filtered = useMemo(() => {
    if (!search.trim()) return scans;
    const q = normalize(search);
    return scans.filter((s) =>
      normalize(s.fileName).includes(q) ||
      normalize(s.metadata?.paciente).includes(q) ||
      normalize(s.metadata?.cpf).includes(q) ||
      normalize(s.metadata?.prontuario).includes(q) ||
      normalize(s.metadata?.numeroAtendimento).includes(q) ||
      normalize(s.printer.name).includes(q) ||
      normalize(s.printer.costCenter?.name).includes(q)
    );
  }, [scans, search]);

  const hasActiveFilters = filterPrinter || filterStatus || filterFrom || filterTo;

  function clearFilters() {
    setFilterPrinter("");
    setFilterStatus("");
    setFilterFrom("");
    setFilterTo("");
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Digitalizações
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Documentos recebidos pelas impressoras via SFTP com dados extraídos por OCR.
        </p>
      </div>

      {/* ── Search + Filters ── */}
      <div className="space-y-2">
        {/* Busca principal */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por paciente, CPF, prontuário, nº atendimento, arquivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10 bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtros avançados */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros avançados
            {hasActiveFilters && (
              <Badge className="ml-1 bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0 h-4">
                {[filterPrinter, filterStatus, filterFrom, filterTo].filter(Boolean).length}
              </Badge>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap gap-2">
            <Select value={filterPrinter || "all"} onValueChange={(v) => setFilterPrinter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm w-48 bg-white">
                <SelectValue placeholder="Impressora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as impressoras</SelectItem>
                {printers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm w-40 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="PROCESSED">Processado</SelectItem>
                <SelectItem value="ERROR">Erro</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                className="h-9 text-sm w-36 bg-white"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                title="Data inicial"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                className="h-9 text-sm w-36 bg-white"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                title="Data final"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-lg border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-16 text-center">
          <ScanLine className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {search ? "Nenhum resultado para a busca" : "Nenhuma digitalização encontrada"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search
              ? `Sem resultados para "${search}". Tente outros termos.`
              : "Ajuste os filtros ou aguarde novos scans chegarem."}
          </p>
          {search && (
            <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={() => setSearch("")}>
              Limpar busca
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[220px]">Paciente</TableHead>
                  <TableHead className="hidden md:table-cell w-[130px]">CPF</TableHead>
                  <TableHead className="hidden lg:table-cell w-[120px]">Prontuário</TableHead>
                  <TableHead className="hidden lg:table-cell w-[120px]">Nº Atendimento</TableHead>
                  <TableHead className="hidden sm:table-cell">Origem</TableHead>
                  <TableHead className="hidden xl:table-cell w-[100px]">Data</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="text-right w-[80px]">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((scan) => (
                  <TableRow key={scan.id} className="hover:bg-muted/20 group">
                    {/* Paciente + arquivo */}
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm leading-tight">
                          <NullCell>{scan.metadata?.paciente}</NullCell>
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <FileIcon fileName={scan.fileName} />
                          <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[170px]">
                            {scan.fileName}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* CPF */}
                    <TableCell className="hidden md:table-cell text-sm tabular-nums">
                      <NullCell>{formatCpf(scan.metadata?.cpf)}</NullCell>
                    </TableCell>

                    {/* Prontuário */}
                    <TableCell className="hidden lg:table-cell text-sm font-mono">
                      <NullCell>{scan.metadata?.prontuario}</NullCell>
                    </TableCell>

                    {/* Nº Atendimento */}
                    <TableCell className="hidden lg:table-cell text-sm font-mono">
                      <NullCell>{scan.metadata?.numeroAtendimento}</NullCell>
                    </TableCell>

                    {/* Origem: impressora + centro de custo */}
                    <TableCell className="hidden sm:table-cell">
                      <p className="text-sm leading-tight">{scan.printer.name}</p>
                      {scan.printer.costCenter && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {scan.printer.costCenter.name}
                        </p>
                      )}
                    </TableCell>

                    {/* Data */}
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground tabular-nums">
                      {new Date(scan.scannedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                      <br />
                      <span className="text-[10px]">
                        {new Date(scan.scannedAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <StatusBadge status={scan.status} errorMsg={scan.errorMsg} />
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {scan.status === "PROCESSED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            title="Abrir PDF"
                            onClick={() => window.open(scansService.getDownloadUrl(scan.id), "_blank")}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">PDF</span>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Excluir"
                            onClick={() => setDeleteScan(scan)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length === scans.length
                ? `${scans.length} digitalização(ões)`
                : `${filtered.length} de ${scans.length} digitalização(ões)`}
            </span>
            {search && filtered.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Buscando por <strong>&quot;{search}&quot;</strong>
              </span>
            )}
          </div>
        </div>
      )}

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
