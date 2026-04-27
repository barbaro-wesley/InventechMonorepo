"use client";

import { useState } from "react";
import {
  CalendarClock, Search, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, XCircle, ChevronLeft, ChevronRight, Plus, Filter, X,
  LayoutGrid, Activity, Wrench, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useMaintenanceSchedules, useToggleSchedule, useMaintenanceGroups,
} from "@/hooks/maintenance/use-maintenance-schedule";
import { useCurrentUser } from "@/store/auth.store";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { ScheduleDetailSheet, getScheduleStatus } from "@/components/maintenance/schedule-detail-sheet";
import { ScheduleFormSheet } from "@/components/maintenance/schedule-form-sheet";
import type { MaintenanceSchedule, MaintenanceType, RecurrenceType } from "@/services/maintenance/maintenance-schedule.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Diária", WEEKLY: "Semanal", BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral",
  ANNUAL: "Anual", CUSTOM: "Personalizada",
};

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: "Preventiva", CORRECTIVE: "Corretiva",
  INITIAL_ACCEPTANCE: "Aceitação Inicial", EXTERNAL_SERVICE: "Serviço Externo",
  TECHNOVIGILANCE: "Tecnovigilância", TRAINING: "Treinamento",
  IMPROPER_USE: "Uso Indevido", DEACTIVATION: "Desativação",
};

