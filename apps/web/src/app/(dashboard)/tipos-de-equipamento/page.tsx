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
  ChevronDown,
  ChevronRight,
  Layers,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Tag,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  useEquipmentTypes,
  useCreateEquipmentType,
  useUpdateEquipmentType,
  useDeleteEquipmentType,
  useCreateEquipmentSubtype,
  useUpdateEquipmentSubtype,
  useDeleteEquipmentSubtype,
} from "@/hooks/equipment/use-equipment-types";
import { useMaintenanceGroups } from "@/hooks/maintenance-groups/use-maintenance-groups";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type {
  EquipmentType,
  EquipmentSubtype,
} from "@/services/equipment/equipment-types.service";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const typeSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
  groupId: z.string().optional(),
});
type TypeForm = z.infer<typeof typeSchema>;

const subtypeSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
});
type SubtypeForm = z.infer<typeof subtypeSchema>;

// ─── Type Sheet (create / edit) ───────────────────────────────────────────────

function TypeSheet({
  open,
  editTarget,
  onClose,
}: {
  open: boolean;
  editTarget: EquipmentType | null;
  onClose: () => void;
}) {
  const create = useCreateEquipmentType();
  const update = useUpdateEquipmentType();
  const isPending = create.isPending || update.isPending;
  const { data: groups = [] } = useMaintenanceGroups({ isActive: true });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TypeForm>({
    resolver: zodResolver(typeSchema),
    values: editTarget
      ? { name: editTarget.name, description: editTarget.description ?? "", groupId: editTarget.group?.id ?? "" }
      : { name: "", description: "", groupId: "" },
  });

  function onSubmit(data: TypeForm) {
    const dto = {
      name: data.name,
      description: data.description || undefined,
      groupId: data.groupId || undefined,
    };
    if (editTarget) {
      update.mutate(
        { id: editTarget.id, dto: { ...dto, groupId: data.groupId || null } },
        { onSuccess: () => { reset(); onClose(); } }
      );
    } else {
      create.mutate(dto, { onSuccess: () => { reset(); onClose(); } });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {editTarget ? "Editar tipo" : "Novo tipo de equipamento"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="type-name">Nome *</Label>
            <Input
              id="type-name"
              placeholder="Ex: Computador, Impressora, UPS"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type-desc">Descrição (opcional)</Label>
            <Input
              id="type-desc"
              placeholder="Breve descrição do tipo"
              {...register("description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type-group">Grupo de manutenção</Label>
            <select
              id="type-group"
              {...register("groupId")}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Sem grupo —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Define quais clientes podem ver equipamentos deste tipo.
            </p>
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : editTarget ? "Salvar alterações" : "Criar tipo"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Subtype Sheet (create / edit) ───────────────────────────────────────────

function SubtypeSheet({
  open,
  typeId,
  typeName,
  editTarget,
  onClose,
}: {
  open: boolean;
  typeId: string;
  typeName: string;
  editTarget: EquipmentSubtype | null;
  onClose: () => void;
}) {
  const create = useCreateEquipmentSubtype();
  const update = useUpdateEquipmentSubtype();
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubtypeForm>({
    resolver: zodResolver(subtypeSchema),
    values: editTarget
      ? { name: editTarget.name, description: editTarget.description ?? "" }
      : { name: "", description: "" },
  });

  function onSubmit(data: SubtypeForm) {
    const dto = { name: data.name, description: data.description || undefined };
    if (editTarget) {
      update.mutate(
        { id: editTarget.id, dto },
        { onSuccess: () => { reset(); onClose(); } }
      );
    } else {
      create.mutate(
        { typeId, ...dto },
        { onSuccess: () => { reset(); onClose(); } }
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {editTarget ? "Editar subtipo" : "Novo subtipo"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Tipo: <span className="font-medium">{typeName}</span>
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Nome *</Label>
            <Input
              id="sub-name"
              placeholder="Ex: Desktop, Notebook, All-in-One"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-desc">Descrição (opcional)</Label>
            <Input
              id="sub-desc"
              placeholder="Breve descrição"
              {...register("description")}
            />
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : editTarget ? "Salvar" : "Criar subtipo"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Type Row ─────────────────────────────────────────────────────────────────

function TypeRow({
  type,
  onEdit,
  onDelete,
  onToggle,
  onAddSubtype,
  onEditSubtype,
  onDeleteSubtype,
  canManage,
}: {
  type: EquipmentType;
  onEdit: (t: EquipmentType) => void;
  onDelete: (t: EquipmentType) => void;
  onToggle: (t: EquipmentType) => void;
  onAddSubtype: (t: EquipmentType) => void;
  onEditSubtype: (type: EquipmentType, sub: EquipmentSubtype) => void;
  onDeleteSubtype: (sub: EquipmentSubtype) => void;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const updateType = useUpdateEquipmentType();

  const subtypeCount = type.subtypes.length;
  const equipmentCount = type._count.equipments;

  return (
    <div
      className="border border-border rounded-xl overflow-hidden"
      style={{ opacity: type.isActive ? 1 : 0.6 }}
    >
      {/* Type header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-muted/20 transition-colors">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
          style={{ color: "var(--muted-foreground)" }}
        >
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--primary)20" }}
        >
          <Layers className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
              {type.name}
            </span>
            {!type.isActive && (
              <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">Inativo</Badge>
            )}
          </div>
          {type.description && (
            <p className="text-xs text-muted-foreground truncate">{type.description}</p>
          )}
          {type.group && (
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: type.group.color ?? "#94a3b8" }}
              />
              <span className="text-xs text-muted-foreground">{type.group.name}</span>
            </div>
          )}
        </div>

        {/* Counters */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            {subtypeCount} subtipo(s)
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5" />
            {equipmentCount} equip.
          </span>
        </div>

        {/* Actions */}
        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title={type.isActive ? "Desativar" : "Ativar"}
              disabled={updateType.isPending}
              onClick={() => onToggle(type)}
            >
              {type.isActive
                ? <ToggleRight className="w-4 h-4 text-green-600" />
                : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Editar tipo"
              onClick={() => onEdit(type)}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Remover tipo"
              onClick={() => onDelete(type)}
              disabled={equipmentCount > 0}
            >
              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
            </Button>
          </div>
        )}
      </div>

      {/* Subtypes panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Subtipos
            </span>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAddSubtype(type)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Novo subtipo
              </Button>
            )}
          </div>

          {type.subtypes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              Nenhum subtipo cadastrado.{" "}
              {canManage && (
                <button
                  className="underline hover:no-underline"
                  style={{ color: "var(--primary)" }}
                  onClick={() => onAddSubtype(type)}
                >
                  Adicionar
                </button>
              )}
            </p>
          ) : (
            type.subtypes.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-border"
                style={{ opacity: sub.isActive ? 1 : 0.55 }}
              >
                <Tag className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm" style={{ color: "var(--foreground)" }}>
                    {sub.name}
                  </span>
                  {sub.description && (
                    <span className="text-xs text-muted-foreground ml-2">
                      — {sub.description}
                    </span>
                  )}
                  {!sub.isActive && (
                    <Badge className="ml-2 bg-gray-100 text-gray-500 border-0 text-xs">
                      Inativo
                    </Badge>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onEditSubtype(type, sub)}
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onDeleteSubtype(sub)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentTypesPage() {
  const { canManageEquipment } = usePermissions();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  // Type sheet
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [editType, setEditType] = useState<EquipmentType | null>(null);

  // Subtype sheet
  const [subtypeSheetOpen, setSubtypeSheetOpen] = useState(false);
  const [subtypeParent, setSubtypeParent] = useState<EquipmentType | null>(null);
  const [editSubtype, setEditSubtype] = useState<EquipmentSubtype | null>(null);

  // Delete confirms
  const [deleteType, setDeleteType] = useState<EquipmentType | null>(null);
  const [deleteSubtype, setDeleteSubtype] = useState<EquipmentSubtype | null>(null);

  const removeType = useDeleteEquipmentType();
  const removeSubtype = useDeleteEquipmentSubtype();
  const updateType = useUpdateEquipmentType();

  const { data, isLoading } = useEquipmentTypes({
    search: search || undefined,
    isActive:
      filterActive === "all" ? undefined :
      filterActive === "active" ? true : false,
    limit: 100,
  });

  const types = data ?? [];

  function openEditType(t: EquipmentType) {
    setEditType(t);
    setTypeSheetOpen(true);
  }

  function openAddSubtype(t: EquipmentType) {
    setSubtypeParent(t);
    setEditSubtype(null);
    setSubtypeSheetOpen(true);
  }

  function openEditSubtype(type: EquipmentType, sub: EquipmentSubtype) {
    setSubtypeParent(type);
    setEditSubtype(sub);
    setSubtypeSheetOpen(true);
  }

  function handleToggleType(t: EquipmentType) {
    updateType.mutate({ id: t.id, dto: { isActive: !t.isActive } });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Tipos de Equipamento
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Categorias e subcategorias usadas no cadastro de equipamentos
          </p>
        </div>
        {canManageEquipment && (
          <Button
            onClick={() => { setEditType(null); setTypeSheetOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo tipo
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors border"
              style={{
                background: filterActive === f ? "var(--primary)" : "transparent",
                color: filterActive === f ? "white" : "var(--muted-foreground)",
                borderColor: filterActive === f ? "var(--primary)" : "var(--border)",
              }}
            >
              {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-border bg-white animate-pulse"
            />
          ))}
        </div>
      ) : types.length === 0 ? (
        <div className="bg-white rounded-xl border border-border py-16 text-center">
          <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {search ? "Nenhum tipo encontrado" : "Nenhum tipo cadastrado"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search
              ? "Tente outro termo de busca"
              : "Crie o primeiro tipo de equipamento para começar"}
          </p>
          {!search && canManageEquipment && (
            <Button
              className="mt-4"
              size="sm"
              onClick={() => { setEditType(null); setTypeSheetOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro tipo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {types.map((type) => (
            <TypeRow
              key={type.id}
              type={type}
              onEdit={openEditType}
              onDelete={setDeleteType}
              onToggle={handleToggleType}
              onAddSubtype={openAddSubtype}
              onEditSubtype={openEditSubtype}
              onDeleteSubtype={setDeleteSubtype}
              canManage={canManageEquipment}
            />
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            {types.length} tipo(s) cadastrado(s)
          </p>
        </div>
      )}

      {/* Type Sheet */}
      <TypeSheet
        open={typeSheetOpen}
        editTarget={editType}
        onClose={() => { setTypeSheetOpen(false); setEditType(null); }}
      />

      {/* Subtype Sheet */}
      {subtypeParent && (
        <SubtypeSheet
          open={subtypeSheetOpen}
          typeId={subtypeParent.id}
          typeName={subtypeParent.name}
          editTarget={editSubtype}
          onClose={() => {
            setSubtypeSheetOpen(false);
            setSubtypeParent(null);
            setEditSubtype(null);
          }}
        />
      )}

      {/* Delete Type dialog */}
      <AlertDialog
        open={!!deleteType}
        onOpenChange={(o) => !o && setDeleteType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tipo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o tipo{" "}
              <strong>{deleteType?.name}</strong>? Esta ação não pode ser
              desfeita. Todos os subtipos vinculados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={removeType.isPending}
              onClick={() => {
                if (!deleteType) return;
                removeType.mutate(deleteType.id, {
                  onSuccess: () => setDeleteType(null),
                });
              }}
            >
              {removeType.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</>
              ) : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Subtype dialog */}
      <AlertDialog
        open={!!deleteSubtype}
        onOpenChange={(o) => !o && setDeleteSubtype(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover subtipo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o subtipo{" "}
              <strong>{deleteSubtype?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={removeSubtype.isPending}
              onClick={() => {
                if (!deleteSubtype) return;
                removeSubtype.mutate(deleteSubtype.id, {
                  onSuccess: () => setDeleteSubtype(null),
                });
              }}
            >
              {removeSubtype.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</>
              ) : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
