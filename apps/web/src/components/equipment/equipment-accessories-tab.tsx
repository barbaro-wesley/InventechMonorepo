"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Cable,
  Plus,
  Unlink,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ChevronRight,
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
import { useEquipmentAccessories, useUnassignAccessory, useAssignAccessory } from "@/hooks/accessories/use-accessories";
import { useAccessories } from "@/hooks/accessories/use-accessories";
import { useAccessoryCategories } from "@/hooks/accessories/use-accessory-categories";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { Accessory } from "@/services/accessories/accessories.service";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  UNDER_MAINTENANCE: "Em manutenção",
  LOANED: "Emprestado",
  SCRAPPED: "Baixado",
  LOST: "Extraviado",
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  IN_USE: "bg-blue-100 text-blue-700 border-blue-200",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-700 border-amber-200",
  LOANED: "bg-purple-100 text-purple-700 border-purple-200",
  SCRAPPED: "bg-red-100 text-red-500 border-red-200",
  LOST: "bg-gray-100 text-gray-500 border-gray-200",
};

function AccessoryStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function WarrantyAlert({ warrantyEnd }: { warrantyEnd: string | null }) {
  if (!warrantyEnd) return null;
  const end = new Date(warrantyEnd);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 30) return null;
  const expired = daysLeft <= 0;
  return (
    <span
      className={`flex items-center gap-1 text-[10px] font-medium ${expired ? "text-red-600" : "text-amber-600"}`}
    >
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      {expired ? "Garantia vencida" : `Garantia vence em ${daysLeft}d`}
    </span>
  );
}

// ─── Assign sheet ─────────────────────────────────────────────────────────────

const assignSchema = z.object({
  accessoryId: z.string().min(1, "Selecione um acessório"),
  reason: z.string().optional(),
});
type AssignForm = z.infer<typeof assignSchema>;

