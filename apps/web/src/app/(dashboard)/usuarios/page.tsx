"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    MoreHorizontal,
    Loader2,
    Clock,
    Users,
    User as UserIcon,
    Mail,
    ShieldCheck,
    Info,
} from "lucide-react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useUsers, useCreateUser, useDeleteUser, useResetUserPassword } from "@/hooks/users/use-users";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { useCustomRoles } from "@/hooks/permissions/use-permissions";
import { useCurrentUser } from "@/store/auth.store";
import { displayRole } from "@/types/auth";
import type { User } from "@/types/user";
import type { Role } from "@/types/auth";
import { cn } from "@/lib/utils";

import { UserManagementSheets, ALL_ROLE_OPTIONS } from "@/components/users/user-management-sheets";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500",
    "bg-orange-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
    "bg-pink-500", "bg-teal-500",
];

const STATUS_DISPLAY: Record<string, { label: string; badge: string; dot: string }> = {
    ACTIVE:     { label: "Ativo",          badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    INACTIVE:   { label: "Inativo",        badge: "bg-slate-100 text-slate-600 border-slate-200",     dot: "bg-slate-400"  },
    SUSPENDED:  { label: "Suspenso",       badge: "bg-orange-50 text-orange-700 border-orange-200",   dot: "bg-orange-500" },
    UNVERIFIED: { label: "Não verificado", badge: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-400"  },
    BLOCKED:    { label: "Bloqueado",      badge: "bg-red-50 text-red-700 border-red-200",            dot: "bg-red-500"    },
};

const FIXED_CREATE_ROLES: { value: Role; label: string; forRoles: Role[] }[] = [
    { value: "COMPANY_ADMIN",   label: "Administrador", forRoles: ["SUPER_ADMIN"] },
    { value: "COMPANY_MANAGER", label: "Gerente",       forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN"] },
];
const FIXED_ROLE_VALUES = new Set(FIXED_CREATE_ROLES.map((r) => r.value as string));

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
    name:     z.string().min(1, "Nome obrigatório"),
    email:    z.email("E-mail inválido"),
    papel:    z.string().min(1, "Informe o papel do usuário"),
    phone:    z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAvatarColor(name: string): string {
    const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Descriptions for fixed roles shown in the callout
// ---------------------------------------------------------------------------

const FIXED_ROLE_DESCRIPTIONS: Record<string, string> = {
    COMPANY_ADMIN:   "Acesso total à gestão da empresa: usuários, configurações, relatórios e todas as funcionalidades.",
    COMPANY_MANAGER: "Acesso operacional — pode gerenciar equipamentos, ordens de serviço, técnicos e preventivas.",
};

// ---------------------------------------------------------------------------
// FormSection — agrupa campos com ícone + título + descrição, dando
// hierarquia visual clara às seções de um formulário (mesmo padrão do
// SectionCard usado em Configurações).
// ---------------------------------------------------------------------------

function FormSection({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {title}
                </h3>
            </div>
            {description && (
                <p className="text-xs text-muted-foreground -mt-2">{description}</p>
            )}
            {children}
        </div>
    );
}

// ---------------------------------------------------------------------------
// RoleOptionCard — cartão selecionável (radio) para escolha do papel.
// Substitui o combo "dropdown + callout separado" por uma lista onde a
// descrição (e, para papéis personalizados, as permissões) já aparece
// junto da opção, sem precisar abrir nada.
// ---------------------------------------------------------------------------

function RoleOptionCard({
    value,
    register,
    label,
    description,
    tags,
}: {
    value: string;
    register: UseFormRegister<CreateUserForm>;
    label: string;
    description?: string | null;
    tags?: { resource: string; action: string }[];
}) {
    return (
        <label
            className={cn(
                "group relative flex items-start gap-3 rounded-lg border border-border bg-background px-3.5 py-3",
                "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30",
                "has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary/30"
            )}
        >
            <input type="radio" value={value} className="sr-only" {...register("papel")} />
            <span className="mt-0.5 w-4 h-4 rounded-full border-2 border-border flex-shrink-0 transition-colors group-has-[:checked]:border-primary group-has-[:checked]:bg-primary" />
            <span className="flex-1 min-w-0 space-y-1">
                <span className="block text-sm font-medium text-foreground">{label}</span>
                {description && (
                    <span className="block text-xs text-muted-foreground leading-relaxed">
                        {description}
                    </span>
                )}
                {tags && tags.length > 0 && (
                    <span className="hidden group-has-[:checked]:flex flex-wrap gap-1 pt-1">
                        {tags.slice(0, 10).map((p) => (
                            <span
                                key={`${p.resource}:${p.action}`}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
                            >
                                {p.resource}:{p.action}
                            </span>
                        ))}
                        {tags.length > 10 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                +{tags.length - 10}
                            </span>
                        )}
                    </span>
                )}
            </span>
        </label>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsuariosPage() {
    const permissions = usePermissions();
    const currentUser = useCurrentUser();
    const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [deleteUser, setDeleteUser] = useState<User | null>(null);
    const [assignRoleUser, setAssignRoleUser] = useState<User | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

    const { data, isLoading } = useUsers({
        page,
        limit: 10,
        search: search || undefined,
        role:   roleFilter   !== "all" ? (roleFilter   as any) : undefined,
        status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    });
    const createUser        = useCreateUser();
    const deleteUserMutation = useDeleteUser();
    const resetPasswordMutation = useResetUserPassword();

    // Reset de senha — restrito ao papel de sistema COMPANY_ADMIN (espelha @Roles no backend).
    // Nunca liberado via permissões personalizadas.
    const canResetPassword = permissions.isCompanyAdmin || permissions.isSuperAdmin;

    const { data: customRoles = [] } = useCustomRoles(currentUser?.companyId ?? "");
    const activeCustomRoles = customRoles.filter((r) => r.isActive);

    const allowedFixedRoles = FIXED_CREATE_ROLES.filter(
        (opt) => permissions.role && opt.forRoles.includes(permissions.role as Role)
    );

    const filterRoleOptions = ALL_ROLE_OPTIONS.filter(
        (opt) => permissions.role && opt.forRoles.includes(permissions.role as Role)
    );

    const form = useForm<CreateUserForm>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { name: "", email: "", phone: "", papel: "" },
    });

    function handleCreate(formData: CreateUserForm) {
        const { papel, ...rest } = formData;
        const isFixedRole = FIXED_ROLE_VALUES.has(papel);
        createUser.mutate(
            {
                ...rest,
                // Sem campo de senha na UI — sempre herda a senha padrão de
                // primeiro acesso configurada em Configurações > Segurança
                ...(isFixedRole ? { role: papel } : { customRoleId: papel }),
            } as any,
            { onSuccess: () => { setCreateOpen(false); form.reset(); } }
        );
    }

    function handleDelete() {
        if (!deleteUser) return;
        deleteUserMutation.mutate(deleteUser.id, { onSuccess: () => setDeleteUser(null) });
    }

    function handleResetPassword() {
        if (!resetPasswordUser) return;
        resetPasswordMutation.mutate(resetPasswordUser.id, { onSuccess: () => setResetPasswordUser(null) });
    }

    const total      = data?.pagination?.total      ?? 0;
    const totalPages = data?.pagination?.totalPages ?? 0;
    const allUsers   = data?.data ?? [];
    const colSpan    = isSuperAdmin ? 6 : 5;

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/25">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                            Usuários
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {isLoading
                                ? "Carregando..."
                                : `${total} usuário${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}
                        </p>
                    </div>
                </div>

                {permissions.canManageUsers && (
                    <Button onClick={() => setCreateOpen(true)} className="flex-shrink-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo usuário
                    </Button>
                )}
            </div>

            {/* ── Card: filtros + tabela + paginação ── */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">

                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Buscar por nome ou e-mail..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>

                    <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Papel" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os papéis</SelectItem>
                            {filterRoleOptions.length > 0 && (
                                <>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel>Papéis fixos</SelectLabel>
                                        {filterRoleOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </>
                            )}
                            {activeCustomRoles.length > 0 && (
                                <>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel>Papéis personalizados</SelectLabel>
                                        {activeCustomRoles.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </>
                            )}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-full sm:w-[160px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectSeparator />
                            {Object.entries(STATUS_DISPLAY).map(([val, cfg]) => (
                                <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Usuário
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Papel
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Status
                                </th>
                                {isSuperAdmin && (
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        Empresa
                                    </th>
                                )}
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Último acesso
                                </th>
                                <th className="w-10 px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 animate-pulse">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                                                <div className="space-y-1.5">
                                                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-28" />
                                                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-36" />
                                                </div>
                                            </div>
                                        </td>
                                        {Array.from({ length: colSpan - 1 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-20" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : allUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-400 text-sm">
                                        {search || roleFilter !== "all" || statusFilter !== "all"
                                            ? "Nenhum usuário encontrado para os filtros aplicados."
                                            : "Nenhum usuário cadastrado ainda."}
                                    </td>
                                </tr>
                            ) : (
                                allUsers.map((user) => {
                                    const status   = STATUS_DISPLAY[user.status] ?? STATUS_DISPLAY.INACTIVE;
                                    const avatarBg = getAvatarColor(user.name);
                                    const initials = getInitials(user.name);

                                    return (
                                        <tr
                                            key={user.id}
                                            className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                        >
                                            {/* Usuário */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm select-none",
                                                        avatarBg
                                                    )}>
                                                        {initials}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                                                            {user.name}
                                                        </p>
                                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Papel */}
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                                    {displayRole(user)}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className={cn("text-xs", status.badge)}>
                                                    <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0", status.dot)} />
                                                    {status.label}
                                                </Badge>
                                            </td>

                                            {/* Empresa (super admin) */}
                                            {isSuperAdmin && (
                                                <td className="px-4 py-3">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                                        {user.company?.name ?? "—"}
                                                    </span>
                                                </td>
                                            )}

                                            {/* Último acesso */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {user.lastLoginAt ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <Clock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                                                        <span>
                                                            {new Date(user.lastLoginAt).toLocaleString("pt-BR", {
                                                                dateStyle: "short",
                                                                timeStyle: "short",
                                                            })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Nunca</span>
                                                )}
                                            </td>

                                            {/* Ações */}
                                            <td className="px-4 py-3">
                                                {permissions.canManageUsers && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="w-7 h-7">
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => setEditUser(user)}>
                                                                Editar
                                                            </DropdownMenuItem>
                                                            {canResetPassword && user.id !== currentUser?.id && (
                                                                <DropdownMenuItem onClick={() => setResetPasswordUser(user)}>
                                                                    Resetar senha
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => setDeleteUser(user)}
                                                            >
                                                                Remover
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500">
                        {isLoading
                            ? "Carregando..."
                            : `${total} usuário${total !== 1 ? "s" : ""} · Página ${page} de ${totalPages || 1}`}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1 || isLoading}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages || isLoading}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Drawer — Criar usuário ── */}
            <Drawer
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) { form.reset(); }
                }}
            >
                <DrawerContent>
                    <DrawerHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                                <UserIcon className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <DrawerTitle>Novo usuário</DrawerTitle>
                                <DrawerDescription>
                                    Preencha os dados para criar e dar acesso a um novo usuário.
                                </DrawerDescription>
                            </div>
                        </div>
                    </DrawerHeader>

                    <DrawerBody>
                        <form
                            id="create-user-form"
                            onSubmit={form.handleSubmit(handleCreate)}
                            className="space-y-7"
                        >
                            {/* ── Seção: Identificação ── */}
                            <FormSection icon={UserIcon} title="Identificação">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Label htmlFor="name">Nome completo</Label>
                                        <Input
                                            id="name"
                                            placeholder="Ex: João Silva"
                                            aria-invalid={!!form.formState.errors.name}
                                            className="mt-1.5"
                                            {...form.register("name")}
                                        />
                                        {form.formState.errors.name && (
                                            <p className="mt-1 text-xs font-medium text-destructive">
                                                {form.formState.errors.name.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="col-span-2">
                                        <Label htmlFor="email">E-mail</Label>
                                        <div className="relative mt-1.5">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="email@empresa.com"
                                                aria-invalid={!!form.formState.errors.email}
                                                className="pl-9"
                                                {...form.register("email")}
                                            />
                                        </div>
                                        {form.formState.errors.email && (
                                            <p className="mt-1 text-xs font-medium text-destructive">
                                                {form.formState.errors.email.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="phone">
                                            Telefone{" "}
                                            <span className="font-normal text-muted-foreground">(opcional)</span>
                                        </Label>
                                        <Input
                                            id="phone"
                                            placeholder="(51) 99999-9999"
                                            className="mt-1.5"
                                            {...form.register("phone")}
                                        />
                                    </div>
                                </div>
                            </FormSection>

                            <div className="border-t border-border" />

                            {/* ── Seção: Acesso e permissões ── */}
                            <FormSection icon={ShieldCheck} title="Acesso e permissões">
                                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                                    <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        O usuário receberá a senha padrão de primeiro acesso configurada em
                                        Configurações → Segurança e será obrigado a trocá-la no primeiro login.
                                    </p>
                                </div>

                                {/* Papel */}
                                <div>
                                    <Label>Papel</Label>
                                    <div className="mt-1.5 space-y-3">
                                        {allowedFixedRoles.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Papéis fixos
                                                </p>
                                                <div className="space-y-2">
                                                    {allowedFixedRoles.map((opt) => (
                                                        <RoleOptionCard
                                                            key={opt.value}
                                                            value={opt.value}
                                                            register={form.register}
                                                            label={opt.label}
                                                            description={FIXED_ROLE_DESCRIPTIONS[opt.value]}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {activeCustomRoles.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Papéis personalizados
                                                </p>
                                                <div className="space-y-2">
                                                    {activeCustomRoles.map((role) => (
                                                        <RoleOptionCard
                                                            key={role.id}
                                                            value={role.id}
                                                            register={form.register}
                                                            label={role.name}
                                                            description={role.description}
                                                            tags={role.permissions}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {form.formState.errors.papel && (
                                        <p className="mt-2 text-xs font-medium text-destructive">
                                            {form.formState.errors.papel.message}
                                        </p>
                                    )}
                                </div>
                            </FormSection>
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
                            form="create-user-form"
                            disabled={createUser.isPending}
                        >
                            {createUser.isPending && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Criar usuário
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <UserManagementSheets
                editUser={editUser}
                assignRoleUser={assignRoleUser}
                onEditUserChange={setEditUser}
                onAssignRoleUserChange={setAssignRoleUser}
            />

            {/* ── Confirmação de remoção ── */}
            <AlertDialog
                open={!!deleteUser}
                onOpenChange={(open: boolean) => !open && setDeleteUser(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover{" "}
                            <strong>{deleteUser?.name}</strong>? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteUserMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Remover"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Confirmação de reset de senha ── */}
            <AlertDialog
                open={!!resetPasswordUser}
                onOpenChange={(open: boolean) => !open && setResetPasswordUser(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Resetar senha</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{resetPasswordUser?.name}</strong> receberá a senha padrão de
                            primeiro acesso da empresa e será obrigado a trocá-la no próximo login.
                            As sessões ativas deste usuário serão encerradas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetPassword}>
                            {resetPasswordMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Resetar senha"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
