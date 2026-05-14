"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  MoreHorizontal,
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
  History,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useInventory,
  useCreateStockItem,
  useUpdateStockItem,
  useDeleteStockItem,
  useItemMovements,
  useCreateMovement,
} from "@/hooks/inventory/use-inventory";
import {
  useStockCategories,
  useCreateStockCategory,
  useUpdateStockCategory,
  useDeleteStockCategory,
} from "@/hooks/inventory/use-stock-categories";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { StockItem, StockMovement } from "@/services/inventory/inventory.service";
import type { StockCategory } from "@/services/inventory/inventory.service";

// ─── Cores de categoria ───────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#f97316", "#6366f1",
  "#14b8a6", "#ec4899", "#84cc16", "#64748b",
];

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ENTRY: "Entrada",
  EXIT: "Saída",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Transferência",
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  ENTRY: "bg-emerald-100 text-emerald-700",
  EXIT: "bg-red-100 text-red-700",
  ADJUSTMENT: "bg-amber-100 text-amber-700",
  TRANSFER: "bg-blue-100 text-blue-700",
};

const UNIT_OPTIONS = ["UN", "KG", "G", "L", "ML", "M", "CM", "CX", "PC", "PAR", "ROLO"];

// ─── Schemas ─────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  clientId: z.string().optional(),
  categoryId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
  unit: z.string().default("UN"),
  brand: z.string().optional(),
  minimumQuantity: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
});
type ItemForm = z.infer<typeof itemSchema>;

const categorySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
});
type CategoryForm = z.infer<typeof categorySchema>;

