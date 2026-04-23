"use client";

import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
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
} from "@/hooks/equipment/use-equipment";
import { useMovements, useCreateMovement, useReturnEquipment } from "@/hooks/equipment/use-movements";
import { useEquipmentTypes } from "@/hooks/equipment/use-equipment-types";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import { useAttachments, useDeleteAttachment, useUploadAttachment } from "@/hooks/storage/use-attachments";
import { EquipmentOsCreateSheet } from "@/components/equipment/equipment-os-create-sheet";
import { EquipmentScheduleCreateSheet } from "@/components/equipment/equipment-schedule-create-sheet";
import { EquipmentManualsSheet } from "@/components/equipment/equipment-manuals-sheet";
import { OsDetailDrawer } from "@/app/(operacional)/operacional/_components/os-detail-drawer";

import { equipmentService } from "@/services/equipment/equipment.service";
import type { Equipment, EquipmentStatus, EquipmentCriticality, EquipmentServiceOrdersResponse } from "@/services/equipment/equipment.service";
import type { InfiniteData } from "@tanstack/react-query";
import type { Movement } from "@/services/equipment/movements.service";
import { storageService } from "@/services/storage/storage.service";
import QRCode from "react-qr-code";

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

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EquipmentForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(equipmentSchema) as any,
    values: editTarget ? {
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
      purchaseValue: editTarget.purchaseValue != null ? formatToBRL(editTarget.purchaseValue) : "",
      purchaseDate: editTarget.purchaseDate ? editTarget.purchaseDate.substring(0, 10) : "",
      warrantyEnd: editTarget.warrantyEnd ? editTarget.warrantyEnd.substring(0, 10) : "",
      depreciationRate: editTarget.depreciationRate != null ? String(editTarget.depreciationRate) : "",
      btus: editTarget.btus?.toString() ?? "",
      voltage: editTarget.voltage ?? "",
      ipAddress: editTarget.ipAddress ?? "",
      operatingSystem: editTarget.operatingSystem ?? "",
      criticality: editTarget.criticality,
      observations: editTarget.observations ?? "",
    } : {
      name: "", brand: "", model: "", serialNumber: "", patrimonyNumber: "", anvisaNumber: "", invoiceNumber: "",
      typeId: "", subtypeId: "", locationId: "", costCenterId: "",
      purchaseValue: "", purchaseDate: "", warrantyEnd: "", depreciationRate: "",
      btus: "", voltage: "", ipAddress: "", operatingSystem: "",
      criticality: "MEDIUM", observations: "",
    },
  });

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
        if (value !== undefined) formData.append(key, String(value));
      });
      files.forEach((file) => formData.append("files", file));
      create.mutate(formData, { onSuccess: handleClose });
    } else {
      create.mutate(dtoFields, { onSuccess: handleClose });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "720px", width: "100%" }}>
        <SheetHeader>
          <SheetTitle>{editTarget ? "Editar equipamento" : "Novo equipamento"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Preencha as informações do equipamento.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 mt-6 pb-6">
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

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : editTarget ? "Salvar" : "Cadastrar equipamento"}
            </Button>
          </SheetFooter>
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
}: {
  equipment: Equipment;
  onView: (e: Equipment) => void;
  onEdit: (e: Equipment) => void;
  onMove: (e: Equipment) => void;
  onDelete: (e: Equipment) => void;
  onPrint: (e: Equipment) => void;
  onCreateOs: (e: Equipment) => void;
  onCreateSchedule: (e: Equipment) => void;
}) {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #3b82f6, #f97316)" }}
        >
          <Wrench className="w-5 h-5 text-white" />
        </div>
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
        {equipment.currentLocation && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Localização</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{equipment.currentLocation.name}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEdit(equipment)}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onView(equipment)}>
          <Eye className="w-3.5 h-3.5 mr-1.5" />Detalhes
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPrint(equipment)}>
          <Printer className="w-3.5 h-3.5 mr-1.5" />QR Code
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateOs(equipment)}>
              <ClipboardList className="w-3.5 h-3.5 mr-2" />Nova OS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateSchedule(equipment)}>
              <CalendarClock className="w-3.5 h-3.5 mr-2" />Agendar Preventiva
            </DropdownMenuItem>
            {equipment.status === "ACTIVE" && (
              <DropdownMenuItem onClick={() => onMove(equipment)}>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />Movimentar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={equipment._count.serviceOrders > 0}
              onClick={() => onDelete(equipment)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              {equipment._count.serviceOrders > 0 ? "Possui OS vinculadas" : "Remover"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono, fullWidth }: { label: string; value: string; mono?: boolean; fullWidth?: boolean }) {
  return (
    <div className={`space-y-1 ${fullWidth ? "col-span-2" : ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className={`text-sm font-medium leading-none ${mono ? "font-mono text-[13px]" : ""}`} style={{ color: "var(--foreground)" }}>
        {value}
      </p>
    </div>
  );
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <div className="p-1.5 rounded-md bg-primary/5 text-primary">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-1">
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
  const [tab, setTab] = React.useState<"info" | "movements" | "attachments" | "history">("info");
  const [selectedHistoryOs, setSelectedHistoryOs] = React.useState<{ id: string; clientId: string | null } | null>(null);
  const [manualsOpen, setManualsOpen] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: movements = [], isLoading: movementsLoading } = useMovements(equipment?.id ?? "");
  const { data: attachments = [], isLoading: attachmentsLoading } = useAttachments("EQUIPMENT", equipment?.id ?? "");
  const returnEquipment = useReturnEquipment(equipment?.id ?? "");
  const deleteAttachment = useDeleteAttachment("EQUIPMENT", equipment?.id ?? "");
  const uploadAttachment = useUploadAttachment("EQUIPMENT", equipment?.id ?? "");
  const recalcDepreciation = useRecalculateDepreciation();
  const {
    data: historyData,
    isLoading: historyLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useEquipmentServiceOrders(equipment?.id ?? "");

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
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "680px", width: "100%" }}>
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg, #3b82f6, #f97316)" }}
              >
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-xl font-bold truncate tracking-tight">{equipment.name}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate uppercase font-medium tracking-wide">
                  {[equipment.type?.name, equipment.subtype?.name].filter(Boolean).join(" › ") || "Sem categoria"}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <StatusBadge status={equipment.status} />
                  <CriticalityBadge criticality={equipment.criticality} />
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Action bar - More integrated */}
        <div className="flex flex-wrap items-center gap-2 mt-6 p-1.5 bg-muted/40 rounded-xl border border-border/50">
          <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-white hover:shadow-sm transition-all" onClick={() => { handleClose(); onEdit(equipment); }}>
            <Pencil className="w-3.5 h-3.5 mr-1.5 text-blue-500" />Editar
          </Button>
          {equipment.status === "ACTIVE" && (
            <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-white hover:shadow-sm transition-all" onClick={() => { handleClose(); onMove(equipment); }}>
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-amber-500" />Movimentar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-white hover:shadow-sm transition-all" onClick={() => { handleClose(); onPrint(equipment); }}>
            <Printer className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />QR Code
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-white hover:shadow-sm transition-all" onClick={() => window.open(equipmentService.getLifeCyclePdfUrl(equipment.id), "_blank")}>
            <FileText className="w-3.5 h-3.5 mr-1.5 text-violet-500" />Ficha Vida
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-white hover:shadow-sm transition-all" onClick={() => setManualsOpen(true)}>
            <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />Manuais
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-medium uppercase px-2">Ações rápidas</span>
          </div>
        </div>

        {/* Tabs - Modernized and explicit */}
        <div className="flex border-b border-border bg-white sticky top-0 z-10">
          {[
            { id: "info", label: "Informações" },
            { id: "movements", label: "Movimentações", count: movements.length },
            { id: "attachments", label: "Anexos", count: attachments.length },
            { id: "history", label: "Histórico", count: equipment.totalServiceOrders },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-all whitespace-nowrap ${tab === t.id
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${tab === t.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Info tab ── */}
        {tab === "info" && (
          <div className="mt-8 space-y-10 pb-8">
            {/* ── Identificação ── */}
            <DetailSection title="Identificação" icon={Tag}>
              {equipment.patrimonyNumber && <DetailRow label="Nº de Patrimônio" value={equipment.patrimonyNumber} mono />}
              {equipment.serialNumber && <DetailRow label="Nº de Série" value={equipment.serialNumber} mono />}
              {equipment.brand && <DetailRow label="Marca" value={equipment.brand} />}
              {equipment.model && <DetailRow label="Modelo" value={equipment.model} />}
              {equipment.anvisaNumber && <DetailRow label="Nº ANVISA" value={equipment.anvisaNumber} mono />}
            </DetailSection>

            {/* ── Localização ── */}
            <DetailSection title="Localização" icon={MapPin}>
              {equipment.costCenter && (
                <DetailRow
                  label="Centro de Custo"
                  fullWidth
                  value={`${equipment.costCenter.name}${equipment.costCenter.code ? ` (${equipment.costCenter.code})` : ""}`}
                />
              )}
              {equipment.currentLocation && (
                <DetailRow label="Localização Atual" fullWidth value={equipment.currentLocation.name} />
              )}
            </DetailSection>

            {/* ── Financeiro ── */}
            {(equipment.purchaseValue != null || equipment.purchaseDate || equipment.warrantyEnd || equipment.depreciationRate != null) && (
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
                  <DetailRow label="Taxa de Depreciação" value={`${equipment.depreciationRate}% /ano`} />
                )}
                {equipment.invoiceNumber && <DetailRow label="Nota Fiscal" value={equipment.invoiceNumber} mono />}

                {equipment.purchaseValue != null && (
                  <div className="col-span-2 pt-2">
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

            {/* ── Observações ── */}
            {equipment.observations && (
              <div className="space-y-4 px-1">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <div className="p-1.5 rounded-md bg-primary/5 text-primary">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/50">
                  {equipment.observations}
                </p>
              </div>
            )}

            <div className="pt-8 border-t border-border/40 text-center">
              <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                Registro criado em {new Date(equipment.createdAt).toLocaleDateString("pt-BR")} às {new Date(equipment.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
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
      </SheetContent>
    </Sheet>

    {manualsOpen && (
      <EquipmentManualsSheet
        equipment={equipment}
        open={manualsOpen}
        onClose={() => setManualsOpen(false)}
      />
    )}
    </>
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
    cc.locations.map((l) => ({ ...l, ccName: cc.name }))
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
    create.mutate(
      {
        type: data.type,
        originLocationId: equipment.currentLocation?.id ?? equipment.location?.id ?? "",
        destinationLocationId: data.destinationLocationId,
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

const LABEL_SIZES = [
  { id: "60x40", label: "50 × 30 mm (Zebra / Genérica)", w: 189, h: 113 },
];

function QRLabelModal({
  open,
  equipment,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}) {
  const [sizeId, setSizeId] = React.useState("50x30");
  const labelSize = LABEL_SIZES.find((s) => s.id === sizeId) ?? LABEL_SIZES[0];

  if (!equipment) return null;

  const qrUrl =
    typeof window !== "undefined"
      ? `${window.location.host}/equipamentos?detail=${equipment.id}`
      : `/equipamentos?detail=${equipment.id}`;

  function handlePrint() {
    if (!equipment) return;
    const printWin = window.open("", "_blank", "width=800,height=600");
    if (!printWin) return;

    const svgEl = document.getElementById("qr-label-svg");
    const svgHtml = svgEl ? svgEl.outerHTML.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"') : "";

    const labelHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title></title>
  <meta charset="UTF-8"/>
  <style>
    @page {
      size: 50mm 30mm;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      width: 50mm;
      height: 30mm;
      overflow: hidden;
    }
    body {
      width: 50mm;
      height: 30mm;
      overflow: hidden;
      background: #fff;
      font-family: Arial, "Helvetica Neue", sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    .qr-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 18mm;
      height: 18mm;
      flex-shrink: 0;
    }
    .qr-wrap svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .pat {
      font-size: 8pt;
      font-weight: bold;
      color: #000;
      margin-bottom: 0.3mm;
      text-align: center;
      line-height: 1;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  ${equipment.patrimonyNumber ? `<div class="pat">PAT: ${equipment.patrimonyNumber}</div>` : ""}
  <div class="qr-wrap">${svgHtml}</div>
<script>
  window.onload = () => {
    setTimeout(() => {
      window.print();
      window.onafterprint = () => window.close();
    }, 300);
  }
<\/script>
</body></html>`;

    printWin.document.open();
    printWin.document.write(labelHtml);
    printWin.document.close();
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimir etiqueta QR
          </AlertDialogTitle>
          <AlertDialogDescription>
            Geração de etiqueta para impressora de etiquetas. Escaneie o QR para acessar os detalhes do equipamento.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Label preview */}
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prévia</p>
          <div className="bg-gray-50 rounded-xl border border-border p-4 flex items-center justify-center">
            <div
              className="bg-white border border-gray-300 rounded flex flex-col items-center justify-center shadow-sm overflow-hidden"
              style={{ width: labelSize.w, height: labelSize.h, padding: "4px" }}
            >
              {equipment.patrimonyNumber && (
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#000" }}>
                  PAT: {equipment.patrimonyNumber}
                </p>
              )}
              <div style={{ flexShrink: 0 }}>
                <QRCode
                  id="qr-label-svg"
                  value={qrUrl}
                  size={labelSize.h - 32}
                  level="M"
                  style={{ display: "block" }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            A impressão abre em nova janela com formatação otimizada para a etiqueta selecionada.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir etiqueta
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipamentosPage() {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o parque de equipamentos.
          </p>
        </div>
        <Button onClick={() => setFormSheet({ open: true, target: null })}>
          <Plus className="w-4 h-4 mr-2" />
          Novo equipamento
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
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
            className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABEL) as EquipmentStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={criticalityFilter}
            onChange={(e) => setCriticalityFilter(e.target.value as EquipmentCriticality | "")}
            className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todas as criticidades</option>
            {(Object.keys(CRITICALITY_LABEL) as EquipmentCriticality[]).map((c) => (
              <option key={c} value={c}>{CRITICALITY_LABEL[c]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors ${showAdvanced || activeFilterCount > 0
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
              className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos os tipos</option>
              {allTypes.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={costCenterFilter}
              onChange={(e) => { setCostCenterFilter(e.target.value); setLocationFilter(""); }}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos os CC</option>
              {allCostCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.name}{cc.code ? ` (${cc.code})` : ""}</option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            <div key={i} className="h-52 rounded-2xl border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : equipments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-14 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {search || activeFilterCount > 0 ? "Nenhum equipamento encontrado" : "Nenhum equipamento cadastrado"}
          </p>
          {!search && activeFilterCount === 0 && (
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