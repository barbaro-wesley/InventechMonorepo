"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, Pencil, Trash2, Package, AlertTriangle,
  MoreHorizontal, ArrowDown, ArrowUp, SlidersHorizontal,
  History, Tag, X, MapPin, Users, ArrowLeftRight, Loader2, LayoutDashboard,
} from "lucide-react";
import { InventoryDashboard } from "./_components/inventory-dashboard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useInventory, useCreateStockItem, useUpdateStockItem,
  useDeleteStockItem, useItemMovements, useCreateMovement,
} from "@/hooks/inventory/use-inventory";
import {
  useStockCategories, useCreateStockCategory,
  useUpdateStockCategory, useDeleteStockCategory,
} from "@/hooks/inventory/use-stock-categories";
import {
  useStockPoints, useCreateStockPoint, useUpdateStockPoint,
  useDeleteStockPoint, useAssignStockPointClients,
} from "@/hooks/inventory/use-stock-points";
import { useClients } from "@/hooks/clients/use-clients";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { StockItem, StockMovement } from "@/services/inventory/inventory.service";
import type { StockCategory } from "@/services/inventory/inventory.service";
import type { StockPoint } from "@/services/inventory/stock-points.service";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3b82f6","#8b5cf6","#10b981","#f59e0b",
  "#ef4444","#06b6d4","#f97316","#6366f1",
  "#14b8a6","#ec4899","#84cc16","#64748b",
];

const UNIT_OPTIONS = ["UN","KG","G","L","ML","M","CM","CX","PC","PAR","ROLO"];

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY:"Entrada", EXIT:"Saída", ADJUSTMENT:"Ajuste", TRANSFER:"Transferência",
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  stockPointId: z.string().min(1,"Selecione um ponto de estoque"),
  categoryId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().min(2,"Mínimo 2 caracteres"),
  description: z.string().optional(),
  unit: z.string().default("UN"),
  brand: z.string().optional(),
  minimumQuantity: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
});
type ItemForm = z.infer<typeof itemSchema>;

const categorySchema = z.object({
  name: z.string().min(2,"Mínimo 2 caracteres"),
  description: z.string().optional(),
});
type CategoryForm = z.infer<typeof categorySchema>;

const pointSchema = z.object({
  name: z.string().min(2,"Mínimo 2 caracteres"),
  description: z.string().optional(),
});
type PointForm = z.infer<typeof pointSchema>;

