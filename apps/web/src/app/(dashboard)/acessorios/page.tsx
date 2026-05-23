"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Cable,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Eye,
  AlertTriangle,
  X,
  Tag,
  MapPin,
  DollarSign,
  ClipboardList,
  Unlink,
  Link,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  useAccessories,
  useCreateAccessory,
  useUpdateAccessory,
  useDeleteAccessory,
  useAccessoryHistory,
} from "@/hooks/accessories/use-accessories";
import {
  useAccessoryCategories,
  useCreateAccessoryCategory,
  useUpdateAccessoryCategory,
  useDeleteAccessoryCategory,
} from "@/hooks/accessories/use-accessory-categories";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import type {
  Accessory,
  AccessoryCategory,
  AccessoryStatus,
  AccessoryCriticality,
  AccessoryOwnership,
  CreateAccessoryDto,
} from "@/services/accessories/accessories.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AccessoryStatus, string> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  UNDER_MAINTENANCE: "Em manutenção",
  LOANED: "Emprestado",
  SCRAPPED: "Baixado",
  LOST: "Extraviado",
};

const STATUS_COLOR: Record<AccessoryStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  IN_USE: "bg-blue-100 text-blue-700 border-blue-200",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-700 border-amber-200",
  LOANED: "bg-purple-100 text-purple-700 border-purple-200",
  SCRAPPED: "bg-red-100 text-red-500 border-red-200",
  LOST: "bg-gray-100 text-gray-500 border-gray-200",
};

const OWNERSHIP_LABEL: Record<AccessoryOwnership, string> = {
  COMPANY: "Empresa",
  CLIENT: "Cliente",
  LEASED: "Locado",
  DONATED: "Doado",
};

const CRITICALITY_LABEL: Record<AccessoryCriticality, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const CRITICALITY_COLOR: Record<AccessoryCriticality, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};

