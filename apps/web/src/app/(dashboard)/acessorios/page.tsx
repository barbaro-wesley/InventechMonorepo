"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useAccessories,
  useDeleteAccessory,
} from "@/hooks/accessories/use-accessories";
import {
  useAccessoryCategories,
  useCreateAccessoryCategory,
  useUpdateAccessoryCategory,
  useDeleteAccessoryCategory,
} from "@/hooks/accessories/use-accessory-categories";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { AccessorySheet } from "@/components/accessories/accessory-sheet";
import type {
  Accessory,
  AccessoryCategory,
  AccessoryStatus,
  AccessoryCriticality,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const { canAccess } = usePermissions();
  const canEdit = canAccess("accessories", "update");
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
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{accessory.patrimonyNumber}</span>
          </div>
        )}
        {accessory.serialNumber && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Série</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{accessory.serialNumber}</span>
          </div>
        )}
        {(accessory.brand || accessory.model) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Modelo</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">
              {[accessory.brand, accessory.model].filter(Boolean).join(" ")}
            </span>
          </div>
        )}
        {accessory.currentEquipment && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Equipamento</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{accessory.currentEquipment.name}</span>
          </div>
        )}
        {accessory.currentLocation && !accessory.currentEquipment && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Localização</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{accessory.currentLocation.name}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => onEdit(accessory)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
          </Button>
        )}
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onView(accessory)}>
          <Eye className="w-3.5 h-3.5 mr-1.5" />Detalhes
        </Button>
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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccessoryStatus | "">("");
  const [criticalityFilter, setCriticalityFilter] = useState<AccessoryCriticality | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Accessory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Accessory | null>(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);

  const { canManageAccessories } = usePermissions();
  const { data: categories = [] } = useAccessoryCategories();

  const { data, isLoading } = useAccessories({
    search: search || undefined,
    status: statusFilter || undefined,
    criticality: criticalityFilter || undefined,
    categoryId: categoryFilter || undefined,
    page,
    limit: 50,
  });

  const accessories = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);
  const activeFilterCount = [statusFilter, criticalityFilter, categoryFilter].filter(Boolean).length;

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

  React.useEffect(() => { setPage(1); }, [statusFilter, criticalityFilter, categoryFilter]);

  function clearAll() {
    setDebouncedSearch("");
    setSearch("");
    setStatusFilter("");
    setCriticalityFilter("");
    setCategoryFilter("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acessórios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os acessórios de equipamentos.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canManageAccessories && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatManagerOpen(true)}
              className="flex-1 sm:flex-none"
            >
              <Tag className="w-3.5 h-3.5" />
              Categorias
            </Button>
          )}
          {canManageAccessories && (
            <Button onClick={() => setCreateOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4" />
              Novo acessório
            </Button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white dark:bg-zinc-950/50 rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Buscar por nome, marca, série ou patrimônio..."
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
          onChange={(e) => setStatusFilter(e.target.value as AccessoryStatus | "")}
          className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as AccessoryStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <select
          value={criticalityFilter}
          onChange={(e) => setCriticalityFilter(e.target.value as AccessoryCriticality | "")}
          className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
        >
          <option value="">Todas as criticidades</option>
          {(Object.keys(CRITICALITY_LABEL) as AccessoryCriticality[]).map((c) => (
            <option key={c} value={c}>{CRITICALITY_LABEL[c]}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors w-full sm:w-auto ${showAdvanced || activeFilterCount > 0
            ? "border-primary text-primary bg-primary/5"
            : "border-border text-muted-foreground hover:bg-muted/30"}`}
        >
          <Tag className="w-3.5 h-3.5" />
          Filtros avançados
          {activeFilterCount > 0 && <span className="ml-1 bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">{activeFilterCount}</span>}
        </button>

        {(debouncedSearch || activeFilterCount > 0) && (
          <button type="button" onClick={clearAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1">
            <X className="w-3.5 h-3.5" />Limpar
          </button>
        )}
        </div>

        {showAdvanced && <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-border rounded-md px-3 py-2 bg-white dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
        >
          <option value="">Todas as categorias</option>
          {categories.filter((c) => c.isActive).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        </div>}
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-2xl border border-border bg-white dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : accessories.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950/50 rounded-xl border border-dashed border-border py-14 text-center">
          <Cable className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">{search || activeFilterCount > 0 ? "Nenhum acessório encontrado" : "Nenhum acessório cadastrado"}</p>
          {canManageAccessories && !search && activeFilterCount === 0 && (
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Cadastrar acessório
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessories.map((acc) => (
            <AccessoryCard
              key={acc.id}
              accessory={acc}
              onView={(a) => router.push(`/acessorios/${a.id}`)}
              onEdit={handleEdit}
              onDelete={(a) => setDeleteTarget(a)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">{((page - 1) * 50) + 1}–{Math.min(page * 50, total)} de {total} acessório(s)</p>
          <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
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
            .map((p, i) => p === "ellipsis"
              ? <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              : <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(p as number)}>{p}</Button>)}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
          </div>
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