const movementSchema = z.object({
  type: z.enum(["ENTRY","EXIT","ADJUSTMENT"]),
  quantity: z.number().positive("Deve ser maior que zero"),
  unitCost: z.number().min(0).optional(),
  reason: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

const transferSchema = z.object({
  destinationPointId: z.string().min(1,"Selecione o ponto destino"),
  quantity: z.number().positive("Deve ser maior que zero"),
  reason: z.string().optional(),
});
type TransferForm = z.infer<typeof transferSchema>;

// ─── ItemSheet ────────────────────────────────────────────────────────────────

function ItemSheet({ open, editTarget, categories, stockPoints, onClose }: {
  open: boolean; editTarget: StockItem | null;
  categories: StockCategory[]; stockPoints: StockPoint[]; onClose: () => void;
}) {
  const create = useCreateStockItem();
  const update = useUpdateStockItem();
  const isPending = create.isPending || update.isPending;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ItemForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(itemSchema) as any,
    values: editTarget ? {
      stockPointId: editTarget.stockPointId,
      categoryId: editTarget.categoryId ?? undefined,
      code: editTarget.code ?? "",
      name: editTarget.name,
      description: editTarget.description ?? "",
      unit: editTarget.unit,
      brand: editTarget.brand ?? "",
      minimumQuantity: editTarget.minimumQuantity,
      unitCost: editTarget.unitCost ?? undefined,
    } : { stockPointId: stockPoints[0]?.id ?? "", unit: "UN", name: "" },
  });

  function handleClose() { reset(); onClose(); }

  function onSubmit(data: ItemForm) {
    const dto = {
      stockPointId: data.stockPointId,
      categoryId: data.categoryId || undefined,
      code: data.code || undefined,
      name: data.name,
      description: data.description || undefined,
      unit: data.unit,
      brand: data.brand || undefined,
      minimumQuantity: data.minimumQuantity,
      unitCost: data.unitCost,
    };
    if (editTarget) {
      update.mutate({ id: editTarget.id, dto }, { onSuccess: handleClose });
    } else {
      create.mutate(dto, { onSuccess: handleClose });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>{editTarget ? "Editar Item" : "Novo Item de Estoque"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="py-5 space-y-5">
          {/* Seção principal */}
          <fieldset className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Identificação</p>

            <div className="space-y-1.5">
              <Label>Ponto de estoque *</Label>
              <Select value={watch("stockPointId") ?? ""} onValueChange={(v) => setValue("stockPointId", v)} disabled={!!editTarget}>
                <SelectTrigger className={cn(errors.stockPointId && "border-red-400")}>
                  <SelectValue placeholder="Selecione o ponto" />
                </SelectTrigger>
                <SelectContent>
                  {stockPoints.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />{p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.stockPointId && <p className="text-xs text-red-500">{errors.stockPointId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input {...register("name")} placeholder="Ex: Luva descartável M" className={cn(errors.name && "border-red-400")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código / SKU</Label>
                <Input {...register("code")} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={watch("unit") ?? "UN"} onValueChange={(v) => setValue("unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={watch("categoryId") ?? "none"} onValueChange={(v) => setValue("categoryId", v === "none" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.filter((c) => c.isActive).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        {cat.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cat.color }} />}
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </fieldset>

          {/* Seção detalhes */}
          <fieldset className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Detalhes</p>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input {...register("brand")} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea {...register("description")} rows={2} placeholder="Opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Qtd. mínima</Label>
                <Input type="number" step="0.001" min={0} {...register("minimumQuantity", { valueAsNumber: true })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Custo unit. (R$)</Label>
                <Input type="number" step="0.01" min={0} {...register("unitCost", { valueAsNumber: true })} placeholder="Opcional" />
              </div>
            </div>
          </fieldset>

          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? "Salvar" : "Criar item"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── PointSheet ───────────────────────────────────────────────────────────────

function PointSheet({ open, editTarget, onClose }: {
  open: boolean; editTarget: StockPoint | null; onClose: () => void;
}) {
  const create = useCreateStockPoint();
  const update = useUpdateStockPoint();
  const assignClients = useAssignStockPointClients();
  const { data: clientsData } = useClients({ limit: 200 });
  const clients = clientsData?.data ?? [];
  const isPending = create.isPending || update.isPending || assignClients.isPending;

  const [selectedClients, setSelectedClients] = useState<string[]>(
    editTarget?.clients.map((c) => c.id) ?? []
  );

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PointForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(pointSchema) as any,
    values: editTarget
      ? { name: editTarget.name, description: editTarget.description ?? "" }
      : { name: "", description: "" },
  });

  function handleClose() { reset(); setSelectedClients([]); onClose(); }

  function toggleClient(id: string) {
    setSelectedClients((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  function onSubmit(data: PointForm) {
    const dto = { name: data.name, description: data.description || undefined };
    if (editTarget) {
      update.mutate({ id: editTarget.id, dto }, {
        onSuccess: () => assignClients.mutate({ id: editTarget.id, clientIds: selectedClients }, { onSuccess: handleClose }),
      });
    } else {
      create.mutate({ ...dto, clientIds: selectedClients }, { onSuccess: handleClose });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>{editTarget ? "Editar Ponto de Estoque" : "Novo Ponto de Estoque"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="py-5 space-y-5">
          <fieldset className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Dados do ponto</p>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input {...register("name")} placeholder="Ex: Almoxarifado Central" className={cn(errors.name && "border-red-400")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea {...register("description")} rows={2} placeholder="Opcional" />
            </div>
          </fieldset>

          {clients.length > 0 && (
            <fieldset className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Clientes com acesso</p>
                {selectedClients.length > 0 && (
                  <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {selectedClients.length} selecionado(s)
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                {(clients as { id: string; name: string }[]).map((c) => (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(c.id)}
                      onChange={() => toggleClient(c.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{c.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? "Salvar" : "Criar ponto"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── CategorySheet ────────────────────────────────────────────────────────────

function CategorySheet({ open, editTarget, onClose }: {
  open: boolean; editTarget: StockCategory | null; onClose: () => void;
}) {
  const create = useCreateStockCategory();
  const update = useUpdateStockCategory();
  const isPending = create.isPending || update.isPending;
  const [selectedColor, setSelectedColor] = useState(editTarget?.color ?? PRESET_COLORS[0]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(categorySchema) as any,
    values: editTarget ? { name: editTarget.name, description: editTarget.description ?? "" } : { name: "", description: "" },
  });

  function handleClose() { reset(); setSelectedColor(PRESET_COLORS[0]); onClose(); }

  function onSubmit(data: CategoryForm) {
    const dto = { name: data.name, description: data.description || undefined, color: selectedColor };
    if (editTarget) {
      update.mutate({ id: editTarget.id, dto }, { onSuccess: handleClose });
    } else {
      create.mutate(dto, { onSuccess: handleClose });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>{editTarget ? "Editar Categoria" : "Nova Categoria"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="py-5 space-y-5">
          <fieldset className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Dados da categoria</p>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input {...register("name")} placeholder="Ex: Materiais cirúrgicos" className={cn(errors.name && "border-red-400")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea {...register("description")} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Cor de identificação</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setSelectedColor(c)}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all", selectedColor === c ? "border-slate-800 dark:border-slate-200 scale-110 shadow" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </fieldset>
          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? "Salvar" : "Criar categoria"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── MovementSheet ────────────────────────────────────────────────────────────

function MovementSheet({ open, item, stockPoints, canCreateMovement, canTransfer, onClose }: {
  open: boolean; item: StockItem | null; stockPoints: StockPoint[];
  canCreateMovement: boolean; canTransfer: boolean; onClose: () => void;
}) {
  const createMovement = useCreateMovement();
  const { data: movementsData } = useItemMovements(item?.id ?? "");
  const defaultTab = canCreateMovement ? "movement" : canTransfer ? "transfer" : "history";
  const [tab, setTab] = useState<"movement" | "transfer" | "history">(defaultTab as "movement" | "transfer" | "history");

  const movForm = useForm<MovementForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(movementSchema) as any,
    defaultValues: { type: "ENTRY", quantity: 1 },
  });

  const transferForm = useForm<TransferForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(transferSchema) as any,
    defaultValues: { quantity: 1 },
  });

  function handleClose() {
    movForm.reset({ type: "ENTRY", quantity: 1 });
    transferForm.reset({ quantity: 1 });
    setTab(defaultTab as "movement" | "transfer" | "history");
    onClose();
  }

  function onMovementSubmit(data: MovementForm) {
    if (!item) return;
    createMovement.mutate({ itemId: item.id, ...data }, { onSuccess: handleClose });
  }

  function onTransferSubmit(data: TransferForm) {
    if (!item) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createMovement as any).mutate(
      { itemId: item.id, destinationPointId: data.destinationPointId, quantity: data.quantity, reason: data.reason, type: "TRANSFER" },
      { onSuccess: handleClose }
    );
  }

  const movements: StockMovement[] = movementsData?.data ?? [];
  const otherPoints = stockPoints.filter((p) => p.id !== item?.stockPointId && p.isActive);
  const isLow = item ? item.minimumQuantity > 0 && item.currentQuantity < item.minimumQuantity : false;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader className="pb-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            {item?.name}
          </SheetTitle>
          {item && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />{item.stockPoint.name}
              </span>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", isLow ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>
                {item.currentQuantity} {item.unit}
              </span>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="flex gap-0 border-b mt-4">
            {[
              ...(canCreateMovement ? [{ key: "movement", label: "Movimentar" }] : []),
              ...(canTransfer && otherPoints.length > 0 ? [{ key: "transfer", label: "Transferir" }] : []),
            ].map((t) => (
              <button key={t.key}
                onClick={() => setTab(t.key as "movement" | "transfer")}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  tab === t.key ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100" : "border-transparent text-slate-400 hover:text-slate-600"
                )}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Formulário movimentação */}
          {tab === "movement" && (
            <form onSubmit={movForm.handleSubmit(onMovementSubmit)} className="space-y-4 mt-4 px-0.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={movForm.watch("type")} onValueChange={(v) => movForm.setValue("type", v as MovementForm["type"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTRY">
                        <div className="flex items-center gap-2"><ArrowDown className="h-3.5 w-3.5 text-emerald-600" />Entrada</div>
                      </SelectItem>
                      <SelectItem value="EXIT">
                        <div className="flex items-center gap-2"><ArrowUp className="h-3.5 w-3.5 text-red-600" />Saída</div>
                      </SelectItem>
                      <SelectItem value="ADJUSTMENT">
                        <div className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />Ajuste</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade</Label>
                  <Input type="number" step="0.001" min={0.001} {...movForm.register("quantity", { valueAsNumber: true })} />
                  {movForm.formState.errors.quantity && <p className="text-xs text-red-500">{movForm.formState.errors.quantity.message}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Custo unitário (R$)</Label>
                <Input type="number" step="0.01" min={0} {...movForm.register("unitCost", { valueAsNumber: true })} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo / Observação</Label>
                <Input {...movForm.register("reason")} placeholder="Ex: Compra, uso em procedimento..." />
              </div>
              <Button type="submit" disabled={createMovement.isPending} className="w-full">
                {createMovement.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Registrar movimentação
              </Button>
            </form>
          )}

          {/* Formulário transferência */}
          {tab === "transfer" && (
            <form onSubmit={transferForm.handleSubmit(onTransferSubmit)} className="space-y-4 mt-4 px-0.5">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-3 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                <ArrowLeftRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                O item será descontado deste ponto e creditado no destino automaticamente.
              </div>
              <div className="space-y-1.5">
                <Label>Ponto destino</Label>
                <Select value={transferForm.watch("destinationPointId") ?? ""} onValueChange={(v) => transferForm.setValue("destinationPointId", v)}>
                  <SelectTrigger className={cn(transferForm.formState.errors.destinationPointId && "border-red-400")}>
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherPoints.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {transferForm.formState.errors.destinationPointId && <p className="text-xs text-red-500">{transferForm.formState.errors.destinationPointId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" step="0.001" min={0.001} {...transferForm.register("quantity", { valueAsNumber: true })} />
                {transferForm.formState.errors.quantity && <p className="text-xs text-red-500">{transferForm.formState.errors.quantity.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Input {...transferForm.register("reason")} placeholder="Opcional" />
              </div>
              <Button type="submit" disabled={createMovement.isPending} className="w-full">
                {createMovement.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Transferir
              </Button>
            </form>
          )}

          {/* Histórico */}
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Histórico</p>
            {movements.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma movimentação registrada</p>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                      m.type === "ENTRY" ? "bg-emerald-100 dark:bg-emerald-950" :
                      m.type === "EXIT" ? "bg-red-100 dark:bg-red-950" :
                      m.type === "TRANSFER" ? "bg-blue-100 dark:bg-blue-950" : "bg-amber-100 dark:bg-amber-950"
                    )}>
                      {m.type === "ENTRY" ? <ArrowDown className="h-3.5 w-3.5 text-emerald-600" /> :
                       m.type === "EXIT" ? <ArrowUp className="h-3.5 w-3.5 text-red-600" /> :
                       m.type === "TRANSFER" ? <ArrowLeftRight className="h-3.5 w-3.5 text-blue-600" /> :
                       <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {m.type === "EXIT" ? "-" : "+"}{m.quantity} {item?.unit}
                        </span>
                        <span className="text-xs text-slate-400">{MOVEMENT_LABELS[m.type]}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {m.reason ? m.reason : m.user.name} · {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">→ {m.quantityAfter}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({ item, canManage, onEdit, onDelete, onMovement }: {
  item: StockItem; canManage: boolean;
  onEdit: () => void; onDelete: () => void; onMovement: () => void;
}) {
  const isLow = item.minimumQuantity > 0 && item.currentQuantity < item.minimumQuantity;
  const isEmpty = item.currentQuantity === 0;
  const accentColor = isEmpty ? "bg-red-500" : isLow ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      {/* Barra de status */}
      <div className={cn("h-1 w-full flex-shrink-0", accentColor)} />

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {item.category && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-white mb-1.5"
                style={{ backgroundColor: item.category.color ?? "#64748b" }}>
                {item.category.name}
              </span>
            )}
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.code && <span className="text-xs text-slate-400 font-mono">{item.code}</span>}
              {item.brand && <span className="text-xs text-slate-400">{item.brand}</span>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onMovement}><History className="h-4 w-4 mr-2" />Movimentações</DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Remover</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quantidade */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-400">Estoque atual</p>
            <p className={cn("text-2xl font-bold leading-tight", isEmpty ? "text-red-600" : isLow ? "text-amber-500" : "text-emerald-600")}>
              {item.currentQuantity}
              <span className="text-sm font-normal text-slate-400 ml-1">{item.unit}</span>
            </p>
          </div>
          {item.minimumQuantity > 0 && (
            <div className="text-right">
              <p className="text-xs text-slate-400">Mín.</p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{item.minimumQuantity}</p>
            </div>
          )}
        </div>

        {/* Alerta */}
        {isLow && (
          <div className={cn("flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 font-medium",
            isEmpty ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400")}>
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {isEmpty ? "Estoque zerado" : "Abaixo do mínimo"}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
          <MapPin className="h-3 w-3 flex-shrink-0" />{item.stockPoint.name}
        </span>
        <button onClick={onMovement} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors flex-shrink-0">
          <History className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── StockPointCard ───────────────────────────────────────────────────────────

function StockPointCard({ point, canManage, onEdit, onDelete }: {
  point: StockPoint; canManage: boolean; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className="h-1 w-full bg-blue-500 flex-shrink-0" />
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{point.name}</p>
              {point.description && <p className="text-xs text-slate-400 truncate">{point.description}</p>}
            </div>
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Remover</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {point.clients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {point.clients.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                <Users className="h-2.5 w-2.5" />{c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4">
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Package className="h-3 w-3" />
          <span className="font-semibold text-slate-600 dark:text-slate-400">{point._count.items}</span> itens
        </span>
        {!point.isActive && <Badge variant="secondary" className="text-xs ml-auto">Inativo</Badge>}
      </div>
    </div>
  );
}

// ─── CategoriesList ───────────────────────────────────────────────────────────

function CategoriesList({ canManage }: { canManage: boolean }) {
  const { data: categories = [], isLoading } = useStockCategories();
  const deleteCategory = useDeleteStockCategory();
  const [catSheet, setCatSheet] = useState<{ open: boolean; target: StockCategory | null }>({ open: false, target: null });
  const [deleteTarget, setDeleteTarget] = useState<StockCategory | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <>
      {categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-slate-500">Nenhuma categoria criada</p>
          <p className="text-sm text-slate-400 mt-1">Categorias ajudam a organizar os itens do estoque</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <div key={cat.id} className="group flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-sm transition-all">
              <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: cat.color ?? "#64748b" }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{cat.name}</p>
                <p className="text-xs text-slate-400">{cat._count.items} {cat._count.items === 1 ? "item" : "itens"}</p>
              </div>
              {canManage && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCatSheet({ open: true, target: cat })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(cat)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CategorySheet open={catSheet.open} editTarget={catSheet.target} onClose={() => setCatSheet({ open: false, target: null })} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria <strong>{deleteTarget?.name}</strong> será removida. Itens vinculados ficam sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleteTarget) deleteCategory.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EstoquePage() {
  const { canManageInventory, canManageInventoryPoints, canCreateInventoryMovements, canTransferInventory, canViewInventory } = usePermissions();
  const canManage = canManageInventory;
  const canManagePoints = canManageInventoryPoints;

  const [activeTab, setActiveTab] = useState<"dashboard" | "points" | "items" | "categories">("dashboard");
  const [search, setSearch] = useState("");
  const [pointFilter, setPointFilter] = useState<string>("all");
  const [belowMinimum, setBelowMinimum] = useState(false);

  const [itemSheet, setItemSheet] = useState<{ open: boolean; target: StockItem | null }>({ open: false, target: null });
  const [movementSheet, setMovementSheet] = useState<{ open: boolean; item: StockItem | null }>({ open: false, item: null });
  const [pointSheet, setPointSheet] = useState<{ open: boolean; target: StockPoint | null }>({ open: false, target: null });
  const [catSheet, setCatSheet] = useState<{ open: boolean; target: StockCategory | null }>({ open: false, target: null });
  const [deleteItemTarget, setDeleteItemTarget] = useState<StockItem | null>(null);
  const [deletePointTarget, setDeletePointTarget] = useState<StockPoint | null>(null);

  const { data: inventoryData, isLoading: loadingItems } = useInventory({
    search: search || undefined,
    stockPointId: pointFilter !== "all" ? pointFilter : undefined,
    belowMinimum: belowMinimum || undefined,
  });

  const { data: categories = [] } = useStockCategories({ isActive: true });
  const { data: stockPoints = [], isLoading: loadingPoints } = useStockPoints();

  const deleteItem = useDeleteStockItem();
  const deletePoint = useDeleteStockPoint();

  const items: StockItem[] = inventoryData?.data ?? [];
  const total = inventoryData?.pagination?.total ?? 0;
  const lowCount = items.filter((i) => i.minimumQuantity > 0 && i.currentQuantity < i.minimumQuantity).length;
  const activePoints = (stockPoints as StockPoint[]).filter((p) => p.isActive);
  const totalItems = (stockPoints as StockPoint[]).reduce((acc, p) => acc + p._count.items, 0);

  const TAB_ACTIONS: Record<string, React.ReactNode> = {
    points: canManagePoints ? (
      <Button size="sm" onClick={() => setPointSheet({ open: true, target: null })}>
        <Plus className="h-4 w-4 mr-1.5" />Novo ponto
      </Button>
    ) : null,
    items: canManage ? (
      <Button size="sm" onClick={() => setItemSheet({ open: true, target: null })}>
        <Plus className="h-4 w-4 mr-1.5" />Novo item
      </Button>
    ) : null,
    categories: canManage ? (
      <Button size="sm" variant="outline" onClick={() => setCatSheet({ open: true, target: null })}>
        <Plus className="h-4 w-4 mr-1.5" />Nova categoria
      </Button>
    ) : null,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/25">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              Controle de Estoque
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {(stockPoints as StockPoint[]).length} ponto(s) · {totalItems} item(s)
              {lowCount > 0 && <span className="ml-2 text-amber-500 font-medium">· {lowCount} abaixo do mínimo</span>}
            </p>
          </div>
        </div>
        {TAB_ACTIONS[activeTab]}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, count: 0 },
          { key: "points", label: "Pontos", icon: MapPin, count: (stockPoints as StockPoint[]).length },
          { key: "items", label: "Itens", icon: Package, count: total },
          { key: "categories", label: "Categorias", icon: Tag, count: (categories as StockCategory[]).length },
        ].map((tab) => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            )}>
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-semibold",
                activeTab === tab.key ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba Dashboard ── */}
      {activeTab === "dashboard" && <InventoryDashboard />}

      {/* ── Aba Pontos ── */}
      {activeTab === "points" && (
        loadingPoints ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : (stockPoints as StockPoint[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-4">
              <MapPin className="h-7 w-7 text-blue-500" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum ponto de estoque</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              Crie um ponto para começar a organizar e controlar seu estoque
            </p>
            {canManagePoints && (
              <Button className="mt-4" onClick={() => setPointSheet({ open: true, target: null })}>
                <Plus className="h-4 w-4 mr-2" />Criar primeiro ponto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(stockPoints as StockPoint[]).map((point) => (
              <StockPointCard key={point.id} point={point} canManage={canManagePoints}
                onEdit={() => setPointSheet({ open: true, target: point })}
                onDelete={() => setDeletePointTarget(point)} />
            ))}
          </div>
        )
      )}

      {/* ── Aba Itens ── */}
      {activeTab === "items" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input placeholder="Buscar por nome, código ou marca..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-9" />
              {search && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearch("")}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Select value={pointFilter} onValueChange={setPointFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <MapPin className="h-3.5 w-3.5 text-slate-400 mr-1.5" />
                <SelectValue placeholder="Todos os pontos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pontos</SelectItem>
                {activePoints.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <button
              onClick={() => setBelowMinimum((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                belowMinimum
                  ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              )}>
              <AlertTriangle className="h-4 w-4" />
              Estoque baixo
              {belowMinimum && lowCount > 0 && (
                <span className="bg-white/25 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">{lowCount}</span>
              )}
            </button>
          </div>

          {/* Grid */}
          {loadingItems ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Package className="h-7 w-7 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum item encontrado</p>
              <p className="text-sm text-slate-400 mt-1">
                {search || belowMinimum || pointFilter !== "all" ? "Tente remover os filtros" : activePoints.length === 0 ? "Crie um ponto de estoque primeiro" : "Adicione o primeiro item"}
              </p>
              {!search && !belowMinimum && pointFilter === "all" && activePoints.length > 0 && canManage && (
                <Button className="mt-4" onClick={() => setItemSheet({ open: true, target: null })}>
                  <Plus className="h-4 w-4 mr-2" />Criar primeiro item
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} canManage={canManage}
                  onEdit={() => setItemSheet({ open: true, target: item })}
                  onDelete={() => setDeleteItemTarget(item)}
                  onMovement={() => setMovementSheet({ open: true, item })} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Categorias ── */}
      {activeTab === "categories" && <CategoriesList canManage={canManage} />}

      {/* ── Sheets ── */}
      <ItemSheet open={itemSheet.open} editTarget={itemSheet.target}
        categories={categories as StockCategory[]} stockPoints={stockPoints as StockPoint[]}
        onClose={() => setItemSheet({ open: false, target: null })} />

      <PointSheet open={pointSheet.open} editTarget={pointSheet.target}
        onClose={() => setPointSheet({ open: false, target: null })} />

      <CategorySheet open={catSheet.open} editTarget={catSheet.target}
        onClose={() => setCatSheet({ open: false, target: null })} />

      <MovementSheet open={movementSheet.open} item={movementSheet.item}
        stockPoints={stockPoints as StockPoint[]}
        canCreateMovement={canCreateInventoryMovements}
        canTransfer={canTransferInventory}
        onClose={() => setMovementSheet({ open: false, item: null })} />

      {/* Delete item */}
      <AlertDialog open={!!deleteItemTarget} onOpenChange={(v) => !v && setDeleteItemTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteItemTarget?.name}</strong> será removido permanentemente.
              {deleteItemTarget && deleteItemTarget.currentQuantity > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ Ainda possui {deleteItemTarget.currentQuantity} {deleteItemTarget.unit} em estoque.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleteItemTarget) deleteItem.mutate(deleteItemTarget.id, { onSuccess: () => setDeleteItemTarget(null) }); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete point */}
      <AlertDialog open={!!deletePointTarget} onOpenChange={(v) => !v && setDeletePointTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ponto de estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletePointTarget?.name}</strong> será removido. Só é possível remover pontos sem itens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deletePointTarget) deletePoint.mutate(deletePointTarget.id, { onSuccess: () => setDeletePointTarget(null) }); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
