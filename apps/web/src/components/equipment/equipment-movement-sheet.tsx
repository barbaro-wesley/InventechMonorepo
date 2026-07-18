"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RefreshCw, MapPin, ArrowRightLeft, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateMovement } from "@/hooks/equipment/use-movements";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import type { Equipment } from "@/services/equipment/equipment.service";

const movementSchema = z.object({
  type: z.enum(["LOAN", "TRANSFER"]),
  destinationLocationId: z.string().min(1, "Selecione o destino"),
  reason: z.string().optional(),
  expectedReturnAt: z.string().optional(),
  notes: z.string().optional(),
});
type MovementForm = z.infer<typeof movementSchema>;

export function EquipmentMovementSheet({
  open,
  equipment,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}) {
  const { data: costCenters = [] } = useCostCenters({ limit: 100 });
  const allLocations = costCenters.flatMap((cc) =>
    cc.locations.map((l) => ({ ...l, ccId: cc.id, ccName: cc.name }))
  );

  const create = useCreateMovement(equipment?.id ?? "");

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<MovementForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(movementSchema) as any,
    defaultValues: { type: "LOAN" },
  });

  const watchedType = watch("type");

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(data: MovementForm) {
    if (!equipment) return;
    const destLocation = allLocations.find((l) => l.id === data.destinationLocationId);
    create.mutate(
      {
        type: data.type,
        originLocationId: equipment.currentLocation?.id ?? equipment.location?.id ?? "",
        destinationLocationId: data.destinationLocationId,
        destinationCostCenterId: data.type === "TRANSFER" ? (destLocation?.ccId ?? undefined) : undefined,
        reason: data.reason || undefined,
        expectedReturnAt: data.expectedReturnAt || undefined,
        notes: data.notes || undefined,
      },
      { onSuccess: handleClose }
    );
  }

  if (!equipment) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "480px", width: "100%" }}>
        <SheetHeader>
          <SheetTitle>Movimentar equipamento</SheetTitle>
          <p className="text-sm text-muted-foreground truncate">{equipment.name}</p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 mt-6 pb-6">
          {/* Origin info */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="text-muted-foreground">Origem: </span>
              <span className="font-medium">
                {equipment.currentLocation?.name ?? equipment.location?.name ?? "Localização não definida"}
              </span>
            </div>
          </div>

          {/* Type selector */}
          <div className="space-y-2">
            <Label>Tipo de movimentação</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["LOAN", "TRANSFER"] as const).map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border cursor-pointer transition-colors text-xs ${watchedType === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/30"
                    }`}
                >
                  <input type="radio" {...register("type")} value={t} className="hidden" />
                  {t === "LOAN" ? <HandCoins className="w-4 h-4 flex-shrink-0" /> : <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />}
                  <div>
                    <p className="font-medium">{t === "LOAN" ? "Empréstimo" : "Transferência"}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {t === "LOAN" ? "Temporário, com retorno" : "Permanente"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label>Destino *</Label>
            <select
              {...register("destinationLocationId")}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Selecione o destino —</option>
              {allLocations
                .filter((l) => l.id !== (equipment.currentLocation?.id ?? equipment.location?.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.name} — {l.ccName}</option>
                ))}
            </select>
            {errors.destinationLocationId && (
              <p className="text-xs text-destructive">{errors.destinationLocationId.message}</p>
            )}
          </div>

          {/* Expected return (LOAN only) */}
          {watchedType === "LOAN" && (
            <div className="space-y-2">
              <Label htmlFor="mv-return">Data prevista de retorno</Label>
              <Input id="mv-return" type="date" {...register("expectedReturnAt")} />
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="mv-reason">Motivo</Label>
            <Input id="mv-reason" placeholder="Ex: Manutenção preventiva" {...register("reason")} />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="mv-notes">Observações</Label>
            <Textarea id="mv-notes" placeholder="Observações adicionais..." rows={3} {...register("notes")} />
          </div>

          <SheetFooter className="mt-auto pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Registrando...</>
                : "Registrar movimentação"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
