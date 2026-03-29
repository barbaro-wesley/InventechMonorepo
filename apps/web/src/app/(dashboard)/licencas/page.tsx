"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Clock,
  Search,
  RefreshCw,
  CalendarDays,
  Ban,
  CheckCircle,
  ChevronRight,
  Users,
  Contact,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  useAllLicenses,
  useUpdateLicense,
  useUpdateTrial,
  useSuspendCompany,
  useActivateCompany,
} from "@/hooks/companies/use-companies";
import type { CompanyLicenseRow } from "@/types/company";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function daysLabel(days: number | null | undefined) {
  if (days === null || days === undefined) return null;
  if (days < 0) return `Vencido há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Vence hoje";
  return `${days} dia(s)`;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  ACTIVE: {
    label: "Ativo",
    icon: ShieldCheck,
    className: "bg-green-100 text-green-700",
  },
  TRIAL: {
    label: "Trial",
    icon: Clock,
    className: "bg-blue-100 text-blue-700",
  },
  SUSPENDED: {
    label: "Suspenso",
    icon: ShieldX,
    className: "bg-red-100 text-red-700",
  },
  INACTIVE: {
    label: "Inativo",
    icon: Ban,
    className: "bg-gray-100 text-gray-600",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.INACTIVE;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.className} border-0 text-xs gap-1`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color + "20" }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Sheets ───────────────────────────────────────────────────────────────────

const licenseSchema = z.object({
  expiresAt: z.string().min(1, "Informe a data de vencimento"),
  notes: z.string().optional(),
});
type LicenseForm = z.infer<typeof licenseSchema>;

const trialSchema = z.object({
  trialEndsAt: z.string().min(1, "Informe a data de término do trial"),
});
type TrialForm = z.infer<typeof trialSchema>;

const suspendSchema = z.object({
  reason: z.string().min(5, "Informe o motivo (mín. 5 caracteres)"),
});
type SuspendForm = z.infer<typeof suspendSchema>;

