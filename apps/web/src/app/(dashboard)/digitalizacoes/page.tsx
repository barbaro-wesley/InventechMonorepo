"use client";

import { useState } from "react";
import {
  Trash2,
  RefreshCw,
  ScanLine,
  Download,
  FileText,
  Image,
} from "lucide-react";
import { toast } from "sonner";
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
import { usePrinters } from "@/hooks/printers/use-printers";
import { scansService } from "@/services/printers/scans.service";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { Scan, ScanStatus } from "@/services/printers/scans.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />;
  return <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />;
}

function StatusBadge({ status, errorMsg }: { status: ScanStatus; errorMsg: string | null }) {
  if (status === "PROCESSED") {
    return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Processado</Badge>;
  }
  if (status === "ERROR") {
    return (
      <span title={errorMsg ?? undefined}>
        <Badge className="bg-red-100 text-red-700 border-0 text-xs cursor-help">Erro</Badge>
      </span>
    );
  }
  return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Pendente</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScansPage() {
  const [filterPrinter, setFilterPrinter] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [deleteScan, setDeleteScan] = useState<Scan | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const permissions = usePermissions();
  const canDelete = permissions.canSeeNav(["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"]);

  const queryParams = {
    ...(filterPrinter ? { printerId: filterPrinter } : {}),
    ...(filterStatus ? { status: filterStatus as ScanStatus } : {}),
    ...(filterFrom ? { from: filterFrom } : {}),
    ...(filterTo ? { to: filterTo } : {}),
  };

  const { data: scans = [], isLoading } = useScans(queryParams);
  const { data: printers = [] } = usePrinters();
  const remove = useDeleteScan();

  async function handleDownload(scan: Scan) {
    setDownloading(scan.id);
    try {
      const url = await scansService.getDownloadUrl(scan.id);
      window.open(url, "_blank");
    } catch {
      toast.error("Erro ao gerar link de download");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Digitalizações
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Arquivos recebidos pelas impressoras via SFTP.
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterPrinter || "all"} onValueChange={(v) => setFilterPrinter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 text-sm w-44">
            <SelectValue placeholder="Impressora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {printers.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 text-sm w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="PROCESSED">Processado</SelectItem>
            <SelectItem value="ERROR">Erro</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-9 text-sm w-36"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            title="Data inicial"
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="date"
            className="h-9 text-sm w-36"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            title="Data final"
          />
        </div>

        {(filterPrinter || filterStatus || filterFrom || filterTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setFilterPrinter("");
              setFilterStatus("");
              setFilterFrom("");
              setFilterTo("");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : scans.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-14 text-center">
          <ScanLine className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Nenhuma digitalização encontrada
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajuste os filtros ou aguarde novos scans chegarem.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead className="hidden sm:table-cell">Impressora</TableHead>
                <TableHead className="hidden lg:table-cell">Centro de Custo</TableHead>
                <TableHead className="hidden md:table-cell">Tamanho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((scan) => (
                <TableRow key={scan.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileIcon fileName={scan.fileName} />
                      <span className="font-mono text-xs truncate max-w-[180px]">{scan.fileName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {scan.printer.name}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {scan.printer.costCenter?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {formatBytes(scan.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={scan.status} errorMsg={scan.errorMsg} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {new Date(scan.scannedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Download"
                        disabled={downloading === scan.id}
                        onClick={() => handleDownload(scan)}
                      >
                        {downloading === scan.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
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
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {scans.length} digitalização(ões)
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteScan} onOpenChange={(o) => !o && setDeleteScan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover digitalização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteScan?.fileName}</strong>?
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
              {remove.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</>
                : "Remover"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
