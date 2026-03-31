"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Loader2,
  Building2,
  Users,
  ShieldAlert,
  ShieldCheck,
  Mail,
  FileText,
  MoreHorizontal,
  Calendar,
  Palette,
  Upload,
  ImageIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  useCompanies,
  useCreateCompany,
  useSuspendCompany,
  useActivateCompany,
  useUpdateLicense,
  useUploadCompanyLogo,
  useUpdateReportSettings,
} from "@/hooks/companies/use-companies";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { cn } from "@/lib/utils";
import type { Company } from "@/types/company";
import type { CompanyStatus } from "@inventech/shared-types";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-teal-500",
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

const STATUS_FILTERS: { label: string; value: CompanyStatus | undefined }[] = [
  { label: "Todas", value: undefined },
  { label: "Ativas", value: "ACTIVE" },
  { label: "Trial", value: "TRIAL" },
  { label: "Suspensas", value: "SUSPENDED" },
  { label: "Expiradas", value: "EXPIRED" },
];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createCompanySchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  admin: z.object({
    name: z.string().min(1, "Nome do admin obrigatório"),
    email: z.string().min(1, "E-mail obrigatório").email("E-mail inválido"),
    password: z
      .string()
      .min(6, "Mínimo 6 caracteres")
      .regex(/[A-Z]/, "Precisa de letra maiúscula")
      .regex(/[0-9]/, "Precisa de número"),
    phone: z.string().optional(),
  }),
});

const suspendSchema = z.object({
  reason: z.string().min(10, "Descreva o motivo (mín. 10 caracteres)"),
});

const licenseSchema = z.object({
  expiresAt: z.string().min(1, "Data obrigatória"),
  notes: z.string().optional(),
});

const reportSettingsSchema = z.object({
  reportPrimaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida").optional().or(z.literal("")),
  reportSecondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida").optional().or(z.literal("")),
  reportHeaderTitle: z.string().optional(),
  reportFooterText: z.string().optional(),
});

