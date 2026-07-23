"use client";

import React, { useMemo, useState } from "react";
import {
  Plus, QrCode, Pencil, Copy, Trash2, Search, Printer, MoreVertical,
  LayoutGrid, List as ListIcon, Ruler, Star, FilePlus2, Power,
  ChevronLeft, ChevronRight, BookOpen, Type, Image as ImageIcon, Sparkles,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LabelCanvas } from "@/components/labels/label-canvas";
import { LabelEditor } from "@/components/labels/label-editor";
import {
  useLabelTemplates, useDeleteLabelTemplate, useCloneLabelTemplate,
  labelTemplateKeys,
} from "@/hooks/label-templates/use-label-templates";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { labelTemplatesService } from "@/services/label-templates/label-templates.service";
import { getErrorMessage } from "@/lib/api";
import { REFERENCE_TYPE_LABELS } from "@/services/label-templates/label-templates.types";
import type {
  LabelTemplate, LabelReferenceType, UpdateLabelTemplateDto,
} from "@/services/label-templates/label-templates.types";
import { cn } from "@/lib/utils";

type EditingState = LabelTemplate | "new" | null;
type ViewMode = "grid" | "list";

const PAGE_SIZE = 9;

export default function EtiquetasPage() {
  const permissions = usePermissions();
  const canCreate = permissions.canAccess("label-template", "create");
  const canEdit = permissions.canAccess("label-template", "update");
  const canDelete = permissions.canAccess("label-template", "delete");

  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<EditingState>(null);
  const [toDelete, setToDelete] = useState<LabelTemplate | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | LabelReferenceType>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useLabelTemplates();
  const deleteMutation = useDeleteLabelTemplate();
  const cloneMutation = useCloneLabelTemplate();

  const templates = useMemo(() => {
    const all = data?.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (filterType !== "all" && t.referenceType !== filterType) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, filterType]);

  // ── Paginação (client-side) ──
  const total = templates.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = templates.slice(start, start + PAGE_SIZE);
  const from = total === 0 ? 0 : start + 1;
  const to = Math.min(start + PAGE_SIZE, total);

  // ── Ações ──
  function openTestPrint(tpl: LabelTemplate) {
    window.open(labelTemplatesService.getRenderUrl(tpl.id, makeTestId()), "_blank");
  }

  async function patchTemplate(id: string, dto: UpdateLabelTemplateDto, message: string) {
    setBusyId(id);
    try {
      await labelTemplatesService.update(id, dto);
      await queryClient.invalidateQueries({ queryKey: labelTemplateKeys.all });
      toast.success(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (editing !== null) {
    return (
      <div className="p-2">
        <LabelEditor
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      </div>
    );
  }

  const gridClass = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-6">
      {/* ── Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 p-6 sm:p-8 dark:border-blue-950/60 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/30">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25">
              <QrCode className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px] dark:text-white">
                Templates de Etiquetas QR
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">
                Crie e gerencie modelos de etiquetas para impressão de equipamentos e ordens de serviço.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            {canCreate && (
              <Button
                onClick={() => setEditing("new")}
                className="gap-2 bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            )}
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <BookOpen className="h-4 w-4" />
              Guia de criação
            </button>
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome do template..."
            className="h-10 bg-white pl-9 dark:bg-slate-900"
          />
        </div>

        <Select
          value={filterType}
          onValueChange={(v) => { setFilterType(v as "all" | LabelReferenceType); setPage(1); }}
        >
          <SelectTrigger className="h-10 w-full bg-white sm:w-48 dark:bg-slate-900">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.keys(REFERENCE_TYPE_LABELS) as LabelReferenceType[]).map((rt) => (
              <SelectItem key={rt} value={rt}>{REFERENCE_TYPE_LABELS[rt]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <ViewToggleButton active={view === "grid"} label="Grade" onClick={() => setView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </ViewToggleButton>
          <ViewToggleButton active={view === "list"} label="Lista" onClick={() => setView("list")}>
            <ListIcon className="h-4 w-4" />
          </ViewToggleButton>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : total === 0 ? (
        <EmptyState
          filtered={!!data?.data?.length}
          canCreate={canCreate}
          onCreate={() => setEditing("new")}
        />
      ) : view === "grid" ? (
        <div className={gridClass}>
          {pageItems.map((tpl) => (
            <LabelTemplateCard
              key={tpl.id}
              template={tpl}
              busy={busyId === tpl.id}
              canEdit={canEdit}
              canClone={canCreate}
              canDelete={canDelete}
              onEdit={() => canEdit && setEditing(tpl)}
              onClone={() => cloneMutation.mutate(tpl.id)}
              onPrintTest={() => openTestPrint(tpl)}
              onDelete={() => setToDelete(tpl)}
              onSetDefault={() => patchTemplate(tpl.id, { isDefault: true }, "Etiqueta definida como padrão!")}
              onToggleActive={() =>
                patchTemplate(tpl.id, { isActive: !tpl.isActive }, tpl.isActive ? "Etiqueta desativada." : "Etiqueta ativada.")
              }
            />
          ))}
          {canCreate && currentPage === totalPages && (
            <CreateCard onClick={() => setEditing("new")} />
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Prévia</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Dimensões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((tpl) => (
                <LabelTemplateRow
                  key={tpl.id}
                  template={tpl}
                  busy={busyId === tpl.id}
                  canEdit={canEdit}
                  canClone={canCreate}
                  canDelete={canDelete}
                  onEdit={() => canEdit && setEditing(tpl)}
                  onClone={() => cloneMutation.mutate(tpl.id)}
                  onPrintTest={() => openTestPrint(tpl)}
                  onDelete={() => setToDelete(tpl)}
                  onSetDefault={() => patchTemplate(tpl.id, { isDefault: true }, "Etiqueta definida como padrão!")}
                  onToggleActive={() =>
                    patchTemplate(tpl.id, { isActive: !tpl.isActive }, tpl.isActive ? "Etiqueta desativada." : "Etiqueta ativada.")
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Rodapé / paginação ── */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mostrando <span className="font-medium text-slate-700 dark:text-slate-200">{from}</span> a{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">{to}</span> de{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span> templates
          </p>
          <div className="flex items-center gap-1">
            <PagerButton
              label="Página anterior"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </PagerButton>
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors",
                    p === currentPage
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  {p}
                </button>
              );
            })}
            <PagerButton
              label="Próxima página"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </PagerButton>
          </div>
        </div>
      )}

      {/* ── Confirmação de exclusão ── */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etiqueta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etiqueta “{toDelete?.name}”? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) deleteMutation.mutate(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Guia de criação ── */}
      <CreationGuideDialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
        canCreate={canCreate}
        onCreate={() => { setGuideOpen(false); setEditing("new"); }}
      />
    </div>
  );
}

