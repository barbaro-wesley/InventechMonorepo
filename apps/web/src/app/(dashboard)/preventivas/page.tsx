"use client";

import { useState } from "react";
import {
  CalendarClock, Search, CheckCircle2, AlertTriangle,
  Clock, XCircle, ChevronLeft, ChevronRight, Plus, X,
  LayoutGrid, Calendar, MoreVertical, SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useMaintenanceSchedules, useMaintenanceGroups,
} from "@/hooks/maintenance/use-maintenance-schedule";
import { useUsers } from "@/hooks/users/use-users";
import { useCurrentUser } from "@/store/auth.store";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { ScheduleDetailPanel, getScheduleStatus } from "@/components/maintenance/schedule-detail-panel";
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

const LEGEND = [
  { color: "bg-emerald-500", label: "Em dia", desc: "Próxima OS dentro do prazo" },
  { color: "bg-amber-500", label: "Atenção", desc: "Próxima OS nos próximos 7 dias" },
  { color: "bg-red-500", label: "Atrasada", desc: "Próxima OS já passou do prazo" },
  { color: "bg-gray-400", label: "Inativo", desc: "Agendamento inativo" },
  { color: "bg-gray-400", label: "Vigência encerrada", desc: "Data final do plano já passou" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff < -1) return `há ${Math.abs(diff)}d`;
  if (diff === -1) return "ontem";
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `em ${diff}d`;
}

function isSameMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function rowVisual(s: MaintenanceSchedule, status: ReturnType<typeof getScheduleStatus>) {
  if (status === "overdue") return { Icon: AlertTriangle, bg: "bg-red-50", color: "text-red-500" };
  if (s.recurrenceType === "DAILY" || s.recurrenceType === "WEEKLY" || s.recurrenceType === "BIWEEKLY") {
    return { Icon: LayoutGrid, bg: "bg-blue-50", color: "text-blue-500" };
  }
  if (s.recurrenceType === "MONTHLY" || s.recurrenceType === "QUARTERLY") {
    return { Icon: Calendar, bg: "bg-amber-50", color: "text-amber-600" };
  }
  return { Icon: Calendar, bg: "bg-emerald-50", color: "text-emerald-600" };
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ schedule }: { schedule: MaintenanceSchedule }) {
  const status = getScheduleStatus(schedule);
  const cfgs = {
    overdue:  { label: "Vencido",             cls: "bg-red-50 text-red-700 ring-1 ring-red-200",              Icon: AlertTriangle },
    due_soon: { label: "Esta semana",         cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",         Icon: Clock },
    active:   { label: "Em dia",              cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",   Icon: CheckCircle2 },
    inactive: { label: "Inativo",             cls: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",           Icon: XCircle },
    expired:  { label: "Vigência encerrada",  cls: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",           Icon: XCircle },
  };
  const { label, cls, Icon } = cfgs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 bg-white dark:bg-zinc-950/50 rounded-2xl border border-border p-4 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-muted/60 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-1/3 rounded bg-muted/60" />
        <div className="h-3 w-1/2 rounded bg-muted/40" />
      </div>
      <div className="hidden sm:block w-24 h-6 rounded bg-muted/40" />
      <div className="hidden md:block w-24 h-6 rounded bg-muted/40" />
      <div className="w-20 h-6 rounded-full bg-muted/40" />
    </div>
  );
}

interface StatCardProps {
  label: string; value: number; icon: React.ElementType;
  color: "blue" | "red" | "amber";
  active?: boolean; onClick?: () => void;
  delta?: string; deltaColor?: string;
}

const colorMap = {
  blue:  { icon: "bg-blue-50 text-blue-600",   border: "border-blue-200",  ring: "ring-blue-300",  text: "text-blue-700" },
  red:   { icon: "bg-red-50 text-red-500",     border: "border-red-200",   ring: "ring-red-300",   text: "text-red-700" },
  amber: { icon: "bg-amber-50 text-amber-500", border: "border-amber-200", ring: "ring-amber-300", text: "text-amber-700" },
};

function StatCard({ label, value, icon: Icon, color, active, onClick, delta, deltaColor }: StatCardProps) {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-200
        ${active
          ? `bg-white dark:bg-zinc-950/50 ${c.border} ring-2 ${c.ring} shadow-sm`
          : "bg-white dark:bg-zinc-950/50 border-border hover:border-gray-300 dark:hover:border-zinc-700 hover:shadow-sm"}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${c.icon}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-foreground tabular-nums leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {delta && <p className={`text-xs font-medium mt-1 ${deltaColor ?? "text-muted-foreground"}`}>{delta}</p>}
        </div>
        {active && <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${c.text}`}>Filtrado</span>}
      </div>
    </button>
  );
}

function PreventivaRow({
  schedule, selected, onSelect, isCompanyLevel,
}: {
  schedule: MaintenanceSchedule;
  selected: boolean;
  onSelect: (s: MaintenanceSchedule) => void;
  isCompanyLevel: boolean;
}) {
  const status = getScheduleStatus(schedule);
  const { Icon, bg, color } = rowVisual(schedule, status);
  const relNext = relativeTime(schedule.nextRunAt);
  const endDiff = schedule.endDate
    ? Math.round((new Date(schedule.endDate).getTime() - Date.now()) / 86400000)
    : null;
  const nextColor = status === "overdue" ? "text-red-500" : status === "due_soon" ? "text-amber-500" : "text-muted-foreground";

  return (
    <div
      onClick={() => onSelect(schedule)}
      className={`flex items-center gap-4 bg-white dark:bg-zinc-950/50 rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${
        selected ? "border-primary ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        <Icon className={`w-[18px] h-[18px] ${color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{schedule.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {schedule.equipment.name}
          {schedule.equipment.patrimonyNumber ? ` · Pat. ${schedule.equipment.patrimonyNumber}` : ""}
        </p>
        {(schedule.equipment.costCenter || schedule.equipment.location) && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {schedule.equipment.costCenter?.name}
            {schedule.equipment.costCenter && schedule.equipment.location ? <span className="mx-1">›</span> : null}
            {schedule.equipment.location?.name}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          {schedule.checklistTemplate && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-1.5 py-0.5 rounded">
              ✓ Checklist
            </span>
          )}
          {endDiff !== null && endDiff < 0 && (
            <span className="text-[10px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 px-1.5 py-0.5 rounded">
              Plano expirado
            </span>
          )}
          {endDiff !== null && endDiff >= 0 && endDiff <= 30 && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-1.5 py-0.5 rounded">
              Vence em {endDiff}d
            </span>
          )}
          {isCompanyLevel && schedule.client && (
            <span className="text-[10px] text-muted-foreground/70 truncate">{schedule.client.name}</span>
          )}
        </div>
      </div>

      <div className="hidden sm:block w-24 shrink-0">
        <p className="text-sm font-medium text-foreground/80">
          {RECURRENCE_LABELS[schedule.recurrenceType] ?? schedule.recurrenceType}
        </p>
        <p className="text-xs text-muted-foreground">Recorrência</p>
      </div>

      <div className="hidden md:block w-32 shrink-0">
        <p className={`text-sm font-medium tabular-nums ${status === "overdue" ? "text-red-600" : "text-foreground/80"}`}>
          {formatDate(schedule.nextRunAt)}
        </p>
        <p className="text-xs text-muted-foreground">Próxima OS</p>
        {relNext && <p className={`text-xs font-medium ${nextColor}`}>{relNext}</p>}
      </div>

      <StatusBadge schedule={schedule} />

      <MoreVertical className="hidden sm:block w-4 h-4 text-muted-foreground/50 shrink-0" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreventivasPage() {
  const currentUser = useCurrentUser();
  const isCompanyLevel = !currentUser?.clientId;
  const { canAccess } = usePermissions();

  const [search, setSearch] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [technicianId, setTechnicianId] = useState<string>("");
  const [maintenanceType, setMaintenanceType] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [editSchedule, setEditSchedule] = useState<MaintenanceSchedule | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  // Uma única caixa de busca cobre título/equipamento/cliente e patrimônio: números puros
  // (ex: "05462") são tratados como patrimônio, o resto vai para a busca textual da API.
  const trimmedSearch = search.trim();
  const looksLikePatrimony = /^\d+$/.test(trimmedSearch);
  const searchParam = trimmedSearch && !looksLikePatrimony ? trimmedSearch : undefined;
  const patrimonyParam = trimmedSearch && looksLikePatrimony ? trimmedSearch : undefined;

  const isActiveFilter =
    statusFilter === "active" || statusFilter === "overdue" || statusFilter === "due_soon" ? true
    : statusFilter === "inactive" ? false
    : undefined;

  // "no_tech" / patrimônio / técnico não têm filtro correspondente na API — bump limit
  // para o filtro client-side cobrir mais registros (mesmo padrão de overdue/due_soon).
  const needsBuffer = statusFilter === "overdue" || statusFilter === "due_soon" || statusFilter === "no_tech" || !!patrimonyParam || !!technicianId;
  const effectiveLimit = needsBuffer ? 100 : LIMIT;

  const { data, isLoading } = useMaintenanceSchedules({
    search: searchParam,
    patrimonyNumber: patrimonyParam,
    recurrenceType: recurrenceType as RecurrenceType || undefined,
    groupId: groupId || undefined,
    maintenanceType: maintenanceType as MaintenanceType || undefined,
    isActive: isActiveFilter,
    nextRunTo: statusFilter === "overdue" ? today : statusFilter === "due_soon" ? in7days : undefined,
    nextRunFrom: statusFilter === "due_soon" ? today : undefined,
    page,
    limit: effectiveLimit,
  });

  const { data: groups = [] } = useMaintenanceGroups();
  const { data: usersData } = useUsers({ role: "TECHNICIAN", limit: 100 });
  const technicians = usersData?.data ?? [];

  const schedules: MaintenanceSchedule[] = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.total ?? 0;
  const totalPages = needsBuffer ? 1 : (data?.pagination?.totalPages ?? Math.ceil(total / LIMIT));

  // Client-side filter for filters not supported by the API (date-status, patrimony, técnico)
  const filtered = schedules.filter((s) => {
    const st = getScheduleStatus(s);
    if (statusFilter === "overdue" && st !== "overdue") return false;
    if (statusFilter === "due_soon" && st !== "due_soon") return false;
    if (statusFilter === "no_tech" && s.assignedTechnician) return false;
    if (patrimonyParam && !s.equipment.patrimonyNumber?.toLowerCase().includes(patrimonyParam.toLowerCase())) return false;
    if (technicianId && s.assignedTechnician?.id !== technicianId) return false;
    return true;
  });

  // Card counts: use pagination total when a server-side filter is active (accurate);
  // otherwise count from the fetched records (reflects what's visible).
  const cntActive   = statusFilter === "active"   ? total : schedules.filter((s) => s.isActive).length;
  const cntOverdue  = statusFilter === "overdue"  ? filtered.length : schedules.filter((s) => getScheduleStatus(s) === "overdue").length;
  const cntDueSoon  = statusFilter === "due_soon" ? filtered.length : schedules.filter((s) => getScheduleStatus(s) === "due_soon").length;

  // Deltas reais (não fabricados) calculados a partir do lote atualmente carregado —
  // mesma limitação de amostragem já assumida pelos contadores acima.
  const cntActiveThisMonth = schedules.filter((s) => s.isActive && isSameMonth(s.createdAt)).length;
  const cntOverdueThisWeek = schedules.filter((s) => getScheduleStatus(s) === "overdue" && (Date.now() - new Date(s.nextRunAt).getTime()) <= 7 * 86400000).length;
  const cntDueToday = schedules.filter((s) => getScheduleStatus(s) === "due_soon" && isToday(s.nextRunAt)).length;

  const hasFilters = !!(search || recurrenceType || groupId || technicianId || maintenanceType || statusFilter);

  function clearFilters() {
    setSearch("");
    setRecurrenceType(""); setGroupId(""); setTechnicianId(""); setMaintenanceType(""); setStatusFilter(""); setPage(1);
  }

  function toggleStatusFilter(val: string) {
    setStatusFilter((prev) => prev === val ? "" : val);
    setPage(1);
  }

  return (
    <div className={`space-y-4 transition-[padding] duration-200 ${selectedSchedule ? "lg:pr-[404px]" : ""}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }}>
            <CalendarClock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">Preventivas</h1>
            <p className="text-sm text-muted-foreground mt-1">Agendamentos recorrentes de OS · PMOC</p>
          </div>
        </div>
        {canAccess('maintenance-schedule', 'create') && (
          <Button onClick={() => setCreateOpen(true)} className="h-11 px-4 gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 border-0 flex-shrink-0">
            <Plus className="w-4 h-4" />
            Nova Preventiva
          </Button>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Ativas" value={cntActive} icon={LayoutGrid} color="blue"
          active={statusFilter === "active"} onClick={() => toggleStatusFilter("active")}
          delta={cntActiveThisMonth > 0 ? `+${cntActiveThisMonth} este mês` : undefined} deltaColor="text-emerald-500" />
        <StatCard label="Vencidas" value={cntOverdue} icon={AlertTriangle} color="red"
          active={statusFilter === "overdue"} onClick={() => toggleStatusFilter("overdue")}
          delta={cntOverdueThisWeek > 0 ? `+${cntOverdueThisWeek} esta semana` : undefined} deltaColor="text-red-500" />
        <StatCard label="Próximos 7 dias" value={cntDueSoon} icon={Clock} color="amber"
          active={statusFilter === "due_soon"} onClick={() => toggleStatusFilter("due_soon")}
          delta={cntDueToday > 0 ? `+${cntDueToday} hoje` : undefined} deltaColor="text-amber-500" />
      </div>

      {/* ── Search + filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-11 pr-9 h-11 rounded-xl text-sm"
            placeholder="Buscar por título, equipamento, patrimônio..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Select value={recurrenceType || "all"} onValueChange={(v) => { setRecurrenceType(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="h-11 rounded-xl text-sm w-36">
            <SelectValue placeholder="Recorrência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda recorrência</SelectItem>
            {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(groups as any[]).length > 0 && (
          <Select value={groupId || "all"} onValueChange={(v) => { setGroupId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl text-sm w-36">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo grupo</SelectItem>
              {(groups as any[]).map((g: any) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="h-11 rounded-xl text-sm w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo status</SelectItem>
            <SelectItem value="active">Em dia</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="due_soon">Esta semana</SelectItem>
            <SelectItem value="no_tech">Sem técnico</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>

        {technicians.length > 0 && (
          <Select value={technicianId || "all"} onValueChange={(v) => { setTechnicianId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl text-sm w-36">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo técnico</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="ghost"
          onClick={() => setShowMoreFilters((v) => !v)}
          className={`h-11 px-4 gap-1.5 text-sm rounded-xl ${showMoreFilters || maintenanceType ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary" : "bg-primary/5 text-primary hover:bg-primary/10"}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
        </Button>

        {showMoreFilters && (
          <Select value={maintenanceType || "all"} onValueChange={(v) => { setMaintenanceType(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl text-sm w-40">
              <SelectValue placeholder="Tipo de manutenção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo tipo</SelectItem>
              {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button variant="ghost" className="h-11 px-3 text-sm text-muted-foreground" onClick={clearFilters}>
            <X className="w-3.5 h-3.5 mr-1" />Limpar
          </Button>
        )}
      </div>

      {/* ── List ── */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-950/50 rounded-2xl border border-dashed border-border py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <CalendarClock className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-foreground">Nenhum agendamento encontrado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {hasFilters ? "Nenhum resultado com os filtros aplicados." : "Crie seu primeiro agendamento de preventiva."}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={clearFilters}>Limpar filtros</Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <PreventivaRow
                key={s.id}
                schedule={s}
                selected={selectedSchedule?.id === s.id}
                onSelect={setSelectedSchedule}
                isCompanyLevel={isCompanyLevel}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <span className="text-xs text-muted-foreground">
              {needsBuffer
                ? <><span className="font-medium text-foreground">{filtered.length}</span> resultado{filtered.length !== 1 ? "s" : ""}</>
                : <>Mostrando <span className="font-medium text-foreground">{(page - 1) * LIMIT + 1}</span> a{" "}
                   <span className="font-medium text-foreground">{Math.min(page * LIMIT, total)}</span> de{" "}
                   <span className="font-medium text-foreground">{total}</span> preventiva{total !== 1 ? "s" : ""}</>
              }
            </span>
            {!needsBuffer && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === "..." ? (
                    <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium ${
                        page === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="bg-white dark:bg-zinc-950/50 border border-border rounded-2xl p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Entenda os status</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {LEGEND.map((l) => (
              <div key={l.label}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-sm font-medium text-foreground">{l.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedSchedule && (
        <ScheduleDetailPanel
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
          onEdit={(s) => { setSelectedSchedule(null); setEditSchedule(s); }}
        />
      )}

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