function RenewLicenseSheet({
  company,
  open,
  onClose,
}: {
  company: CompanyLicenseRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateLicense = useUpdateLicense(company?.id ?? "");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LicenseForm>({ resolver: zodResolver(licenseSchema) });

  function onSubmit(data: LicenseForm) {
    updateLicense.mutate(
      { expiresAt: data.expiresAt, notes: data.notes },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) { reset(); onClose(); }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Renovar licença</SheetTitle>
          <p className="text-sm text-muted-foreground">{company?.name}</p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="expiresAt">Nova data de vencimento</Label>
            <Input id="expiresAt" type="date" {...register("expiresAt")} />
            {errors.expiresAt && (
              <p className="text-xs text-destructive">{errors.expiresAt.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Input
              id="notes"
              placeholder="Ex: Plano anual — Contrato #2026-042"
              {...register("notes")}
            />
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateLicense.isPending}>
              {updateLicense.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                "Salvar licença"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SetTrialSheet({
  company,
  open,
  onClose,
}: {
  company: CompanyLicenseRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateTrial = useUpdateTrial(company?.id ?? "");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrialForm>({ resolver: zodResolver(trialSchema) });

  function onSubmit(data: TrialForm) {
    updateTrial.mutate(
      { trialEndsAt: data.trialEndsAt },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) { reset(); onClose(); }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Configurar período de trial</SheetTitle>
          <p className="text-sm text-muted-foreground">{company?.name}</p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="trialEndsAt">Término do trial</Label>
            <Input id="trialEndsAt" type="date" {...register("trialEndsAt")} />
            {errors.trialEndsAt && (
              <p className="text-xs text-destructive">{errors.trialEndsAt.message}</p>
            )}
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateTrial.isPending}>
              {updateTrial.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                "Salvar trial"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SuspendSheet({
  company,
  open,
  onClose,
}: {
  company: CompanyLicenseRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const suspend = useSuspendCompany();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SuspendForm>({ resolver: zodResolver(suspendSchema) });

  function onSubmit(data: SuspendForm) {
    if (!company) return;
    suspend.mutate(
      { id: company.id, reason: data.reason },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) { reset(); onClose(); }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-destructive">Suspender empresa</SheetTitle>
          <p className="text-sm text-muted-foreground">{company?.name}</p>
        </SheetHeader>

        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Todos os usuários serão bloqueados imediatamente e as sessões ativas serão encerradas.
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo da suspensão</Label>
            <Input
              id="reason"
              placeholder="Ex: Contrato vencido — cliente não renovou"
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={suspend.isPending}>
              {suspend.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Suspendendo...</>
              ) : (
                "Suspender empresa"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterStatus = "all" | "ACTIVE" | "TRIAL" | "SUSPENDED" | "INACTIVE";

export default function LicensesPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterExpiring, setFilterExpiring] = useState<number | undefined>();
  const [search, setSearch] = useState("");

  // Sheets
  const [renewTarget, setRenewTarget] = useState<CompanyLicenseRow | null>(null);
  const [trialTarget, setTrialTarget] = useState<CompanyLicenseRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<CompanyLicenseRow | null>(null);
  const [activateTarget, setActivateTarget] = useState<CompanyLicenseRow | null>(null);

  const activate = useActivateCompany();

  const { data: licenses, isLoading } = useAllLicenses({
    status: filterStatus !== "all" ? filterStatus : undefined,
    expiringInDays: filterExpiring,
  });

  const filtered = (licenses ?? []).filter((c) =>
    search
      ? c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase())
      : true
  );

  // Summary counts
  const counts = (licenses ?? []).reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      if (c.expiryWarning) acc.warning++;
      return acc;
    },
    { ACTIVE: 0, TRIAL: 0, SUSPENDED: 0, INACTIVE: 0, warning: 0 } as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Gestão de Licenças
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Controle de contratos, trials e suspensões de todas as empresas
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={ShieldCheck} label="Ativas" value={counts.ACTIVE} color="#22c55e" />
        <SummaryCard icon={Clock} label="Em trial" value={counts.TRIAL} color="#3b82f6" />
        <SummaryCard icon={ShieldX} label="Suspensas" value={counts.SUSPENDED} color="#ef4444" />
        <SummaryCard icon={ShieldAlert} label="Vencendo em 30 dias" value={counts.warning} color="#f59e0b" />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "ACTIVE", "TRIAL", "SUSPENDED", "INACTIVE"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors border"
                style={{
                  background: filterStatus === s ? "var(--primary)" : "transparent",
                  color: filterStatus === s ? "white" : "var(--muted-foreground)",
                  borderColor: filterStatus === s ? "var(--primary)" : "var(--border)",
                }}
              >
                {s === "all"
                  ? "Todas"
                  : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
            <button
              onClick={() =>
                setFilterExpiring(filterExpiring === 30 ? undefined : 30)
              }
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors border flex items-center gap-1"
              style={{
                background: filterExpiring === 30 ? "#f59e0b" : "transparent",
                color: filterExpiring === 30 ? "white" : "var(--muted-foreground)",
                borderColor: filterExpiring === 30 ? "#f59e0b" : "var(--border)",
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              Vencendo
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Empresa
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Licença / Trial
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Prazo
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Usuários / Clientes
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50 animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground text-sm"
                  >
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((company) => {
                  const isSuspended = company.status === "SUSPENDED";
                  const isTrial = company.status === "TRIAL";
                  const isActive = company.status === "ACTIVE";
                  const days = company.daysUntilExpiry;
                  const expiryDate = isTrial
                    ? company.trialEndsAt
                    : company.licenseExpiresAt;

                  return (
                    <tr
                      key={company.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      {/* Company */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/empresas/${company.id}`}
                          className="font-medium hover:underline flex items-center gap-1"
                          style={{ color: "var(--foreground)" }}
                        >
                          {company.name}
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        </Link>
                        <p className="text-xs text-muted-foreground">{company.slug}</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={company.status} />
                        {isSuspended && company.suspendedReason && (
                          <p
                            className="text-xs text-muted-foreground mt-0.5 max-w-[160px] truncate"
                            title={company.suspendedReason}
                          >
                            {company.suspendedReason}
                          </p>
                        )}
                      </td>

                      {/* License / Trial date */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span
                            style={{
                              color:
                                company.isLicenseExpired || company.isTrialExpired
                                  ? "#ef4444"
                                  : "var(--foreground)",
                            }}
                          >
                            {formatDate(expiryDate)}
                          </span>
                        </div>
                      </td>

                      {/* Days countdown */}
                      <td className="px-4 py-3">
                        {days !== null && days !== undefined ? (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                days < 0
                                  ? "#fee2e2"
                                  : days <= 7
                                    ? "#fef3c7"
                                    : days <= 30
                                      ? "#fef9c3"
                                      : "#f0fdf4",
                              color:
                                days < 0
                                  ? "#dc2626"
                                  : days <= 7
                                    ? "#d97706"
                                    : days <= 30
                                      ? "#ca8a04"
                                      : "#16a34a",
                            }}
                          >
                            {daysLabel(days)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Counts */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {company._count.users}
                          </span>
                          <span className="flex items-center gap-1">
                            <Contact className="w-3.5 h-3.5" />
                            {company._count.clients}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Renovar licença — para ativas e suspensas */}
                          {(isActive || isSuspended) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => setRenewTarget(company)}
                            >
                              <Shield className="w-3 h-3 mr-1" />
                              Renovar
                            </Button>
                          )}

                          {/* Configurar trial — para qualquer não-trial */}
                          {!isTrial && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => setTrialTarget(company)}
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              Trial
                            </Button>
                          )}

                          {/* Suspender / Reativar */}
                          {isSuspended ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 border-green-300 text-green-700 hover:bg-green-50"
                              disabled={activate.isPending}
                              onClick={() => setActivateTarget(company)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Reativar
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => setSuspendTarget(company)}
                            >
                              <Ban className="w-3 h-3 mr-1" />
                              Suspender
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Count footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {filtered.length} empresa(s)
              {search || filterStatus !== "all" || filterExpiring
                ? " · filtradas"
                : " no total"}
            </p>
          </div>
        )}
      </div>

      {/* Sheets */}
      <RenewLicenseSheet
        company={renewTarget}
        open={!!renewTarget}
        onClose={() => setRenewTarget(null)}
      />
      <SetTrialSheet
        company={trialTarget}
        open={!!trialTarget}
        onClose={() => setTrialTarget(null)}
      />
      <SuspendSheet
        company={suspendTarget}
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
      />

      {/* Activate confirm dialog */}
      <AlertDialog
        open={!!activateTarget}
        onOpenChange={(o) => !o && setActivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reativar <strong>{activateTarget?.name}</strong>?
              Todos os usuários suspensos serão reativados e poderão fazer login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={activate.isPending}
              onClick={() => {
                if (!activateTarget) return;
                activate.mutate(activateTarget.id, {
                  onSuccess: () => setActivateTarget(null),
                });
              }}
            >
              {activate.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Reativando...</>
              ) : (
                "Confirmar reativação"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
