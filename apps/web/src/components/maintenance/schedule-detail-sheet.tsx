"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Power,
  PowerOff,
  Pencil,
  Zap,
  Trash2,
  User,
  Building2,
  Repeat,
  CalendarRange,
  Activity,
  Wrench,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
import { useToggleSchedule, useTriggerSchedule, useDeleteMaintenanceSchedule } from "@/hooks/maintenance/use-maintenance-schedule";
import type { MaintenanceSchedule } from "@/services/maintenance/maintenance-schedule.service";

// ─── Types & helpers ──────────────────────────────────────────────────────────

type ScheduleStatus = "overdue" | "due_soon" | "active" | "inactive";

export function getScheduleStatus(s: MaintenanceSchedule): ScheduleStatus {
  if (!s.isActive) return "inactive";
  const next = new Date(s.nextRunAt);
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (next < now) return "overdue";
  if (next <= sevenDays) return "due_soon";
  return "active";
}

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

const MAINTENANCE_TYPE_COLORS: Record<string, string> = {
  PREVENTIVE: "bg-blue-50 text-blue-700 ring-blue-200",
  CORRECTIVE: "bg-orange-50 text-orange-700 ring-orange-200",
  INITIAL_ACCEPTANCE: "bg-purple-50 text-purple-700 ring-purple-200",
  EXTERNAL_SERVICE: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  TECHNOVIGILANCE: "bg-rose-50 text-rose-700 ring-rose-200",
  TRAINING: "bg-green-50 text-green-700 ring-green-200",
  IMPROPER_USE: "bg-amber-50 text-amber-700 ring-amber-200",
  DEACTIVATION: "bg-gray-50 text-gray-700 ring-gray-200",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Days until / since nextRunAt */
function daysUntil(iso: string): { label: string; urgent: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 0)
    return { label: `${Math.abs(days)} dia${Math.abs(days) !== 1 ? "s" : ""} em atraso`, urgent: true };
  if (days === 0) return { label: "Hoje!", urgent: true };
  if (days === 1) return { label: "Amanhã", urgent: true };
  return { label: `em ${days} dia${days !== 1 ? "s" : ""}`, urgent: days <= 7 };
}

