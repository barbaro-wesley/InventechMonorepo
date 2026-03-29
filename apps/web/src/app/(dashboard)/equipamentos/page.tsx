"use client";

import { useState, useRef } from "react";
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
import { useClients } from "@/hooks/clients/use-clients";
import { useCurrentUser } from "@/store/auth.store";
import {
  useEquipment,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
  useRecalculateDepreciation,
} from "@/hooks/equipment/use-equipment";
import { useMovements, useCreateMovement, useReturnEquipment } from "@/hooks/equipment/use-movements";
import { useEquipmentTypes } from "@/hooks/equipment/use-equipment-types";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import { useAttachments, usePresignedUrl, useDeleteAttachment, useUploadAttachment } from "@/hooks/storage/use-attachments";
import type { Equipment, EquipmentStatus, EquipmentCriticality } from "@/services/equipment/equipment.service";
import type { Movement } from "@/services/equipment/movements.service";
import { storageService } from "@/services/storage/storage.service";
import type { Attachment } from "@/services/storage/storage.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function CriticalityBadge({ criticality }: { criticality: EquipmentCriticality }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CRITICALITY_COLOR[criticality]}`}>
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
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  observations: z.string().optional(),
});
type EquipmentForm = z.infer<typeof equipmentSchema>;

// ─── Equipment Sheet ──────────────────────────────────────────────────────────