type CreateCompanyForm = z.infer<typeof createCompanySchema>;
type SuspendForm = z.infer<typeof suspendSchema>;
type LicenseForm = z.infer<typeof licenseSchema>;
type ReportSettingsForm = z.infer<typeof reportSettingsSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAvatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDate(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

// ---------------------------------------------------------------------------
// Company Card
// ---------------------------------------------------------------------------

function CompanyCard({
  company,
  onSuspend,
  onActivate,
  onLicense,
  onTemplate,
  onClick,
}: {
  company: Company;
  onSuspend: () => void;
  onActivate: () => void;
  onLicense: () => void;
  onTemplate: () => void;
  onClick: () => void;
}) {
  const status = STATUS_CONFIG[company.status] ?? STATUS_CONFIG["SUSPENDED"];
  const avatarBg = getAvatarColor(company.name);
  const initials = getInitials(company.name);
  const canSuspend =
    company.status === "ACTIVE" || company.status === "TRIAL";

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700"
    >
      {/* Status accent */}
      <div className={cn("h-1 w-full flex-shrink-0", status.accent)} />

      <div className="p-5 flex-1 flex flex-col">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none",
              avatarBg
            )}
          >
            {initials}
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onClick}>
                  Ver detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLicense}>
                  Gerenciar licença
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onTemplate}>
                  <Palette className="w-4 h-4 mr-2" />
                  Personalizar relatório
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {canSuspend ? (
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={onSuspend}
                  >
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    Suspender
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-emerald-600 focus:text-emerald-600"
                    onClick={onActivate}
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Reativar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Name */}
        <div className="mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
            {company.name}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{company.slug}</p>
        </div>

        {/* Status */}
        <Badge variant="outline" className={cn("text-xs w-fit", status.badge)}>
          <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0", status.dot)} />
          {status.label}
        </Badge>

        {/* Contact */}
        <div className="mt-4 space-y-1.5 flex-1">
          {company.email && (
            <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
              <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span className="truncate">{company.email}</span>
            </div>
          )}
          {company.document && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <FileText className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span>{company.document}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats footer */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {company._count?.users ?? 0}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              usuário{(company._count?.users ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {company._count?.clients ?? 0}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              cliente{(company._count?.clients ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
          <Calendar className="w-3 h-3" />
          {formatDate(company.createdAt)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
        </div>
        <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse w-16" />
        <div className="space-y-2 pt-1">
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-full" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-2/3" />
        </div>
      </div>
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmpresasPage() {
  const permissions = usePermissions();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | undefined>(
    undefined
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [suspendCompany, setSuspendCompany] = useState<Company | null>(null);
  const [activateCompany, setActivateCompany] = useState<Company | null>(null);
  const [licenseCompany, setLicenseCompany] = useState<Company | null>(null);
  const [templateCompany, setTemplateCompany] = useState<Company | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data, isLoading } = useCompanies({
    page,
    limit: 12,
    search: search || undefined,
    status: statusFilter,
  });

  const createCompany = useCreateCompany();
  const suspendMutation = useSuspendCompany();
  const activateMutation = useActivateCompany();
  const updateLicense = useUpdateLicense(licenseCompany?.id ?? "");
  const uploadLogo = useUploadCompanyLogo(templateCompany?.id ?? "");
  const updateReportSettings = useUpdateReportSettings(templateCompany?.id ?? "");

  const createForm = useForm<CreateCompanyForm>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: "",
      document: "",
      email: "",
      phone: "",
      admin: { name: "", email: "", password: "", phone: "" },
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

  const reportSettingsForm = useForm<ReportSettingsForm>({
    resolver: zodResolver(reportSettingsSchema),
    defaultValues: {
      reportPrimaryColor: "",
      reportSecondaryColor: "",
      reportHeaderTitle: "",
      reportFooterText: "",
    },
  });

  function handleCreate(formData: CreateCompanyForm) {
    createCompany.mutate(formData, {
      onSuccess: () => {
        setCreateOpen(false);
        createForm.reset();
      },
    });
  }

  function handleSuspend(formData: SuspendForm) {
    if (!suspendCompany) return;
    suspendMutation.mutate(
      { id: suspendCompany.id, reason: formData.reason },
      {
        onSuccess: () => {
          setSuspendCompany(null);
          suspendForm.reset();
        },
      }
    );
  }

  function handleActivate() {
    if (!activateCompany) return;
    activateMutation.mutate(activateCompany.id, {
      onSuccess: () => setActivateCompany(null),
    });
  }

  function handleUpdateLicense(formData: LicenseForm) {
    updateLicense.mutate(formData, {
      onSuccess: () => {
        setLicenseCompany(null);
        licenseForm.reset();
      },
    });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    uploadLogo.mutate(file);
  }

  function handleSaveReportSettings(formData: ReportSettingsForm) {
    const dto = {
      ...(formData.reportPrimaryColor && { reportPrimaryColor: formData.reportPrimaryColor }),
      ...(formData.reportSecondaryColor && { reportSecondaryColor: formData.reportSecondaryColor }),
      ...(formData.reportHeaderTitle !== undefined && { reportHeaderTitle: formData.reportHeaderTitle }),
      ...(formData.reportFooterText !== undefined && { reportFooterText: formData.reportFooterText }),
    };
    updateReportSettings.mutate(dto, {
      onSuccess: () => {
        setTemplateCompany(null);
        setLogoPreview(null);
        reportSettingsForm.reset();
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

  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 0;
  const companies = data?.data ?? [];
  const hasFilters = !!search || !!statusFilter;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Empresas
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {!isLoading && total > 0
                ? `${total} empresa${total !== 1 ? "s" : ""} cadastrada${total !== 1 ? "s" : ""}`
                : isLoading
                ? "Carregando..."
                : "Nenhuma empresa cadastrada"}
            </p>
          </div>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Nova empresa
        </Button>
      </div>

      {/* ── Search + filters ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar empresa..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                statusFilter === f.value
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid / states ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
            {hasFilters
              ? "Nenhuma empresa encontrada"
              : "Nenhuma empresa cadastrada"}
          </h3>
          <p className="text-sm text-slate-400 max-w-xs">
            {hasFilters
              ? "Tente ajustar os filtros ou a busca."
              : "Comece criando a primeira empresa da plataforma."}
          </p>
          {!hasFilters && (
            <Button
              size="sm"
              className="mt-5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova empresa
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onClick={() => router.push(`/empresas/${company.id}`)}
              onSuspend={() => {
                suspendForm.reset();
                setSuspendCompany(company);
              }}
              onActivate={() => setActivateCompany(company)}
              onLicense={() => {
                licenseForm.reset();
                setLicenseCompany(company);
              }}
              onTemplate={() => {
                setLogoPreview(company.logoUrl ?? null);
                reportSettingsForm.reset({
                  reportPrimaryColor: company.reportPrimaryColor ?? "#1E40AF",
                  reportSecondaryColor: company.reportSecondaryColor ?? "#DBEAFE",
                  reportHeaderTitle: company.reportHeaderTitle ?? "",
                  reportFooterText: company.reportFooterText ?? "",
                });
                setTemplateCompany(company);
              }}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 pt-2">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* ── Drawer — Criar empresa ── */}
      <Drawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) createForm.reset();
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Nova empresa</DrawerTitle>
            <DrawerDescription>
              Preencha os dados abaixo para cadastrar uma nova empresa e seu
              administrador.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <form
              id="create-company-form"
              onSubmit={createForm.handleSubmit(handleCreate)}
              className="space-y-6"
            >
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Dados da empresa
                </p>
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    placeholder="Nome da empresa"
                    className="mt-1.5"
                    {...createForm.register("name")}
                  />
                  {createForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-500">
                      {createForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="document">CNPJ</Label>
                    <Input
                      id="document"
                      placeholder="00.000.000/0001-00"
                      className="mt-1.5"
                      {...createForm.register("document")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(00) 0000-0000"
                      className="mt-1.5"
                      {...createForm.register("phone")}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contato@empresa.com"
                    className="mt-1.5"
                    {...createForm.register("email")}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Administrador
                </p>
                <div>
                  <Label htmlFor="admin.name">Nome *</Label>
                  <Input
                    id="admin.name"
                    placeholder="Nome do administrador"
                    className="mt-1.5"
                    {...createForm.register("admin.name")}
                  />
                  {createForm.formState.errors.admin?.name && (
                    <p className="mt-1 text-xs text-red-500">
                      {createForm.formState.errors.admin.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="admin.email">E-mail *</Label>
                  <Input
                    id="admin.email"
                    type="email"
                    placeholder="admin@empresa.com"
                    className="mt-1.5"
                    {...createForm.register("admin.email")}
                  />
                  {createForm.formState.errors.admin?.email && (
                    <p className="mt-1 text-xs text-red-500">
                      {createForm.formState.errors.admin.email.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="admin.password">Senha *</Label>
                    <Input
                      id="admin.password"
                      type="password"
                      placeholder="Mín. 6 caracteres"
                      className="mt-1.5"
                      {...createForm.register("admin.password")}
                    />
                    {createForm.formState.errors.admin?.password && (
                      <p className="mt-1 text-xs text-red-500">
                        {createForm.formState.errors.admin.password.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="admin.phone">Telefone</Label>
                    <Input
                      id="admin.phone"
                      placeholder="(00) 00000-0000"
                      className="mt-1.5"
                      {...createForm.register("admin.phone")}
                    />
                  </div>
                </div>
              </div>
            </form>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-company-form"
              disabled={createCompany.isPending}
            >
              {createCompany.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Criar empresa
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Modal — Suspender ── */}
      <Dialog
        open={!!suspendCompany}
        onOpenChange={(open) => !open && setSuspendCompany(null)}
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
              <strong>{suspendCompany?.name}</strong>. Todos os usuários desta
              empresa perderão acesso imediatamente.
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
                onClick={() => setSuspendCompany(null)}
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
        open={!!licenseCompany}
        onOpenChange={(open) => !open && setLicenseCompany(null)}
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
              Atualize a validade da licença de{" "}
              <strong>{licenseCompany?.name}</strong>.
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
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                placeholder="Ex: Plano anual renovado — Contrato #2026-042"
                className="mt-1.5"
                {...licenseForm.register("notes")}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLicenseCompany(null)}
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

      {/* ── Drawer — Personalizar relatório ── */}
      <Drawer
        open={!!templateCompany}
        onOpenChange={(open) => {
          if (!open) {
            setTemplateCompany(null);
            setLogoPreview(null);
            reportSettingsForm.reset();
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Personalizar relatório</DrawerTitle>
            <DrawerDescription>
              {templateCompany?.name} — Logo e cores dos relatórios gerados
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <form
              id="report-settings-form"
              onSubmit={reportSettingsForm.handleSubmit(handleSaveReportSettings)}
              className="space-y-6"
            >
              {/* Logo */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Logo
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-800">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label
                      htmlFor="logo-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {uploadLogo.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploadLogo.isPending ? "Enviando..." : "Selecionar imagem"}
                    </Label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="sr-only"
                      onChange={handleLogoChange}
                    />
                    <p className="mt-1 text-xs text-slate-400">PNG, JPG ou SVG — máx. 2MB</p>
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Cores
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primaryColor">Cor primária</Label>
                    <p className="text-xs text-slate-400 mb-1.5">Cabeçalho das tabelas</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="primaryColor"
                        className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
                        value={reportSettingsForm.watch("reportPrimaryColor") || "#1E40AF"}
                        onChange={(e) => reportSettingsForm.setValue("reportPrimaryColor", e.target.value)}
                      />
                      <Input
                        className="font-mono text-sm"
                        placeholder="#1E40AF"
                        {...reportSettingsForm.register("reportPrimaryColor")}
                      />
                    </div>
                    {reportSettingsForm.formState.errors.reportPrimaryColor && (
                      <p className="mt-1 text-xs text-red-500">
                        {reportSettingsForm.formState.errors.reportPrimaryColor.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="secondaryColor">Cor secundária</Label>
                    <p className="text-xs text-slate-400 mb-1.5">Linhas alternadas</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="secondaryColor"
                        className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
                        value={reportSettingsForm.watch("reportSecondaryColor") || "#DBEAFE"}
                        onChange={(e) => reportSettingsForm.setValue("reportSecondaryColor", e.target.value)}
                      />
                      <Input
                        className="font-mono text-sm"
                        placeholder="#DBEAFE"
                        {...reportSettingsForm.register("reportSecondaryColor")}
                      />
                    </div>
                    {reportSettingsForm.formState.errors.reportSecondaryColor && (
                      <p className="mt-1 text-xs text-red-500">
                        {reportSettingsForm.formState.errors.reportSecondaryColor.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Texts */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Textos
                </p>
                <div>
                  <Label htmlFor="reportHeaderTitle">Título do cabeçalho</Label>
                  <Input
                    id="reportHeaderTitle"
                    placeholder="Ex: Relatório Técnico — Aria Engenharia"
                    className="mt-1.5"
                    {...reportSettingsForm.register("reportHeaderTitle")}
                  />
                </div>
                <div>
                  <Label htmlFor="reportFooterText">Texto do rodapé</Label>
                  <Input
                    id="reportFooterText"
                    placeholder="Ex: Documento confidencial — uso interno"
                    className="mt-1.5"
                    {...reportSettingsForm.register("reportFooterText")}
                  />
                </div>
              </div>
            </form>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplateCompany(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="report-settings-form"
              disabled={updateReportSettings.isPending}
            >
              {updateReportSettings.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Confirmação — Reativar ── */}
      <AlertDialog
        open={!!activateCompany}
        onOpenChange={(open) => !open && setActivateCompany(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reativar <strong>{activateCompany?.name}</strong>? Os
              usuários voltarão a ter acesso imediatamente.
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
