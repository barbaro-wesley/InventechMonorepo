"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, CalendarClock, AlertTriangle, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateMaintenanceSchedule,
  useUpdateMaintenanceSchedule,
  useMaintenanceGroups,
} from "@/hooks/maintenance/use-maintenance-schedule";
import { useCurrentUser } from "@/store/auth.store";
import { useUsers } from "@/hooks/users/use-users";
import { api } from "@/lib/api";
import type { MaintenanceSchedule, MaintenanceType, RecurrenceType } from "@/services/maintenance/maintenance-schedule.service";

// ─── Labels ───────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  clientId: string;
  equipmentId: string;
  title: string;
  description: string;
  maintenanceType: MaintenanceType;
  recurrenceType: RecurrenceType;
  customIntervalDays: number;
  estimatedDurationMin: number;
  assignedTechnicianId: string;
  groupId: string;
  startDate: string;
  endDate: string;
};

interface SimpleOption {
  id: string;
  name: string;
}

interface EquipmentOption {
  id: string;
  name: string;
  brand: string | null;
  patrimonyNumber: string | null;
  group?: { id: string; name: string } | null;
}

interface ScheduleFormSheetProps {
  /** Pass `null` for create mode, a schedule object for edit mode */
  mode: "create" | "edit";
  schedule?: MaintenanceSchedule | null;
  /** For create mode: pre-fill equipment */
  prefilledEquipment?: EquipmentOption | null;
  open: boolean;
  onClose: () => void;
}

