"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addDays,
  subDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarClock,
  User,
  MapPin,
  Tag,
  ListChecks,
  ArrowRight,
  Layers,
  Sparkles,
  CalendarDays,
  ListFilter,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MaintenanceSchedule } from "@/services/maintenance/maintenance-schedule.service";
import { getScheduleStatus } from "@/components/maintenance/schedule-detail-panel";

export type ViewMode = "month" | "week" | "day" | "agenda";

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

interface PreventivasCalendarViewProps {
  schedules: MaintenanceSchedule[];
  isLoading: boolean;
  selectedSchedule: MaintenanceSchedule | null;
  onSelectSchedule: (s: MaintenanceSchedule) => void;
  onCreateNew?: () => void;
  currentDate: Date;
  onDateChange: (d: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hideHeader?: boolean;
}

export function PreventivasCalendarView({
  schedules,
  isLoading,
  selectedSchedule,
  onSelectSchedule,
  onCreateNew,
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  hideHeader = false,
}: PreventivasCalendarViewProps) {
  // Helper to parse date string safely
  const getScheduleDate = (s: MaintenanceSchedule): Date | null => {
    if (!s.nextRunAt) return null;
    try {
      return parseISO(s.nextRunAt);
    } catch {
      return new Date(s.nextRunAt);
    }
  };

  // Status helper mapping
  const getStatusBadge = (s: MaintenanceSchedule) => {
    const status = getScheduleStatus(s);
    if (status === "overdue") {
      return {
        label: "Vencida",
        bg: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50",
        dot: "bg-red-500",
        Icon: AlertTriangle,
      };
    }
    if (status === "due_soon") {
      return {
        label: "Esta semana",
        bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
        dot: "bg-amber-500",
        Icon: Clock,
      };
    }
    if (status === "inactive" || status === "expired") {
      return {
        label: "Inativo",
        bg: "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-800",
        dot: "bg-gray-400",
        Icon: XCircle,
      };
    }
    return {
      label: "Em dia",
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
      dot: "bg-emerald-500",
      Icon: CheckCircle2,
    };
  };

  // Date Navigation handlers
  const handlePrev = () => {
    if (viewMode === "month") onDateChange(subMonths(currentDate, 1));
    else if (viewMode === "week") onDateChange(subWeeks(currentDate, 1));
    else onDateChange(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === "month") onDateChange(addMonths(currentDate, 1));
    else if (viewMode === "week") onDateChange(addWeeks(currentDate, 1));
    else onDateChange(addDays(currentDate, 1));
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  // Title label formatted for current range
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
    return "Cronograma Geral de Preventivas";
  };

  return (
    <div className="space-y-4">
      {/* ── Sub Header / View Switcher Toolbar (optional) ── */}
      {!hideHeader && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-all"
                title="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-background text-foreground shadow-xs border border-border/60 hover:bg-muted/80 transition-all"
              >
                Hoje
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-all"
                title="Próximo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-base font-bold text-foreground capitalize tracking-tight ml-2">
              {getHeaderDateLabel()}
            </h2>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs font-medium">
            <button
              onClick={() => onViewModeChange("month")}
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
              onClick={() => onViewModeChange("week")}
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
              onClick={() => onViewModeChange("day")}
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
              onClick={() => onViewModeChange("agenda")}
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
      )}

      {/* ── Main View Content ── */}
      {isLoading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-12 text-center text-muted-foreground animate-pulse">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40 animate-bounce" />
          <p className="text-sm font-medium">Carregando cronograma de preventivas...</p>
        </div>
      ) : (
        <>
          {viewMode === "month" && (
            <MonthView
              currentDate={currentDate}
              schedules={schedules}
              onSelectSchedule={onSelectSchedule}
              onSelectDay={(day) => {
                onDateChange(day);
                onViewModeChange("day");
              }}
              selectedSchedule={selectedSchedule}
            />
          )}

          {viewMode === "week" && (
            <WeekView
              currentDate={currentDate}
              schedules={schedules}
              onSelectSchedule={onSelectSchedule}
              selectedSchedule={selectedSchedule}
            />
          )}

          {viewMode === "day" && (
            <DayView
              currentDate={currentDate}
              schedules={schedules}
              onSelectSchedule={onSelectSchedule}
              selectedSchedule={selectedSchedule}
              onCreateNew={onCreateNew}
            />
          )}

          {viewMode === "agenda" && (
            <AgendaView
              schedules={schedules}
              onSelectSchedule={onSelectSchedule}
              selectedSchedule={selectedSchedule}
              onCreateNew={onCreateNew}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MONTH VIEW (Visão Mensal)
// ─────────────────────────────────────────────────────────────────────────────
function MonthView({
  currentDate,
  schedules,
  onSelectSchedule,
  onSelectDay,
  selectedSchedule,
}: {
  currentDate: Date;
  schedules: MaintenanceSchedule[];
  onSelectSchedule: (s: MaintenanceSchedule) => void;
  onSelectDay: (d: Date) => void;
  selectedSchedule: MaintenanceSchedule | null;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-xs overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground py-2.5">
        {weekDays.map((wd) => (
          <div key={wd}>{wd}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/60">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDay = isToday(day);

          // Find schedules for this day
          const daySchedules = schedules.filter((s) => {
            if (!s.nextRunAt) return false;
            const sDate = parseISO(s.nextRunAt);
            return isSameDay(sDate, day);
          });

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                !isCurrentMonth
                  ? "bg-muted/10 text-muted-foreground/40"
                  : isTodayDay
                  ? "bg-primary/5 dark:bg-primary/10"
                  : "hover:bg-muted/20"
              }`}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  onClick={() => onSelectDay(day)}
                  className={`cursor-pointer text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isTodayDay
                      ? "bg-primary text-primary-foreground shadow-xs scale-105"
                      : isCurrentMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/40"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {daySchedules.length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {daySchedules.length}
                  </span>
                )}
              </div>

              {/* Items in Cell */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {daySchedules.slice(0, 3).map((s) => {
                  const status = getScheduleStatus(s);
                  const isSelected = selectedSchedule?.id === s.id;

                  const colorStyles =
                    status === "overdue"
                      ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-900"
                      : status === "due_soon"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-900"
                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-900";

                  return (
                    <div
                      key={s.id}
                      onClick={() => onSelectSchedule(s)}
                      className={`px-1.5 py-1 rounded-md text-[11px] font-medium border truncate cursor-pointer transition-all hover:scale-[1.02] ${colorStyles} ${
                        isSelected ? "ring-2 ring-primary font-bold" : ""
                      }`}
                      title={`${s.title} (${s.equipment.name})`}
                    >
                      <div className="truncate flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            status === "overdue"
                              ? "bg-red-500"
                              : status === "due_soon"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span className="truncate">{s.equipment.name}</span>
                      </div>
                    </div>
                  );
                })}

                {daySchedules.length > 3 && (
                  <button
                    onClick={() => onSelectDay(day)}
                    className="w-full text-[10px] font-semibold text-primary hover:underline text-left pl-1"
                  >
                    + {daySchedules.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. WEEK VIEW (Visão Semanal)
// ─────────────────────────────────────────────────────────────────────────────
function WeekView({
  currentDate,
  schedules,
  onSelectSchedule,
  selectedSchedule,
}: {
  currentDate: Date;
  schedules: MaintenanceSchedule[];
  onSelectSchedule: (s: MaintenanceSchedule) => void;
  selectedSchedule: MaintenanceSchedule | null;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {days.map((day) => {
        const isTodayDay = isToday(day);
        const daySchedules = schedules.filter((s) => {
          if (!s.nextRunAt) return false;
          return isSameDay(parseISO(s.nextRunAt), day);
        });

        return (
          <div
            key={day.toISOString()}
            className={`bg-white dark:bg-zinc-900 rounded-2xl border ${
              isTodayDay ? "border-primary/50 ring-1 ring-primary/30" : "border-border"
            } p-3 flex flex-col min-h-[360px] shadow-xs`}
          >
            {/* Header Column */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  {format(day, "EEE", { locale: ptBR })}
                </p>
                <p className="text-lg font-extrabold text-foreground leading-none mt-0.5">
                  {format(day, "d MMM", { locale: ptBR })}
                </p>
              </div>

              {isTodayDay && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Hoje
                </span>
              )}
            </div>

            {/* List for day */}
            <div className="flex-1 space-y-2 overflow-y-auto">
              {daySchedules.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 text-muted-foreground/40 text-center">
                  <CalendarIcon className="w-6 h-6 mb-1 opacity-30" />
                  <p className="text-[11px]">Sem preventivas</p>
                </div>
              ) : (
                daySchedules.map((s) => {
                  const status = getScheduleStatus(s);
                  const isSelected = selectedSchedule?.id === s.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => onSelectSchedule(s)}
                      className={`p-2.5 rounded-xl border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all space-y-1.5 ${
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                            status === "overdue"
                              ? "bg-red-500/15 text-red-600 dark:text-red-400"
                              : status === "due_soon"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {RECURRENCE_LABELS[s.recurrenceType] ?? s.recurrenceType}
                        </span>

                        <span
                          className={`w-2 h-2 rounded-full ${
                            status === "overdue"
                              ? "bg-red-500"
                              : status === "due_soon"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                      </div>

                      <p className="font-semibold text-xs text-foreground leading-tight line-clamp-2">
                        {s.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {s.equipment.name}
                      </p>

                      {s.equipment.patrimonyNumber && (
                        <p className="text-[10px] font-mono text-muted-foreground/80">
                          Pat. #{s.equipment.patrimonyNumber}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DAY VIEW (Visão do Dia)
// ─────────────────────────────────────────────────────────────────────────────
function DayView({
  currentDate,
  schedules,
  onSelectSchedule,
  selectedSchedule,
  onCreateNew,
}: {
  currentDate: Date;
  schedules: MaintenanceSchedule[];
  onSelectSchedule: (s: MaintenanceSchedule) => void;
  selectedSchedule: MaintenanceSchedule | null;
  onCreateNew?: () => void;
}) {
  const daySchedules = schedules.filter((s) => {
    if (!s.nextRunAt) return false;
    return isSameDay(parseISO(s.nextRunAt), currentDate);
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Agenda de Preventivas
          </h3>
          <p className="text-xs text-muted-foreground">
            {format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
          {daySchedules.length} agendamento{daySchedules.length !== 1 ? "s" : ""}
        </span>
      </div>

      {daySchedules.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground space-y-3">
          <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <div>
            <p className="text-base font-semibold text-foreground">
              Nenhuma preventiva programada para este dia
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Utilize as setas no topo para navegar entre as datas ou agende uma nova preventiva.
            </p>
          </div>
          {onCreateNew && (
            <Button onClick={onCreateNew} size="sm" className="rounded-xl mt-2">
              <Plus className="w-4 h-4 mr-1.5" /> Nova Preventiva
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {daySchedules.map((s) => {
            const status = getScheduleStatus(s);
            const isSelected = selectedSchedule?.id === s.id;

            return (
              <div
                key={s.id}
                onClick={() => onSelectSchedule(s)}
                className={`p-4 rounded-2xl border bg-muted/10 hover:bg-muted/30 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isSelected ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      status === "overdue"
                        ? "bg-red-500/10 text-red-500"
                        : status === "due_soon"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}
                  >
                    <CalendarClock className="w-5 h-5" />
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-foreground">{s.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.equipment.name}
                      {s.equipment.patrimonyNumber ? ` · Pat. ${s.equipment.patrimonyNumber}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {RECURRENCE_LABELS[s.recurrenceType] ?? s.recurrenceType}
                      </span>
                      {s.assignedTechnician && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" /> {s.assignedTechnician.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-border">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      status === "overdue"
                        ? "bg-red-500/10 text-red-600"
                        : status === "due_soon"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-emerald-500/10 text-emerald-600"
                    }`}
                  >
                    {status === "overdue" ? "Vencido" : status === "due_soon" ? "Esta semana" : "Em dia"}
                  </span>
                  <Button variant="ghost" size="sm" className="text-xs rounded-xl gap-1">
                    Ver Detalhes <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AGENDA / TIMELINE VIEW (Visão de Agenda Cronológica)
// ─────────────────────────────────────────────────────────────────────────────
function groupSchedulesByDay(schedules: MaintenanceSchedule[]) {
  const groups: Record<string, { dateObj: Date; dateStr: string; items: MaintenanceSchedule[] }> = {};

  const sorted = [...schedules].sort((a, b) => {
    return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
  });

  for (const s of sorted) {
    if (!s.nextRunAt) continue;
    const d = parseISO(s.nextRunAt);
    const key = format(d, "yyyy-MM-dd");

    if (!groups[key]) {
      groups[key] = {
        dateObj: d,
        dateStr: key,
        items: [],
      };
    }
    groups[key].items.push(s);
  }

  return Object.values(groups);
}

function AgendaView({
  schedules,
  onSelectSchedule,
  selectedSchedule,
  onCreateNew,
}: {
  schedules: MaintenanceSchedule[];
  onSelectSchedule: (s: MaintenanceSchedule) => void;
  selectedSchedule: MaintenanceSchedule | null;
  onCreateNew?: () => void;
}) {
  const dayGroups = groupSchedulesByDay(schedules);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Linha do Tempo de Preventivas</h3>
          <p className="text-xs text-muted-foreground">
            Agendamentos agrupados por dia e ordenados por data de vencimento da próxima OS
          </p>
        </div>
      </div>

      {dayGroups.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <CalendarClock className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold text-foreground">Nenhum agendamento encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dayGroups.map((group) => {
            const isTodayDay = isToday(group.dateObj);
            const dateTitle = format(group.dateObj, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

            return (
              <div key={group.dateStr} className="space-y-3">
                {/* Day Group Header */}
                <div className="flex items-center justify-between bg-muted/40 dark:bg-zinc-800/60 px-4 py-2.5 rounded-xl border border-border/60">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isTodayDay ? "bg-primary animate-pulse" : "bg-muted-foreground/60"
                      }`}
                    />
                    <h4 className="text-sm font-bold text-foreground capitalize">
                      {dateTitle}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {isTodayDay && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        Hoje
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? "preventiva" : "preventivas"}
                    </span>
                  </div>
                </div>

                {/* Day Items */}
                <div className="space-y-2.5 pl-2 border-l-2 border-primary/20 dark:border-primary/30 ml-2">
                  {group.items.map((s) => {
                    const status = getScheduleStatus(s);
                    const isSelected = selectedSchedule?.id === s.id;

                    return (
                      <div
                        key={s.id}
                        onClick={() => onSelectSchedule(s)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                            : "border-border bg-white dark:bg-zinc-900/60 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                              status === "overdue"
                                ? "bg-red-500 animate-pulse"
                                : status === "due_soon"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-foreground truncate">{s.title}</p>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                {RECURRENCE_LABELS[s.recurrenceType] ?? s.recurrenceType}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {s.equipment.name}
                              {s.equipment.patrimonyNumber ? ` · Pat. #${s.equipment.patrimonyNumber}` : ""}
                              {s.equipment.location ? ` · ${s.equipment.location.name}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              status === "overdue"
                                ? "bg-red-500/10 text-red-600"
                                : status === "due_soon"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-emerald-500/10 text-emerald-600"
                            }`}
                          >
                            {status === "overdue" ? "Vencido" : status === "due_soon" ? "Esta semana" : "Em dia"}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