// ─── Card (grade) ───────────────────────────────────────────────────────────

interface TemplateActions {
  template: LabelTemplate;
  busy: boolean;
  canEdit: boolean;
  canClone: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onClone: () => void;
  onPrintTest: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onToggleActive: () => void;
}

function LabelTemplateCard({
  template, busy, canEdit, canClone, canDelete,
  onEdit, onClone, onPrintTest, onDelete, onSetDefault, onToggleActive,
}: TemplateActions) {
  const actions = [
    canEdit && { key: "edit", icon: Pencil, label: "Editar", onClick: onEdit },
    canClone && { key: "clone", icon: Copy, label: "Duplicar", onClick: onClone },
    { key: "print", icon: Printer, label: "Imprimir teste", onClick: onPrintTest },
    canDelete && { key: "delete", icon: Trash2, label: "Excluir", onClick: onDelete, danger: true },
  ].filter(Boolean) as { key: string; icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }[];

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex gap-4 p-4">
        {/* Prévia */}
        <div className="relative shrink-0">
          {template.isDefault && (
            <span className="absolute -left-1.5 -top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950 shadow-sm">
              <Star className="h-3 w-3 fill-current" />
              Padrão
            </span>
          )}
          <div className="flex h-[132px] w-[132px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700">
            <LabelCanvas
              layout={template.layout}
              scale={previewScale(template.layout.width, template.layout.height)}
              selectedId={null}
              onSelect={() => {}}
              onElementChange={() => {}}
              interactive={false}
            />
          </div>
        </div>

        {/* Detalhes */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
              {template.name}
            </h3>
            <OverflowMenu
              template={template}
              busy={busy}
              canEdit={canEdit}
              onSetDefault={onSetDefault}
              onToggleActive={onToggleActive}
            />
          </div>

          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {REFERENCE_TYPE_LABELS[template.referenceType]}
          </p>

          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Ruler className="h-3.5 w-3.5" />
            {template.layout.width} × {template.layout.height} mm
          </p>

          <div className="mt-auto pt-3">
            <StatusBadge active={template.isActive} />
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-stretch border-t border-slate-100 dark:border-slate-800">
        {actions.map((a, i) => (
          <React.Fragment key={a.key}>
            {i > 0 && <span className="my-2 w-px bg-slate-100 dark:bg-slate-800" />}
            <button
              type="button"
              onClick={a.onClick}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                a.danger
                  ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  : "text-slate-600 hover:bg-slate-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              )}
            >
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Linha (lista) ──────────────────────────────────────────────────────────

function LabelTemplateRow({
  template, busy, canEdit, canClone, canDelete,
  onEdit, onClone, onPrintTest, onDelete, onSetDefault, onToggleActive,
}: TemplateActions) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex h-12 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700">
          <LabelCanvas
            layout={template.layout}
            scale={thumbScale(template.layout.width, template.layout.height)}
            selectedId={null}
            onSelect={() => {}}
            onElementChange={() => {}}
            interactive={false}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100">{template.name}</span>
          {template.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <Star className="h-3 w-3 fill-current" />
              Padrão
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden text-sm text-slate-500 sm:table-cell dark:text-slate-400">
        {REFERENCE_TYPE_LABELS[template.referenceType]}
      </TableCell>
      <TableCell className="hidden font-mono text-sm text-slate-500 md:table-cell dark:text-slate-400">
        {template.layout.width} × {template.layout.height} mm
      </TableCell>
      <TableCell>
        <StatusBadge active={template.isActive} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-0.5">
          {canEdit && (
            <IconButton title="Editar" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
          )}
          {canClone && (
            <IconButton title="Duplicar" onClick={onClone}>
              <Copy className="h-3.5 w-3.5" />
            </IconButton>
          )}
          <IconButton title="Imprimir teste" onClick={onPrintTest}>
            <Printer className="h-3.5 w-3.5" />
          </IconButton>
          {canDelete && (
            <IconButton title="Excluir" danger onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          )}
          <OverflowMenu
            template={template}
            busy={busy}
            canEdit={canEdit}
            onSetDefault={onSetDefault}
            onToggleActive={onToggleActive}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Peças reutilizáveis ────────────────────────────────────────────────────

function OverflowMenu({
  template, busy, canEdit, onSetDefault, onToggleActive,
}: {
  template: LabelTemplate;
  busy: boolean;
  canEdit: boolean;
  onSetDefault: () => void;
  onToggleActive: () => void;
}) {
  if (!canEdit) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Mais opções"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {!template.isDefault && (
          <DropdownMenuItem onClick={onSetDefault}>
            <Star className="h-4 w-4" />
            Definir como padrão
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onToggleActive}>
          <Power className="h-4 w-4" />
          {template.isActive ? "Desativar" : "Ativar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-400")} />
      {active ? "Ativa" : "Inativa"}
    </span>
  );
}

function ViewToggleButton({
  active, label, onClick, children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  title, danger, onClick, children,
}: {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        danger
          ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      )}
    >
      {children}
    </button>
  );
}

function PagerButton({
  label, disabled, onClick, children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[224px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors group-hover:border-blue-200 group-hover:text-blue-500 dark:border-slate-700 dark:bg-slate-800">
        <FilePlus2 className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Criar novo template</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Comece do zero ou use um modelo existente como base.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors group-hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:group-hover:bg-blue-950/40">
        <Plus className="h-4 w-4" />
        Novo Template
      </span>
    </button>
  );
}

function EmptyState({
  filtered, canCreate, onCreate,
}: {
  filtered: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <QrCode className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {filtered ? "Nenhuma etiqueta corresponde aos filtros" : "Nenhuma etiqueta cadastrada"}
      </h3>
      <p className="mb-4 max-w-xs text-sm text-slate-400">
        {filtered
          ? "Ajuste a busca ou o filtro de tipo."
          : canCreate
            ? "Crie o primeiro modelo de etiqueta para começar."
            : "Nenhum modelo de etiqueta disponível ainda."}
      </p>
      {canCreate && !filtered && (
        <Button onClick={onCreate} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-4">
        <div className="h-[132px] w-[132px] shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-6 w-20 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      <div className="mt-4 h-9 rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

function CreationGuideDialog({
  open, onOpenChange, canCreate, onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const tips = [
    { icon: Ruler, title: "Defina as dimensões", text: "Informe largura e altura (mm) conforme a etiqueta física da impressora." },
    { icon: QrCode, title: "Adicione um QR Code", text: "Use a variável {qr_url} para gerar o link do equipamento ou da OS automaticamente." },
    { icon: Type, title: "Insira textos com variáveis", text: "Campos como {equipment_patrimony} e {company_name} são preenchidos na impressão." },
    { icon: ImageIcon, title: "Inclua o logo", text: "O logo da empresa é renderizado no PDF final — no editor aparece como placeholder." },
  ];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Guia de criação de etiquetas
          </AlertDialogTitle>
          <AlertDialogDescription>
            Passos rápidos para montar um template de etiqueta QR.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-3">
          {tips.map((tip) => (
            <li key={tip.title} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <tip.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{tip.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tip.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
          {canCreate && (
            <AlertDialogAction className="gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              Criar template
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Escala (px/mm) para a prévia do card caber em ~116×110px. */
function previewScale(width: number, height: number) {
  return Math.max(1.2, Math.min(116 / width, 110 / height));
}

/** Escala (px/mm) para a miniatura da lista caber em ~84×44px. */
function thumbScale(width: number, height: number) {
  return Math.max(1, Math.min(84 / width, 44 / height));
}

/** ID fictício (UUID) para a impressão de teste — campos da entidade ficam vazios. */
function makeTestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000";
}
