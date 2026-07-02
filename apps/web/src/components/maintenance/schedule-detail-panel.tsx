"use client";

import { useState } from "react";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Power,
  Ban,
  Pencil,
  Play,
  Trash2,
  User,
  Wrench,
  Loader2,
  ExternalLink,
  X,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { MaintenanceSchedule } from "@/services/maintenance/maintenance-schedule.service";

// ─── Types & helpers ──────────────────────────────────────────────────────────

type ScheduleStatus = "overdue" | "due_soon" | "active" | "inactive" | "expired";

export function getScheduleStatus(s: MaintenanceSchedule): ScheduleStatus {
  if (!s.isActive) return "inactive";
  const now = new Date();
  if (s.endDate && new Date(s.endDate) < now) return "expired";
  const next = new Date(s.nextRunAt);
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

const STATUS_META: Record<ScheduleStatus, { label: string; caption: string; cls: string; Icon: React.ElementType }> = {
  overdue: { label: "Vencido", caption: "Próxima OS já passou do prazo", cls: "bg-red-50 text-red-700 ring-1 ring-red-200", Icon: AlertTriangle },
  due_soon: { label: "Esta semana", caption: "Próxima OS nos próximos 7 dias", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", Icon: Clock },
  active: { label: "Em dia", caption: "Próxima OS dentro do prazo", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", Icon: CheckCircle2 },
  inactive: { label: "Inativo", caption: "Agendamento inativo", cls: "bg-gray-100 text-gray-500 ring-1 ring-gray-200", Icon: XCircle },
  expired: { label: "Vigência encerrada", caption: "Vigência da preventiva encerrada", cls: "bg-gray-100 text-gray-500 ring-1 ring-gray-200", Icon: CalendarX },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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
        <span className={overdue ? "text-red-600 font-medium" : "font-medium text-emerald-600"}>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${overdue ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, bold, children }: { label: string; bold?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className={`text-sm ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{children}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 pt-3 border-t border-border first:mt-0 first:pt-0 first:border-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScheduleDetailPanelProps {
  schedule: MaintenanceSchedule;
  onClose: () => void;
  onEdit: (schedule: MaintenanceSchedule) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleDetailPanel({ schedule, onClose, onEdit }: ScheduleDetailPanelProps) {
  const { canAccess } = usePermissions();
  const canEdit = canAccess("maintenance-schedule", "update");
  const canDelete = canAccess("maintenance-schedule", "delete");
  const canTrigger = canAccess("maintenance-schedule", "trigger");

  const [confirmTrigger, setConfirmTrigger] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = useToggleSchedule();
  const triggerGen = useTriggerSchedule();
  const deleteSchedule = useDeleteMaintenanceSchedule();

  const status = getScheduleStatus(schedule);
  const meta = STATUS_META[status];
  const dt = daysUntil(schedule.nextRunAt);
  const typeColor = MAINTENANCE_TYPE_COLORS[schedule.maintenanceType] ?? "bg-gray-50 text-gray-700 ring-gray-200";

  function handleToggle() {
    toggle.mutate({ id: schedule.id, isActive: !schedule.isActive });
  }

  function handleTrigger() {
    if (!schedule.clientId) return;
    triggerGen.mutate(
      { clientId: schedule.clientId, id: schedule.id },
      { onSuccess: () => setConfirmTrigger(false) }
    );
  }

  function handleDelete() {
    if (!schedule.clientId) return;
    deleteSchedule.mutate(
      { clientId: schedule.clientId, id: schedule.id },
      { onSuccess: () => { setConfirmDelete(false); onClose(); } }
    );
  }

  return (
    <>
      <div className="fixed inset-y-0 inset-x-0 lg:left-auto lg:right-0 lg:w-[380px] z-40 bg-white dark:bg-zinc-950 border-t lg:border-t-0 lg:border-l border-border shadow-xl overflow-y-auto">
        <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-base font-bold text-foreground leading-tight pr-2">{schedule.title}</h3>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 -mt-0.5" title="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4 truncate">
              {schedule.equipment.name}
              {schedule.equipment.brand ? ` · ${schedule.equipment.brand}` : ""}
            </p>

            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.cls}`}>
                <meta.Icon className="w-3 h-3" />
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground">{meta.caption}</span>
            </div>

            <IntervalProgress schedule={schedule} />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Calendar className="w-3 h-3" />
                  Última geração
                </div>
                <div className="text-sm font-semibold text-foreground">{formatDate(schedule.lastRunAt)}</div>
              </div>
              <div className="border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-primary mb-1">
                  <CalendarClock className="w-3 h-3" />
                  Próxima geração
                </div>
                <div className="text-sm font-semibold text-foreground">{formatDate(schedule.nextRunAt)}</div>
                {schedule.isActive && (
                  <div className={`text-xs font-medium mt-0.5 ${dt.urgent ? "text-red-500" : "text-muted-foreground"}`}>
                    {dt.label}
                  </div>
                )}
              </div>
            </div>

            {/* Equipamento */}
            <SectionTitle icon={Wrench}>Equipamento</SectionTitle>
            <InfoRow label="Equipamento" bold>
              <Link
                href={`/equipamentos?detail=${schedule.equipment.id}`}
                className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                onClick={onClose}
              >
                {schedule.equipment.name}
                {schedule.equipment.brand ? ` · ${schedule.equipment.brand}` : ""}
                <ExternalLink className="w-3 h-3 ml-0.5 flex-shrink-0" />
              </Link>
            </InfoRow>
            {schedule.equipment.patrimonyNumber && (
              <InfoRow label="Pat.">
                <span className="font-mono">{schedule.equipment.patrimonyNumber}</span>
              </InfoRow>
            )}
            <InfoRow label="Centro de custo" bold>
              {schedule.equipment.costCenter ? (
                <span>
                  {schedule.equipment.costCenter.name}
                  {schedule.equipment.costCenter.code ? (
                    <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                      ({schedule.equipment.costCenter.code})
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground/50 italic">Não definido</span>
              )}
            </InfoRow>
            <InfoRow label="Localização" bold>
              {schedule.equipment.location?.name ?? (
                <span className="text-muted-foreground/50 italic">Não definida</span>
              )}
            </InfoRow>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="OS geradas" bold>{schedule._count.maintenances}</InfoRow>
              <InfoRow label="Duração estimada" bold>
                {schedule.estimatedDurationMin ? `${schedule.estimatedDurationMin} min` : "—"}
              </InfoRow>
            </div>

            {/* Configuração */}
            <SectionTitle icon={Settings2}>Configuração</SectionTitle>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tipo de manutenção</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${typeColor}`}>
                  {MAINTENANCE_TYPE_LABELS[schedule.maintenanceType] ?? schedule.maintenanceType}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Recorrência</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary ring-1 ring-primary/20">
                  {RECURRENCE_LABELS[schedule.recurrenceType] ?? schedule.recurrenceType}
                  {schedule.recurrenceType === "CUSTOM" && schedule.customIntervalDays
                    ? ` (${schedule.customIntervalDays} dias)`
                    : ""}
                </span>
              </div>
            </div>
            <InfoRow label="Período">
              <span className="flex items-center gap-2">
                {formatDate(schedule.startDate)}
                <span className="text-muted-foreground/40">→</span>
                {schedule.endDate ? formatDate(schedule.endDate) : "sem data fim"}
              </span>
            </InfoRow>
            <InfoRow label="Responsável técnico">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                {schedule.assignedTechnician?.name ?? "Nenhum técnico vinculado"}
              </span>
            </InfoRow>
            <InfoRow label="Grupo">
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
                <span className="text-muted-foreground/50 italic">Nenhum grupo</span>
              )}
            </InfoRow>
            {schedule.client && (
              <InfoRow label="Cliente">{schedule.client.name}</InfoRow>
            )}
            {schedule.description && (
              <InfoRow label="Descrição">
                <span className="whitespace-pre-wrap">{schedule.description}</span>
              </InfoRow>
            )}

            {/* Ações */}
            {(canEdit || canDelete || canTrigger) && (
              <>
                <SectionTitle icon={SlidersHorizontal}>Ações</SectionTitle>
                <div className="flex flex-col gap-2">
                  {canEdit && (
                    <Button
                      variant="outline"
                      className="justify-center gap-2 text-sm h-10 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                      onClick={() => onEdit(schedule)}
                    >
                      <Pencil className="w-4 h-4" />
                      Editar agendamento
                    </Button>
                  )}
                  {canTrigger && schedule.isActive && schedule.clientId && (
                    <Button
                      variant="outline"
                      className="justify-center gap-2 text-sm h-10"
                      disabled={triggerGen.isPending}
                      onClick={() => setConfirmTrigger(true)}
                    >
                      <Play className="w-4 h-4" />
                      Gerar OS agora
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="outline"
                      className={`justify-center gap-2 text-sm h-10 ${
                        schedule.isActive
                          ? "border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                          : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                      }`}
                      disabled={toggle.isPending}
                      onClick={handleToggle}
                    >
                      {toggle.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : schedule.isActive ? (
                        <Ban className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                      {schedule.isActive ? "Inativar agendamento" : "Ativar agendamento"}
                    </Button>
                  )}
                  {canDelete && schedule.clientId && (
                    <Button
                      variant="outline"
                      className="justify-center gap-2 text-sm h-10 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir agendamento
                    </Button>
                  )}
                </div>
              </>
            )}
        </div>
      </div>

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
