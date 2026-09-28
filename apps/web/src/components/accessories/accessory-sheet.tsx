"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCreateAccessory, useUpdateAccessory } from "@/hooks/accessories/use-accessories";
import { useAccessoryCategories } from "@/hooks/accessories/use-accessory-categories";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import type { Accessory, CreateAccessoryDto } from "@/services/accessories/accessories.service";

const accessorySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  patrimonyNumber: z.string().optional(),
  anvisaNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  ownership: z.enum(["COMPANY", "CLIENT", "LEASED", "DONATED"]),
  purchaseValue: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  observations: z.string().optional(),
  currentLocationId: z.string().optional(),
});
type AccessoryForm = z.infer<typeof accessorySchema>;

function formatToBRL(val: string | number): string {
  const cleanValue = val.toString().replace(/\D/g, "");
  if (!cleanValue) return "";
  const cents = parseInt(cleanValue, 10);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function AccessorySheet({
  open,
  editTarget,
  onClose,
}: {
  open: boolean;
  editTarget: Accessory | null;
  onClose: () => void;
}) {
  const create = useCreateAccessory();
  const update = useUpdateAccessory();
  const isPending = create.isPending || update.isPending;

  const { data: categories = [] } = useAccessoryCategories();
  const { data: costCenters = [] } = useCostCenters({ limit: 100 });
  const allLocations = costCenters.flatMap((cc) =>
    cc.locations.map((l) => ({ ...l, ccName: cc.name }))
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AccessoryForm>({
    resolver: zodResolver(accessorySchema),
    defaultValues: {
      name: "", categoryId: "", brand: "", model: "", serialNumber: "",
      patrimonyNumber: "", anvisaNumber: "", invoiceNumber: "",
      ownership: "COMPANY", purchaseValue: "", purchaseDate: "",
      warrantyStart: "", warrantyEnd: "",
      criticality: "MEDIUM", observations: "", currentLocationId: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (editTarget) {
      reset({
        name: editTarget.name,
        categoryId: editTarget.categoryId ?? "",
        brand: editTarget.brand ?? "",
        model: editTarget.model ?? "",
        serialNumber: editTarget.serialNumber ?? "",
        patrimonyNumber: editTarget.patrimonyNumber ?? "",
        anvisaNumber: editTarget.anvisaNumber ?? "",
        invoiceNumber: editTarget.invoiceNumber ?? "",
        ownership: editTarget.ownership,
        purchaseValue: editTarget.purchaseValue != null
          ? formatToBRL(Math.round(editTarget.purchaseValue * 100))
          : "",
        purchaseDate: editTarget.purchaseDate?.substring(0, 10) ?? "",
        warrantyStart: editTarget.warrantyStart?.substring(0, 10) ?? "",
        warrantyEnd: editTarget.warrantyEnd?.substring(0, 10) ?? "",
        criticality: editTarget.criticality,
        observations: editTarget.observations ?? "",
        currentLocationId: editTarget.currentLocationId ?? "",
      });
    } else {
      reset({
        name: "", categoryId: "", brand: "", model: "", serialNumber: "",
        patrimonyNumber: "", anvisaNumber: "", invoiceNumber: "",
        ownership: "COMPANY", purchaseValue: "", purchaseDate: "",
        warrantyStart: "", warrantyEnd: "",
        criticality: "MEDIUM", observations: "", currentLocationId: "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTarget?.id]);

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(data: AccessoryForm) {
    const dto: CreateAccessoryDto = {
      name: data.name,
      categoryId: data.categoryId || undefined,
      brand: data.brand || undefined,
      model: data.model || undefined,
      serialNumber: data.serialNumber || undefined,
      patrimonyNumber: data.patrimonyNumber || undefined,
      anvisaNumber: data.anvisaNumber || undefined,
      invoiceNumber: data.invoiceNumber || undefined,
      ownership: data.ownership,
      purchaseValue: data.purchaseValue
        ? parseInt(data.purchaseValue.replace(/\D/g, ""), 10) / 100
        : undefined,
      purchaseDate: data.purchaseDate || undefined,
      warrantyStart: data.warrantyStart || undefined,
      warrantyEnd: data.warrantyEnd || undefined,
      criticality: data.criticality,
      observations: data.observations || undefined,
      currentLocationId: data.currentLocationId || undefined,
    };

    if (editTarget) {
      update.mutate({ id: editTarget.id, dto }, { onSuccess: handleClose });
    } else {
      create.mutate(dto, { onSuccess: handleClose });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="w-full sm:w-[680px] sm:max-w-[680px] p-0 flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="px-5 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <SheetTitle>{editTarget ? "Editar acessório" : "Novo acessório"}</SheetTitle>
          <p className="text-sm text-muted-foreground">Preencha as informações do acessório.</p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">
            {/* ── Identificação ── */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</legend>
              <div className="space-y-2">
                <Label htmlFor="ac-name">Nome *</Label>
                <Input id="ac-name" placeholder="Ex: Cabo de O₂, Monitor SpO₂..." {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select
                    {...register("categoryId")}
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Sem categoria —</option>
                    {categories.filter((c) => c.isActive).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ac-brand">Marca</Label>
                  <Input id="ac-brand" placeholder="Ex: Philips" {...register("brand")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac-model">Modelo</Label>
                  <Input id="ac-model" placeholder="Ex: M1520A" {...register("model")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ac-serial">Nº de Série</Label>
                  <Input id="ac-serial" placeholder="SN-2024-001" {...register("serialNumber")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac-patri">Patrimônio</Label>
                  <Input id="ac-patri" placeholder="PAT-ACC-001" {...register("patrimonyNumber")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ac-anvisa">Nº ANVISA</Label>
                  <Input id="ac-anvisa" placeholder="80000000000" {...register("anvisaNumber")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac-invoice">Nº Nota Fiscal</Label>
                  <Input id="ac-invoice" placeholder="NF-001" {...register("invoiceNumber")} />
                </div>
              </div>
            </fieldset>

            {/* ── Localização & Propriedade ── */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização & Propriedade</legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Localização inicial</Label>
                  <select
                    {...register("currentLocationId")}
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Selecione —</option>
                    {allLocations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.ccName})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Propriedade</Label>
                  <select
                    {...register("ownership")}
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="COMPANY">Empresa</option>
                    <option value="CLIENT">Cliente</option>
                    <option value="LEASED">Locado</option>
                    <option value="DONATED">Doado</option>
                  </select>
                </div>
              </div>
            </fieldset>

            {/* ── Aquisição ── */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aquisição</legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ac-pval">Valor de compra</Label>
                  <Input
                    id="ac-pval"
                    placeholder="R$ 0,00"
                    {...register("purchaseValue")}
                    onChange={(e) => setValue("purchaseValue", formatToBRL(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac-pdate">Data de compra</Label>
                  <Input id="ac-pdate" type="date" {...register("purchaseDate")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ac-wstart">Início da garantia</Label>
                  <Input id="ac-wstart" type="date" {...register("warrantyStart")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac-wend">Fim da garantia</Label>
                  <Input id="ac-wend" type="date" {...register("warrantyEnd")} />
                </div>
              </div>
            </fieldset>

            {/* ── Observações ── */}
            <div className="space-y-2">
              <Label htmlFor="ac-obs">Observações</Label>
              <Textarea
                id="ac-obs"
                placeholder="Informações adicionais..."
                rows={3}
                {...register("observations")}
              />
            </div>
          </div>

          <SheetFooter className="px-5 py-4 border-t border-border flex-shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : editTarget ? "Salvar" : "Cadastrar acessório"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
