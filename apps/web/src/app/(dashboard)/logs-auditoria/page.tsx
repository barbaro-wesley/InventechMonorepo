"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Globe,
  RefreshCw,
  Search,
  Filter,
  Unlock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  useAuditStats,
  useLoginAttempts,
  useAccountBlocks,
  useUnblockUser,
} from "@/hooks/audit/use-audit";
import type { AccountBlock } from "@/services/audit/audit.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGeo(
  country: string | null,
  city: string | null,
  region: string | null
) {
  if (!country) return "—";
  const parts = [city, region, country].filter(Boolean);
  return parts.join(", ");
}

function shortUA(ua: string | null) {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30);
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color + "20" }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "attempts" | "blocks";

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [tab, setTab] = useState<Tab>("attempts");

  // Attempts filters
  const [attemptSearch, setAttemptSearch] = useState("");
  const [attemptSuccess, setAttemptSuccess] = useState<
    "all" | "true" | "false"
  >("all");
  const [attemptPage, setAttemptPage] = useState(1);

  // Blocks filters
  const [blockActiveOnly, setBlockActiveOnly] = useState(false);
  const [blockPage, setBlockPage] = useState(1);

  // Unblock dialog
  const [unblockTarget, setUnblockTarget] = useState<AccountBlock | null>(null);

  const { data: stats, isLoading: statsLoading } = useAuditStats();

  const { data: attempts, isLoading: attemptsLoading } = useLoginAttempts({
    page: attemptPage,
    limit: 20,
    search: attemptSearch || undefined,
    success:
      attemptSuccess === "all"
        ? undefined
        : attemptSuccess === "true"
          ? true
          : false,
  });

  const { data: blocks, isLoading: blocksLoading } = useAccountBlocks({
    page: blockPage,
    limit: 20,
    activeOnly: blockActiveOnly || undefined,
  });

  const unblockMutation = useUnblockUser();

  function handleUnblock() {
    if (!unblockTarget) return;
    unblockMutation.mutate(unblockTarget.user.id, {
      onSuccess: () => setUnblockTarget(null),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Logs de Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoramento de tentativas de login e bloqueios de conta
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Globe}
          label="Tentativas hoje"
          value={statsLoading ? "—" : (stats?.today.total ?? 0)}
          color="#6366f1"
        />
        <StatCard
          icon={CheckCircle}
          label="Logins bem-sucedidos"
          value={statsLoading ? "—" : (stats?.today.success ?? 0)}
          color="#22c55e"
        />
        <StatCard
          icon={XCircle}
          label="Tentativas falhas hoje"
          value={statsLoading ? "—" : (stats?.today.failed ?? 0)}
          color="#ef4444"
        />
        <StatCard
          icon={ShieldX}
          label="Contas bloqueadas"
          value={statsLoading ? "—" : (stats?.activeBlocks ?? 0)}
          color="#f97316"
        />
      </div>

      {/* Top IPs panel */}
      {stats && stats.topFailedIps.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            IPs com mais falhas (7 dias)
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.topFailedIps.map((item) => (
              <div
                key={item.ip}
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-sm font-mono text-red-700">{item.ip}</span>
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  {item.count}x
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("attempts")}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors"
            style={{
              color: tab === "attempts" ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: tab === "attempts" ? "2px solid var(--primary)" : "2px solid transparent",
            }}
          >
            <ShieldAlert className="w-4 h-4" />
            Tentativas de Login
          </button>
          <button
            onClick={() => setTab("blocks")}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors"
            style={{
              color: tab === "blocks" ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: tab === "blocks" ? "2px solid var(--primary)" : "2px solid transparent",
            }}
          >
            <ShieldX className="w-4 h-4" />
            Bloqueios de Conta
          </button>
        </div>

        {/* ── Tentativas de Login ── */}
        {tab === "attempts" && (
          <div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por email, IP ou cidade..."
                  value={attemptSearch}
                  onChange={(e) => {
                    setAttemptSearch(e.target.value);
                    setAttemptPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <select
                  value={attemptSuccess}
                  onChange={(e) => {
                    setAttemptSuccess(e.target.value as "all" | "true" | "false");
                    setAttemptPage(1);
                  }}
                  className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ color: "var(--foreground)" }}
                >
                  <option value="all">Todos</option>
                  <option value="true">Sucesso</option>
                  <option value="false">Falhas</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Email / Usuário
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      IP
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Localização
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Motivo da falha
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Navegador
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Data/Hora
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attemptsLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50 animate-pulse">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-muted rounded w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : attempts?.data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground text-sm"
                      >
                        Nenhuma tentativa encontrada.
                      </td>
                    </tr>
                  ) : (
                    attempts?.data.map((attempt) => (
                      <tr
                        key={attempt.id}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {attempt.success ? (
                            <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Sucesso
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                              <ShieldX className="w-3 h-3 mr-1" />
                              Falha
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className="font-medium text-sm"
                            style={{ color: "var(--foreground)" }}
                          >
                            {attempt.email}
                          </p>
                          {attempt.user && (
                            <p className="text-xs text-muted-foreground">
                              {attempt.user.name}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                            {attempt.ipAddress}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatGeo(attempt.country, attempt.city, attempt.region)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {attempt.failReason ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {shortUA(attempt.userAgent)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(attempt.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {attempts && attempts.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {attempts.pagination.total} registros · Página{" "}
                  {attempts.pagination.page} de {attempts.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!attempts.pagination.hasPrevPage}
                    onClick={() => setAttemptPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!attempts.pagination.hasNextPage}
                    onClick={() => setAttemptPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Bloqueios de Conta ── */}
        {tab === "blocks" && (
          <div>
            {/* Filters */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                <input
                  type="checkbox"
                  checked={blockActiveOnly}
                  onChange={(e) => {
                    setBlockActiveOnly(e.target.checked);
                    setBlockPage(1);
                  }}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span style={{ color: "var(--foreground)" }}>
                  Somente bloqueios ativos
                </span>
              </label>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Usuário
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      IP
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Motivo
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Bloqueado em
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Expira em
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {blocksLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50 animate-pulse">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-muted rounded w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : blocks?.data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground text-sm"
                      >
                        Nenhum bloqueio encontrado.
                      </td>
                    </tr>
                  ) : (
                    blocks?.data.map((block) => {
                      const isActive =
                        !block.unblocked && new Date(block.expiresAt) > new Date();
                      return (
                        <tr
                          key={block.id}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            {isActive ? (
                              <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Expirado
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className="font-medium text-sm"
                              style={{ color: "var(--foreground)" }}
                            >
                              {block.user.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {block.user.email}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                              {block.ipAddress}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                            {block.reason}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(block.blockedAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(block.expiresAt)}
                          </td>
                          <td className="px-4 py-3">
                            {isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setUnblockTarget(block)}
                              >
                                <Unlock className="w-3 h-3 mr-1" />
                                Desbloquear
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {blocks && blocks.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {blocks.pagination.total} registros · Página{" "}
                  {blocks.pagination.page} de {blocks.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!blocks.pagination.hasPrevPage}
                    onClick={() => setBlockPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!blocks.pagination.hasNextPage}
                    onClick={() => setBlockPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unblock confirmation */}
      <AlertDialog
        open={!!unblockTarget}
        onOpenChange={(open) => !open && setUnblockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desbloquear a conta de{" "}
              <strong>{unblockTarget?.user.name}</strong> (
              {unblockTarget?.user.email})? O usuário poderá fazer login
              imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnblock}
              disabled={unblockMutation.isPending}
            >
              {unblockMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Desbloqueando...
                </>
              ) : (
                "Desbloquear"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
