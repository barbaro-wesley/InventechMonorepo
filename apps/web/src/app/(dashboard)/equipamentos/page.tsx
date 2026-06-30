"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Wrench,
  Search,
  MapPin,
  Tag,
  ArrowRightLeft,
  HandCoins,
  RotateCcw,
  BarChart2,
  Eye,
  AlertTriangle,
  Paperclip,
  X,
  Upload,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  ExternalLink,
  Monitor,
  DollarSign,
  ClipboardList,
  CalendarClock,
  MoreHorizontal,
  Printer,
  BookOpen,
  Network,
  ChevronDown,
  Layers,
  CheckSquare,
  Square,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useEquipment,
  useEquipmentById,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
  useRecalculateDepreciation,
  useEquipmentServiceOrders,
  useNetworkStats,
} from "@/hooks/equipment/use-equipment";
import { useMovements, useCreateMovement, useReturnEquipment } from "@/hooks/equipment/use-movements";
import { useCustomFieldDefinitions } from "@/hooks/equipment/use-custom-fields";
import { useEquipmentTypes } from "@/hooks/equipment/use-equipment-types";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import { useAttachments, useDeleteAttachment, useUploadAttachment } from "@/hooks/storage/use-attachments";
import { useMaintenanceSchedules, useToggleSchedule } from "@/hooks/maintenance/use-maintenance-schedule";
import type { MaintenanceSchedule } from "@/services/maintenance/maintenance-schedule.service";
import { EquipmentOsCreateSheet } from "@/components/equipment/equipment-os-create-sheet";
import { EquipmentScheduleCreateSheet } from "@/components/equipment/equipment-schedule-create-sheet";
import { EquipmentManualsSheet } from "@/components/equipment/equipment-manuals-sheet";
import { EquipmentAccessoriesTab } from "@/components/equipment/equipment-accessories-tab";
import { OsDetailDrawer } from "@/app/(operacional)/operacional/_components/os-detail-drawer";

import { usePermissions } from "@/hooks/auth/use-permissions";
import { equipmentService } from "@/services/equipment/equipment.service";
import type { Equipment, EquipmentStatus, EquipmentCriticality, EquipmentServiceOrdersResponse } from "@/services/equipment/equipment.service";
import type { InfiniteData } from "@tanstack/react-query";
import type { Movement } from "@/services/equipment/movements.service";
import { storageService } from "@/services/storage/storage.service";

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  ACTIVE: "Ativo",
  BORROWED: "Emprestado",
  UNDER_MAINTENANCE: "Em manutenção",
  INACTIVE: "Inativo",
  DISPOSED: "Descartado",
};

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  BORROWED: "bg-amber-100 text-amber-700 border-amber-200",
  UNDER_MAINTENANCE: "bg-blue-100 text-blue-700 border-blue-200",
  INACTIVE: "bg-gray-100 text-gray-500 border-gray-200",
  DISPOSED: "bg-red-100 text-red-500 border-red-200",
};

const CRITICALITY_LABEL: Record<EquipmentCriticality, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const CRITICALITY_COLOR: Record<EquipmentCriticality, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};

