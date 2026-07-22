"use client";

import React, { useMemo, useState } from "react";
import { Plus, QrCode, Pencil, Copy, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LabelCanvas } from "@/components/labels/label-canvas";
import { LabelEditor } from "@/components/labels/label-editor";
import {
  useLabelTemplates, useDeleteLabelTemplate, useCloneLabelTemplate,
} from "@/hooks/label-templates/use-label-templates";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { REFERENCE_TYPE_LABELS } from "@/services/label-templates/label-templates.types";
import type {
  LabelTemplate, LabelReferenceType,
} from "@/services/label-templates/label-templates.types";

type EditingState = LabelTemplate | "new" | null;

export default function EtiquetasPage() {
  const permissions = usePermissions();
  const canCreate = permissions.canAccess("label-template", "create");
  const canEdit = permissions.canAccess("label-template", "update");
  const canDelete = permissions.canAccess("label-template", "delete");

  const [editing, setEditing] = useState<EditingState>(null);
  const [toDelete, setToDelete] = useState<LabelTemplate | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | LabelReferenceType>("all");

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

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Etiquetas QR
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Modelos de etiqueta para equipamentos e ordens de serviço.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome…"
              className="h-9 w-56 pl-8 text-sm"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | LabelReferenceType)}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.keys(REFERENCE_TYPE_LABELS) as LabelReferenceType[]).map((rt) => (
                <SelectItem key={rt} value={rt}>{REFERENCE_TYPE_LABELS[rt]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" />
              Nova etiqueta
            </Button>
          )}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-white dark:bg-zinc-900" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-14 text-center dark:bg-zinc-950/50">
          <QrCode className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {data?.data?.length ? "Nenhuma etiqueta corresponde aos filtros" : "Nenhuma etiqueta cadastrada"}
          </p>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            {data?.data?.length
              ? "Ajuste a busca ou o filtro de tipo."
              : canCreate
                ? "Crie o primeiro modelo de etiqueta para começar."
                : "Nenhum modelo de etiqueta disponível ainda."}
          </p>
          {canCreate && !data?.data?.length && (
            <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" />
              Nova etiqueta
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white dark:bg-zinc-950/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Prévia</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Dimensões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tpl) => (
                <TableRow
                  key={tpl.id}
                  className={canEdit ? "cursor-pointer" : undefined}
                  onClick={() => canEdit && setEditing(tpl)}
                >
                  <TableCell>
                    <div className="flex h-12 w-24 items-center justify-center overflow-hidden rounded border border-border bg-white">
                      <LabelCanvas
                        layout={tpl.layout}
                        scale={thumbScale(tpl.layout.width, tpl.layout.height)}
                        selectedId={null}
                        onSelect={() => {}}
                        onElementChange={() => {}}
                        interactive={false}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tpl.name}</span>
                      {tpl.isDefault && (
                        <Badge className="border-0 bg-amber-100 text-amber-700">Padrão</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {REFERENCE_TYPE_LABELS[tpl.referenceType]}
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm text-muted-foreground md:table-cell">
                    {tpl.layout.width} × {tpl.layout.height} mm
                  </TableCell>
                  <TableCell>
                    <Badge className={tpl.isActive
                      ? "border-0 bg-green-100 text-green-700"
                      : "border-0 bg-gray-100 text-gray-500"}>
                      {tpl.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Editar"
                          onClick={() => setEditing(tpl)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      {canCreate && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Duplicar"
                          onClick={() => cloneMutation.mutate(tpl.id)} disabled={cloneMutation.isPending}>
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Excluir"
                          onClick={() => setToDelete(tpl)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </div>
  );
}

/** Escala (px/mm) para a miniatura caber em ~88×44px. */
function thumbScale(width: number, height: number) {
  return Math.max(1.2, Math.min(88 / width, 44 / height));
}
