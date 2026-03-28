"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  FileText,
  Calendar,
  Users,
  Link2,
  ShieldAlert,
  ShieldCheck,
  Pencil,
  Loader2,
  KeyRound,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  useCompany,
  useCompanyLicense,
  useUpdateCompany,
  useSuspendCompany,
  useActivateCompany,
  useUpdateLicense,
} from "@/hooks/companies/use-companies";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/drawer";
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500",
  "bg-orange-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
  "bg-pink-500", "bg-teal-500",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; accent: string; dot: string }
> = {
  ACTIVE: {
    label: "Ativa",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accent: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  TRIAL: {
    label: "Trial",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    accent: "bg-blue-500",
    dot: "bg-blue-500",
  },
  SUSPENDED: {
    label: "Suspensa",
    badge: "bg-red-50 text-red-700 border-red-200",
    accent: "bg-red-400",
    dot: "bg-red-500",
  },
  EXPIRED: {
    label: "Expirada",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    accent: "bg-orange-400",
    dot: "bg-orange-500",
  },
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const editSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
});

const suspendSchema = z.object({
  reason: z.string().min(10, "Descreva o motivo (mín. 10 caracteres)"),
});

const licenseSchema = z.object({
  expiresAt: z.string().min(1, "Data obrigatória"),
  notes: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;
type SuspendForm = z.infer<typeof suspendSchema>;
type LicenseForm = z.infer<typeof licenseSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAvatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatDateTime(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDaysColor(days?: number | null) {
  if (days == null) return "text-slate-400";
  if (days > 30) return "text-emerald-600";
  if (days > 15) return "text-amber-600";
  return "text-red-600";
}

// ---------------------------------------------------------------------------
// Info Field — reusable row
// ---------------------------------------------------------------------------

function InfoField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p
          className={cn(
            "text-sm text-slate-900 dark:text-slate-100 break-all",
            mono && "font-mono",
            !value && "text-slate-400 italic"
          )}
        >
          {value ?? "Não informado"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonDetail() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* back */}
      <div className="h-5 w-28 bg-slate-200 dark:bg-slate-700 rounded" />

      {/* hero */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="h-1 bg-slate-200 dark:bg-slate-700" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-2">
                <div className="h-5 w-56 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-6 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3"
          >
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex gap-3 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                  <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const permissions = usePermissions();

  const [editOpen, setEditOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);

  const { data: company, isLoading, isError } = useCompany(id);
  const { data: license, isLoading: licenseLoading } = useCompanyLicense(id);

  const updateCompany = useUpdateCompany(id);
  const suspendMutation = useSuspendCompany();
  const activateMutation = useActivateCompany();
  const updateLicense = useUpdateLicense(id);

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: {
      name: company?.name ?? "",
      document: company?.document ?? "",
      email: company?.email ?? "",
      phone: company?.phone ?? "",
    },
  });

  const suspendForm = useForm<SuspendForm>({
    resolver: zodResolver(suspendSchema),
    defaultValues: { reason: "" },
  });

  const licenseForm = useForm<LicenseForm>({
    resolver: zodResolver(licenseSchema),
    defaultValues: { expiresAt: "", notes: "" },
  });

  function handleEdit(formData: EditForm) {
    updateCompany.mutate(formData, {
      onSuccess: () => setEditOpen(false),
    });
  }

  function handleSuspend(formData: SuspendForm) {
    suspendMutation.mutate(
      { id, reason: formData.reason },
      {
        onSuccess: () => {
          setSuspendOpen(false);
          suspendForm.reset();
        },
      }
    );
  }

  function handleActivate() {
    activateMutation.mutate(id, {
      onSuccess: () => setActivateOpen(false),
    });
  }

  function handleUpdateLicense(formData: LicenseForm) {
    updateLicense.mutate(formData, {
      onSuccess: () => {
        setLicenseOpen(false);
        licenseForm.reset();
      },
    });
  }

  if (!permissions.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  if (isLoading) return <SkeletonDetail />;

  if (isError || !company) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
          Empresa não encontrada
        </h3>
        <p className="text-sm text-slate-400 mb-5">
          Esta empresa não existe ou foi removida.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.push("/empresas")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para empresas
        </Button>
      </div>
    );
  }

  const status = STATUS_CONFIG[company.status] ?? STATUS_CONFIG["SUSPENDED"];
  const avatarBg = getAvatarColor(company.name);
  const initials = getInitials(company.name);
  const canSuspend = company.status === "ACTIVE" || company.status === "TRIAL";
  const isSuspended = company.status === "SUSPENDED";

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Back nav ── */}
      <button
        onClick={() => router.push("/empresas")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Empresas
      </button>

      {/* ── Hero card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className={cn("h-1 w-full", status.accent)} />

        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 select-none",
                  avatarBg
                )}
              >
                {initials}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {company.name}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">{company.slug}</p>
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", status.badge)}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full mr-1.5",
                        status.dot
                      )}
                    />
                    {status.label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
              {canSuspend ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  onClick={() => setSuspendOpen(true)}
                >
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Suspender
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                  onClick={() => setActivateOpen(true)}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Reativar
                </Button>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Usuários</p>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {company._count?.users ?? 0}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Clientes</p>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {company._count?.clients ?? 0}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Cadastrada em</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {formatDate(company.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Suspension alert ── */}
      {isSuspended && license?.suspendedReason && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Empresa suspensa desde {formatDate(license.suspendedAt)}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5 break-words">
              {license.suspendedReason}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 flex-shrink-0"
            onClick={() => setActivateOpen(true)}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reativar
          </Button>
        </div>
      )}

      {/* ── Info grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Company info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Informações da empresa
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Dados cadastrais e de contato
          </p>

          <InfoField icon={Mail} label="E-mail" value={company.email} />
          <InfoField icon={Phone} label="Telefone" value={company.phone} />
          <InfoField icon={FileText} label="CNPJ" value={company.document} mono />
          <InfoField icon={Link2} label="Slug" value={company.slug} mono />
          <InfoField
            icon={Calendar}
            label="Última atualização"
            value={formatDateTime(company.updatedAt)}
          />
        </div>

        {/* License info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Licença
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-500 -mt-1 -mr-2"
              onClick={() => {
                licenseForm.reset({
                  expiresAt: license?.licenseExpiresAt
                    ? license.licenseExpiresAt.split("T")[0]
                    : "",
                  notes: license?.notes ?? "",
                });
                setLicenseOpen(true);
              }}
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
              Gerenciar
            </Button>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Status do contrato e validade
          </p>

          {licenseLoading ? (
            <div className="space-y-3 animate-pulse flex-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex gap-3 py-3 border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : !license ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <KeyRound className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">
                Nenhuma licença configurada
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setLicenseOpen(true)}
              >
                Configurar licença
              </Button>
            </div>
          ) : (
            <div className="flex-1">
              {/* Status row */}
              <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                  {license.isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Status</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      STATUS_CONFIG[license.status]?.badge
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full mr-1.5",
                        STATUS_CONFIG[license.status]?.dot
                      )}
                    />
                    {STATUS_CONFIG[license.status]?.label ?? license.status}
                  </Badge>
                </div>
              </div>

              {/* Expiry */}
              {license.licenseExpiresAt && (
                <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">
                      Vencimento do contrato
                    </p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatDate(license.licenseExpiresAt)}
                    </p>
                    {license.daysUntilExpiry != null && (
                      <p
                        className={cn(
                          "text-xs mt-0.5 font-medium",
                          getDaysColor(license.daysUntilExpiry)
                        )}
                      >
                        {license.daysUntilExpiry > 0
                          ? `${license.daysUntilExpiry} dias restantes`
                          : "Vencida"}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Trial */}
              {license.trialEndsAt && (
                <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Trial até</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatDate(license.trialEndsAt)}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {license.notes && (
                <div className="flex items-start gap-3 py-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Observações</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {license.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* No license data */}
              {!license.licenseExpiresAt && !license.trialEndsAt && !license.notes && (
                <div className="py-6 text-center">
                  <p className="text-xs text-slate-400">
                    Nenhuma data de vencimento configurada.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setLicenseOpen(true)}
                  >
                    Configurar agora
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer — Editar empresa ── */}
      <Drawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) editForm.reset();
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar empresa</DrawerTitle>
            <DrawerDescription>
              Atualize os dados cadastrais de {company.name}.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <form
              id="edit-company-form"
              onSubmit={editForm.handleSubmit(handleEdit)}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  className="mt-1.5"
                  {...editForm.register("name")}
                />
                {editForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-500">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-document">CNPJ</Label>
                  <Input
                    id="edit-document"
                    placeholder="00.000.000/0001-00"
                    className="mt-1.5"
                    {...editForm.register("document")}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <Input
                    id="edit-phone"
                    placeholder="(00) 0000-0000"
                    className="mt-1.5"
                    {...editForm.register("phone")}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="contato@empresa.com"
                  className="mt-1.5"
                  {...editForm.register("email")}
                />
                {editForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-500">
                    {editForm.formState.errors.email.message}
                  </p>
                )}
              </div>
            </form>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="edit-company-form"
              disabled={updateCompany.isPending}
            >
              {updateCompany.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Salvar alterações
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Modal — Suspender ── */}
      <Dialog
        open={suspendOpen}
        onOpenChange={(open) => {
          setSuspendOpen(open);
          if (!open) suspendForm.reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Suspender empresa</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={suspendForm.handleSubmit(handleSuspend)}
            className="space-y-4"
          >
            <p className="text-sm text-slate-500">
              Informe o motivo da suspensão de{" "}
              <strong>{company.name}</strong>. Todos os usuários desta empresa
              perderão acesso imediatamente.
            </p>
            <div>
              <Label htmlFor="reason">Motivo *</Label>
              <textarea
                id="reason"
                rows={3}
                placeholder="Ex: Contrato vencido em 01/03/2026..."
                className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                {...suspendForm.register("reason")}
              />
              {suspendForm.formState.errors.reason && (
                <p className="mt-1 text-xs text-red-500">
                  {suspendForm.formState.errors.reason.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSuspendOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={suspendMutation.isPending}
              >
                {suspendMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Suspender
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal — Gerenciar licença ── */}
      <Dialog
        open={licenseOpen}
        onOpenChange={(open) => {
          setLicenseOpen(open);
          if (!open) licenseForm.reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar licença</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={licenseForm.handleSubmit(handleUpdateLicense)}
            className="space-y-4"
          >
            <p className="text-sm text-slate-500">
              Atualize a validade do contrato de{" "}
              <strong>{company.name}</strong>.
            </p>
            <div>
              <Label htmlFor="expiresAt">Válida até *</Label>
              <Input
                id="expiresAt"
                type="date"
                className="mt-1.5"
                {...licenseForm.register("expiresAt")}
              />
              {licenseForm.formState.errors.expiresAt && (
                <p className="mt-1 text-xs text-red-500">
                  {licenseForm.formState.errors.expiresAt.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="license-notes">Observações</Label>
              <Input
                id="license-notes"
                placeholder="Ex: Plano anual — Contrato #2026-042"
                className="mt-1.5"
                {...licenseForm.register("notes")}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLicenseOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateLicense.isPending}>
                {updateLicense.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação — Reativar ── */}
      <AlertDialog
        open={activateOpen}
        onOpenChange={(open) => setActivateOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reativar <strong>{company.name}</strong>? Os usuários
              voltarão a ter acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {activateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Reativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