/** Visual progress of current interval: lastRunAt → nextRunAt */
function IntervalProgress({ schedule }: { schedule: MaintenanceSchedule }) {
  if (!schedule.lastRunAt) return null;
  const start = new Date(schedule.lastRunAt).getTime();
  const end = new Date(schedule.nextRunAt).getTime();
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  const overdue = now > end;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Progresso do intervalo</span>
        <span className={overdue ? "text-red-600 font-medium" : ""}>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            overdue ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatDate(schedule.lastRunAt)}</span>
        <span>{formatDate(schedule.nextRunAt)}</span>
      </div>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <div className="text-sm font-medium text-foreground leading-snug">{children}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ schedule }: { schedule: MaintenanceSchedule }) {
  const status = getScheduleStatus(schedule);
  const cfgs = {
    overdue: { label: "Vencido", cls: "bg-red-50 text-red-700 ring-1 ring-red-200", Icon: AlertTriangle },
    due_soon: { label: "Esta semana", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", Icon: Clock },
    active: { label: "Em dia", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", Icon: CheckCircle2 },
    inactive: { label: "Inativo", cls: "bg-gray-100 text-gray-500 ring-1 ring-gray-200", Icon: XCircle },
  };
  const { label, cls, Icon } = cfgs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScheduleDetailSheetProps {
  schedule: MaintenanceSchedule | null;
  onClose: () => void;
  onEdit: (schedule: MaintenanceSchedule) => void;
  onDeleted?: () => void;
  isManager: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleDetailSheet({
  schedule,
  onClose,
  onEdit,
  onDeleted,
  isManager,
}: ScheduleDetailSheetProps) {
  const [confirmTrigger, setConfirmTrigger] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = useToggleSchedule();
  const triggerGen = useTriggerSchedule();
  const deleteSchedule = useDeleteMaintenanceSchedule();

  if (!schedule) return null;

  const status = getScheduleStatus(schedule);
  const dt = daysUntil(schedule.nextRunAt);
  const typeColor = MAINTENANCE_TYPE_COLORS[schedule.maintenanceType] ?? "bg-gray-50 text-gray-700 ring-gray-200";

  function handleToggle() {
    toggle.mutate({ id: schedule!.id, isActive: !schedule!.isActive });
  }

  function handleTrigger() {
    if (!schedule?.clientId) return;
    triggerGen.mutate(schedule.clientId, { onSuccess: () => setConfirmTrigger(false) });
  }

  function handleDelete() {
    if (!schedule?.clientId) return;
    deleteSchedule.mutate(
      { clientId: schedule.clientId, id: schedule.id },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          onClose();
          onDeleted?.();
        },
      }
    );
  }

  return (
    <>
      <Sheet open={!!schedule} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="px-5 py-4 border-b border-border bg-muted/20 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }}
                >
                  <CalendarClock className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-bold leading-tight truncate">
                    {schedule.title}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {schedule.equipment.name}
                    {schedule.equipment.brand && ` · ${schedule.equipment.brand}`}
                  </p>
                </div>
              </div>
              <StatusBadge schedule={schedule} />
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-0">

            {/* Progress Bar */}
            <IntervalProgress schedule={schedule} />

            {/* Next run highlight */}
            <div
              className={`mt-4 rounded-xl p-3.5 flex items-center gap-3 ${
                status === "overdue"
                  ? "bg-red-50 border border-red-200"
                  : status === "due_soon"
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-emerald-50 border border-emerald-200"
              }`}
            >
              <CalendarRange className={`w-5 h-5 flex-shrink-0 ${
                status === "overdue" ? "text-red-500" : status === "due_soon" ? "text-amber-500" : "text-emerald-500"
              }`} />
              <div>
                <p className={`text-sm font-semibold ${
                  status === "overdue" ? "text-red-700" : status === "due_soon" ? "text-amber-700" : "text-emerald-700"
                }`}>
                  {schedule.isActive
                    ? `Próxima OS: ${formatDate(schedule.nextRunAt)} (${dt.label})`
                    : "Agendamento inativo"}
                </p>
                {schedule.lastRunAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Última geração: {formatDate(schedule.lastRunAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Execuções counter */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-white p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{schedule._count.maintenances}</p>
                <p className="text-xs text-muted-foreground mt-0.5">OS geradas</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-3 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {schedule.estimatedDurationMin
                    ? `${schedule.estimatedDurationMin} min`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Duração estimada</p>
              </div>
            </div>

            {/* Details */}
            <div className="mt-5">
              <SectionTitle>Configuração</SectionTitle>
              <div className="bg-white rounded-lg border border-border divide-y divide-border px-3">
                <InfoRow icon={Wrench} label="Tipo de manutenção">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${typeColor}`}>
                    {MAINTENANCE_TYPE_LABELS[schedule.maintenanceType] ?? schedule.maintenanceType}
                  </span>
                </InfoRow>
                <InfoRow icon={Repeat} label="Recorrência">
                  {RECURRENCE_LABELS[schedule.recurrenceType] ?? schedule.recurrenceType}
                  {schedule.recurrenceType === "CUSTOM" && schedule.customIntervalDays
                    ? ` (${schedule.customIntervalDays} dias)`
                    : ""}
                </InfoRow>
                <InfoRow icon={CalendarRange} label="Período">
                  {formatDate(schedule.startDate)}
                  {schedule.endDate ? ` → ${formatDate(schedule.endDate)}` : " → sem data fim"}
                </InfoRow>
              </div>
            </div>

            <div className="mt-3">
              <SectionTitle>Responsável</SectionTitle>
              <div className="bg-white rounded-lg border border-border divide-y divide-border px-3">
                <InfoRow icon={User} label="Técnico">
                  {schedule.assignedTechnician?.name ?? (
                    <span className="text-muted-foreground/50 italic text-sm">Nenhum técnico vinculado</span>
                  )}
                </InfoRow>
                <InfoRow icon={Activity} label="Grupo">
                  {schedule.group ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: schedule.group.color ? `${schedule.group.color}20` : "#f3f4f6",
                        color: schedule.group.color ?? "#374151",
                        border: `1px solid ${schedule.group.color ?? "#d1d5db"}`,
                      }}
                    >
                      {schedule.group.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 italic text-sm">Nenhum grupo</span>
                  )}
                </InfoRow>
                {schedule.client && (
                  <InfoRow icon={Building2} label="Cliente">
                    {schedule.client.name}
                  </InfoRow>
                )}
              </div>
            </div>

            {schedule.description && (
              <div className="mt-3">
                <SectionTitle>Descrição</SectionTitle>
                <div className="bg-white rounded-lg border border-border p-3">
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {schedule.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {isManager && (
            <div className="border-t border-border p-4 bg-muted/10 flex-shrink-0 space-y-2">
              {/* Row 1: Edit + Toggle */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-9"
                  onClick={() => onEdit(schedule)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex-1 gap-1.5 text-xs h-9 ${
                    schedule.isActive
                      ? "text-muted-foreground hover:text-destructive hover:border-destructive"
                      : "text-emerald-600 hover:border-emerald-500"
                  }`}
                  disabled={toggle.isPending}
                  onClick={handleToggle}
                >
                  {toggle.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : schedule.isActive ? (
                    <PowerOff className="w-3.5 h-3.5" />
                  ) : (
                    <Power className="w-3.5 h-3.5" />
                  )}
                  {schedule.isActive ? "Desativar" : "Ativar"}
                </Button>
                {schedule.clientId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
                    title="Excluir agendamento"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              {/* Row 2: Force OS */}
              {schedule.isActive && schedule.clientId && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-1.5 text-xs h-9 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 border-0"
                  onClick={() => setConfirmTrigger(true)}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Forçar geração de OS agora
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm trigger dialog */}
      <AlertDialog open={confirmTrigger} onOpenChange={setConfirmTrigger}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forçar geração de OS</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá gerar uma OS preventiva imediatamente para{" "}
              <strong>{schedule.title}</strong>, independente do prazo agendado.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-r from-emerald-500 to-blue-600 border-0"
              disabled={triggerGen.isPending}
              onClick={handleTrigger}
            >
              {triggerGen.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              Excluir agendamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{schedule.title}</strong>?{" "}
              O agendamento será desativado e não gerará mais OS preventivas automaticamente.
              O histórico de OS já geradas será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteSchedule.isPending}
              onClick={handleDelete}
            >
              {deleteSchedule.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>
              ) : (
                "Excluir agendamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
