"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Building2,
  MapPin,
  RefreshCw,
  Hash,
  Wrench,
  ArrowRight,
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
  useCostCenters,
  useCreateCostCenter,
  useUpdateCostCenter,
  useDeleteCostCenter,
} from "@/hooks/equipment/use-cost-centers";
import {
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
} from "@/hooks/equipment/use-locations";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { CostCenter, EmbeddedLocation } from "@/services/equipment/cost-centers.service";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ccSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  code: z.string().optional(),
  description: z.string().optional(),
});
type CcForm = z.infer<typeof ccSchema>;

const locSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
});
type LocForm = z.infer<typeof locSchema>;

// ─── Cost Center Sheet ────────────────────────────────────────────────────────

function CostCenterSheet({
  open,
  editTarget,
  onClose,
}: {
  open: boolean;
  editTarget: CostCenter | null;
  onClose: () => void;
}) {
  const create = useCreateCostCenter();
  const update = useUpdateCostCenter();
  const isPending = create.isPending || update.isPending;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CcForm>({
    resolver: zodResolver(ccSchema),
    values: editTarget
      ? { name: editTarget.name, code: editTarget.code ?? "", description: editTarget.description ?? "" }
      : { name: "", code: "", description: "" },
  });

  function onSubmit(data: CcForm) {
    const dto = { name: data.name, code: data.code || undefined, description: data.description || undefined };
    if (editTarget) {
      update.mutate({ id: editTarget.id, dto }, { onSuccess: () => { reset(); onClose(); } });
    } else {
      create.mutate(dto, { onSuccess: () => { reset(); onClose(); } });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editTarget ? "Editar centro de custo" : "Novo centro de custo"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Agrupa localizações físicas para fins de organização e controle.
          </p>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Nome *</Label>
            <Input id="cc-name" placeholder="Ex: TI, Produção, Administrativo" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-code">
              Código interno <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input id="cc-code" placeholder="Ex: CC-001" {...register("code")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-desc">
              Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input id="cc-desc" placeholder="Breve descrição" {...register("description")} />
          </div>
          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : editTarget ? "Salvar" : "Criar centro de custo"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── EmbeddedLocation Sheet ───────────────────────────────────────────────────────────
// Contexto já vem resolvido — sheet só pede nome e descrição

function EmbeddedLocationSheet({
  open,
  context, // { type: 'root', cc } | { type: 'child', parent }
  editTarget,
  onClose,
}: {
  open: boolean;
  context: { type: "root"; cc: CostCenter } | { type: "child"; parent: EmbeddedLocation } | null;
  editTarget: EmbeddedLocation | null;
  onClose: () => void;
}) {
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const isPending = create.isPending || update.isPending;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LocForm>({
    resolver: zodResolver(locSchema),
    values: editTarget
      ? { name: editTarget.name, description: editTarget.description ?? "" }
      : { name: "", description: "" },
  });

  const contextLabel = context?.type === "root"
    ? `Centro de Custo: ${context.cc.name}`
    : context?.type === "child"
      ? `Sublocalização de: ${context.parent.name}`
      : "";

  const title = editTarget
    ? "Editar localização"
    : context?.type === "root"
      ? "Nova localização"
      : "Nova sublocalização";

  function onSubmit(data: LocForm) {
    const dto = { name: data.name, description: data.description || undefined };

    if (editTarget) {
      update.mutate({ id: editTarget.id, dto }, { onSuccess: () => { reset(); onClose(); } });
    } else if (context?.type === "root") {
      create.mutate(
        { ...dto, costCenterId: context.cc.id },
        { onSuccess: () => { reset(); onClose(); } }
      );
    } else if (context?.type === "child") {
      create.mutate(
        { ...dto, costCenterId: context.parent.costCenterId ?? undefined, parentId: context.parent.id },
        { onSuccess: () => { reset(); onClose(); } }
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {contextLabel && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{contextLabel}</span>
            </div>
          )}
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="loc-name">Nome *</Label>
            <Input
              id="loc-name"
              placeholder={
                context?.type === "child" || (editTarget && editTarget.parentId)
                  ? "Ex: CPD, Help Desk, Sala 01"
                  : "Ex: RH, TI, Financeiro"
              }
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-desc">
              Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input id="loc-desc" placeholder="Breve descrição" {...register("description")} />
          </div>
          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : editTarget ? "Salvar" : "Criar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Sub-location row ─────────────────────────────────────────────────────────

function SubEmbeddedLocationRow({
  location,
  onEdit,
  onDelete,
  onAddChild,
  allEmbeddedLocations,
  depth,
  canManage,
}: {
  location: EmbeddedLocation;
  onEdit: (l: EmbeddedLocation) => void;
  onDelete: (l: EmbeddedLocation) => void;
  onAddChild: (parent: EmbeddedLocation) => void;
  allEmbeddedLocations: EmbeddedLocation[];
  depth: number;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allEmbeddedLocations.filter((l) => l.parentId === location.id);

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-white/80 hover:bg-muted/20 transition-colors group">
        {/* Expand toggle */}
        <button
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground"
          style={{ visibility: children.length > 0 ? "visible" : "hidden" }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />

        <span className="flex-1 text-sm truncate" style={{ color: "var(--foreground)" }}>
          {location.name}
        </span>

        {location.description && (
          <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[140px]">
            {location.description}
          </span>
        )}

        {location._count.equipments > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <Wrench className="w-3 h-3" />{location._count.equipments}
          </span>
        )}

        {/* Actions */}
        {canManage && (
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0" title="Adicionar sublocalização"
              onClick={() => onAddChild(location)}
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(location)}>
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0"
              onClick={() => onDelete(location)}
              disabled={location._count.equipments > 0 || children.length > 0}
            >
              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {expanded && children.map((child) => (
        <div key={child.id} className="mt-1.5">
          <SubEmbeddedLocationRow
            location={child}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            allEmbeddedLocations={allEmbeddedLocations}
            depth={depth + 1}
            canManage={canManage}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Cost Center Card ─────────────────────────────────────────────────────────

function CostCenterCard({
  cc,
  onEditCc,
  onDeleteCc,
  onAddLocation,
  onAddSubLocation,
  onEditLocation,
  onDeleteLocation,
  canManage,
}: {
  cc: CostCenter;
  onEditCc: (cc: CostCenter) => void;
  onDeleteCc: (cc: CostCenter) => void;
  onAddLocation: (cc: CostCenter) => void;
  onAddSubLocation: (parent: EmbeddedLocation) => void;
  onEditLocation: (l: EmbeddedLocation) => void;
  onDeleteLocation: (l: EmbeddedLocation) => void;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const rootLocations = cc.locations.filter((l) => !l.parentId);

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      {/* ── CC Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 bg-white cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex-shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--primary)18" }}
        >
          <Building2 className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              {cc.name}
            </span>
            {cc.code && (
              <span className="flex items-center gap-0.5 text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                <Hash className="w-3 h-3" />{cc.code}
              </span>
            )}
            {!cc.isActive && (
              <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">Inativo</Badge>
            )}
          </div>
          {cc.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{cc.description}</p>
          )}
        </div>

        {/* Counters */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 mr-2">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {cc._count.locations} local.
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5" />
            {cc._count.equipments} equip.
          </span>
        </div>

        {/* Actions — stop propagation so click doesn't toggle expand */}
        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEditCc(cc)}>
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={() => onDeleteCc(cc)}
              disabled={cc._count.equipments > 0 || cc._count.locations > 0}
              title={cc._count.locations > 0 ? "Remova as localizações antes" : "Remover"}
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Locations Panel ── */}
      {expanded && (
        <div className="border-t border-border bg-slate-50/60 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Localizações
            </p>
            {canManage && (
              <Button
                variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => onAddLocation(cc)}
              >
                <Plus className="w-3 h-3" />
                Nova localização
              </Button>
            )}
          </div>

          {rootLocations.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-lg bg-white">
              <MapPin className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma localização ainda.</p>
              {canManage && (
                <button
                  className="text-xs mt-1 font-medium hover:underline"
                  style={{ color: "var(--primary)" }}
                  onClick={() => onAddLocation(cc)}
                >
                  Adicionar primeira localização
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {rootLocations.map((loc) => (
                <SubEmbeddedLocationRow
                  key={loc.id}
                  location={loc}
                  onEdit={onEditLocation}
                  onDelete={onDeleteLocation}
                  onAddChild={onAddSubLocation}
                  allEmbeddedLocations={cc.locations}
                  depth={0}
                  canManage={canManage}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostCentersPage() {
  const { canManageEquipment } = usePermissions();

  // Sheet state
  type SheetState =
    | { type: "cc"; editTarget: CostCenter | null }
    | { type: "loc"; context: { type: "root"; cc: CostCenter } | { type: "child"; parent: EmbeddedLocation }; editTarget: EmbeddedLocation | null }
    | null;

  const [sheet, setSheet] = useState<SheetState>(null);
  const [deleteCc, setDeleteCc] = useState<CostCenter | null>(null);
  const [deleteLoc, setDeleteLoc] = useState<EmbeddedLocation | null>(null);

  const removeCc = useDeleteCostCenter();
  const removeLoc = useDeleteLocation();

  const { data: costCenters = [], isLoading } = useCostCenters({ limit: 100 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Centros de Custo & Localizações
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize onde os equipamentos estão instalados dentro de cada cliente.
          </p>
        </div>
        {canManageEquipment && (
          <Button onClick={() => setSheet({ type: "cc", editTarget: null })}>
            <Plus className="w-4 h-4 mr-2" />
            Novo centro de custo
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : costCenters.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-14 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Nenhum centro de custo cadastrado
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Comece criando o primeiro centro de custo para este cliente
          </p>
          {canManageEquipment && (
            <Button size="sm" onClick={() => setSheet({ type: "cc", editTarget: null })}>
              <Plus className="w-4 h-4 mr-2" />
              Criar centro de custo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {costCenters.map((cc) => (
            <CostCenterCard
              key={cc.id}
              cc={cc}
              onEditCc={(c) => setSheet({ type: "cc", editTarget: c })}
              onDeleteCc={setDeleteCc}
              onAddLocation={(c) => setSheet({ type: "loc", context: { type: "root", cc: c }, editTarget: null })}
              onAddSubLocation={(parent) => setSheet({ type: "loc", context: { type: "child", parent }, editTarget: null })}
              onEditLocation={(l) => setSheet({ type: "loc", context: { type: "root", cc: costCenters.find((c) => c.id === l.costCenterId)! }, editTarget: l })}
              onDeleteLocation={setDeleteLoc}
              canManage={canManageEquipment}
            />
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            {costCenters.length} centro(s) de custo · {costCenters.reduce((sum, cc) => sum + cc.locations.length, 0)} localização(ões)
          </p>
        </div>
      )}

      {/* ── Sheets ── */}
      <CostCenterSheet
        open={sheet?.type === "cc"}
        editTarget={sheet?.type === "cc" ? sheet.editTarget : null}
        onClose={() => setSheet(null)}
      />

      <EmbeddedLocationSheet
        open={sheet?.type === "loc"}
        context={sheet?.type === "loc" ? sheet.context : null}
        editTarget={sheet?.type === "loc" ? sheet.editTarget : null}
        onClose={() => setSheet(null)}
      />

      {/* ── Delete CC ── */}
      <AlertDialog open={!!deleteCc} onOpenChange={(o) => !o && setDeleteCc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover centro de custo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteCc?.name}</strong>?
              Remova as localizações vinculadas antes de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={removeCc.isPending}
              onClick={() => deleteCc && removeCc.mutate(deleteCc.id, { onSuccess: () => setDeleteCc(null) })}
            >
              {removeCc.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Location ── */}
      <AlertDialog open={!!deleteLoc} onOpenChange={(o) => !o && setDeleteLoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover localização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteLoc?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={removeLoc.isPending}
              onClick={() => deleteLoc && removeLoc.mutate(deleteLoc.id, { onSuccess: () => setDeleteLoc(null) })}
            >
              {removeLoc.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