function AssignSheet({
  open,
  equipmentId,
  onClose,
}: {
  open: boolean;
  equipmentId: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null);

  const { data: availableData, isLoading } = useAccessories({
    status: "AVAILABLE",
    search: search || undefined,
    limit: 20,
  });
  const availableAccessories = availableData?.data ?? [];

  const { data: categories = [] } = useAccessoryCategories();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AssignForm>({
    resolver: zodResolver(assignSchema) as any,
  });

  const assign = useAssignAccessory(selectedAccessory?.id ?? "");

  function handleClose() {
    reset();
    setSearch("");
    setSelectedAccessory(null);
    onClose();
  }

  function selectAccessory(acc: Accessory) {
    setSelectedAccessory(acc);
    setValue("accessoryId", acc.id);
  }

  function onSubmit(data: AssignForm) {
    if (!selectedAccessory) return;
    assign.mutate(
      { equipmentId, reason: data.reason || undefined },
      { onSuccess: handleClose }
    );
  }

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent
        className="w-full sm:w-[500px] sm:max-w-[500px] p-0 flex flex-col gap-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader className="px-5 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <SheetTitle>Vincular acessório</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Selecione um acessório disponível para vincular ao equipamento.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5">
            {/* ── Search ── */}
            <div className="space-y-2">
              <Label>Buscar acessório</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Nome, série ou patrimônio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Accessory list ── */}
            <div className="space-y-1.5">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg border border-border bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : availableAccessories.length === 0 ? (
                <div className="py-8 text-center">
                  <Cable className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {search ? "Nenhum acessório encontrado" : "Nenhum acessório disponível"}
                  </p>
                </div>
              ) : (
                availableAccessories.map((acc) => {
                  const isSelected = selectedAccessory?.id === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => selectAccessory(acc)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{acc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            {acc.category && (
                              <span
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                                style={{
                                  backgroundColor: acc.category.color
                                    ? `${acc.category.color}20`
                                    : undefined,
                                  color: acc.category.color ?? undefined,
                                  border: `1px solid ${acc.category.color ?? "#e5e7eb"}40`,
                                }}
                              >
                                {acc.category.name}
                              </span>
                            )}
                            {acc.serialNumber && <span>S/N: {acc.serialNumber}</span>}
                            {acc.patrimonyNumber && <span>PAT: {acc.patrimonyNumber}</span>}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <AccessoryStatusBadge status={acc.status} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {errors.accessoryId && (
              <p className="text-xs text-destructive">{errors.accessoryId.message}</p>
            )}

            {/* ── Reason ── */}
            {selectedAccessory && (
              <div className="space-y-2 border-t border-border pt-4">
                <Label>Motivo do vínculo (opcional)</Label>
                <Input placeholder="Ex: Substituição preventiva..." {...register("reason")} />
              </div>
            )}
          </div>

          <SheetFooter className="px-5 py-4 border-t border-border flex-shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!selectedAccessory || assign.isPending}
              className="flex-1"
            >
              {assign.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <Cable className="w-4 h-4 mr-2" />
                  Vincular acessório
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Unassign dialog ──────────────────────────────────────────────────────────

function UnassignDialog({
  open,
  accessory,
  onClose,
}: {
  open: boolean;
  accessory: Accessory | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const unassign = useUnassignAccessory(accessory?.id ?? "");

  function handleConfirm() {
    if (!accessory) return;
    unassign.mutate(
      { unassignReason: reason || undefined },
      { onSuccess: onClose }
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Desvincular acessório?</AlertDialogTitle>
          <AlertDialogDescription>
            O acessório <strong>{accessory?.name}</strong> será desvinculado deste equipamento e
            ficará disponível novamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label>Motivo (opcional)</Label>
          <Input
            placeholder="Ex: Manutenção, substituição..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={unassign.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {unassign.isPending ? "Desvinculando..." : "Desvincular"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

interface EquipmentAccessoriesTabProps {
  equipmentId: string;
  onViewAccessory?: (accessory: Accessory) => void;
}

export function EquipmentAccessoriesTab({
  equipmentId,
  onViewAccessory,
}: EquipmentAccessoriesTabProps) {
  const { data: accessories = [], isLoading } = useEquipmentAccessories(equipmentId);

  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<Accessory | null>(null);

  const { canAssignAccessories } = usePermissions();

  if (isLoading) {
    return (
      <div className="mt-4 space-y-2 pb-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 space-y-3 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {accessories.length === 0
              ? "Nenhum acessório vinculado"
              : `${accessories.length} acessório${accessories.length > 1 ? "s" : ""} vinculado${accessories.length > 1 ? "s" : ""}`}
          </p>
          {canAssignAccessories && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => setAssignOpen(true)}
            >
              <Plus className="w-3 h-3" />
              Vincular
            </Button>
          )}
        </div>

        {/* List */}
        {accessories.length === 0 ? (
          <div className="py-10 text-center">
            <Cable className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Nenhum acessório vinculado a este equipamento
            </p>
            {canAssignAccessories && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 text-xs"
                onClick={() => setAssignOpen(true)}
              >
                <Plus className="w-3 h-3 mr-1.5" />
                Vincular primeiro acessório
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {accessories.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                {/* Category color dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: acc.category?.color ?? "#94a3b8" }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{acc.name}</span>
                    <AccessoryStatusBadge status={acc.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                    {acc.category && <span>{acc.category.name}</span>}
                    {acc.serialNumber && <span>S/N: {acc.serialNumber}</span>}
                    {acc.patrimonyNumber && <span>PAT: {acc.patrimonyNumber}</span>}
                    {acc.brand && acc.model && <span>{acc.brand} {acc.model}</span>}
                  </div>
                  <WarrantyAlert warrantyEnd={acc.warrantyEnd} />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {onViewAccessory && (
                    <button
                      type="button"
                      onClick={() => onViewAccessory(acc)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                      title="Ver detalhe"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canAssignAccessories && (
                    <button
                      type="button"
                      onClick={() => setUnassignTarget(acc)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                      title="Desvincular"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign sheet */}
      <AssignSheet
        open={assignOpen}
        equipmentId={equipmentId}
        onClose={() => setAssignOpen(false)}
      />

      {/* Unassign dialog */}
      <UnassignDialog
        open={!!unassignTarget}
        accessory={unassignTarget}
        onClose={() => setUnassignTarget(null)}
      />
    </>
  );
}