function EquipmentSheet({
  open,
  editTarget,
  clientId,
  onClose,
}: {
  open: boolean;
  editTarget: Equipment | null;
  clientId: string;
  onClose: () => void;
}) {
  const create = useCreateEquipment(clientId);
  const update = useUpdateEquipment(clientId);
  const uploadAttachment = useUploadAttachment("EQUIPMENT", editTarget?.id ?? "");
  const isPending = create.isPending || update.isPending || uploadAttachment.isPending;

  const { data: types = [] } = useEquipmentTypes();
  const { data: costCenters = [] } = useCostCenters(clientId, { limit: 100 });

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EquipmentForm>({
    resolver: zodResolver(equipmentSchema),
    values: editTarget ? {
      name: editTarget.name,
      brand: editTarget.brand ?? "",
      model: editTarget.model ?? "",
      serialNumber: editTarget.serialNumber ?? "",
      patrimonyNumber: editTarget.patrimonyNumber ?? "",
      typeId: editTarget.type?.id ?? "",
      subtypeId: editTarget.subtype?.id ?? "",
      locationId: editTarget.location?.id ?? "",
      costCenterId: editTarget.costCenter?.id ?? "",
      purchaseValue: editTarget.purchaseValue ?? "",
      purchaseDate: editTarget.purchaseDate ? editTarget.purchaseDate.substring(0, 10) : "",
      warrantyEnd: editTarget.warrantyEnd ? editTarget.warrantyEnd.substring(0, 10) : "",
      depreciationRate: editTarget.depreciationRate ?? "",
      btus: editTarget.btus?.toString() ?? "",
      voltage: editTarget.voltage ?? "",
      ipAddress: editTarget.ipAddress ?? "",
      operatingSystem: editTarget.operatingSystem ?? "",
      criticality: editTarget.criticality,
      observations: editTarget.observations ?? "",
    } : {
      name: "", brand: "", model: "", serialNumber: "", patrimonyNumber: "",
      typeId: "", subtypeId: "", locationId: "", costCenterId: "",
      purchaseValue: "", purchaseDate: "", warrantyEnd: "", depreciationRate: "",
      btus: "", voltage: "", ipAddress: "", operatingSystem: "",
      criticality: "MEDIUM", observations: "",
    },
  });

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
      typeId: data.typeId || undefined,
      subtypeId: data.subtypeId || undefined,
      locationId: data.locationId || undefined,
      costCenterId: data.costCenterId || undefined,
      purchaseValue: data.purchaseValue || undefined,
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
                <Label htmlFor="eq-pval">Valor de compra (R$)</Label>
                <Input id="eq-pval" placeholder="45000.00" {...register("purchaseValue")} />
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
                <Input id="eq-volt" placeholder="220V" {...register("voltage")} />
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

// ─── Movement Sheet ───────────────────────────────────────────────────────────

const movementSchema = z.object({
  type: z.enum(["TRANSFER", "LOAN"]),
  originLocationId: z.string().min(1, "Selecione a origem"),
  destinationLocationId: z.string().min(1, "Selecione o destino"),
  reason: z.string().optional(),
  expectedReturnAt: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

function MovementSheet({
  open,
  equipment,
  clientId,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  clientId: string;
  onClose: () => void;
}) {
  const create = useCreateMovement(clientId, equipment?.id ?? "");
  const { data: costCenters = [] } = useCostCenters(clientId, { limit: 100 });
  const allLocations = costCenters.flatMap((cc) => cc.locations);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: "TRANSFER", originLocationId: equipment?.location?.id ?? "", destinationLocationId: "" },
  });

  const type = watch("type");

  function onSubmit(data: MovementForm) {
    create.mutate(
      {
        type: data.type,
        originLocationId: data.originLocationId,
        destinationLocationId: data.destinationLocationId,
        reason: data.reason || undefined,
        expectedReturnAt: data.expectedReturnAt || undefined,
      },
      { onSuccess: () => { reset(); onClose(); } }
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Registrar movimentação</SheetTitle>
          {equipment && (
            <p className="text-sm text-muted-foreground">{equipment.name}</p>
          )}
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label>Tipo de movimentação</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["TRANSFER", "LOAN"] as const).map((t) => {
                const active = type === t;
                return (
                  <label
                    key={t}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}
                  >
                    <input type="radio" {...register("type")} value={t} className="hidden" />
                    {t === "TRANSFER" ? <ArrowRightLeft className="w-4 h-4" /> : <HandCoins className="w-4 h-4" />}
                    <div>
                      <p className="text-sm font-medium">{t === "TRANSFER" ? "Transferência" : "Empréstimo"}</p>
                      <p className="text-xs text-muted-foreground">{t === "TRANSFER" ? "Permanente" : "Temporário"}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Origem</Label>
            <select
              {...register("originLocationId")}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Selecione —</option>
              {allLocations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {errors.originLocationId && <p className="text-xs text-destructive">{errors.originLocationId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Destino</Label>
            <select
              {...register("destinationLocationId")}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Selecione —</option>
              {allLocations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {errors.destinationLocationId && <p className="text-xs text-destructive">{errors.destinationLocationId.message}</p>}
          </div>

          {type === "LOAN" && (
            <div className="space-y-1.5">
              <Label htmlFor="mv-return">Data prevista de devolução *</Label>
              <Input id="mv-return" type="date" {...register("expectedReturnAt")} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="mv-reason">Motivo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input id="mv-reason" placeholder="Ex: Transferência para manutenção" {...register("reason")} />
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
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

// ─── Attachment helpers ───────────────────────────────────────────────────────

function AttachmentIcon({ category, mimeType }: { category: string; mimeType: string }) {
  if (category === "image") return <FileImage className="w-4 h-4 text-blue-500" />;
  if (category === "spreadsheet") return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  if (category === "archive") return <FileArchive className="w-4 h-4 text-amber-500" />;
  return <FileText className="w-4 h-4 text-red-400" />;
}

function AttachmentRow({
  attachment,
  onOpen,
  onDelete,
  isDeleting,
}: {
  attachment: Attachment;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-white hover:bg-muted/30 transition-colors group">
      <div className="flex-shrink-0">
        <AttachmentIcon category={attachment.category} mimeType={attachment.mimeType} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {attachment.sizeFormatted} · {new Date(attachment.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost" size="sm" className="h-7 w-7 p-0"
          title="Abrir arquivo"
          onClick={() => onOpen(attachment.id)}
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost" size="sm" className="h-7 w-7 p-0"
          title="Remover"
          disabled={isDeleting}
          onClick={() => onDelete(attachment.id)}
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ─── Detail Section Card ──────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="px-4 py-3 space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: "green" | "red" }) {
  const valueClass = highlight === "green" ? "text-emerald-600" : highlight === "red" ? "text-red-500" : "";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right truncate ${mono ? "font-mono" : ""} ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function DetailSheet({
  open,
  equipment,
  clientId,
  onClose,
  onEdit,
  onMove,
}: {
  open: boolean;
  equipment: Equipment | null;
  clientId: string;
  onClose: () => void;
  onEdit: (e: Equipment) => void;
  onMove: (e: Equipment) => void;
}) {
  const { data: movements = [], isLoading: movLoading } = useMovements(clientId, equipment?.id ?? "");
  const { data: attachments = [], isLoading: attLoading } = useAttachments("EQUIPMENT", equipment?.id ?? "");
  const returnEquip = useReturnEquipment(clientId, equipment?.id ?? "");
  const recalc = useRecalculateDepreciation(clientId);
  const openUrl = usePresignedUrl();
  const deleteAtt = useDeleteAttachment("EQUIPMENT", equipment?.id ?? "");

  if (!equipment) return null;

  const activeMovement = movements.find((m) => m.status === "ACTIVE");
  const warrantyOk = equipment.warrantyEnd ? new Date(equipment.warrantyEnd) > new Date() : null;

  const hasFinancial = equipment.purchaseValue || equipment.warrantyEnd || equipment.currentValue;
  const hasTechnical = equipment.btus || equipment.voltage || equipment.ipAddress || equipment.operatingSystem;

  function handleOpenFile(attachmentId: string) {
    openUrl.mutate(attachmentId, {
      onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer"),
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "600px", width: "100%" }}>

        {/* ── Header ── */}
        <div className="px-4 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--primary)15" }}>
              <Wrench className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm leading-snug">{equipment.name}</h2>
              {(equipment.brand || equipment.model) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[equipment.brand, equipment.model].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={equipment.status} />
                <CriticalityBadge criticality={equipment.criticality} />
                {equipment._count.serviceOrders > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ClipboardList className="w-3 h-3" />{equipment._count.serviceOrders} OS
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => onEdit(equipment)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
            </Button>
            {equipment.status === "ACTIVE" && (
              <Button size="sm" variant="outline" onClick={() => onMove(equipment)}>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />Movimentar
              </Button>
            )}
            {activeMovement?.type === "LOAN" && (
              <Button size="sm" variant="outline" disabled={returnEquip.isPending}
                onClick={() => returnEquip.mutate({ movementId: activeMovement.id })}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Devolver
              </Button>
            )}
            {equipment.purchaseValue && equipment.depreciationRate && (
              <Button size="sm" variant="outline" disabled={recalc.isPending}
                onClick={() => recalc.mutate(equipment.id)}>
                <BarChart2 className="w-3.5 h-3.5 mr-1.5" />
                {recalc.isPending ? "Calculando..." : "Depreciar"}
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Identificação ── */}
          <SectionCard title="Identificação" icon={Tag}>
            {equipment.type && (
              <InfoRow label="Tipo" value={[equipment.type.name, equipment.subtype?.name].filter(Boolean).join(" › ")} />
            )}
            {equipment.serialNumber && <InfoRow label="Nº de Série" value={equipment.serialNumber} mono />}
            {equipment.patrimonyNumber && <InfoRow label="Patrimônio" value={equipment.patrimonyNumber} mono />}
          </SectionCard>

          {/* ── Localização ── */}
          {(equipment.costCenter || equipment.currentLocation) && (
            <SectionCard title="Localização" icon={MapPin}>
              {equipment.costCenter && (
                <InfoRow label="Centro de Custo" value={`${equipment.costCenter.name}${equipment.costCenter.code ? ` (${equipment.costCenter.code})` : ""}`} />
              )}
              {equipment.location && equipment.location.id !== equipment.currentLocation?.id && (
                <InfoRow label="Localização original" value={equipment.location.name} />
              )}
              {equipment.currentLocation && (
                <InfoRow label="Localização atual" value={equipment.currentLocation.name} />
              )}
            </SectionCard>
          )}

          {/* ── Financeiro ── */}
          {hasFinancial && (
            <SectionCard title="Financeiro" icon={DollarSign}>
              {equipment.purchaseValue && (
                <InfoRow label="Valor de compra" value={`R$ ${Number(equipment.purchaseValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              )}
              {equipment.currentValue && (
                <InfoRow label="Valor atual" value={`R$ ${Number(equipment.currentValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              )}
              {equipment.depreciationRate && (
                <InfoRow label="Taxa de depreciação" value={`${equipment.depreciationRate}% /ano`} />
              )}
              {equipment.purchaseDate && (
                <InfoRow label="Data de compra" value={new Date(equipment.purchaseDate).toLocaleDateString("pt-BR")} />
              )}
              {warrantyOk !== null && equipment.warrantyEnd && (
                <InfoRow
                  label="Garantia"
                  value={`${warrantyOk ? "Em vigor" : "Expirada"} · ${new Date(equipment.warrantyEnd).toLocaleDateString("pt-BR")}`}
                  highlight={warrantyOk ? "green" : "red"}
                />
              )}
            </SectionCard>
          )}

          {/* ── Técnico ── */}
          {hasTechnical && (
            <SectionCard title="Técnico" icon={Monitor}>
              {equipment.btus && <InfoRow label="BTUs" value={equipment.btus.toLocaleString("pt-BR")} />}
              {equipment.voltage && <InfoRow label="Tensão" value={equipment.voltage} />}
              {equipment.ipAddress && <InfoRow label="Endereço IP" value={equipment.ipAddress} mono />}
              {equipment.operatingSystem && <InfoRow label="Sistema Operacional" value={equipment.operatingSystem} />}
            </SectionCard>
          )}

          {/* ── Movimentação ativa ── */}
          {activeMovement && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <HandCoins className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">
                  {activeMovement.type === "LOAN" ? "Empréstimo em andamento" : "Transferência em andamento"}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {activeMovement.origin.name} → {activeMovement.destination.name}
                </p>
                {activeMovement.expectedReturnAt && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Devolução prevista: {new Date(activeMovement.expectedReturnAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Anexos ── */}
          <SectionCard title={`Anexos${attachments.length > 0 ? ` (${attachments.length})` : ""}`} icon={Paperclip}>
            {attLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
              </div>
            ) : attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhum arquivo anexado</p>
            ) : (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <AttachmentRow
                    key={att.id}
                    attachment={att}
                    onOpen={handleOpenFile}
                    onDelete={(id) => deleteAtt.mutate(id)}
                    isDeleting={deleteAtt.isPending}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Histórico de movimentações ── */}
          <SectionCard title={`Movimentações${movements.length > 0 ? ` (${movements.length})` : ""}`} icon={ArrowRightLeft}>
            {movLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
              </div>
            ) : movements.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma movimentação registrada</p>
            ) : (
              <div className="space-y-2">
                {movements.map((mv) => <MovementRow key={mv.id} movement={mv} />)}
              </div>
            )}
          </SectionCard>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MovementRow({ movement }: { movement: Movement }) {
  const isActive = movement.status === "ACTIVE";
  const isLoan = movement.type === "LOAN";
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${isActive ? "border-amber-200 bg-amber-50/60" : "border-border bg-muted/20"}`}>
      <div className="flex-shrink-0 mt-0.5">
        {isLoan ? <HandCoins className="w-3.5 h-3.5 text-amber-500" /> : <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium">{isLoan ? "Empréstimo" : "Transferência"}</span>
          {isActive && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Em andamento</span>}
          {movement.status === "RETURNED" && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Devolvido</span>}
          {movement.status === "CANCELLED" && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Cancelado</span>}
        </div>
        <p className="text-muted-foreground mt-0.5">{movement.origin.name} → {movement.destination.name}</p>
        {movement.reason && <p className="text-muted-foreground truncate">{movement.reason}</p>}
        <p className="text-muted-foreground mt-0.5">{new Date(movement.createdAt).toLocaleDateString("pt-BR")}</p>
      </div>
    </div>
  );
}

// ─── Equipment Row ────────────────────────────────────────────────────────────

function EquipmentRow({
  equipment,
  onView,
  onEdit,
  onMove,
  onDelete,
}: {
  equipment: Equipment;
  onView: (e: Equipment) => void;
  onEdit: (e: Equipment) => void;
  onMove: (e: Equipment) => void;
  onDelete: (e: Equipment) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-xl hover:shadow-sm transition-shadow group">
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center bg-muted/50">
        <Wrench className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{equipment.name}</span>
          <StatusBadge status={equipment.status} />
          <CriticalityBadge criticality={equipment.criticality} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {equipment.brand && (
            <span className="text-xs text-muted-foreground">{equipment.brand}{equipment.model ? ` ${equipment.model}` : ""}</span>
          )}
          {equipment.type && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="w-3 h-3" />{equipment.type.name}
            </span>
          )}
          {equipment.currentLocation && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />{equipment.currentLocation.name}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Ver detalhes" onClick={() => onView(equipment)}>
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(equipment)}>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
        {equipment.status === "ACTIVE" && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Movimentar" onClick={() => onMove(equipment)}>
            <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
        <Button
          variant="ghost" size="sm" className="h-7 w-7 p-0"
          onClick={() => onDelete(equipment)}
          disabled={equipment._count.serviceOrders > 0}
          title={equipment._count.serviceOrders > 0 ? "Possui OS vinculadas" : "Remover"}
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipamentosPage() {
  const user = useCurrentUser();
  const fixedClientId = user?.clientId ?? null;

  const [selectedClientId, setSelectedClientId] = useState(fixedClientId ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "">("");
  const [criticalityFilter, setCriticalityFilter] = useState<EquipmentCriticality | "">("");

  const [formSheet, setFormSheet] = useState<{ open: boolean; target: Equipment | null }>({ open: false, target: null });
  const [detailSheet, setDetailSheet] = useState<Equipment | null>(null);
  const [moveSheet, setMoveSheet] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);

  const { data: clientsData } = useClients({ limit: 100 });
  const clients = clientsData?.data ?? [];

  const { data: listData, isLoading } = useEquipment(selectedClientId, {
    search: search || undefined,
    status: statusFilter || undefined,
    criticality: criticalityFilter || undefined,
    limit: 50,
  });

  const equipments = listData?.data ?? [];
  const total = listData?.total ?? 0;

  const remove = useDeleteEquipment(selectedClientId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o parque de equipamentos dos seus clientes.
          </p>
        </div>
        {selectedClientId && (
          <Button onClick={() => setFormSheet({ open: true, target: null })}>
            <Plus className="w-4 h-4 mr-2" />
            Novo equipamento
          </Button>
        )}
      </div>

      {/* Client selector + Filters */}
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
        {!fixedClientId && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Label htmlFor="client-sel" className="text-sm font-medium whitespace-nowrap">Cliente</Label>
            <select
              id="client-sel"
              value={selectedClientId}
              onChange={(e) => { setSelectedClientId(e.target.value); setSearch(""); }}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
            >
              <option value="">— Selecione —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedClientId && (
          <>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Buscar por nome, marca, série..."
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
          </>
        )}
      </div>

      {/* Content */}
      {!selectedClientId ? (
        <div className="bg-white rounded-xl border border-border py-14 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Selecione um cliente para ver os equipamentos</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : equipments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-14 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {search || statusFilter || criticalityFilter ? "Nenhum equipamento encontrado" : "Nenhum equipamento cadastrado"}
          </p>
          {!search && !statusFilter && !criticalityFilter && (
            <Button size="sm" className="mt-4" onClick={() => setFormSheet({ open: true, target: null })}>
              <Plus className="w-4 h-4 mr-2" />Cadastrar equipamento
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {equipments.map((eq) => (
            <EquipmentRow
              key={eq.id}
              equipment={eq}
              onView={setDetailSheet}
              onEdit={(e) => setFormSheet({ open: true, target: e })}
              onMove={setMoveSheet}
              onDelete={setDeleteTarget}
            />
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            {equipments.length} de {total} equipamento(s)
          </p>
        </div>
      )}

      {/* ── Sheets ── */}
      <EquipmentSheet
        open={formSheet.open}
        editTarget={formSheet.target}
        clientId={selectedClientId}
        onClose={() => setFormSheet({ open: false, target: null })}
      />

      <DetailSheet
        open={!!detailSheet}
        equipment={detailSheet}
        clientId={selectedClientId}
        onClose={() => setDetailSheet(null)}
        onEdit={(e) => { setDetailSheet(null); setFormSheet({ open: true, target: e }); }}
        onMove={(e) => { setDetailSheet(null); setMoveSheet(e); }}
      />

      <MovementSheet
        open={!!moveSheet}
        equipment={moveSheet}
        clientId={selectedClientId}
        onClose={() => setMoveSheet(null)}
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
