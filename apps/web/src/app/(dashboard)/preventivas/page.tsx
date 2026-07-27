"use client";

import { useState, useRef, useEffect } from "react";
import {
  CalendarClock,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  ListFilter,
  Filter,
  Layers,
  Sparkles,
  Tag,
  Wrench,
  Monitor,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  subMonths,
  addMonths,
  subWeeks,
  addWeeks,
  subDays,
  addDays,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
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
  useMaintenanceGroups,
} from "@/hooks/maintenance/use-maintenance-schedule";
import { useEquipmentTypes } from "@/hooks/equipment/use-equipment-types";
import { useCurrentUser } from "@/store/auth.store";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { ScheduleDetailPanel } from "@/components/maintenance/schedule-detail-panel";
import { ScheduleFormSheet } from "@/components/maintenance/schedule-form-sheet";
import { PreventivasCalendarView, type ViewMode } from "@/components/maintenance/preventivas-calendar-view";
import type { MaintenanceSchedule } from "@/services/maintenance/maintenance-schedule.service";

const LEGEND = [
  { color: "bg-emerald-500", label: "Em dia", desc: "Próxima OS dentro do prazo programado" },
  { color: "bg-amber-500", label: "Atenção / Esta semana", desc: "Próxima OS nos próximos 7 dias" },
  { color: "bg-red-500", label: "Vencida / Atrasada", desc: "Próxima OS já passou da data limite" },
  { color: "bg-gray-400", label: "Inativo / Encerrado", desc: "Agendamento inativo ou vigência finalizada" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function PreventivasPage() {
  const currentUser = useCurrentUser();
  const { canAccess } = usePermissions();

  const dateInputRef = useRef<HTMLInputElement>(null);
  const lastAutoJumpRef = useRef<string>("");

  // Filter States
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [groupId, setGroupId] = useState("");
  const [typeId, setTypeId] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const LIMIT = 100;

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  // Panel & Sheets
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [editSchedule, setEditSchedule] = useState<MaintenanceSchedule | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Queries for Select Dropdowns
  const { data: groupsData } = useMaintenanceGroups();
  const { data: typesData } = useEquipmentTypes({ limit: 100 });

  const groupsList: any[] = Array.isArray(groupsData)
    ? groupsData
    : (groupsData as any)?.data ?? [];
  const typesList: any[] = Array.isArray(typesData)
    ? typesData
    : (typesData as any)?.data ?? [];

  // Search parameter formatting using debouncedSearch
  const trimmedSearch = debouncedSearch.trim();
  const isPatrimonyNumber = /^\d+$/.test(trimmedSearch);
  const searchParam = trimmedSearch && !isPatrimonyNumber ? trimmedSearch : undefined;
  const patrimonyParam = trimmedSearch && isPatrimonyNumber ? trimmedSearch : undefined;

  // Compute dynamic date range based on active view mode and currentDate
  const getDateRangeForView = (date: Date, mode: ViewMode) => {
    // If user typed a search query, search across all dates (don't restrict date range)
    if (trimmedSearch) {
      return { date: undefined, nextRunFrom: undefined, nextRunTo: undefined };
    }

    if (mode === "month") {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(monthStart);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return {
        date: undefined,
        nextRunFrom: format(gridStart, "yyyy-MM-dd"),
        nextRunTo: format(gridEnd, "yyyy-MM-dd"),
      };
    }
    if (mode === "week") {
      const wStart = startOfWeek(date, { weekStartsOn: 1 });
      const wEnd = endOfWeek(date, { weekStartsOn: 1 });
      return {
        date: undefined,
        nextRunFrom: format(wStart, "yyyy-MM-dd"),
        nextRunTo: format(wEnd, "yyyy-MM-dd"),
      };
    }
    if (mode === "day") {
      return {
        date: format(date, "yyyy-MM-dd"),
        nextRunFrom: undefined,
        nextRunTo: undefined,
      };
    }
    // Agenda mode: 1 month back to 3 months forward
    return {
      date: undefined,
      nextRunFrom: format(startOfMonth(subMonths(date, 1)), "yyyy-MM-dd"),
      nextRunTo: format(endOfMonth(addMonths(date, 3)), "yyyy-MM-dd"),
    };
  };

  const { date: dateParam, nextRunFrom, nextRunTo } = getDateRangeForView(currentDate, viewMode);

  // Query schedules with all filters
  const { data, isLoading } = useMaintenanceSchedules({
    search: searchParam,
    patrimonyNumber: patrimonyParam,
    groupId: groupId || undefined,
    typeId: typeId || undefined,
    date: dateParam,
    nextRunFrom,
    nextRunTo,
    page,
    limit: LIMIT,
  });

  const schedules: MaintenanceSchedule[] = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.total ?? schedules.length;
  const totalPages = data?.pagination?.totalPages ?? Math.ceil(total / LIMIT);

  // Auto-jump calendar date to the target date of the first search result when searching
  useEffect(() => {
    if (trimmedSearch && schedules.length > 0 && schedules[0].nextRunAt) {
      const targetIso = schedules[0].nextRunAt;
      const jumpKey = `${trimmedSearch}-${targetIso}`;
      if (lastAutoJumpRef.current !== jumpKey) {
        lastAutoJumpRef.current = jumpKey;
        try {
          const parsed = parseISO(targetIso);
          if (!isNaN(parsed.getTime())) {
            setCurrentDate(parsed);
          }
        } catch {}
      }
    }
  }, [trimmedSearch, schedules]);

  const hasFilters = !!(search || groupId || typeId);

  const clearFilters = () => {
    setSearch("");
    setGroupId("");
    setTypeId("");
    setPage(1);
    lastAutoJumpRef.current = "";
  };

  // Navigation handlers
  const handlePrev = () => {
    setPage(1);
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    setPage(1);
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    setPage(1);
    setCurrentDate(new Date());
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setPage(1);
    setViewMode(mode);
  };

  // Label formatted for current period
  const getHeaderDateLabel = () => {
    if (viewMode === "month") {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(start, end)) {
        return `${format(start, "d", { locale: ptBR })} - ${format(end, "d 'de' MMMM, yyyy", { locale: ptBR })}`;
      }
      return `${format(start, "d 'de' MMM", { locale: ptBR })} - ${format(end, "d 'de' MMM, yyyy", { locale: ptBR })}`;
    }
    if (viewMode === "day") {
      return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    return "Cronograma Geral";
  };

  return (
    <div className={`space-y-4 transition-[padding] duration-200 ${selectedSchedule ? "lg:pr-[404px]" : ""}`}>
      {/* ── Dynamic Top Header & Calendar Toolbar Card ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-4 shadow-xs space-y-4">
        {/* Top Row: Title + Period Badge + Search & Dropdown Filters + New Button */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Header Title & Dynamic Count Badge */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
              style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }}
            >
              <CalendarClock className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-none">
                  Preventivas
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize border border-primary/20">
                  {getHeaderDateLabel()}
                </span>
                {!isLoading && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60">
                    {total} {total === 1 ? "preventiva" : "preventivas"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Agenda e Cronograma de Manutenção Preventiva · PMOC
              </p>
            </div>
          </div>

          {/* Controls: Search + Group Select + Type Select + New Schedule Button */}
          <div className="flex items-center gap-2 flex-wrap flex-1 xl:justify-end">
            {/* Direct Inline Search Field */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Equipamento ou patrimônio..."
                className="pl-9 pr-7 h-9 rounded-xl text-xs bg-muted/30 focus:bg-background transition-colors"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Grupo de Manutenção Dropdown */}
            <Select
              value={groupId || "all"}
              onValueChange={(v) => {
                setGroupId(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs w-36 bg-muted/30 focus:bg-background">
                <SelectValue placeholder="Todo Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo Grupo</SelectItem>
                {groupsList.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tipo de Equipamento Dropdown */}
            <Select
              value={typeId || "all"}
              onValueChange={(v) => {
                setTypeId(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs w-36 bg-muted/30 focus:bg-background">
                <SelectValue placeholder="Todo Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo Tipo</SelectItem>
                {typesList.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear filters button */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Limpar
              </Button>
            )}

            {/* New Schedule Button */}
            {canAccess("maintenance-schedule", "create") && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="h-9 px-3 gap-1.5 text-xs rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 border-0 shadow-xs font-semibold flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                Nova Preventiva
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Row: Calendar Date Controls + Page Navigation (if multi-page) + View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          {/* Navigation Controls (< Hoje > Ir para data) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-all"
                title="Período anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-background text-foreground shadow-xs border border-border/60 hover:bg-muted/80 transition-all"
              >
                Hoje
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-all"
                title="Próximo período"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-border/60 mx-0.5" />

              {/* Specific Date Picker Trigger */}
              <div className="flex items-center">
                <input
                  ref={dateInputRef}
                  type="date"
                  value={format(currentDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split("-").map(Number);
                      setCurrentDate(new Date(y, m - 1, d));
                      setPage(1);
                    }
                  }}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
                    if (el) {
                      if (typeof el.showPicker === "function") {
                        el.showPicker();
                      } else {
                        el.focus();
                      }
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-background text-foreground shadow-xs border border-border/60 hover:bg-muted/80 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Selecionar data específica"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Ir para data</span>
                </button>
              </div>
            </div>

            {/* If period has multiple pages (>100 items), display inline dynamic page navigator */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-xl border border-amber-300 dark:border-amber-800 text-xs font-medium">
                <span>Pág {page} de {totalPages}</span>
                <div className="flex items-center ml-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-0.5 rounded hover:bg-amber-500/20 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-0.5 rounded hover:bg-amber-500/20 disabled:opacity-30"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs font-medium">
            <button
              onClick={() => handleViewModeChange("month")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "month"
                  ? "bg-white dark:bg-zinc-800 text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Mês
            </button>
            <button
              onClick={() => handleViewModeChange("week")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "week"
                  ? "bg-white dark:bg-zinc-800 text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              onClick={() => handleViewModeChange("day")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "day"
                  ? "bg-white dark:bg-zinc-800 text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Dia
            </button>
            <button
              onClick={() => handleViewModeChange("agenda")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "agenda"
                  ? "bg-white dark:bg-zinc-800 text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Agenda
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Search Info Banner ── */}
      {trimmedSearch && schedules.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                Busca: "{trimmedSearch}" · {schedules.length} preventiva{schedules.length !== 1 ? "s" : ""} encontrada{schedules.length !== 1 ? "s" : ""}
              </p>
              {schedules[0].nextRunAt && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium truncate">
                  📅 O calendário navegou para a data do próximo agendamento:{" "}
                  <strong>{format(parseISO(schedules[0].nextRunAt), "dd/MM/yyyy ('em' EEEE)", { locale: ptBR })}</strong>
                </p>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-emerald-500/20 rounded-lg shrink-0"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Limpar busca
          </Button>
        </div>
      )}

      {/* ── Calendar View ── */}
      <PreventivasCalendarView
        schedules={schedules}
        isLoading={isLoading}
        selectedSchedule={selectedSchedule}
        onSelectSchedule={setSelectedSchedule}
        onCreateNew={() => setCreateOpen(true)}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        hideHeader
      />

      {/* ── Legend Footer ── */}
      <div className="bg-white dark:bg-zinc-900 border border-border rounded-2xl p-4 shadow-xs">
        <div className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-primary" />
          Legenda de Status no Calendário
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-start gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${l.color} shrink-0 mt-1`} />
              <div>
                <p className="text-xs font-bold text-foreground">{l.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{l.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Schedule Detail Drawer Panel ── */}
      {selectedSchedule && (
        <ScheduleDetailPanel
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
          onEdit={(s) => {
            setSelectedSchedule(null);
            setEditSchedule(s);
          }}
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