function StatusBadge({ status }: { status: EquipmentStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function CriticalityBadge({ criticality }: { criticality: EquipmentCriticality }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${CRITICALITY_COLOR[criticality]}`}>
      {CRITICALITY_LABEL[criticality]}
    </span>
  );
}

// ─── Equipment Form Schema ────────────────────────────────────────────────────

const equipmentSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  patrimonyNumber: z.string().optional(),
  anvisaNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  typeId: z.string().optional(),
  subtypeId: z.string().optional(),
  locationId: z.string().optional(),
  costCenterId: z.string().optional(),
  purchaseValue: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyEnd: z.string().optional(),
  depreciationRate: z.string().optional(),
  btus: z.string().optional(),
  voltage: z.string().optional(),
  ipAddress: z.string().optional(),
  operatingSystem: z.string().optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
  observations: z.string().optional(),
});
type EquipmentForm = z.infer<typeof equipmentSchema>;

const formatToBRL = (val: string | number) => {
  const cleanValue = val.toString().replace(/\D/g, "");
  if (!cleanValue) return "";
  const cents = parseInt(cleanValue, 10);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

// ─── Equipment Sheet ──────────────────────────────────────────────────────────

function EquipmentSheet({
  open,
  editTarget,
  onClose,
}: {
  open: boolean;
  editTarget: Equipment | null;
  onClose: () => void;
}) {
  const create = useCreateEquipment();
  const update = useUpdateEquipment();
  const uploadAttachment = useUploadAttachment("EQUIPMENT", editTarget?.id ?? "");
  const isPending = create.isPending || update.isPending || uploadAttachment.isPending;

  const { data: types = [] } = useEquipmentTypes();
  const { data: costCenters = [] } = useCostCenters({ limit: 100 });

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const { data: customFieldDefs = [] } = useCustomFieldDefinitions();
  const activeCustomFields = customFieldDefs.filter((d) => d.isActive);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EquipmentForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(equipmentSchema) as any,
    defaultValues: {
      name: "", brand: "", model: "", serialNumber: "", patrimonyNumber: "", anvisaNumber: "", invoiceNumber: "",
      typeId: "", subtypeId: "", locationId: "", costCenterId: "",
      purchaseValue: "", purchaseDate: "", warrantyEnd: "", depreciationRate: "",
      btus: "", voltage: "", ipAddress: "", operatingSystem: "",
      criticality: "MEDIUM", observations: "",
    },
  });

  useEffect(() => {
    if (editTarget) {
      reset({
        name: editTarget.name,
        brand: editTarget.brand ?? "",
        model: editTarget.model ?? "",
        serialNumber: editTarget.serialNumber ?? "",
        patrimonyNumber: editTarget.patrimonyNumber ?? "",
        anvisaNumber: editTarget.anvisaNumber ?? "",
        invoiceNumber: editTarget.invoiceNumber ?? "",
        typeId: editTarget.type?.id ?? "",
        subtypeId: editTarget.subtype?.id ?? "",
        locationId: editTarget.location?.id ?? "",
        costCenterId: editTarget.costCenter?.id ?? "",
        purchaseValue: editTarget.purchaseValue != null ? formatToBRL(Math.round(editTarget.purchaseValue * 100)) : "",
        purchaseDate: editTarget.purchaseDate ? editTarget.purchaseDate.substring(0, 10) : "",
        warrantyEnd: editTarget.warrantyEnd ? editTarget.warrantyEnd.substring(0, 10) : "",
        depreciationRate: editTarget.depreciationRate != null ? String(editTarget.depreciationRate) : "",
        btus: editTarget.btus?.toString() ?? "",
        voltage: editTarget.voltage ?? "",
        ipAddress: editTarget.ipAddress ?? "",
        operatingSystem: editTarget.operatingSystem ?? "",
        criticality: editTarget.criticality,
        observations: editTarget.observations ?? "",
      });
      const vals: Record<string, string> = {};
      (editTarget.customFieldValues ?? []).forEach((v) => {
        vals[v.definitionId] = v.value ?? "";
      });
      setCustomFieldValues(vals);
    } else {
      reset({
        name: "", brand: "", model: "", serialNumber: "", patrimonyNumber: "", anvisaNumber: "", invoiceNumber: "",
        typeId: "", subtypeId: "", locationId: "", costCenterId: "",
        purchaseValue: "", purchaseDate: "", warrantyEnd: "", depreciationRate: "",
        btus: "", voltage: "", ipAddress: "", operatingSystem: "",
        criticality: "MEDIUM", observations: "",
      });
      setCustomFieldValues({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget?.id]);

  const watchedVoltage = watch("voltage");
  const voltageOption = ["110V", "220V", "Bivolt", ""].includes(watchedVoltage || "") ? (watchedVoltage || "") : "Outra";

  const watchedTypeId = watch("typeId");
  const watchedCostCenterId = watch("costCenterId");

  const availableSubtypes = types.find((t) => t.id === watchedTypeId)?.subtypes ?? [];
  const selectedCC = costCenters.find((cc) => cc.id === watchedCostCenterId);
  const availableLocations = selectedCC ? selectedCC.locations : costCenters.flatMap((cc) => cc.locations);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...selected.filter((f) => !existing.has(f.name + f.size))];
    });
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleClose() {
    reset();
    setFiles([]);
    setCustomFieldValues({});
    onClose();
  }

  function onSubmit(data: EquipmentForm) {
    const dtoFields = {
      name: data.name,
      brand: data.brand || undefined,
      model: data.model || undefined,
      serialNumber: data.serialNumber || undefined,
      patrimonyNumber: data.patrimonyNumber || undefined,
      anvisaNumber: data.anvisaNumber || undefined,
      invoiceNumber: data.invoiceNumber || undefined,
      typeId: data.typeId || undefined,
      subtypeId: data.subtypeId || undefined,
      locationId: data.locationId || undefined,
      costCenterId: data.costCenterId || undefined,
      purchaseValue: data.purchaseValue ? (parseInt(data.purchaseValue.replace(/\D/g, ""), 10) / 100).toString() : undefined,
      purchaseDate: data.purchaseDate || undefined,
      warrantyEnd: data.warrantyEnd || undefined,
      depreciationRate: data.depreciationRate || undefined,
      btus: data.btus ? parseInt(data.btus) : undefined,
      voltage: data.voltage || undefined,
      ipAddress: data.ipAddress || undefined,
      operatingSystem: data.operatingSystem || undefined,
      criticality: data.criticality,
      observations: data.observations || undefined,
      customFields: Object.entries(customFieldValues)
        .map(([definitionId, value]) => ({ definitionId, value: value || undefined })),
    };

    if (editTarget) {
      update.mutate({ id: editTarget.id, dto: dtoFields }, {
        onSuccess: async () => {
          if (files.length > 0) {
            await Promise.all(files.map((file) => storageService.upload(file, "EQUIPMENT", editTarget.id)));
          }
          handleClose();
        },
      });
      return;
    }

    if (files.length > 0) {
      const formData = new FormData();
      Object.entries(dtoFields).forEach(([key, value]) => {
        if (value === undefined) return;
        if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });
      files.forEach((file) => formData.append("files", file));
      create.mutate(formData, { onSuccess: handleClose });
    } else {
      create.mutate(dtoFields, { onSuccess: handleClose });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="w-full sm:w-[720px] sm:max-w-[720px] p-0 flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="px-5 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <SheetTitle>{editTarget ? "Editar equipamento" : "Novo equipamento"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Preencha as informações do equipamento.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">
          {/* ── Identificação ── */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</legend>
            <div className="space-y-2">
              <Label htmlFor="eq-name">Nome *</Label>
              <Input id="eq-name" placeholder="Ex: Ar Condicionado UTI 01" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq-brand">Marca</Label>
                <Input id="eq-brand" placeholder="Ex: Daikin" {...register("brand")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-model">Modelo</Label>
                <Input id="eq-model" placeholder="Ex: FVQ140A" {...register("model")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq-serial">Nº de Série</Label>
                <Input id="eq-serial" placeholder="SN-2024-001" {...register("serialNumber")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-patri">Patrimônio</Label>
                <Input id="eq-patri" placeholder="PAT-001" {...register("patrimonyNumber")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq-anvisa">Nº ANVISA</Label>
                <Input id="eq-anvisa" placeholder="80000000000" {...register("anvisaNumber")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-invoice">Nº Nota Fiscal</Label>
                <Input id="eq-invoice" placeholder="NF-001" {...register("invoiceNumber")} />
              </div>
            </div>
          </fieldset>

          {/* ── Classificação ── */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classificação</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  {...register("typeId")}
                  onChange={(e) => { setValue("typeId", e.target.value); setValue("subtypeId", ""); }}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Selecione —</option>
                  {types.filter((t) => t.isActive).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Subtipo</Label>
                <select
                  {...register("subtypeId")}
                  disabled={!watchedTypeId}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                >
                  <option value="">— Selecione —</option>
                  {availableSubtypes.filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Criticidade</Label>
              <select
                {...register("criticality")}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </div>
          </fieldset>

          {/* ── Localização ── */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <select
                  {...register("costCenterId")}
                  onChange={(e) => { setValue("costCenterId", e.target.value); setValue("locationId", ""); }}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Selecione —</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.name}{cc.code ? ` (${cc.code})` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <select
                  {...register("locationId")}
                  disabled={availableLocations.length === 0}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                >
                  <option value="">— Selecione —</option>
                  {availableLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* ── Aquisição ── */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aquisição</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq-pval">Valor de compra</Label>
                <Input
                  id="eq-pval"
                  placeholder="R$ 0,00"
                  {...register("purchaseValue")}
                  onChange={(e) => {
                    const formatted = formatToBRL(e.target.value);
                    setValue("purchaseValue", formatted);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-pdate">Data de compra</Label>
                <Input id="eq-pdate" type="date" {...register("purchaseDate")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq-wend">Fim da garantia</Label>
                <Input id="eq-wend" type="date" {...register("warrantyEnd")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-depr">Depreciação (% /ano)</Label>
                <Input id="eq-depr" placeholder="10.00" {...register("depreciationRate")} />
              </div>
            </div>
          </fieldset>

          {/* ── Técnico ── */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Técnico</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq-btus">BTUs</Label>
                <Input id="eq-btus" placeholder="48000" type="number" {...register("btus")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-volt">Tensão</Label>
                <div className="space-y-2">
                  <select
                    id="eq-volt-select"
                    value={voltageOption}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "Outra") {
                        setValue("voltage", " "); // Space acting as a trigger for "Other" mode while being truthy
                      } else {
                        setValue("voltage", val);
                      }
                    }}
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Selecione —</option>
                    <option value="110V">110V</option>
                    <option value="220V">220V</option>
                    <option value="Bivolt">Bivolt</option>
                    <option value="Outra">Outra (Digitar manual)</option>
                  </select>

                  {voltageOption === "Outra" && (
                    <Input
                      id="eq-volt-custom"
                      placeholder="Ex: 380V ou Trifásico"
                      autoFocus
                      {...register("voltage")}
                      value={watchedVoltage === " " ? "" : watchedVoltage}
                      onChange={(e) => setValue("voltage", e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq-ip">Endereço IP</Label>
                <Input id="eq-ip" placeholder="192.168.1.100" {...register("ipAddress")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq-os">Sistema Operacional</Label>
                <Input id="eq-os" placeholder="Windows 11" {...register("operatingSystem")} />
              </div>
            </div>
          </fieldset>

          {/* ── Observações ── */}
          <div className="space-y-2">
            <Label htmlFor="eq-obs">Observações</Label>
            <Textarea
              id="eq-obs"
              placeholder="Informações adicionais sobre o equipamento..."
              rows={3}
              {...register("observations")}
            />
          </div>

          {/* ── Campos Personalizados ── */}
          {activeCustomFields.length > 0 && (
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Campos Personalizados
              </legend>
              {activeCustomFields.map((def) => {
                const value = customFieldValues[def.id] ?? "";
                const onChange = (v: string) =>
                  setCustomFieldValues((prev) => ({ ...prev, [def.id]: v }));

                return (
                  <div key={def.id} className="space-y-2">
                    <Label>
                      {def.name}
                      {def.required && <span className="text-destructive ml-1">*</span>}
                    </Label>

                    {def.fieldType === "TEXT" && (
                      <Input value={value} onChange={(e) => onChange(e.target.value)} />
                    )}

                    {def.fieldType === "NUMBER" && (
                      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
                    )}

                    {def.fieldType === "DATE" && (
                      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
                    )}

                    {def.fieldType === "BOOLEAN" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`cf-${def.id}`}
                          checked={value === "true"}
                          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
                          className="w-4 h-4 accent-primary"
                        />
                        <label htmlFor={`cf-${def.id}`} className="text-sm">Sim</label>
                      </div>
                    )}

                    {def.fieldType === "SELECT" && (
                      <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        {(def.options as string[])?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </fieldset>
          )}

          {/* ── Anexos (somente criação) ── */}
          {!editTarget && (
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Anexos <span className="font-normal normal-case text-muted-foreground">(opcional)</span>
              </legend>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-muted-foreground hover:text-primary"
              >
                <Upload className="w-4 h-4" />
                Clique para selecionar arquivos
                <span className="text-xs">(PDF, imagens, documentos)</span>
              </button>

              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-xs truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          )}

        </div>

        <div className="flex gap-2 p-5 pt-4 border-t border-border flex-shrink-0">
          <Button type="button" variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              : editTarget ? "Salvar" : "Cadastrar equipamento"}
          </Button>
        </div>
      </form>
      </SheetContent>
    </Sheet>
  );
}
function MovementRow({ movement }: { movement: Movement }) {
  const isActive = movement.status === "ACTIVE";
  const isLoan = movement.type === "LOAN";
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${isActive ? "border-amber-200 bg-amber-50/50 shadow-sm" : "border-border bg-card hover:bg-muted/30"}`}>
      <div className={`flex-shrink-0 p-2 rounded-lg ${isLoan ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
        {isLoan ? <HandCoins className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm">{isLoan ? "Empréstimo" : "Transferência"}</span>
          <div className="flex items-center gap-1.5">
            {isActive && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">Ativo</span>}
            {movement.status === "RETURNED" && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Devolvido</span>}
            {movement.status === "CANCELLED" && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider">Cancelado</span>}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <span className="truncate">{movement.origin.name}</span>
          <ArrowRightLeft className="w-3 h-3 flex-shrink-0 opacity-50" />
          <span className="truncate">{movement.destination.name}</span>
        </div>
        {movement.reason && <p className="text-xs text-slate-500 mt-1.5 line-clamp-1 italic">"{movement.reason}"</p>}
        <div className="mt-2 text-[10px] text-muted-foreground/70 font-medium">
          {new Date(movement.createdAt).toLocaleDateString("pt-BR")}
        </div>
      </div>
    </div>
  );
}

function EquipmentCard({
  equipment,
  onView,
  onEdit,
  onMove,
  onDelete,
  onPrint,
  onCreateOs,
  onCreateSchedule,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  equipment: Equipment;
  onView: (e: Equipment) => void;
  onEdit: (e: Equipment) => void;
  onMove: (e: Equipment) => void;
  onDelete: (e: Equipment) => void;
  onPrint: (e: Equipment) => void;
  onCreateOs: (e: Equipment) => void;
  onCreateSchedule: (e: Equipment) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (e: Equipment) => void;
}) {
  const { canAccess } = usePermissions();
  const canEdit = canAccess("equipment", "update");
  const canDelete = canAccess("equipment", "delete");
  const canMove = canAccess("movement", "create");
  const canCreateOs = canAccess("service-order", "create");
  const canSchedule = canAccess("maintenance-schedule", "create");
  return (
    <div
      className={`flex flex-col bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition-colors ${
        selectionMode && selected
          ? "border-primary ring-1 ring-primary/30"
          : "border-slate-200 dark:border-slate-800"
      } ${selectionMode ? "cursor-pointer" : ""}`}
      onClick={selectionMode ? () => onToggleSelect?.(equipment) : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        {selectionMode ? (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
            {selected ? (
              <CheckSquare className="w-6 h-6 text-primary" />
            ) : (
              <Square className="w-6 h-6 text-slate-300 dark:text-slate-700" />
            )}
          </div>
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #3b82f6, #f97316)" }}
          >
            <Wrench className="w-5 h-5 text-white" />
          </div>
        )}
        <StatusBadge status={equipment.status} />
      </div>

      {/* Title */}
      <div className="px-5 pb-3">
        <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--foreground)" }}>
          {equipment.name}
        </p>
        {equipment.type && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[equipment.type.name, equipment.subtype?.name].filter(Boolean).join(" › ")}
          </p>
        )}
        <div className="mt-1.5">
          <CriticalityBadge criticality={equipment.criticality} />
        </div>
      </div>

      {/* Fields */}
      <div className="px-5 pb-4 space-y-1.5 flex-1">
        {equipment.patrimonyNumber && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Patrimônio</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{equipment.patrimonyNumber}</span>
          </div>
        )}
        {(equipment.brand || equipment.model) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Modelo</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{[equipment.brand, equipment.model].filter(Boolean).join(" ")}</span>
          </div>
        )}
        {equipment.serialNumber && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Série</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{equipment.serialNumber}</span>
          </div>
        )}
        {equipment.costCenter && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Centro</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{equipment.costCenter.name}</span>
          </div>
        )}
        {(equipment.currentLocation ?? equipment.location) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Localização</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{(equipment.currentLocation ?? equipment.location)!.name}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {!selectionMode && (
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
        {canEdit && (
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEdit(equipment)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
          </Button>
        )}
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onView(equipment)}>
          <Eye className="w-3.5 h-3.5 mr-1.5" />Detalhes
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPrint(equipment)}>
          <Printer className="w-3.5 h-3.5 mr-1.5" />QR Code
        </Button>
        {(canCreateOs || canSchedule || canMove || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canCreateOs && (
                <DropdownMenuItem onClick={() => onCreateOs(equipment)}>
                  <ClipboardList className="w-3.5 h-3.5 mr-2" />Nova OS
                </DropdownMenuItem>
              )}
              {canSchedule && (
                <DropdownMenuItem onClick={() => onCreateSchedule(equipment)}>
                  <CalendarClock className="w-3.5 h-3.5 mr-2" />Agendar Preventiva
                </DropdownMenuItem>
              )}
              {canMove && equipment.status === "ACTIVE" && (
                <DropdownMenuItem onClick={() => onMove(equipment)}>
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />Movimentar
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={equipment._count.serviceOrders > 0}
                  onClick={() => onDelete(equipment)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  {equipment._count.serviceOrders > 0 ? "Possui OS vinculadas" : "Remover"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      )}
    </div>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono, fullWidth }: { label: string; value: string; mono?: boolean; fullWidth?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">{label}</span>
      {mono ? (
        <code className="text-[12px] font-mono font-semibold bg-muted/60 border border-border/60 rounded-md px-2 py-0.5 w-fit max-w-full break-all" style={{ color: "var(--foreground)" }}>
          {value}
        </code>
      ) : (
        <span className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>{value}</span>
      )}
    </div>
  );
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white dark:bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/40 border-b border-border/50">
        <div className="p-1.5 rounded-lg bg-background border border-border/70 text-primary flex-shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 p-4">
        {children}
      </div>
    </div>
  );
}

function AttachmentIcon({ category }: { category: string }) {
  if (category === "image") return <FileImage className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;
  if (category === "spreadsheet") return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
  if (category === "archive") return <FileArchive className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
  return <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
}

const OS_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta", AWAITING_PICKUP: "Aguardando", IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída", COMPLETED_APPROVED: "Aprovada", COMPLETED_REJECTED: "Reprovada", CANCELLED: "Cancelada",
};
const OS_STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-700", AWAITING_PICKUP: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700", COMPLETED: "bg-violet-100 text-violet-700",
  COMPLETED_APPROVED: "bg-emerald-100 text-emerald-700", COMPLETED_REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};
const OS_TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: "Preventiva", CORRECTIVE: "Corretiva", INITIAL_ACCEPTANCE: "Aceite Inicial",
  EXTERNAL_SERVICE: "Serviço Externo", TECHNOVIGILANCE: "Tecnovigilância",
  TRAINING: "Treinamento", IMPROPER_USE: "Uso Indevido", DEACTIVATION: "Desativação",
};
const OS_PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600", MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700", URGENT: "bg-red-100 text-red-700",
};
const OS_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente",
};

function EquipmentHistoryTab({
  historyData,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onViewOs,
}: {
  historyData: InfiniteData<EquipmentServiceOrdersResponse> | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onViewOs: (id: string, clientId: string | null) => void;
}) {
  const allItems = historyData?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return (
      <div className="mt-4 space-y-2 pb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="mt-4 py-12 text-center pb-6">
        <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Nenhuma ordem de serviço registrada</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2 pb-6">
      {allItems.map((os) => (
        <button
          key={os.id}
          type="button"
          onClick={() => onViewOs(os.id, os.clientId)}
          className="w-full text-left rounded-lg border border-border bg-card px-3 py-2.5 space-y-1.5 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-mono text-muted-foreground flex-shrink-0">#{os.number}</span>
              <span className="text-xs font-medium truncate">{os.title}</span>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${OS_STATUS_COLOR[os.status] ?? ""}`}>
              {OS_STATUS_LABEL[os.status] ?? os.status}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {OS_TYPE_LABEL[os.maintenanceType] ?? os.maintenanceType}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${OS_PRIORITY_COLOR[os.priority] ?? ""}`}>
              {OS_PRIORITY_LABEL[os.priority] ?? os.priority}
            </span>
            {os.actualHours != null && (
              <span className="text-[10px] text-muted-foreground">
                {os.actualHours}h reais
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {os.technicians.length > 0
                ? os.technicians.map((t) => t.technician.name).join(", ")
                : os.requester?.name ?? "—"}
            </span>
            <span>{new Date(os.createdAt).toLocaleDateString("pt-BR")}</span>
          </div>
        </button>
      ))}

      {hasNextPage && (
        <button
          type="button"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </div>
  );
}

function DetailSheet({
  open,
  equipment,
  onClose,
  onEdit,
  onMove,
  onPrint,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
  onEdit: (e: Equipment) => void;
  onMove: (e: Equipment) => void;
  onPrint: (e: Equipment) => void;
}) {
  const [tab, setTab] = React.useState<"info" | "movements" | "attachments" | "history" | "schedules" | "accessories">("info");
  const [selectedHistoryOs, setSelectedHistoryOs] = React.useState<{ id: string; clientId: string | null } | null>(null);
  const [manualsOpen, setManualsOpen] = React.useState(false);
  const [scheduleCreateOpen, setScheduleCreateOpen] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: movements = [], isLoading: movementsLoading } = useMovements(equipment?.id ?? "");
  const { data: attachments = [], isLoading: attachmentsLoading } = useAttachments("EQUIPMENT", equipment?.id ?? "");
  const returnEquipment = useReturnEquipment(equipment?.id ?? "");
  const deleteAttachment = useDeleteAttachment("EQUIPMENT", equipment?.id ?? "");
  const uploadAttachment = useUploadAttachment("EQUIPMENT", equipment?.id ?? "");
  const recalcDepreciation = useRecalculateDepreciation();
  const { data: schedulesData, isLoading: schedulesLoading } = useMaintenanceSchedules(
    equipment?.id ? { equipmentId: equipment.id } : undefined
  );
  const schedules = schedulesData?.data ?? [];
  const toggleSchedule = useToggleSchedule();
  const {
    data: historyData,
    isLoading: historyLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useEquipmentServiceOrders(equipment?.id ?? "");

  const { canAccess } = usePermissions();
  const canEdit = canAccess("equipment", "update");
  const canMove = canAccess("movement", "create");

  if (!equipment) return null;

  const activeMovement = movements.find((m) => m.status === "ACTIVE");

  function handleClose() {
    setTab("info");
    onClose();
  }

  function handleOpenFile(attachmentId: string) {
    window.open(storageService.getDownloadUrl(attachmentId), "_blank");
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAttachment.mutate(file);
    e.target.value = "";
  }

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="gap-0" style={{ maxWidth: "680px", width: "100%" }}>
        {/* Fixed top section: header + action bar + tabs — never scrolls */}
        <div className="flex-shrink-0">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, #3b82f6, #f97316)" }}
            >
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl font-bold truncate tracking-tight">{equipment.name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate uppercase font-medium tracking-wide">
                {[equipment.type?.name, equipment.subtype?.name].filter(Boolean).join(" › ") || "Sem categoria"}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <StatusBadge status={equipment.status} />
                <CriticalityBadge criticality={equipment.criticality} />
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 mt-6 p-1.5 bg-muted/40 rounded-xl border border-border/50">
          {canEdit && (
            <Button size="sm" variant="ghost" className="h-9 sm:h-8 text-xs hover:bg-white hover:shadow-sm transition-all flex-1 basis-[calc(50%-4px)] sm:flex-none justify-center" onClick={() => { handleClose(); onEdit(equipment); }}>
              <Pencil className="w-3.5 h-3.5 mr-1.5 text-blue-500" />Editar
            </Button>
          )}
          {canMove && equipment.status === "ACTIVE" && (
            <Button size="sm" variant="ghost" className="h-9 sm:h-8 text-xs hover:bg-white hover:shadow-sm transition-all flex-1 basis-[calc(50%-4px)] sm:flex-none justify-center" onClick={() => { handleClose(); onMove(equipment); }}>
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-amber-500" />Movimentar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-9 sm:h-8 text-xs hover:bg-white hover:shadow-sm transition-all flex-1 basis-[calc(50%-4px)] sm:flex-none justify-center" onClick={() => { handleClose(); onPrint(equipment); }}>
            <Printer className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />QR Code
          </Button>
          <Button size="sm" variant="ghost" className="h-9 sm:h-8 text-xs hover:bg-white hover:shadow-sm transition-all flex-1 basis-[calc(50%-4px)] sm:flex-none justify-center" onClick={() => window.open(equipmentService.getLifeCyclePdfUrl(equipment.id), "_blank")}>
            <FileText className="w-3.5 h-3.5 mr-1.5 text-violet-500" />Ficha Vida
          </Button>
          <Button size="sm" variant="ghost" className="h-9 sm:h-8 text-xs hover:bg-white hover:shadow-sm transition-all flex-1 basis-[calc(50%-4px)] sm:flex-none justify-center" onClick={() => setManualsOpen(true)}>
            <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />Manuais
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-white overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {[
            { id: "info", label: "Informações", short: "Info" },
            { id: "accessories", label: "Acessórios", short: "Acess." },
            { id: "movements", label: "Movimentações", short: "Movim.", count: movements.length },
            { id: "attachments", label: "Anexos", short: "Anexos", count: attachments.length },
            { id: "history", label: "Histórico", short: "Histórico", count: equipment.totalServiceOrders },
            { id: "schedules", label: "Preventivas", short: "Prev.", count: schedules.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1 px-3 sm:px-4 py-3 text-xs sm:text-sm border-b-2 transition-all whitespace-nowrap flex-shrink-0 justify-center ${tab === t.id
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
            >
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 ${tab === t.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        </div>{/* end fixed section */}

        {/* Scrollable tab content */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Info tab ── */}
        {tab === "info" && (
          <div className="mt-5 space-y-3 pb-8">

            {/* ── Identificadores primários ── */}
            {(equipment.patrimonyNumber || equipment.serialNumber || equipment.anvisaNumber) && (
              <div className="flex flex-wrap gap-2">
                {equipment.patrimonyNumber && (
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[110px] px-3.5 py-3 rounded-xl bg-primary/5 border border-primary/15">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Patrimônio</span>
                    <span className="text-sm font-bold font-mono text-primary">{equipment.patrimonyNumber}</span>
                  </div>
                )}
                {equipment.serialNumber && (
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[110px] px-3.5 py-3 rounded-xl bg-muted/50 border border-border/70">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Nº de Série</span>
                    <span className="text-sm font-bold font-mono" style={{ color: "var(--foreground)" }}>{equipment.serialNumber}</span>
                  </div>
                )}
                {equipment.anvisaNumber && (
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[110px] px-3.5 py-3 rounded-xl bg-muted/50 border border-border/70">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">ANVISA</span>
                    <span className="text-sm font-bold font-mono" style={{ color: "var(--foreground)" }}>{equipment.anvisaNumber}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Identificação ── */}
            {(equipment.brand || equipment.model) && (
              <DetailSection title="Identificação" icon={Tag}>
                {equipment.brand && <DetailRow label="Marca" value={equipment.brand} />}
                {equipment.model && <DetailRow label="Modelo" value={equipment.model} />}
              </DetailSection>
            )}

            {/* ── Localização ── */}
            {(equipment.costCenter || equipment.currentLocation || equipment.location) && (
              <DetailSection title="Localização" icon={MapPin}>
                {equipment.costCenter && (
                  <DetailRow
                    label="Centro de Custo"
                    fullWidth
                    value={`${equipment.costCenter.name}${equipment.costCenter.code ? ` (${equipment.costCenter.code})` : ""}`}
                  />
                )}
                {(equipment.currentLocation ?? equipment.location) && (
                  <DetailRow
                    label="Localização"
                    fullWidth
                    value={(equipment.currentLocation ?? equipment.location)!.name}
                  />
                )}
              </DetailSection>
            )}

            {/* ── Financeiro ── */}
            {(equipment.purchaseValue != null || equipment.purchaseDate || equipment.warrantyEnd || equipment.depreciationRate != null || equipment.invoiceNumber) && (
              <DetailSection title="Financeiro" icon={DollarSign}>
                {equipment.purchaseValue != null && (
                  <DetailRow label="Valor de Compra" value={`R$ ${equipment.purchaseValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                )}
                {equipment.currentValue != null && (
                  <DetailRow label="Valor Atual" value={`R$ ${equipment.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                )}
                {equipment.purchaseDate && (
                  <DetailRow label="Data de Compra" value={new Date(equipment.purchaseDate).toLocaleDateString("pt-BR")} />
                )}
                {equipment.warrantyEnd && (
                  <DetailRow label="Fim da Garantia" value={new Date(equipment.warrantyEnd).toLocaleDateString("pt-BR")} />
                )}
                {equipment.depreciationRate != null && (
                  <DetailRow label="Depreciação" value={`${equipment.depreciationRate}% /ano`} />
                )}
                {equipment.invoiceNumber && (
                  <DetailRow label="Nota Fiscal" value={equipment.invoiceNumber} mono />
                )}
                {equipment.purchaseValue != null && (
                  <div className="sm:col-span-2 pt-1">
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs font-semibold px-4"
                      disabled={recalcDepreciation.isPending}
                      onClick={() => recalcDepreciation.mutate(equipment.id)}
                    >
                      <BarChart2 className="w-3.5 h-3.5 mr-2 text-primary" />
                      {recalcDepreciation.isPending ? "Recalculando..." : "Recalcular depreciação"}
                    </Button>
                  </div>
                )}
              </DetailSection>
            )}

            {/* ── Técnico ── */}
            {(equipment.btus || equipment.voltage || equipment.ipAddress || equipment.operatingSystem || equipment.power) && (
              <DetailSection title="Técnico" icon={Monitor}>
                {equipment.btus && <DetailRow label="BTUs" value={equipment.btus.toLocaleString("pt-BR")} />}
                {equipment.voltage && <DetailRow label="Tensão" value={equipment.voltage} />}
                {equipment.power && <DetailRow label="Potência" value={equipment.power} />}
                {equipment.ipAddress && <DetailRow label="Endereço IP" value={equipment.ipAddress} mono />}
                {equipment.operatingSystem && <DetailRow label="Sistema Operacional" value={equipment.operatingSystem} />}
              </DetailSection>
            )}

            {/* ── Campos Personalizados ── */}
            {(equipment.customFieldValues?.filter((cf) => cf.value).length ?? 0) > 0 && (
              <DetailSection title="Campos Personalizados" icon={Tag}>
                {equipment.customFieldValues!.filter((cf) => cf.value).map((cf) => (
                  <DetailRow key={cf.definitionId} label={cf.definition.name} value={cf.value!} />
                ))}
              </DetailSection>
            )}

            {/* ── Observações ── */}
            {equipment.observations && (
              <div className="rounded-xl border border-border/70 bg-white dark:bg-slate-900/40 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/40 border-b border-border/50">
                  <div className="p-1.5 rounded-lg bg-background border border-border/70 text-primary flex-shrink-0">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Observações</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed p-4">
                  {equipment.observations}
                </p>
              </div>
            )}

            {/* ── Rodapé ── */}
            <div className="pt-2 pb-1 text-center">
              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-medium">
                Cadastrado em {new Date(equipment.createdAt).toLocaleDateString("pt-BR")} às {new Date(equipment.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        )}

        {/* ── Accessories tab ── */}
        {tab === "accessories" && (
          <EquipmentAccessoriesTab equipmentId={equipment.id} />
        )}

        {/* ── Movements tab ── */}
        {tab === "movements" && (
          <div className="mt-4 space-y-3 pb-6">
            {activeMovement && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start justify-between gap-3">
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-amber-800">Movimentação ativa</p>
                  <p className="text-amber-700">{activeMovement.origin.name} → {activeMovement.destination.name}</p>
                  {activeMovement.expectedReturnAt && (
                    <p className="text-amber-600">
                      Retorno previsto: {new Date(activeMovement.expectedReturnAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0"
                  disabled={returnEquipment.isPending}
                  onClick={() => returnEquipment.mutate({ movementId: activeMovement.id })}
                >
                  <RotateCcw className="w-3 h-3 mr-1.5" />
                  {returnEquipment.isPending ? "..." : "Devolver"}
                </Button>
              </div>
            )}

            {movementsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-16 rounded-lg border border-border bg-muted/30 animate-pulse" />)}
              </div>
            ) : movements.length === 0 ? (
              <div className="py-10 text-center">
                <ArrowRightLeft className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {movements.map((m) => <MovementRow key={m.id} movement={m} />)}
              </div>
            )}
          </div>
        )}

        {/* ── History tab ── */}
        {tab === "history" && (
          <EquipmentHistoryTab
            historyData={historyData}
            isLoading={historyLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={!!hasNextPage}
            onLoadMore={fetchNextPage}
            onViewOs={(id, clientId) => setSelectedHistoryOs({ id, clientId })}
          />
        )}

        <OsDetailDrawer
          osId={selectedHistoryOs?.id ?? null}
          clientId={selectedHistoryOs?.clientId ?? null}
          open={!!selectedHistoryOs}
          onClose={() => setSelectedHistoryOs(null)}
        />

        {/* ── Schedules tab ── */}
        {tab === "schedules" && (
          <div className="mt-4 space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {schedules.length === 0 ? "Nenhum agendamento cadastrado" : `${schedules.length} agendamento${schedules.length > 1 ? "s" : ""}`}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => setScheduleCreateOpen(true)}
              >
                <Plus className="w-3 h-3" />
                Novo agendamento
              </Button>
            </div>

            {schedulesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse" />)}
              </div>
            ) : schedules.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarClock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum agendamento de manutenção preventiva</p>
                <Button size="sm" variant="ghost" className="mt-3 text-xs" onClick={() => setScheduleCreateOpen(true)}>
                  <Plus className="w-3 h-3 mr-1.5" />
                  Criar primeiro agendamento
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {schedules.map((sch: MaintenanceSchedule) => (
                  <ScheduleCard
                    key={sch.id}
                    schedule={sch}
                    onToggle={(id, isActive) => toggleSchedule.mutate({ id, isActive })}
                    isToggling={toggleSchedule.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Attachments tab ── */}
        {tab === "attachments" && (
          <div className="mt-4 space-y-3 pb-6">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAttachment.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploadAttachment.isPending ? "Enviando..." : "Adicionar arquivo"}
            </button>

            {attachmentsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg border border-border bg-muted/30 animate-pulse" />)}
              </div>
            ) : attachments.length === 0 ? (
              <div className="py-10 text-center">
                <Paperclip className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum arquivo anexado</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
                    <AttachmentIcon category={att.category} />
                    <span className="flex-1 text-xs truncate">{att.fileName}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{att.sizeFormatted}</span>
                    <button
                      type="button"
                      className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => handleOpenFile(att.id)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => deleteAttachment.mutate(att.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>{/* end scrollable section */}
      </SheetContent>
    </Sheet>

    {manualsOpen && (
      <EquipmentManualsSheet
        equipment={equipment}
        open={manualsOpen}
        onClose={() => setManualsOpen(false)}
      />
    )}

    <EquipmentScheduleCreateSheet
      equipment={equipment}
      open={scheduleCreateOpen}
      onClose={() => setScheduleCreateOpen(false)}
    />
    </>
  );
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Diária", WEEKLY: "Semanal", BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral",
  ANNUAL: "Anual", CUSTOM: "Personalizada",
};

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: "Preventiva", CORRECTIVE: "Corretiva", INITIAL_ACCEPTANCE: "Aceite Inicial",
  EXTERNAL_SERVICE: "Serviço Externo", TECHNOVIGILANCE: "Tecnovigilância",
  TRAINING: "Treinamento", IMPROPER_USE: "Uso Indevido", DEACTIVATION: "Desativação",
};

function ScheduleCard({
  schedule,
  onToggle,
  isToggling,
}: {
  schedule: MaintenanceSchedule;
  onToggle: (id: string, isActive: boolean) => void;
  isToggling: boolean;
}) {
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  return (
    <div className={`rounded-lg border px-3 py-2.5 space-y-1.5 transition-colors ${schedule.isActive ? "border-border bg-white" : "border-border/50 bg-muted/20"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className={`w-3.5 h-3.5 flex-shrink-0 ${schedule.isActive ? "text-primary" : "text-muted-foreground/40"}`} />
          <span className="text-xs font-semibold truncate">{schedule.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${schedule.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
            {schedule.isActive ? "Ativo" : "Inativo"}
          </span>
          <button
            type="button"
            disabled={isToggling}
            onClick={() => onToggle(schedule.id, !schedule.isActive)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            {schedule.isActive ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>{MAINTENANCE_TYPE_LABELS[schedule.maintenanceType] ?? schedule.maintenanceType} · {RECURRENCE_LABELS[schedule.recurrenceType] ?? schedule.recurrenceType}</span>
        {schedule.group && <span>Grupo: {schedule.group.name}</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-4 text-[11px]">
        <span className="text-muted-foreground">
          Última: <span className="text-foreground font-medium">{fmtDate(schedule.lastRunAt)}</span>
        </span>
        <span className="text-muted-foreground">
          Próxima: <span className={`font-medium ${schedule.isActive ? "text-foreground" : "text-muted-foreground"}`}>{fmtDate(schedule.nextRunAt)}</span>
        </span>
        {schedule.assignedTechnician && (
          <span className="text-muted-foreground col-span-2">
            Técnico: <span className="text-foreground font-medium">{schedule.assignedTechnician.name}</span>
          </span>
        )}
        {schedule._count.maintenances > 0 && (
          <span className="text-muted-foreground col-span-2">
            {schedule._count.maintenances} execução{schedule._count.maintenances > 1 ? "ões" : ""} realizada{schedule._count.maintenances > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Movement Sheet ────────────────────────────────────────────────────────────

const movementSchema = z.object({
  type: z.enum(["LOAN", "TRANSFER"]),
  destinationLocationId: z.string().min(1, "Selecione o destino"),
  reason: z.string().optional(),
  expectedReturnAt: z.string().optional(),
  notes: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

function MovementSheet({
  open,
  equipment,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}) {
  const { data: costCenters = [] } = useCostCenters({ limit: 100 });
  const allLocations = costCenters.flatMap((cc) =>
    cc.locations.map((l) => ({ ...l, ccId: cc.id, ccName: cc.name }))
  );

  const create = useCreateMovement(equipment?.id ?? "");

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<MovementForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(movementSchema) as any,
    defaultValues: { type: "LOAN" },
  });

  const watchedType = watch("type");

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(data: MovementForm) {
    if (!equipment) return;
    const destLocation = allLocations.find((l) => l.id === data.destinationLocationId);
    create.mutate(
      {
        type: data.type,
        originLocationId: equipment.currentLocation?.id ?? equipment.location?.id ?? "",
        destinationLocationId: data.destinationLocationId,
        destinationCostCenterId: data.type === "TRANSFER" ? (destLocation?.ccId ?? undefined) : undefined,
        reason: data.reason || undefined,
        expectedReturnAt: data.expectedReturnAt || undefined,
        notes: data.notes || undefined,
      },
      { onSuccess: handleClose }
    );
  }

  if (!equipment) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "480px", width: "100%" }}>
        <SheetHeader>
          <SheetTitle>Movimentar equipamento</SheetTitle>
          <p className="text-sm text-muted-foreground truncate">{equipment.name}</p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 mt-6 pb-6">
          {/* Origin info */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="text-muted-foreground">Origem: </span>
              <span className="font-medium">
                {equipment.currentLocation?.name ?? equipment.location?.name ?? "Localização não definida"}
              </span>
            </div>
          </div>

          {/* Type selector */}
          <div className="space-y-2">
            <Label>Tipo de movimentação</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["LOAN", "TRANSFER"] as const).map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border cursor-pointer transition-colors text-xs ${watchedType === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/30"
                    }`}
                >
                  <input type="radio" {...register("type")} value={t} className="hidden" />
                  {t === "LOAN" ? <HandCoins className="w-4 h-4 flex-shrink-0" /> : <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />}
                  <div>
                    <p className="font-medium">{t === "LOAN" ? "Empréstimo" : "Transferência"}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {t === "LOAN" ? "Temporário, com retorno" : "Permanente"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label>Destino *</Label>
            <select
              {...register("destinationLocationId")}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Selecione o destino —</option>
              {allLocations
                .filter((l) => l.id !== (equipment.currentLocation?.id ?? equipment.location?.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.name} — {l.ccName}</option>
                ))}
            </select>
            {errors.destinationLocationId && (
              <p className="text-xs text-destructive">{errors.destinationLocationId.message}</p>
            )}
          </div>

          {/* Expected return (LOAN only) */}
          {watchedType === "LOAN" && (
            <div className="space-y-2">
              <Label htmlFor="mv-return">Data prevista de retorno</Label>
              <Input id="mv-return" type="date" {...register("expectedReturnAt")} />
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="mv-reason">Motivo</Label>
            <Input id="mv-reason" placeholder="Ex: Manutenção preventiva" {...register("reason")} />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="mv-notes">Observações</Label>
            <Textarea id="mv-notes" placeholder="Observações adicionais..." rows={3} {...register("notes")} />
          </div>

          <SheetFooter className="mt-auto pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Registrando...</>
                : "Registrar movimentação"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── QR Label Print ──────────────────────────────────────────────────────────

function QRLabelModal({
  open,
  equipment,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}) {
  if (!equipment) return null;

  const typeLine = [equipment.type?.name, equipment.subtype?.name].filter(Boolean).join(" › ");

  function handlePrint() {
    window.open(equipmentService.getLabelUrl(equipment!.id), "_blank");
    onClose();
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimir etiqueta
          </AlertDialogTitle>
          <AlertDialogDescription>
            PDF vertical 30 × 50 mm gerado pela API. Selecione a Zebra no diálogo de impressão.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Prévia da etiqueta vertical */}
        <div className="flex justify-center py-2">
          <div
            className="bg-white border border-gray-300 shadow-sm rounded flex flex-col items-center overflow-hidden"
            style={{ width: 90, height: 150, padding: 5, gap: 3 }}
          >
            {/* Logo placeholder */}
            <div className="w-7 h-7 rounded border border-gray-200 bg-gray-50 flex-shrink-0" />
            {/* Patrimônio */}
            {equipment.patrimonyNumber && (
              <p style={{ fontSize: 7, fontWeight: 800, color: "#000", textAlign: "center", lineHeight: 1.1, wordBreak: "break-all" }}>
                N° {equipment.patrimonyNumber}
              </p>
            )}
            {/* Tipo */}
            {equipment.type?.name && (
              <p style={{ fontSize: 5.5, color: "#111827", textAlign: "center", lineHeight: 1.1 }}>
                {equipment.type.name}
              </p>
            )}
            {/* Subtipo */}
            {equipment.subtype?.name && (
              <p style={{ fontSize: 5, color: "#6B7280", textAlign: "center", lineHeight: 1.1 }}>
                {equipment.subtype.name}
              </p>
            )}
            {/* QR placeholder */}
            <div className="flex-1 w-full border border-gray-200 bg-gray-100 rounded flex items-center justify-center mt-auto">
              <p style={{ fontSize: 5, color: "#9ca3af" }}>QR</p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Abrir PDF e imprimir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── IP Network Panel ─────────────────────────────────────────────────────────

const NETWORK_SUBNET = '192.168.0';
const NETWORK_GATEWAY_IPS = new Set([1, 251]);
const NETWORK_IP_RANGE = Array.from({ length: 254 }, (_, i) => i + 1);

function IpNetworkPanel({ onFilterIp }: { onFilterIp: (ip: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useNetworkStats(NETWORK_SUBNET);

  const usedMap = useMemo(() => {
    const map = new Map<number, { name: string; status: EquipmentStatus }>();
    (data?.usedIps ?? []).forEach((eq) => {
      const parts = eq.ipAddress?.split('.');
      if (!parts || parts.length < 4) return;
      const oct = parseInt(parts[3], 10);
      if (!isNaN(oct) && oct >= 1 && oct <= 254) {
        map.set(oct, { name: eq.name, status: eq.status });
      }
    });
    return map;
  }, [data]);

  const usedCount = [...usedMap.keys()].filter((k) => !NETWORK_GATEWAY_IPS.has(k)).length;
  const freeCount = 252 - usedCount;
  const pct = Math.round((usedCount / 252) * 100);

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-zinc-950/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Network className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Mapa de IPs — {NETWORK_SUBNET}.0/24</p>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? 'Carregando...'
                : `${freeCount} livre${freeCount !== 1 ? 's' : ''} · ${usedCount} em uso · 2 reservados (gateway)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">{freeCount}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span className="text-rose-700 dark:text-rose-400 font-medium">{usedCount}</span>
              </div>
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-rose-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{pct}%</span>
            </div>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
          {isLoading ? (
            <div className="h-24 bg-muted/50 animate-pulse rounded-lg" />
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{freeCount}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">IPs livres</p>
                </div>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">{usedCount}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Em uso</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">2</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Reservados</p>
                </div>
              </div>

              {/* IP grid */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg">
                <p className="text-[10px] text-muted-foreground mb-2 font-mono">
                  {NETWORK_SUBNET}.1 → {NETWORK_SUBNET}.254
                </p>
                <div className="flex flex-wrap gap-[3px]">
                  {NETWORK_IP_RANGE.map((octet) => {
                    const isGateway = NETWORK_GATEWAY_IPS.has(octet);
                    const eq = usedMap.get(octet);
                    const isFree = !isGateway && !eq;

                    return (
                      <div key={octet} className="relative group">
                        {/* Cell */}
                        <div
                          role={eq ? 'button' : undefined}
                          tabIndex={eq ? 0 : undefined}
                          onKeyDown={
                            eq
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ')
                                    onFilterIp(`${NETWORK_SUBNET}.${octet}`);
                                }
                              : undefined
                          }
                          onClick={eq ? () => onFilterIp(`${NETWORK_SUBNET}.${octet}`) : undefined}
                          className={[
                            'w-3.5 h-3.5 rounded-[3px] transition-transform duration-150 group-hover:scale-125 group-hover:z-10 relative',
                            isGateway
                              ? 'bg-amber-400 dark:bg-amber-500 cursor-default'
                              : eq
                              ? 'bg-rose-500 dark:bg-rose-600 cursor-pointer'
                              : 'bg-emerald-400 dark:bg-emerald-600 cursor-default',
                            isFree ? 'opacity-50' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        />

                        {/* Custom tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-bottom">
                          <div className={[
                            'rounded-lg px-2.5 py-1.5 shadow-xl text-white text-[11px] whitespace-nowrap min-w-[100px]',
                            isGateway
                              ? 'bg-amber-600'
                              : eq
                              ? 'bg-zinc-900'
                              : 'bg-emerald-700',
                          ].join(' ')}>
                            <p className="font-mono font-bold tracking-tight">
                              {NETWORK_SUBNET}.{octet}
                            </p>
                            {isGateway && (
                              <p className="text-amber-200 text-[10px] mt-0.5">Gateway reservado</p>
                            )}
                            {eq && (
                              <p className="text-zinc-300 text-[10px] mt-0.5 max-w-[160px] truncate">
                                {eq.name}
                              </p>
                            )}
                            {isFree && (
                              <p className="text-emerald-200 text-[10px] mt-0.5">Livre</p>
                            )}
                          </div>
                          {/* Arrow */}
                          <div className="flex justify-center -mt-px">
                            <div className={[
                              'w-2 h-2 rotate-45 translate-y-[-4px]',
                              isGateway ? 'bg-amber-600' : eq ? 'bg-zinc-900' : 'bg-emerald-700',
                            ].join(' ')} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[3px] bg-emerald-400 opacity-60 inline-block" />
                  Livre ({freeCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[3px] bg-rose-500 inline-block" />
                  Em uso ({usedCount}) — clique para filtrar
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[3px] bg-amber-400 inline-block" />
                  Gateway reservado (.1 e .251)
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipamentosPage() {
  const { canAccess } = usePermissions();
  const canCreateEquipment = canAccess("equipment", "create");
  const [search, setSearch] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [patrimonyFilter, setPatrimonyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "">("");
  const [criticalityFilter, setCriticalityFilter] = useState<EquipmentCriticality | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [costCenterFilter, setCostCenterFilter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [qrTarget, setQrTarget] = useState<Equipment | null>(null);
  const [page, setPage] = useState(1);

  const { data: allTypes = [] } = useEquipmentTypes();
  const { data: allCostCenters = [] } = useCostCenters({ limit: 100 });
  const allLocations = allCostCenters.flatMap((cc) => cc.locations);

  const [formSheet, setFormSheet] = useState<{ open: boolean; target: Equipment | null }>({ open: false, target: null });
  const [detailSheet, setDetailSheet] = useState<Equipment | null>(null);
  const [moveSheet, setMoveSheet] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [osSheet, setOsSheet] = useState<Equipment | null>(null);
  const [scheduleSheet, setScheduleSheet] = useState<Equipment | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSheet, setBatchSheet] = useState<{ open: boolean; equipment: { id: string; name: string }[] }>({
    open: false,
    equipment: [],
  });
  const [schedBatchSheet, setSchedBatchSheet] = useState<{ open: boolean; equipment: { id: string; name: string }[] }>({
    open: false,
    equipment: [],
  });
  const [printingLabels, setPrintingLabels] = useState(false);

  const searchParams = useSearchParams();
  const detailId = searchParams.get("detail");
  const { data: detailData } = useEquipmentById(detailId ?? "");

  useEffect(() => {
    if (detailData) {
      setDetailSheet(detailData);
    }
  }, [detailData]);

  const { data: listData, isLoading } = useEquipment({
    search: search || undefined,
    ipAddress: ipFilter || undefined,
    patrimonyNumber: patrimonyFilter || undefined,
    status: (statusFilter as EquipmentStatus) || undefined,
    criticality: (criticalityFilter as EquipmentCriticality) || undefined,
    typeId: typeFilter || undefined,
    locationId: locationFilter || undefined,
    costCenterId: costCenterFilter || undefined,
    page,
    limit: 50,
  });

  const equipments = listData?.data ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  const activeFilterCount = [statusFilter, criticalityFilter, typeFilter, locationFilter, costCenterFilter, ipFilter, patrimonyFilter]
    .filter(Boolean).length;

  useEffect(() => {
    setPage(1);
  }, [search, ipFilter, patrimonyFilter, statusFilter, criticalityFilter, typeFilter, locationFilter, costCenterFilter]);

  function clearAll() {
    setSearch("");
    setIpFilter("");
    setStatusFilter("");
    setCriticalityFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setCostCenterFilter("");
    setPatrimonyFilter("");
  }

  const remove = useDeleteEquipment();
  const canCreateOs = canAccess("service-order", "create");

  function toggleSelectionMode() {
    setSelectionMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelect(e: Equipment) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(e.id)) next.delete(e.id);
      else next.add(e.id);
      return next;
    });
  }

  function handleOpenBatchSheet() {
    const selected = equipments.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) return;
    setBatchSheet({
      open: true,
      equipment: selected.map((e) => ({ id: e.id, name: e.name })),
    });
  }

  function handleOpenScheduleBatch() {
    const selected = equipments.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) return;
    setSchedBatchSheet({
      open: true,
      equipment: selected.map((e) => ({ id: e.id, name: e.name })),
    });
  }

  async function handlePrintLabels() {
    setPrintingLabels(true);
    try {
      await equipmentService.openBatchLabels([...selectedIds]);
    } catch {
      toast.error("Erro ao gerar etiquetas");
    } finally {
      setPrintingLabels(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o parque de equipamentos.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canCreateOs && (
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              className="flex-1 sm:flex-none"
              onClick={toggleSelectionMode}
            >
              {selectionMode ? (
                <><XCircle className="w-4 h-4 mr-2" />Cancelar seleção</>
              ) : (
                <><Layers className="w-4 h-4 mr-2" />Ações em lote</>
              )}
            </Button>
          )}
          {canCreateEquipment && !selectionMode && (
            <Button className="flex-1 sm:flex-none" onClick={() => setFormSheet({ open: true, target: null })}>
              <Plus className="w-4 h-4 mr-2" />
              Novo equipamento
            </Button>
          )}
        </div>
      </div>

      {/* IP Network Panel */}
      <IpNetworkPanel
        onFilterIp={(ip) => {
          setSearch(ip);
        }}
      />

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-950/50 rounded-xl border border-border p-4 space-y-3">
        {/* Row 1: search + toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Buscar por nome, marca, série, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EquipmentStatus | "")}
            className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
          >
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABEL) as EquipmentStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={criticalityFilter}
            onChange={(e) => setCriticalityFilter(e.target.value as EquipmentCriticality | "")}
            className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
          >
            <option value="">Todas as criticidades</option>
            {(Object.keys(CRITICALITY_LABEL) as EquipmentCriticality[]).map((c) => (
              <option key={c} value={c}>{CRITICALITY_LABEL[c]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors w-full sm:w-auto ${showAdvanced || activeFilterCount > 0
              ? "border-primary text-primary bg-primary/5"
              : "border-border text-muted-foreground hover:bg-muted/30"
              }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Filtros avançados
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {activeFilterCount}
              </span>
            )}
          </button>
          {(search || activeFilterCount > 0) && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>

        {/* Row 2: advanced filters */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
            >
              <option value="">Todos os tipos</option>
              {allTypes.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={costCenterFilter}
              onChange={(e) => { setCostCenterFilter(e.target.value); setLocationFilter(""); }}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
            >
              <option value="">Todos os CC</option>
              {allCostCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.name}{cc.code ? ` (${cc.code})` : ""}</option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
            >
              <option value="">Todas as localizações</option>
              {(costCenterFilter
                ? allLocations.filter((l) => allCostCenters.find(cc => cc.id === costCenterFilter)?.locations.some(ll => ll.id === l.id))
                : allLocations
              ).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <div className="relative">
              <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm w-44"
                placeholder="Filtrar por IP..."
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
              />
            </div>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm w-44"
                placeholder="Patrimônio..."
                value={patrimonyFilter}
                onChange={(e) => setPatrimonyFilter(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-2xl border border-border bg-white dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : equipments.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950/50 rounded-xl border border-dashed border-border py-14 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {search || activeFilterCount > 0 ? "Nenhum equipamento encontrado" : "Nenhum equipamento cadastrado"}
          </p>
          {!search && activeFilterCount === 0 && canCreateEquipment && (
            <Button size="sm" className="mt-4" onClick={() => setFormSheet({ open: true, target: null })}>
              <Plus className="w-4 h-4 mr-2" />Cadastrar equipamento
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipments.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                onView={setDetailSheet}
                onEdit={(e) => setFormSheet({ open: true, target: e })}
                onMove={setMoveSheet}
                onDelete={setDeleteTarget}
                onPrint={setQrTarget}
                onCreateOs={setOsSheet}
                onCreateSchedule={setScheduleSheet}
                selectionMode={selectionMode}
                selected={selectedIds.has(eq.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} de {total} equipamento(s)
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3 text-xs"
                >
                  Anterior
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "ellipsis" ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(p as number)}
                        className="h-8 w-8 p-0 text-xs"
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3 text-xs"
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Sheets ── */}
      <EquipmentSheet
        open={formSheet.open}
        editTarget={formSheet.target}
        onClose={() => setFormSheet({ open: false, target: null })}
      />

      <DetailSheet
        open={!!detailSheet}
        equipment={detailSheet}
        onClose={() => setDetailSheet(null)}
        onEdit={(e) => { setDetailSheet(null); setFormSheet({ open: true, target: e }); }}
        onMove={(e) => { setDetailSheet(null); setMoveSheet(e); }}
        onPrint={(e) => { setDetailSheet(null); setQrTarget(e); }}
      />

      <MovementSheet
        open={!!moveSheet}
        equipment={moveSheet}
        onClose={() => setMoveSheet(null)}
      />

      <QRLabelModal
        open={!!qrTarget}
        equipment={qrTarget}
        onClose={() => setQrTarget(null)}
      />

      <EquipmentOsCreateSheet
        equipment={osSheet}
        open={!!osSheet}
        onClose={() => setOsSheet(null)}
      />

      <EquipmentScheduleCreateSheet
        equipment={scheduleSheet}
        open={!!scheduleSheet}
        onClose={() => setScheduleSheet(null)}
      />

      <EquipmentOsCreateSheet
        batchEquipment={batchSheet.equipment}
        open={batchSheet.open}
        onClose={() => {
          setBatchSheet({ open: false, equipment: [] });
          setSelectionMode(false);
          setSelectedIds(new Set());
        }}
      />

      <EquipmentScheduleCreateSheet
        batchEquipment={schedBatchSheet.equipment}
        open={schedBatchSheet.open}
        onClose={() => {
          setSchedBatchSheet({ open: false, equipment: [] });
          setSelectionMode(false);
          setSelectedIds(new Set());
        }}
      />

      {/* ── Toolbar flutuante de seleção ── */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-xl px-5 py-3">
          <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSelectedIds(new Set())}>
            Limpar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={handleOpenScheduleBatch}
          >
            <CalendarClock className="w-4 h-4 mr-2" />
            Agendar Preventiva
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={handlePrintLabels}
            disabled={printingLabels}
          >
            {printingLabels
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Printer className="w-4 h-4 mr-2" />}
            Imprimir Etiquetas
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleOpenBatchSheet}>
            <Layers className="w-4 h-4 mr-2" />
            Criar OS em Lote
          </Button>
        </div>
      )}

      {/* ── Delete ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover equipamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              {remove.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}