const movementSchema = z.object({
  type: z.enum(["ENTRY", "EXIT", "ADJUSTMENT", "TRANSFER"]),
  quantity: z.number().positive("Quantidade deve ser maior que zero"),
  unitCost: z.number().min(0).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

// ─── ItemSheet ────────────────────────────────────────────────────────────────

function ItemSheet({
  open,
  editTarget,
  categories,
  onClose,
}: {
  open: boolean;
  editTarget: StockItem | null;
  categories: StockCategory[];
  onClose: () => void;
}) {
  const create = useCreateStockItem();
  const update = useUpdateStockItem();
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ItemForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(itemSchema) as any,
    values: editTarget
      ? {
          categoryId: editTarget.categoryId ?? undefined,
          code: editTarget.code ?? "",
          name: editTarget.name,
          description: editTarget.description ?? "",
          unit: editTarget.unit,
          brand: editTarget.brand ?? "",
          minimumQuantity: editTarget.minimumQuantity,
          unitCost: editTarget.unitCost ?? undefined,
        }
      : { unit: "UN", minimumQuantity: 0 },
  });

  const unit = watch("unit");

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(data: ItemForm) {
    const dto = {
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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editTarget ? "Editar Item" : "Novo Item de Estoque"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4 pb-4">
          {/* Categoria */}
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              value={watch("categoryId") ?? "none"}
              onValueChange={(v) => setValue("categoryId", v === "none" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.filter((c) => c.isActive).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      {cat.color && (
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome */}
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...register("name")} placeholder="Ex: Luva de procedimento" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Código e Marca */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input {...register("code")} placeholder="Ex: LVP-001" />
            </div>
            <div className="space-y-1">
              <Label>Marca</Label>
              <Input {...register("brand")} placeholder="Ex: Medline" />
            </div>
          </div>

          {/* Unidade e Estoque mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={(v) => setValue("unit", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estoque mínimo</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                {...register("minimumQuantity", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          </div>

          {/* Custo unitário */}
          <div className="space-y-1">
            <Label>Custo unitário (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              {...register("unitCost", { valueAsNumber: true })}
              placeholder="0,00"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea {...register("description")} rows={2} placeholder="Informações adicionais" />
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : editTarget ? "Salvar alterações" : "Criar item"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── CategorySheet ────────────────────────────────────────────────────────────

function CategorySheet({
  open,
  editTarget,
  onClose,
}: {
  open: boolean;
  editTarget: StockCategory | null;
  onClose: () => void;
}) {
  const create = useCreateStockCategory();
  const update = useUpdateStockCategory();
  const isPending = create.isPending || update.isPending;
  const [selectedColor, setSelectedColor] = useState(editTarget?.color ?? PRESET_COLORS[0]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(categorySchema) as any,
    values: editTarget
      ? { name: editTarget.name, description: editTarget.description ?? "" }
      : { name: "", description: "" },
  });

  function handleClose() {
    reset();
    setSelectedColor(PRESET_COLORS[0]);
    onClose();
  }

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
        <SheetHeader>
          <SheetTitle>{editTarget ? "Editar Categoria" : "Nova Categoria"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4 pb-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...register("name")} placeholder="Ex: Materiais cirúrgicos" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea {...register("description")} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${selectedColor === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : editTarget ? "Salvar" : "Criar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── MovementSheet ────────────────────────────────────────────────────────────

function MovementSheet({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: StockItem | null;
  onClose: () => void;
}) {
  const createMovement = useCreateMovement();
  const { data: movementsData } = useItemMovements(item?.id ?? "");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<MovementForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(movementSchema) as any,
    defaultValues: { type: "ENTRY", quantity: 1 },
  });

  const movType = watch("type");

  function handleClose() {
    reset({ type: "ENTRY", quantity: 1 });
    onClose();
  }

  function onSubmit(data: MovementForm) {
    if (!item) return;
    createMovement.mutate(
      { itemId: item.id, ...data },
      { onSuccess: handleClose },
    );
  }

  const movements: StockMovement[] = movementsData?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Movimentações — {item?.name}
          </SheetTitle>
        </SheetHeader>

        {/* Qtd atual */}
        {item && (
          <div className="mt-4 p-3 rounded-lg bg-muted flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estoque atual</span>
            <span className={`text-lg font-bold ${item.minimumQuantity > 0 && item.currentQuantity < item.minimumQuantity ? "text-red-600" : "text-emerald-600"}`}>
              {item.currentQuantity} {item.unit}
            </span>
          </div>
        )}

        {/* Formulário nova movimentação */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-4 pb-4 border-b">
          <p className="text-sm font-medium">Registrar movimentação</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={movType} onValueChange={(v) => setValue("type", v as MovementForm["type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRY">Entrada</SelectItem>
                  <SelectItem value="EXIT">Saída</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  <SelectItem value="TRANSFER">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input
                type="number"
                step="0.001"
                min={0.001}
                {...register("quantity", { valueAsNumber: true })}
              />
              {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Custo unitário (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              {...register("unitCost", { valueAsNumber: true })}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1">
            <Label>Motivo</Label>
            <Input {...register("reason")} placeholder="Ex: Compra, Uso em procedimento..." />
          </div>

          <Button type="submit" disabled={createMovement.isPending} className="w-full">
            {createMovement.isPending ? "Registrando..." : "Registrar"}
          </Button>
        </form>

        {/* Histórico */}
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Histórico</p>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação</p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className={`p-1.5 rounded-full ${m.type === "ENTRY" ? "bg-emerald-100" : m.type === "EXIT" ? "bg-red-100" : "bg-amber-100"}`}>
                    {m.type === "ENTRY" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : m.type === "EXIT" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-red-600" />
                    ) : (
                      <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${MOVEMENT_TYPE_COLORS[m.type]}`}>
                        {MOVEMENT_TYPE_LABELS[m.type]}
                      </span>
                      <span className="text-sm font-medium">
                        {m.type === "EXIT" ? "-" : "+"}{m.quantity} {item?.unit}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.reason ?? m.user.name} · {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Após: {m.quantityAfter}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  canManage,
  onEdit,
  onDelete,
  onMovement,
}: {
  item: StockItem;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMovement: () => void;
}) {
  const isLow = item.minimumQuantity > 0 && item.currentQuantity < item.minimumQuantity;
  const isEmpty = item.currentQuantity === 0;

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.category && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: item.category.color ?? "#64748b" }}
              >
                {item.category.name}
              </span>
            )}
            {item.code && (
              <span className="text-xs text-muted-foreground font-mono">{item.code}</span>
            )}
          </div>
          <p className="font-semibold mt-1 truncate">{item.name}</p>
          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onMovement}>
              <History className="h-4 w-4 mr-2" />
              Movimentações
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Estoque */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Estoque atual</p>
          <p className={`text-2xl font-bold ${isEmpty ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-600"}`}>
            {item.currentQuantity}
            <span className="text-sm font-normal text-muted-foreground ml-1">{item.unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Mínimo</p>
          <p className="text-sm">{item.minimumQuantity} {item.unit}</p>
        </div>
      </div>

      {/* Alerta */}
      {isLow && (
        <div className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 ${isEmpty ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {isEmpty ? "Estoque zerado" : "Abaixo do mínimo"}
        </div>
      )}

      {/* Footer */}
      {item.client && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          Proprietário: <span className="font-medium">{item.client.name}</span>
        </p>
      )}
    </div>
  );
}

// ─── CategoriesList ───────────────────────────────────────────────────────────

function CategoriesList({ canManage }: { canManage: boolean }) {
  const { data: categories = [], isLoading } = useStockCategories();
  const deleteCategory = useDeleteStockCategory();
  const updateCategory = useUpdateStockCategory();
  const [catSheet, setCatSheet] = useState<{ open: boolean; target: StockCategory | null }>({ open: false, target: null });
  const [deleteTarget, setDeleteTarget] = useState<StockCategory | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mt-4">
        {canManage && (
          <Button size="sm" onClick={() => setCatSheet({ open: true, target: null })}>
            <Plus className="h-4 w-4 mr-2" />
            Nova categoria
          </Button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma categoria criada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-lg border bg-card p-4 flex items-start gap-3">
              <div
                className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0"
                style={{ backgroundColor: cat.color ?? "#64748b" }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{cat.name}</p>
                {cat.description && (
                  <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{cat._count.items} itens</p>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCatSheet({ open: true, target: cat })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => setDeleteTarget(cat)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {cat.isActive === false && (
                <Badge variant="secondary" className="text-xs">Inativa</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <CategorySheet
        open={catSheet.open}
        editTarget={catSheet.target}
        onClose={() => setCatSheet({ open: false, target: null })}
      />

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
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) {
                  deleteCategory.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                }
              }}
            >
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
  const { canAccess, isCompanyLevel } = usePermissions();
  const canManage = canAccess("inventory", "create");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [belowMinimum, setBelowMinimum] = useState(false);

  const [itemSheet, setItemSheet] = useState<{ open: boolean; target: StockItem | null }>({ open: false, target: null });
  const [movementSheet, setMovementSheet] = useState<{ open: boolean; item: StockItem | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);

  const { data: inventoryData, isLoading } = useInventory({
    search: search || undefined,
    categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
    belowMinimum: belowMinimum || undefined,
  });

  const { data: categories = [] } = useStockCategories({ isActive: true });

  const deleteItem = useDeleteStockItem();

  const items: StockItem[] = inventoryData?.data ?? [];
  const total = inventoryData?.pagination?.total ?? 0;

  const lowStockCount = items.filter(
    (i) => i.minimumQuantity > 0 && i.currentQuantity < i.minimumQuantity
  ).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Controle de Estoque
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie itens e movimentações de estoque
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setItemSheet({ open: true, target: null })}>
            <Plus className="h-4 w-4 mr-2" />
            Novo item
          </Button>
        )}
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Itens
            {total > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{total}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categorias
            {(categories as StockCategory[]).length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{(categories as StockCategory[]).length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Itens ── */}
        <TabsContent value="items" className="space-y-4 mt-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou marca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setSearch("")}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {(categories as StockCategory[]).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      {cat.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={belowMinimum ? "default" : "outline"}
              className="gap-2"
              onClick={() => setBelowMinimum((v) => !v)}
            >
              <AlertTriangle className="h-4 w-4" />
              Estoque baixo
              {belowMinimum && lowStockCount > 0 && (
                <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                  {lowStockCount}
                </span>
              )}
            </Button>
          </div>

          {/* Grid de itens */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Nenhum item encontrado</p>
              <p className="text-sm mt-1">
                {search || belowMinimum
                  ? "Tente remover os filtros"
                  : "Crie o primeiro item de estoque"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  onEdit={() => setItemSheet({ open: true, target: item })}
                  onDelete={() => setDeleteTarget(item)}
                  onMovement={() => setMovementSheet({ open: true, item })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Aba Categorias ── */}
        <TabsContent value="categories">
          <CategoriesList canManage={canManage} />
        </TabsContent>
      </Tabs>

      {/* Sheets */}
      <ItemSheet
        open={itemSheet.open}
        editTarget={itemSheet.target}
        categories={categories as StockCategory[]}
        onClose={() => setItemSheet({ open: false, target: null })}
      />

      <MovementSheet
        open={movementSheet.open}
        item={movementSheet.item}
        onClose={() => setMovementSheet({ open: false, item: null })}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              O item <strong>{deleteTarget?.name}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
              {deleteTarget && deleteTarget.currentQuantity > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ Este item ainda possui {deleteTarget.currentQuantity} {deleteTarget.unit} em estoque.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) {
                  deleteItem.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