const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: "Preventiva",
  CORRECTIVE: "Corretiva",
  INITIAL_ACCEPTANCE: "Aceite Inicial",
  EXTERNAL_SERVICE: "Serviço Externo",
  TECHNOVIGILANCE: "Tecnovigilância",
  TRAINING: "Treinamento",
  IMPROPER_USE: "Uso Indevido",
  DEACTIVATION: "Desativação",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function isWarrantyExpiring(warrantyEnd: string | null): { expiring: boolean; expired: boolean; days: number } {
  if (!warrantyEnd) return { expiring: false, expired: false, days: 0 };
  const end = new Date(warrantyEnd);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { expiring: days > 0 && days <= 30, expired: days <= 0, days };
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AccessoryStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function CriticalityBadge({ criticality }: { criticality: AccessoryCriticality }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${CRITICALITY_COLOR[criticality]}`}
    >
      {CRITICALITY_LABEL[criticality]}
    </span>
  );
}

// ─── Category Manager Sheet ───────────────────────────────────────────────────

function CategoryManagerSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: categories = [], isLoading } = useAccessoryCategories();
  const createCat = useCreateAccessoryCategory();
  const updateCat = useUpdateAccessoryCategory();
  const deleteCat = useDeleteAccessoryCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Inline form state ──
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newDesc, setNewDesc] = useState("");

  // ── Edit form state ──
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editDesc, setEditDesc] = useState("");

  function startEdit(cat: AccessoryCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color ?? "#6366f1");
    setEditDesc(cat.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createCat.mutate(
      { name: newName.trim(), color: newColor, description: newDesc || undefined },
      {
        onSuccess: () => {
          setNewName("");
          setNewColor("#6366f1");
          setNewDesc("");
        },
      }
    );
  }

  function handleUpdate(id: string) {
    if (!editName.trim()) return;
    updateCat.mutate(
      { id, dto: { name: editName.trim(), color: editColor, description: editDesc || undefined } },
      { onSuccess: () => setEditingId(null) }
    );
  }

  function handleDelete(id: string) {
    deleteCat.mutate(id, { onSuccess: () => setDeletingId(null) });
  }

  const PRESET_COLORS = [
    "#6366f1", "#06b6d4", "#10b981", "#f59e0b",
    "#ef4444", "#8b5cf6", "#ec4899", "#64748b",
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px] p-0 flex flex-col gap-0 overflow-hidden">
          <SheetHeader className="px-5 py-4 border-b border-border bg-muted/20 flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              Categorias de acessórios
            </SheetTitle>
            <p className="text-sm text-muted-foreground">Organize acessórios por tipo ou função.</p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">
            {/* ── Create form ── */}
            <form onSubmit={handleCreate} className="space-y-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Nova categoria</p>
              <div className="space-y-2">
                <Label htmlFor="cat-name" className="text-xs">Nome *</Label>
                <Input
                  id="cat-name"
                  placeholder="Ex: Cabos, Sensores, Suportes..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cor</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-border"
                    title="Cor personalizada"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-desc" className="text-xs">Descrição (opcional)</Label>
                <Input
                  id="cat-desc"
                  placeholder="Breve descrição..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full gap-2"
                disabled={!newName.trim() || createCat.isPending}
              >
                {createCat.isPending
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Criando...</>
                  : <><Plus className="w-3.5 h-3.5" />Criar categoria</>}
              </Button>
            </form>

            {/* ── Category list ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categorias ({categories.length})
              </p>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <div className="py-8 text-center">
                  <Tag className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma categoria criada</p>
                </div>
              ) : (
                categories.map((cat) =>
                  editingId === cat.id ? (
                    /* ── Edit row ── */
                    <div key={cat.id} className="p-3 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Nome da categoria"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${editColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer border border-border"
                        />
                      </div>
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Descrição (opcional)"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => handleUpdate(cat.id)}
                          disabled={!editName.trim() || updateCat.isPending}
                        >
                          {updateCat.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display row ── */
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-white hover:bg-muted/20 transition-colors group"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color ?? "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cat.name}</p>
                        {cat.description && (
                          <p className="text-[11px] text-muted-foreground truncate">{cat.description}</p>
                        )}
                        {cat._count && (
                          <p className="text-[11px] text-muted-foreground">
                            {cat._count.accessories} acessório{cat._count.accessories !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => startEdit(cat)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingId(cat.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>

          <SheetFooter className="px-5 py-4 border-t border-border flex-shrink-0">
            <Button variant="outline" onClick={onClose} className="w-full">Fechar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os acessórios vinculados a esta categoria <strong>não serão removidos</strong>, apenas ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={deleteCat.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCat.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Create/Edit Sheet ────────────────────────────────────────────────────────

const accessorySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  patrimonyNumber: z.string().optional(),
  anvisaNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  ownership: z.enum(["COMPANY", "CLIENT", "LEASED", "DONATED"]).default("COMPANY"),
  purchaseValue: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  observations: z.string().optional(),
  locationId: z.string().optional(),
});
type AccessoryForm = z.infer<typeof accessorySchema>;

function formatToBRL(val: string | number): string {
  const cleanValue = val.toString().replace(/\D/g, "");
  if (!cleanValue) return "";
  const cents = parseInt(cleanValue, 10);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function AccessorySheet({
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccessoryForm>({
    resolver: zodResolver(accessorySchema) as any,
    defaultValues: {
      name: "", categoryId: "", brand: "", model: "", serialNumber: "",
      patrimonyNumber: "", anvisaNumber: "", invoiceNumber: "",
      ownership: "COMPANY", purchaseValue: "", purchaseDate: "",
      warrantyStart: "", warrantyEnd: "",
      criticality: "MEDIUM", observations: "", locationId: "",
    },
  });

  React.useEffect(() => {
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
        locationId: editTarget.currentLocationId ?? "",
      });
    } else {
      reset({
        name: "", categoryId: "", brand: "", model: "", serialNumber: "",
        patrimonyNumber: "", anvisaNumber: "", invoiceNumber: "",
        ownership: "COMPANY", purchaseValue: "", purchaseDate: "",
        warrantyStart: "", warrantyEnd: "",
        criticality: "MEDIUM", observations: "", locationId: "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget?.id]);

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
      locationId: data.locationId || undefined,
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
                    {...register("locationId")}
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

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className={`text-sm font-medium leading-none ${mono ? "font-mono text-[13px]" : ""}`}>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-1">
        {children}
      </div>
    </div>
  );
}

type DetailTab = "info" | "history";

function AccessoryDetailSheet({
  open,
  accessory,
  onClose,
  onEdit,
}: {
  open: boolean;
  accessory: Accessory | null;
  onClose: () => void;
  onEdit: (a: Accessory) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("info");
  const { data: history, isLoading: historyLoading } = useAccessoryHistory(
    accessory?.id ?? "",
    open && tab === "history"
  );

  const { canManageAccessories } = usePermissions();

  if (!accessory) return null;

  const warranty = isWarrantyExpiring(accessory.warrantyEnd);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setTab("info"); onClose(); } }}>
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "640px", width: "100%" }}>
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
            >
              <Cable className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl font-bold truncate tracking-tight">{accessory.name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5 uppercase font-medium tracking-wide truncate">
                {accessory.category?.name ?? "Sem categoria"}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <StatusBadge status={accessory.status} />
                <CriticalityBadge criticality={accessory.criticality} />
                {(warranty.expiring || warranty.expired) && (
                  <span className={`flex items-center gap-1 text-[10px] font-medium ${warranty.expired ? "text-red-600" : "text-amber-600"}`}>
                    <AlertTriangle className="w-3 h-3" />
                    {warranty.expired ? "Garantia vencida" : `Garantia em ${warranty.days}d`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Action bar */}
        {canManageAccessories && (
          <div className="flex items-center gap-2 mt-5 p-1.5 bg-muted/40 rounded-xl border border-border/50">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs hover:bg-white hover:shadow-sm"
              onClick={() => { onClose(); onEdit(accessory); }}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5 text-blue-500" />Editar
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border mt-5 bg-white sticky top-0 z-10">
          {([
            { id: "info", label: "Informações" },
            { id: "history", label: "Histórico" },
          ] as { id: DetailTab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm border-b-2 transition-all ${
                tab === t.id
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Info tab ── */}
        {tab === "info" && (
          <div className="mt-8 space-y-10 pb-8">
            <DetailSection title="Identificação" icon={Tag}>
              {accessory.patrimonyNumber && <DetailRow label="Patrimônio" value={accessory.patrimonyNumber} mono />}
              {accessory.serialNumber && <DetailRow label="Nº de Série" value={accessory.serialNumber} mono />}
              {accessory.qrCode && <DetailRow label="QR Code" value={accessory.qrCode} mono />}
              {accessory.brand && <DetailRow label="Marca" value={accessory.brand} />}
              {accessory.model && <DetailRow label="Modelo" value={accessory.model} />}
              {accessory.anvisaNumber && <DetailRow label="Nº ANVISA" value={accessory.anvisaNumber} mono />}
              <DetailRow label="Propriedade" value={OWNERSHIP_LABEL[accessory.ownership]} />
            </DetailSection>

            <DetailSection title="Localização" icon={MapPin}>
              {accessory.currentLocation && <DetailRow label="Localização atual" value={accessory.currentLocation.name} />}
              {accessory.currentEquipment && <DetailRow label="Equipamento" value={accessory.currentEquipment.name} />}
              {!accessory.currentLocation && !accessory.currentEquipment && (
                <p className="text-xs text-muted-foreground col-span-2">Localização não definida</p>
              )}
            </DetailSection>

            {(accessory.purchaseValue != null || accessory.warrantyEnd) && (
              <DetailSection title="Financeiro" icon={DollarSign}>
                {accessory.purchaseValue != null && (
                  <DetailRow label="Valor de compra" value={formatBRL(accessory.purchaseValue)} />
                )}
                {accessory.purchaseDate && <DetailRow label="Data de compra" value={formatDate(accessory.purchaseDate)} />}
                {accessory.warrantyStart && <DetailRow label="Início da garantia" value={formatDate(accessory.warrantyStart)} />}
                {accessory.warrantyEnd && (
                  <DetailRow
                    label="Fim da garantia"
                    value={formatDate(accessory.warrantyEnd)}
                  />
                )}
                {accessory.invoiceNumber && <DetailRow label="Nota Fiscal" value={accessory.invoiceNumber} mono />}
              </DetailSection>
            )}

            {accessory.totalMaintenances > 0 && (
              <DetailSection title="Manutenção" icon={ClipboardList}>
                <DetailRow label="Total de manutenções" value={String(accessory.totalMaintenances)} />
                {accessory.lastMaintenanceAt && (
                  <DetailRow label="Última manutenção" value={formatDate(accessory.lastMaintenanceAt)} />
                )}
              </DetailSection>
            )}

            {accessory.observations && (
              <div className="space-y-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/50">
                  {accessory.observations}
                </p>
              </div>
            )}

            <div className="pt-8 border-t border-border/40 text-center">
              <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                Criado em {new Date(accessory.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        )}

        {/* ── History tab ── */}
        {tab === "history" && (
          <div className="mt-4 pb-8">
            {historyLoading ? (
              <div className="space-y-2 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg border border-border bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                {/* Status history */}
                {(history?.statusHistory ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      Histórico de Status
                    </p>
                    {history!.statusHistory.map((sh) => (
                      <div key={sh.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            {sh.fromStatus && (
                              <>
                                <span className="text-muted-foreground">{STATUS_LABEL[sh.fromStatus]}</span>
                                <span className="text-muted-foreground">→</span>
                              </>
                            )}
                            <span className="font-semibold">{STATUS_LABEL[sh.toStatus]}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>{sh.changedBy.name}</span>
                            {sh.reason && <span>· {sh.reason}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                          {formatDate(sh.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assignments */}
                {(history?.assignments ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      Vínculos com Equipamentos
                    </p>
                    {history!.assignments.map((asgn) => (
                      <div
                        key={asgn.id}
                        className={`px-3 py-2.5 rounded-lg border ${asgn.isActive ? "border-blue-200 bg-blue-50/50" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold truncate">{asgn.equipment.name}</span>
                          {asgn.isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">Ativo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span>Vinculado por {asgn.assignedBy.name}</span>
                          <span>·</span>
                          <span>{formatDate(asgn.assignedAt)}</span>
                          {asgn.unassignedAt && <><span>→</span><span>{formatDate(asgn.unassignedAt)}</span></>}
                        </div>
                        {asgn.reason && <p className="text-[11px] text-slate-500 mt-1 italic">"{asgn.reason}"</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Movements */}
                {(history?.movements ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      Movimentações
                    </p>
                    {history!.movements.map((mv) => (
                      <div key={mv.id} className="px-3 py-2.5 rounded-lg border border-border bg-card">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold">{mv.type === "LOAN" ? "Empréstimo" : "Transferência"}</span>
                          <span className="text-muted-foreground">{formatDate(mv.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {mv.originLocation.name} → {mv.destinationLocation.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Maintenances */}
                {(history?.maintenances ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      Manutenções
                    </p>
                    {history!.maintenances.map((mt) => (
                      <div key={mt.id} className="px-3 py-2.5 rounded-lg border border-border bg-card">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold truncate">{mt.title}</span>
                          {mt.completedAt ? (
                            <span className="text-[10px] text-emerald-700 font-bold">Concluída</span>
                          ) : (
                            <span className="text-[10px] text-amber-700 font-bold">Pendente</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{MAINTENANCE_TYPE_LABEL[mt.type] ?? mt.type}</span>
                          {mt.technician && <><span>·</span><span>{mt.technician.name}</span></>}
                          {mt.completedAt && <><span>·</span><span>{formatDate(mt.completedAt)}</span></>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!history ||
                  (history.statusHistory.length === 0 &&
                    history.assignments.length === 0 &&
                    history.movements.length === 0 &&
                    history.maintenances.length === 0 && (
                      <div className="py-10 text-center">
                        <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Nenhum histórico registrado</p>
                      </div>
                    ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Accessory Card ───────────────────────────────────────────────────────────

function AccessoryCard({
  accessory,
  onView,
  onEdit,
  onDelete,
}: {
  accessory: Accessory;
  onView: (a: Accessory) => void;
  onEdit: (a: Accessory) => void;
  onDelete: (a: Accessory) => void;
}) {
  const { canManageAccessories, canAccess } = usePermissions();
  const canDelete = canAccess("accessories", "delete");
  const warranty = isWarrantyExpiring(accessory.warrantyEnd);

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: accessory.category?.color
              ? `${accessory.category.color}30`
              : "linear-gradient(135deg, #6366f1, #06b6d4)",
          }}
        >
          <Cable
            className="w-5 h-5"
            style={{ color: accessory.category?.color ?? "white" }}
          />
        </div>
        <StatusBadge status={accessory.status} />
      </div>

      {/* Title */}
      <div className="px-5 pb-3">
        <p className="font-semibold text-sm leading-snug truncate">{accessory.name}</p>
        {accessory.category && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {accessory.category.name}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <CriticalityBadge criticality={accessory.criticality} />
          {(warranty.expiring || warranty.expired) && (
            <span
              className={`flex items-center gap-1 text-[10px] font-medium ${warranty.expired ? "text-red-600" : "text-amber-600"}`}
            >
              <AlertTriangle className="w-3 h-3" />
              {warranty.expired ? "Garantia vencida" : `${warranty.days}d`}
            </span>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="px-5 pb-4 space-y-1.5 flex-1">
        {accessory.patrimonyNumber && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Patrimônio</span>
            <span className="font-mono text-slate-700 truncate">{accessory.patrimonyNumber}</span>
          </div>
        )}
        {accessory.serialNumber && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Série</span>
            <span className="font-mono text-slate-700 truncate">{accessory.serialNumber}</span>
          </div>
        )}
        {(accessory.brand || accessory.model) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Modelo</span>
            <span className="text-slate-700 truncate">
              {[accessory.brand, accessory.model].filter(Boolean).join(" ")}
            </span>
          </div>
        )}
        {accessory.currentEquipment && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Equipamento</span>
            <span className="text-slate-700 truncate">{accessory.currentEquipment.name}</span>
          </div>
        )}
        {accessory.currentLocation && !accessory.currentEquipment && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Localização</span>
            <span className="text-slate-700 truncate">{accessory.currentLocation.name}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={() => onView(accessory)}
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />Detalhes
        </Button>
        {canManageAccessories && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => onEdit(accessory)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
          </Button>
        )}
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(accessory)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AcessoriosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccessoryStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Accessory | null>(null);
  const [viewTarget, setViewTarget] = useState<Accessory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Accessory | null>(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);

  const { canManageAccessories, canViewAccessories } = usePermissions();
  const { data: categories = [] } = useAccessoryCategories();

  const { data, isLoading } = useAccessories({
    search: search || undefined,
    status: statusFilter || undefined,
    categoryId: categoryFilter || undefined,
    page,
    limit: 24,
  });

  const accessories = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 24);

  const deleteAccessory = useDeleteAccessory();

  function handleEdit(a: Accessory) {
    setEditTarget(a);
    setCreateOpen(true);
  }

  function handleCloseSheet() {
    setCreateOpen(false);
    setEditTarget(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteAccessory.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  // ── Search debounce ──
  const [debouncedSearch, setDebouncedSearch] = useState("");
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(debouncedSearch);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [debouncedSearch]);

  return (
    <div className="flex flex-col gap-6 p-6 pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cable className="w-6 h-6 text-primary" />
            Acessórios
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie e rastreie acessórios de equipamentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageAccessories && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatManagerOpen(true)}
              className="gap-2 h-9"
            >
              <Tag className="w-3.5 h-3.5" />
              Categorias
            </Button>
          )}
          {canManageAccessories && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo acessório
            </Button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-9"
            placeholder="Buscar por nome, série, patrimônio ou QR..."
            value={debouncedSearch}
            onChange={(e) => setDebouncedSearch(e.target.value)}
          />
          {debouncedSearch && (
            <button
              onClick={() => setDebouncedSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="h-9 text-sm border border-border rounded-md px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as AccessoryStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="h-9 text-sm border border-border rounded-md px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todas as categorias</option>
          {categories.filter((c) => c.isActive).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {(statusFilter || categoryFilter || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground"
            onClick={() => {
              setDebouncedSearch("");
              setStatusFilter("");
              setCategoryFilter("");
              setPage(1);
            }}
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* ── Summary ── */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{total} acessório{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</span>
        {totalPages > 1 && (
          <span>· Página {page} de {totalPages}</span>
        )}
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : accessories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Cable className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground font-medium">Nenhum acessório encontrado</p>
          {canManageAccessories && !search && !statusFilter && !categoryFilter && (
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Cadastrar primeiro acessório
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accessories.map((acc) => (
            <AccessoryCard
              key={acc.id}
              accessory={acc}
              onView={(a) => setViewTarget(a)}
              onEdit={handleEdit}
              onDelete={(a) => setDeleteTarget(a)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* ── Category Manager ── */}
      <CategoryManagerSheet
        open={catManagerOpen}
        onClose={() => setCatManagerOpen(false)}
      />

      {/* ── Create/Edit Sheet ── */}
      <AccessorySheet
        open={createOpen}
        editTarget={editTarget}
        onClose={handleCloseSheet}
      />

      {/* ── Detail Sheet ── */}
      <AccessoryDetailSheet
        open={!!viewTarget}
        accessory={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={handleEdit}
      />

      {/* ── Delete dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acessório?</AlertDialogTitle>
            <AlertDialogDescription>
              O acessório <strong>{deleteTarget?.name}</strong> será removido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteAccessory.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccessory.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