const TYPE_COLORS: Record<string, string> = {
  PREVENTIVE: "bg-blue-50 text-blue-700 ring-blue-200",
  CORRECTIVE: "bg-orange-50 text-orange-700 ring-orange-200",
  INITIAL_ACCEPTANCE: "bg-purple-50 text-purple-700 ring-purple-200",
  EXTERNAL_SERVICE: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  TECHNOVIGILANCE: "bg-rose-50 text-rose-700 ring-rose-200",
  TRAINING: "bg-green-50 text-green-700 ring-green-200",
  IMPROPER_USE: "bg-amber-50 text-amber-700 ring-amber-200",
  DEACTIVATION: "bg-gray-50 text-gray-600 ring-gray-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ schedule }: { schedule: MaintenanceSchedule }) {
  const status = getScheduleStatus(schedule);
  const cfgs = {
    overdue:  { label: "Vencido",      cls: "bg-red-50 text-red-700 ring-1 ring-red-200",     Icon: AlertTriangle },
    due_soon: { label: "Esta semana",  cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", Icon: Clock },
    active:   { label: "Em dia",       cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", Icon: CheckCircle2 },
    inactive: { label: "Inativo",      cls: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",   Icon: XCircle },
  };
  const { label, cls, Icon } = cfgs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

function IntervalMiniBar({ schedule }: { schedule: MaintenanceSchedule }) {
  if (!schedule.lastRunAt || !schedule.isActive) return null;
  const start = new Date(schedule.lastRunAt).getTime();
  const end = new Date(schedule.nextRunAt).getTime();
  const pct = Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)));
  const overdue = Date.now() > end;
  return (
    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden" title={`${pct}% do intervalo`}>
      <div
        className={`h-full rounded-full ${overdue ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[36, 20, 16, 18, 16, 12, 10, 8].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded bg-muted/60 animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

interface StatCardProps {
  label: string; value: number; icon: React.ElementType;
  color: "blue" | "red" | "amber" | "gray";
  active?: boolean; onClick?: () => void;
}
const colorMap = {
  blue:  { bg: "bg-blue-50",   icon: "bg-blue-100 text-blue-600",   border: "border-blue-200",   ring: "ring-blue-300",   text: "text-blue-700" },
  red:   { bg: "bg-red-50",    icon: "bg-red-100 text-red-600",     border: "border-red-200",    ring: "ring-red-300",    text: "text-red-700" },
  amber: { bg: "bg-amber-50",  icon: "bg-amber-100 text-amber-600", border: "border-amber-200",  ring: "ring-amber-300",  text: "text-amber-700" },
  gray:  { bg: "bg-gray-50",   icon: "bg-gray-100 text-gray-500",   border: "border-gray-200",   ring: "ring-gray-300",   text: "text-gray-500" },
};
function StatCard({ label, value, icon: Icon, color, active, onClick }: StatCardProps) {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-200
        ${active ? `${c.bg} ${c.border} ring-2 ${c.ring} shadow-sm` : "bg-white border-border hover:border-gray-300 hover:shadow-sm"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        {active && <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>Filtrado</span>}
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreventivasPage() {
  const currentUser = useCurrentUser();
  const isCompanyLevel = !currentUser?.clientId;
  const { isManager } = usePermissions();

  const [search, setSearch] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<string>("");
  const [maintenanceType, setMaintenanceType] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [editSchedule, setEditSchedule] = useState<MaintenanceSchedule | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const isActiveFilter =
    statusFilter === "inactive" ? false
    : statusFilter === "active" || statusFilter === "overdue" || statusFilter === "due_soon" ? true
    : undefined;

  const { data, isLoading, refetch, isFetching } = useMaintenanceSchedules({
    search: search || undefined,
    recurrenceType: recurrenceType as RecurrenceType || undefined,
    maintenanceType: maintenanceType as MaintenanceType || undefined,
    groupId: groupId || undefined,
    isActive: isActiveFilter,
    page,
    limit: LIMIT,
  });

  const { data: groups = [] } = useMaintenanceGroups();

  const schedules: MaintenanceSchedule[] = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? Math.ceil(total / LIMIT);

  // Client-side filter for overdue/due_soon (date-based)
  const filtered =
    statusFilter === "overdue" ? schedules.filter((s) => getScheduleStatus(s) === "overdue")
    : statusFilter === "due_soon" ? schedules.filter((s) => getScheduleStatus(s) === "due_soon")
    : schedules;

  // Stats
  const statsAll = schedules;
  const cntActive   = statsAll.filter((s) => s.isActive).length;
  const cntOverdue  = statsAll.filter((s) => getScheduleStatus(s) === "overdue").length;
  const cntDueSoon  = statsAll.filter((s) => getScheduleStatus(s) === "due_soon").length;
  const cntInactive = statsAll.filter((s) => !s.isActive).length;

  const hasFilters = !!(search || recurrenceType || maintenanceType || groupId || statusFilter);

  function clearFilters() {
    setSearch(""); setRecurrenceType(""); setMaintenanceType("");
    setGroupId(""); setStatusFilter(""); setPage(1);
  }

  function toggleStatusFilter(val: string) {
    setStatusFilter((prev) => prev === val ? "" : val);
    setPage(1);
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }}>
              <CalendarClock className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Preventivas (PMOC)</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-10">
            Plano de Manutenção, Operação e Controle — agendamentos recorrentes de OS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9 text-xs gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {isManager && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 border-0">
              <Plus className="w-3.5 h-3.5" />
              Nova Preventiva
            </Button>
          )}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Ativos" value={cntActive} icon={LayoutGrid} color="blue"
          active={statusFilter === "active"} onClick={() => toggleStatusFilter("active")} />
        <StatCard label="Vencidos" value={cntOverdue} icon={AlertTriangle} color="red"
          active={statusFilter === "overdue"} onClick={() => toggleStatusFilter("overdue")} />
        <StatCard label="Esta semana" value={cntDueSoon} icon={Clock} color="amber"
          active={statusFilter === "due_soon"} onClick={() => toggleStatusFilter("due_soon")} />
        <StatCard label="Inativos" value={cntInactive} icon={XCircle} color="gray"
          active={statusFilter === "inactive"} onClick={() => toggleStatusFilter("inactive")} />
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 pr-9 h-10 text-sm"
              placeholder="Buscar por título, equipamento ou cliente..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={recurrenceType || "all"} onValueChange={(v) => { setRecurrenceType(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-10 text-sm w-40">
                <SelectValue placeholder="Recorrência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda recorrência</SelectItem>
                {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={maintenanceType || "all"} onValueChange={(v) => { setMaintenanceType(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-10 text-sm w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo tipo</SelectItem>
                {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {groups.length > 0 && (
              <Select value={groupId || "all"} onValueChange={(v) => { setGroupId(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-10 text-sm w-40">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-10 px-3 text-xs text-muted-foreground" onClick={clearFilters}>
                <X className="w-3.5 h-3.5 mr-1" />Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Agendamento", "Tipo", "Grupo", "Técnico", "Recorrência", "Próxima OS", "Execuções", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{[1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <CalendarClock className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-foreground">Nenhum agendamento encontrado</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
            {hasFilters ? "Nenhum resultado com os filtros aplicados." : "Crie seu primeiro agendamento de preventiva."}
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={clearFilters}>Limpar filtros</Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agendamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Grupo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Técnico</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Recorrência</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Próxima OS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Última OS</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Exec.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const status = getScheduleStatus(s);
                  const typeColor = TYPE_COLORS[s.maintenanceType] ?? "bg-gray-50 text-gray-600 ring-gray-200";
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSchedule(s)}
                      className="group hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer"
                    >
                      {/* Agendamento */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-sm text-foreground leading-tight">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">
                          {s.equipment.name}{s.equipment.brand ? ` · ${s.equipment.brand}` : ""}
                        </p>
                        {isCompanyLevel && s.client && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{s.client.name}</p>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ${typeColor}`}>
                          {MAINTENANCE_TYPE_LABELS[s.maintenanceType] ?? s.maintenanceType}
                        </span>
                      </td>

                      {/* Grupo */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {s.group ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: s.group.color ? `${s.group.color}20` : "#f3f4f6",
                              color: s.group.color ?? "#374151",
                              border: `1px solid ${s.group.color ?? "#d1d5db"}`,
                            }}
                          >
                            {s.group.name}
                          </span>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>

                      {/* Técnico */}
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        {s.assignedTechnician ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="w-2.5 h-2.5 text-primary" />
                            </div>
                            <span className="text-xs text-foreground/80 truncate max-w-[100px]">{s.assignedTechnician.name}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>

                      {/* Recorrência */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-sm text-foreground/80">
                          {RECURRENCE_LABELS[s.recurrenceType] ?? s.recurrenceType}
                          {s.recurrenceType === "CUSTOM" && s.customIntervalDays ? ` (${s.customIntervalDays}d)` : ""}
                        </span>
                      </td>

                      {/* Próxima OS */}
                      <td className="px-4 py-3.5">
                        <p className={`text-sm font-medium tabular-nums ${
                          status === "overdue" ? "text-red-600" : status === "due_soon" ? "text-amber-600" : "text-foreground/80"
                        }`}>
                          {formatDate(s.nextRunAt)}
                        </p>
                        <div className="mt-1">
                          <IntervalMiniBar schedule={s} />
                        </div>
                      </td>

                      {/* Última OS */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground tabular-nums">{formatDate(s.lastRunAt)}</span>
                      </td>

                      {/* Execuções */}
                      <td className="px-4 py-3.5 hidden md:table-cell text-center">
                        <span className="text-sm font-semibold text-foreground/80">{s._count.maintenances}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge schedule={s} />
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
                <span className="font-medium text-foreground">{total}</span> agendamento{total !== 1 ? "s" : ""}
              </span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Sheet ── */}
      <ScheduleDetailSheet
        schedule={selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
        onEdit={(s) => { setSelectedSchedule(null); setEditSchedule(s); }}
        isManager={isManager}
      />

      {/* ── Edit Sheet ── */}
      <ScheduleFormSheet
        mode="edit"
        schedule={editSchedule}
        open={!!editSchedule}
        onClose={() => setEditSchedule(null)}
      />

      {/* ── Create Sheet ── */}
      <ScheduleFormSheet
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
