"use client";

import { useState } from "react";
import {
  CalendarClock,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMaintenanceSchedules,
  useToggleSchedule,
} from "@/hooks/maintenance/use-maintenance-schedule";
import { useCurrentUser } from "@/store/auth.store";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { MaintenanceSchedule } from "@/services/maintenance/maintenance-schedule.service";

// ─── Labels ──────────────────────────────────────────────────────────────────

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM: "Personalizada",
};

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: "Preventiva",
  CORRECTIVE: "Corretiva",
  INITIAL_ACCEPTANCE: "Aceitação Inicial",
  EXTERNAL_SERVICE: "Serviço Externo",
  TECHNOVIGILANCE: "Tecnovigilância",
  TRAINING: "Treinamento",
  IMPROPER_USE: "Uso Indevido",
  DEACTIVATION: "Desativação",
};

// ─── Status helpers ───────────────────────────────────────────────────────────

type ScheduleStatus = "overdue" | "due_soon" | "active" | "inactive";

function getScheduleStatus(s: MaintenanceSchedule): ScheduleStatus {
  if (!s.isActive) return "inactive";
  const next = new Date(s.nextRunAt);
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (next < now) return "overdue";
  if (next <= sevenDays) return "due_soon";
  return "active";
}

function StatusBadge({ schedule }: { schedule: MaintenanceSchedule }) {
  const status = getScheduleStatus(schedule);
  const configs = {
    overdue: {
      label: "Vencido",
      className: "bg-red-100 text-red-700 border-red-200",
      Icon: AlertTriangle,
    },
    due_soon: {
      label: "Esta semana",
      className: "bg-amber-100 text-amber-700 border-amber-200",
      Icon: Clock,
    },
    active: {
      label: "Em dia",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Icon: CheckCircle2,
    },
    inactive: {
      label: "Inativo",
      className: "bg-gray-100 text-gray-500 border-gray-200",
      Icon: XCircle,
    },
  };
  const { label, className, Icon } = configs[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${className}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-white dark:bg-slate-900 p-4 flex flex-col gap-1 ${className ?? ""}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PrevenTivasPage() {
  const currentUser = useCurrentUser();
  const isCompanyLevel = !currentUser?.clientId;
  const { isManager } = usePermissions();

  const [search, setSearch] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const isActiveFilter =
    statusFilter === "inactive"
      ? false
      : statusFilter === "active" || statusFilter === "overdue" || statusFilter === "due_soon"
      ? true
      : undefined;

  const { data, isLoading, refetch, isFetching } = useMaintenanceSchedules({
    search: search || undefined,
    recurrenceType: recurrenceType as any,
    isActive: isActiveFilter,
    page,
    limit: LIMIT,
  });

  const toggle = useToggleSchedule();

  const schedules: MaintenanceSchedule[] = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? Math.ceil(total / LIMIT);

  // Client-side status filter for overdue/due_soon (since backend doesn't have that concept)
  const filtered =
    statusFilter === "overdue"
      ? schedules.filter((s) => getScheduleStatus(s) === "overdue")
      : statusFilter === "due_soon"
      ? schedules.filter((s) => getScheduleStatus(s) === "due_soon")
      : schedules;

  // Stats (from full result)
  const overdue = schedules.filter((s) => getScheduleStatus(s) === "overdue").length;
  const dueSoon = schedules.filter((s) => getScheduleStatus(s) === "due_soon").length;
  const active = schedules.filter((s) => s.isActive).length;
  const inactive = schedules.filter((s) => !s.isActive).length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }}
          >
            <CalendarClock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Preventivas (PMOC)</h1>
            <p className="text-xs text-muted-foreground">
              Plano de Manutenção, Operação e Controle
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Ativos" value={active} />
        <StatCard
          label="Vencidos"
          value={overdue}
          className={overdue > 0 ? "border-red-200 dark:border-red-900" : ""}
        />
        <StatCard
          label="Esta semana"
          value={dueSoon}
          className={dueSoon > 0 ? "border-amber-200 dark:border-amber-900" : ""}
        />
        <StatCard label="Inativos" value={inactive} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título, equipamento…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={recurrenceType ?? "all"}
          onValueChange={(v) => {
            setRecurrenceType(v === "all" ? undefined : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Recorrência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as recorrências</SelectItem>
            {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter ?? "all"}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? undefined : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Em dia</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
            <SelectItem value="due_soon">Esta semana</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden">

        {/* Mobile card list */}
        <div className="sm:hidden">
          {isLoading ? (
            <p className="px-4 py-12 text-center text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-muted-foreground">Nenhum agendamento encontrado.</p>
          ) : (
            <div className="divide-y">
              {filtered.map((s) => (
                <div key={s.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.equipment.name}{s.equipment.brand ? ` · ${s.equipment.brand}` : ""}
                      </p>
                      {isCompanyLevel && s.client?.name && (
                        <p className="text-xs text-muted-foreground">{s.client.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <StatusBadge schedule={s} />
                      {isManager && (
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ id: s.id, isActive: !s.isActive })}
                          title={s.isActive ? "Desativar" : "Ativar"}
                        >
                          {s.isActive
                            ? <PowerOff className="w-3.5 h-3.5 text-muted-foreground" />
                            : <Power className="w-3.5 h-3.5 text-emerald-600" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {s.group && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: s.group.color ? `${s.group.color}20` : undefined,
                          color: s.group.color ?? undefined,
                          border: `1px solid ${s.group.color ?? "transparent"}`,
                        }}
                      >
                        {s.group.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {RECURRENCE_LABELS[s.recurrenceType] ?? s.recurrenceType}
                      {s.recurrenceType === "CUSTOM" && s.customIntervalDays ? ` (${s.customIntervalDays}d)` : ""}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        getScheduleStatus(s) === "overdue" ? "text-red-600" :
                        getScheduleStatus(s) === "due_soon" ? "text-amber-600" : "text-muted-foreground"
                      }`}
                    >
                      Próxima: {formatDate(s.nextRunAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Agendamento
                </th>
                {isCompanyLevel && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Cliente
                  </th>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Grupo
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Recorrência
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Próxima OS
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Última OS
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Execuções
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={isCompanyLevel ? 9 : 8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isCompanyLevel ? 9 : 8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Nenhum agendamento encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Title + equipment */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm leading-tight">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.equipment.name}
                        {s.equipment.brand ? ` · ${s.equipment.brand}` : ""}
                      </p>
                    </td>

                    {/* Client (company-level only) */}
                    {isCompanyLevel && (
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {s.client?.name ?? "—"}
                      </td>
                    )}

                    {/* Group */}
                    <td className="px-4 py-3">
                      {s.group ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background: s.group.color
                              ? `${s.group.color}20`
                              : undefined,
                            color: s.group.color ?? undefined,
                            border: `1px solid ${s.group.color ?? "transparent"}`,
                          }}
                        >
                          {s.group.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Recurrence */}
                    <td className="px-4 py-3 text-sm">
                      {RECURRENCE_LABELS[s.recurrenceType] ?? s.recurrenceType}
                      {s.recurrenceType === "CUSTOM" && s.customIntervalDays
                        ? ` (${s.customIntervalDays}d)`
                        : ""}
                    </td>

                    {/* Next run */}
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          getScheduleStatus(s) === "overdue"
                            ? "text-red-600 font-medium"
                            : getScheduleStatus(s) === "due_soon"
                            ? "text-amber-600 font-medium"
                            : ""
                        }
                      >
                        {formatDate(s.nextRunAt)}
                      </span>
                    </td>

                    {/* Last run */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(s.lastRunAt)}
                    </td>

                    {/* Execution count */}
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="font-medium">{s._count.maintenances}</span>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <StatusBadge schedule={s} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {isManager && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={toggle.isPending}
                          onClick={() =>
                            toggle.mutate({ id: s.id, isActive: !s.isActive })
                          }
                          title={s.isActive ? "Desativar agendamento" : "Ativar agendamento"}
                        >
                          {s.isActive ? (
                            <PowerOff className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <Power className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
            <span>
              {total} agendamento{total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
