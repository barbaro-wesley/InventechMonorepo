"use client";

import React, { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RefreshCw, Paperclip, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useCreateEquipment,
  useUpdateEquipment,
} from "@/hooks/equipment/use-equipment";
import { useCustomFieldDefinitions } from "@/hooks/equipment/use-custom-fields";
import { useEquipmentTypes } from "@/hooks/equipment/use-equipment-types";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import { useUploadAttachment } from "@/hooks/storage/use-attachments";
import type { Equipment } from "@/services/equipment/equipment.service";
import { storageService } from "@/services/storage/storage.service";

// ─── Schema ───────────────────────────────────────────────────────────────────

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

export const formatToBRL = (val: string | number) => {
  const cleanValue = val.toString().replace(/\D/g, "");
  if (!cleanValue) return "";
  const cents = parseInt(cleanValue, 10);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

// ─── Component ──────────────────────────────────────────────────────────────────

export function EquipmentFormSheet({
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