// ─── Helper label ─────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-semibold text-foreground/80">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleFormSheet({
  mode,
  schedule,
  prefilledEquipment,
  open,
  onClose,
}: ScheduleFormSheetProps) {
  const currentUser = useCurrentUser();
  const fixedClientId = currentUser?.clientId ?? null;

  const [clients, setClients] = useState<SimpleOption[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentOption | null>(
    prefilledEquipment ?? null
  );
  const [loadingEquipment, setLoadingEquipment] = useState(false);

  const createSchedule = useCreateMaintenanceSchedule();
  const updateSchedule = useUpdateMaintenanceSchedule();
  const { data: groups = [] } = useMaintenanceGroups();
  const { data: usersData } = useUsers({ limit: 100 });
  const technicians = usersData?.data ?? [];

  const form = useForm<FormData>({
    defaultValues: {
      clientId: fixedClientId ?? "",
      recurrenceType: "MONTHLY",
      maintenanceType: "PREVENTIVE",
      estimatedDurationMin: 60,
      startDate: new Date().toISOString().split("T")[0],
    },
  });

  const recurrenceType = form.watch("recurrenceType");

  // Reset form on open
  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && schedule) {
      form.reset({
        clientId: schedule.clientId ?? fixedClientId ?? "",
        equipmentId: schedule.equipment.id,
        title: schedule.title,
        description: schedule.description ?? "",
        maintenanceType: schedule.maintenanceType,
        recurrenceType: schedule.recurrenceType,
        customIntervalDays: schedule.customIntervalDays ?? undefined,
        estimatedDurationMin: schedule.estimatedDurationMin ?? 60,
        assignedTechnicianId: schedule.assignedTechnician?.id ?? "",
        groupId: schedule.group?.id ?? "",
        startDate: schedule.startDate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
        endDate: schedule.endDate?.split("T")[0] ?? "",
      });
      setSelectedEquipment({ ...schedule.equipment, patrimonyNumber: null });
    } else {
      form.reset({
        clientId: fixedClientId ?? "",
        recurrenceType: "MONTHLY",
        maintenanceType: "PREVENTIVE",
        estimatedDurationMin: 60,
        startDate: new Date().toISOString().split("T")[0],
      });
      setSelectedEquipment(prefilledEquipment ?? null);
      setEquipmentSearch("");
    }

    // Load clients if company level
    if (!fixedClientId) {
      api.get("/clients", { params: { limit: 100 } }).then(({ data }) => {
        setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
      });
    }
  }, [open]);

  // Load equipment when search changes
  useEffect(() => {
    if (mode === "edit") return;
    if (equipmentSearch.length < 2) {
      setEquipmentList([]);
      return;
    }
    setLoadingEquipment(true);
    api
      .get("/equipment", { params: { search: equipmentSearch, limit: 20 } })
      .then(({ data }) => {
        const items: EquipmentOption[] = (data?.data ?? data ?? []).map((e: any) => ({
          id: e.id,
          name: e.name,
          brand: e.brand,
          patrimonyNumber: e.patrimonyNumber ?? null,
          group: e.type?.group ?? null,
        }));
        setEquipmentList(items);
      })
      .finally(() => setLoadingEquipment(false));
  }, [equipmentSearch, mode]);

  const onSubmit = (values: FormData) => {
    if (mode === "create") {
      if (!selectedEquipment) return;
      createSchedule.mutate(
        {
          clientId: values.clientId,
          equipmentId: selectedEquipment.id,
          title: values.title,
          description: values.description || undefined,
          maintenanceType: values.maintenanceType,
          recurrenceType: values.recurrenceType,
          ...(values.recurrenceType === "CUSTOM" && {
            customIntervalDays: Number(values.customIntervalDays),
          }),
          estimatedDurationMin: Number(values.estimatedDurationMin) || undefined,
          groupId: values.groupId || undefined,
          assignedTechnicianId: values.assignedTechnicianId || undefined,
          startDate: values.startDate,
          endDate: values.endDate || undefined,
        },
        { onSuccess: () => { form.reset(); onClose(); } }
      );
    } else if (schedule) {
      updateSchedule.mutate(
        {
          clientId: schedule.clientId ?? "",
          id: schedule.id,
          dto: {
            title: values.title,
            description: values.description || undefined,
            recurrenceType: values.recurrenceType,
            ...(values.recurrenceType === "CUSTOM" && {
              customIntervalDays: Number(values.customIntervalDays),
            }),
            estimatedDurationMin: Number(values.estimatedDurationMin) || undefined,
            assignedTechnicianId: values.assignedTechnicianId || null,
            groupId: values.groupId || null,
            endDate: values.endDate || null,
          },
        },
        { onSuccess: () => { form.reset(); onClose(); } }
      );
    }
  };

  const isPending = createSchedule.isPending || updateSchedule.isPending;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[720px] sm:max-w-[720px] overflow-y-auto p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }}
            >
              <CalendarClock className="w-4 h-4 text-white" />
            </div>
            <SheetTitle className="text-base font-bold">
              {mode === "create" ? "Nova Preventiva" : "Editar Agendamento"}
            </SheetTitle>
          </div>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Equipamento (create mode: busca dinâmica) */}
            {mode === "create" ? (
              <div className="space-y-1.5">
                <FieldLabel required>Equipamento</FieldLabel>
                {selectedEquipment ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CalendarClock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{selectedEquipment.name}</p>
                      {selectedEquipment.brand && (
                        <p className="text-xs text-muted-foreground">{selectedEquipment.brand}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      onClick={() => { setSelectedEquipment(null); setEquipmentSearch(""); }}
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-9 h-10 text-sm"
                        placeholder="Buscar por nome ou nº de patrimônio..."
                        value={equipmentSearch}
                        onChange={(e) => setEquipmentSearch(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 px-0.5">
                      Busca por nome, marca, série ou nº de patrimônio. Digite ao menos 2 caracteres.
                    </p>
                    {loadingEquipment && (
                      <p className="text-xs text-muted-foreground px-1 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                      </p>
                    )}
                    {equipmentList.length > 0 && (
                      <div className="border border-border rounded-lg bg-white shadow-sm divide-y divide-border max-h-44 overflow-y-auto">
                        {equipmentList.map((eq) => (
                          <button
                            key={eq.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors"
                            onClick={() => {
                              setSelectedEquipment(eq);
                              form.setValue("equipmentId", eq.id);
                              if (eq.group?.id) form.setValue("groupId", eq.group.id);
                              setEquipmentList([]);
                              setEquipmentSearch("");
                            }}
                          >
                            <p className="text-sm font-medium leading-tight">{eq.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {eq.patrimonyNumber && (
                                <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-px rounded">
                                  #{eq.patrimonyNumber}
                                </span>
                              )}
                              {eq.brand && (
                                <span className="text-xs text-muted-foreground">{eq.brand}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {equipmentSearch.length >= 2 && !loadingEquipment && equipmentList.length === 0 && (
                      <p className="text-xs text-muted-foreground px-1">Nenhum equipamento encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <CalendarClock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{schedule?.equipment.name}</p>
                  <p className="text-xs text-muted-foreground">Equipamento não pode ser alterado</p>
                </div>
              </div>
            )}

            {/* Sem grupo alert */}
            {selectedEquipment && !selectedEquipment.group && mode === "create" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  Este equipamento não tem grupo vinculado. As OS geradas não serão roteadas automaticamente para nenhum grupo.
                </p>
              </div>
            )}

            {/* Cliente (somente para company level no modo criar) */}
            {mode === "create" && !fixedClientId && (
              <div className="space-y-1.5">
                <FieldLabel required>Prestador</FieldLabel>
                <Select
                  onValueChange={(v) => form.setValue("clientId", v)}
                  defaultValue={form.getValues("clientId") || undefined}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione o prestador" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Título */}
            <div className="space-y-1.5">
              <FieldLabel required>Título</FieldLabel>
              <Input
                {...form.register("title", { required: "Título obrigatório" })}
                className={`h-10 text-sm ${form.formState.errors.title ? "border-red-500" : ""}`}
                placeholder="Ex: Preventiva mensal — Ar condicionado"
              />
              {form.formState.errors.title && (
                <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Tipo de manutenção + Recorrência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Tipo</FieldLabel>
                <Select
                  defaultValue={form.getValues("maintenanceType") || "PREVENTIVE"}
                  onValueChange={(v) => form.setValue("maintenanceType", v as MaintenanceType)}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Recorrência</FieldLabel>
                <Select
                  defaultValue={form.getValues("recurrenceType") || "MONTHLY"}
                  onValueChange={(v) => form.setValue("recurrenceType", v as RecurrenceType)}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Intervalo customizado */}
            {recurrenceType === "CUSTOM" && (
              <div className="space-y-1.5">
                <FieldLabel required>Intervalo (dias)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  className="h-10 text-sm w-32"
                  {...form.register("customIntervalDays", {
                    required: "Obrigatório para recorrência personalizada",
                    valueAsNumber: true,
                  })}
                  placeholder="45"
                />
                {form.formState.errors.customIntervalDays && (
                  <p className="text-xs text-red-500">{form.formState.errors.customIntervalDays.message}</p>
                )}
              </div>
            )}

            {/* Data início + fim + Duração */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Data de início</FieldLabel>
                <Input
                  type="date"
                  className="h-10 text-sm"
                  {...form.register("startDate", { required: "Data obrigatória" })}
                  disabled={mode === "edit"}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-red-500">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Data de fim</FieldLabel>
                <Input type="date" className="h-10 text-sm" {...form.register("endDate")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Duração estimada (min)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  className="h-10 text-sm"
                  {...form.register("estimatedDurationMin", { valueAsNumber: true })}
                  placeholder="60"
                />
              </div>
            </div>

            {/* Técnico responsável */}
            <div className="space-y-1.5">
              <FieldLabel>Técnico responsável</FieldLabel>
              <Select
                defaultValue={form.getValues("assignedTechnicianId") || "none"}
                onValueChange={(v) => form.setValue("assignedTechnicianId", v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum técnico</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grupo */}
            <div className="space-y-1.5">
              <FieldLabel>Grupo de manutenção</FieldLabel>
              <Select
                defaultValue={form.getValues("groupId") || "none"}
                onValueChange={(v) => form.setValue("groupId", v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Nenhum grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                {...form.register("description")}
                placeholder="Descreva o que deve ser feito nesta preventiva..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 p-5 pt-4 border-t border-border flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-10">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || (mode === "create" && !selectedEquipment)}
              className="flex-1 h-10 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 border-0"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "create" ? "Criar agendamento" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
