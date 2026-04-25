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
  RefreshCw,
  Wrench,
  Users,
  ClipboardList,
  MoreHorizontal,
  Infinity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  useMaintenanceGroups,
  useCreateMaintenanceGroup,
  useUpdateMaintenanceGroup,
  useDeleteMaintenanceGroup,
} from "@/hooks/maintenance-groups/use-maintenance-groups";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { MaintenanceGroup } from "@/services/maintenance-groups/maintenance-groups.service";

// ─── Cores predefinidas ───────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#f97316", "#6366f1",
  "#14b8a6", "#ec4899", "#84cc16", "#64748b",
];

// ─── Schema ──────────────────────────────────────────────────────────────────

const groupSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
  color: z.string().optional(),
  noRestriction: z.boolean().optional(),
});
type GroupForm = z.infer<typeof groupSchema>;

// ─── GroupSheet ───────────────────────────────────────────────────────────────

function GroupSheet({
  open,
  editTarget,
  onClose,
}: {
  open: boolean;
  editTarget: MaintenanceGroup | null;
  onClose: () => void;
}) {
  const create = useCreateMaintenanceGroup();
  const update = useUpdateMaintenanceGroup();
  const isPending = create.isPending || update.isPending;

  const [selectedColor, setSelectedColor] = useState(editTarget?.color ?? PRESET_COLORS[0]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<GroupForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(groupSchema) as any,
    values: editTarget
      ? { name: editTarget.name, description: editTarget.description ?? "", color: editTarget.color ?? "", noRestriction: editTarget.noRestriction ?? false }
      : { name: "", description: "", color: PRESET_COLORS[0], noRestriction: false },
  });

  const noRestriction = watch("noRestriction");

  function handleClose() {
    reset();
    setSelectedColor(PRESET_COLORS[0]);
    onClose();
  }

  function onSubmit(data: GroupForm) {
    const dto = {
      name: data.name,
      description: data.description || undefined,
      color: selectedColor,
      noRestriction: data.noRestriction ?? false,
    };

    if (editTarget) {
      update.mutate({ id: editTarget.id, dto }, { onSuccess: handleClose });
    } else {
      create.mutate(dto, { onSuccess: handleClose });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "480px", width: "100%" }}>
        <SheetHeader>
          <SheetTitle>{editTarget ? "Editar grupo" : "Novo grupo de manutenção"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Grupos definem categorias de manutenção e controlam quais equipamentos cada cliente pode visualizar.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 mt-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="mg-name">Nome *</Label>
            <Input id="mg-name" placeholder="Ex: Ar Condicionado, Elétrica, Hidráulica" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mg-desc">Descrição</Label>
            <Textarea
              id="mg-desc"
              placeholder="Descreva o escopo deste grupo..."
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor de identificação</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setSelectedColor(c); setValue("color", c); }}
                  className="w-8 h-8 rounded-lg border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: selectedColor === c ? "#1e293b" : "transparent",
                    transform: selectedColor === c ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: selectedColor }} />
              <input
                type="text"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="text-xs font-mono border border-border rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Acesso a equipamentos</Label>
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                noRestriction
                  ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-500"
                {...register("noRestriction")}
              />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Infinity className="w-3.5 h-3.5 text-amber-500" />
                  Sem restrição de tipo
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clientes vinculados a este grupo poderão ver todos os tipos de equipamento, independente do vínculo no cadastro do tipo.
                </p>
              </div>
            </label>
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : editTarget ? "Salvar" : "Criar grupo"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onEdit,
  onDelete,
  canManage,
}: {
  group: MaintenanceGroup;
  onEdit: (g: MaintenanceGroup) => void;
  onDelete: (g: MaintenanceGroup) => void;
  canManage: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Barra colorida */}
      <div className="h-1.5 w-full" style={{ background: group.color ?? "#94a3b8" }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${group.color ?? "#94a3b8"}20` }}
            >
              <Wrench className="w-4 h-4" style={{ color: group.color ?? "#94a3b8" }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{group.name}</p>
              {group.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{group.description}</p>
              )}
            </div>
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(group)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={group._count.serviceOrders > 0 || group._count.technicians > 0}
                  onClick={() => onDelete(group)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  {group._count.serviceOrders > 0 || group._count.technicians > 0
                    ? "Possui vínculos"
                    : "Remover"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Badge sem restrição */}
        {group.noRestriction && (
          <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Infinity className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Sem restrição de tipo</span>
          </div>
        )}

        {/* Contadores */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{group._count.technicians} técnico{group._count.technicians !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>{group._count.serviceOrders} OS</span>
          </div>
          {!group.isActive && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
              Inativo
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GruposManutencaoPage() {
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{ open: boolean; target: MaintenanceGroup | null }>({
    open: false,
    target: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceGroup | null>(null);

  const { canManageEquipment } = usePermissions();
  const { data: groups = [], isLoading } = useMaintenanceGroups(
    search ? { search } : undefined
  );
  const remove = useDeleteMaintenanceGroup();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Grupos de Manutenção
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Categorize os serviços e controle o acesso dos clientes aos equipamentos.
          </p>
        </div>
        {canManageEquipment && (
          <Button onClick={() => setSheet({ open: true, target: null })}>
            <Plus className="w-4 h-4 mr-2" />
            Novo grupo
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-9 text-sm"
          placeholder="Buscar grupo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-14 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {search ? "Nenhum grupo encontrado" : "Nenhum grupo cadastrado"}
          </p>
          {!search && canManageEquipment && (
            <Button size="sm" className="mt-4" onClick={() => setSheet({ open: true, target: null })}>
              <Plus className="w-4 h-4 mr-2" />Criar primeiro grupo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onEdit={(g) => setSheet({ open: true, target: g })}
              onDelete={setDeleteTarget}
              canManage={canManageEquipment}
            />
          ))}
        </div>
      )}

      {/* Sheet */}
      <GroupSheet
        open={sheet.open}
        editTarget={sheet.target}
        onClose={() => setSheet({ open: false, target: null })}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o grupo <strong>{deleteTarget?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() =>
                deleteTarget && remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }
            >
              {remove.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
