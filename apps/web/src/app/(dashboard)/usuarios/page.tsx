"use client";

import { useState } from "react";
import { Plus, Search, MoreHorizontal, Loader2, Clock, Users, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useUsers, useCreateUser, useDeleteUser } from "@/hooks/users/use-users";
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
    password: z.string().min(6, "Mínimo 6 caracteres"),
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
// PapelCallout — descrição contextual após a seleção do papel
// ---------------------------------------------------------------------------

function PapelCallout({
    papel,
    fixedRoleValues,
    customRoles,
}: {
    papel: string;
    fixedRoleValues: Set<string>;
    customRoles: { id: string; name: string; description?: string | null; permissions: { resource: string; action: string }[] }[];
}) {
    if (!papel) return null;

    if (fixedRoleValues.has(papel)) {
        const desc = FIXED_ROLE_DESCRIPTIONS[papel];
        if (!desc) return null;
        return (
            <div className="mt-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2.5">
                <p className="text-xs text-slate-600 dark:text-slate-400">{desc}</p>
            </div>
        );
    }

    const custom = customRoles.find((r) => r.id === papel);
    if (!custom) return null;

    return (
        <div className="mt-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2.5 space-y-2">
            {custom.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400">{custom.description}</p>
            )}
            {custom.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {custom.permissions.slice(0, 10).map((p) => (
                        <span
                            key={`${p.resource}:${p.action}`}
                            className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
                        >
                            {p.resource}:{p.action}
                        </span>
                    ))}
                    {custom.permissions.length > 10 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            +{custom.permissions.length - 10}
                        </span>
                    )}
                </div>
            )}
        </div>
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
    const [showPassword, setShowPassword] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [deleteUser, setDeleteUser] = useState<User | null>(null);
    const [assignRoleUser, setAssignRoleUser] = useState<User | null>(null);

    const { data, isLoading } = useUsers({
        page,
        limit: 10,
        search: search || undefined,
        role:   roleFilter   !== "all" ? (roleFilter   as any) : undefined,
        status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    });
    const createUser        = useCreateUser();
    const deleteUserMutation = useDeleteUser();

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
        defaultValues: { name: "", email: "", password: "", phone: "", papel: "" },
    });

    function handleCreate(formData: CreateUserForm) {
        const { papel, ...rest } = formData;
        const isFixedRole = FIXED_ROLE_VALUES.has(papel);
        createUser.mutate(
            { ...rest, ...(isFixedRole ? { role: papel } : { customRoleId: papel }) } as any,
            { onSuccess: () => { setCreateOpen(false); form.reset(); } }
        );
    }

    function handleDelete() {
        if (!deleteUser) return;
        deleteUserMutation.mutate(deleteUser.id, { onSuccess: () => setDeleteUser(null) });
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
                    if (!open) { form.reset(); setShowPassword(false); }
                }}
            >
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Novo usuário</DrawerTitle>
                        <DrawerDescription>
                            Preencha os dados para criar e dar acesso a um novo usuário.
                        </DrawerDescription>
                    </DrawerHeader>

                    <DrawerBody>
                        <form
                            id="create-user-form"
                            onSubmit={form.handleSubmit(handleCreate)}
                            className="space-y-6"
                        >
                            {/* ── Seção: Identificação ── */}
                            <fieldset className="space-y-4">
                                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Identificação
                                </legend>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Label htmlFor="name">Nome completo</Label>
                                        <Input
                                            id="name"
                                            placeholder="Ex: João Silva"
                                            className="mt-1.5"
                                            {...form.register("name")}
                                        />
                                        {form.formState.errors.name && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {form.formState.errors.name.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="col-span-2">
                                        <Label htmlFor="email">E-mail</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="email@empresa.com"
                                            className="mt-1.5"
                                            {...form.register("email")}
                                        />
                                        {form.formState.errors.email && (
                                            <p className="mt-1 text-xs text-red-500">
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
                            </fieldset>

                            <div className="border-t border-slate-100 dark:border-slate-800" />

                            {/* ── Seção: Acesso e permissões ── */}
                            <fieldset className="space-y-4">
                                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Acesso e permissões
                                </legend>

                                {/* Senha com toggle */}
                                <div>
                                    <Label htmlFor="password">Senha de acesso</Label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Mínimo 6 caracteres"
                                            className="pr-10"
                                            {...form.register("password")}
                                        />
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                        >
                                            {showPassword
                                                ? <EyeOff className="w-4 h-4" />
                                                : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {form.formState.errors.password ? (
                                        <p className="mt-1 text-xs text-red-500">
                                            {form.formState.errors.password.message}
                                        </p>
                                    ) : (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            O usuário pode alterar a senha após o primeiro acesso.
                                        </p>
                                    )}
                                </div>

                                {/* Papel */}
                                <div>
                                    <Label>Papel</Label>
                                    <Select
                                        value={form.watch("papel")}
                                        onValueChange={(v) =>
                                            form.setValue("papel", v, { shouldValidate: true })
                                        }
                                    >
                                        <SelectTrigger className="mt-1.5">
                                            <SelectValue placeholder="Selecione o papel" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allowedFixedRoles.length > 0 && (
                                                <SelectGroup>
                                                    <SelectLabel>Papéis fixos</SelectLabel>
                                                    {allowedFixedRoles.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )}
                                            {activeCustomRoles.length > 0 && (
                                                <>
                                                    {allowedFixedRoles.length > 0 && <SelectSeparator />}
                                                    <SelectGroup>
                                                        <SelectLabel>Papéis personalizados</SelectLabel>
                                                        {activeCustomRoles.map((role) => (
                                                            <SelectItem key={role.id} value={role.id}>
                                                                {role.name}
                                                                {role.description && (
                                                                    <span className="text-xs text-muted-foreground ml-1.5">
                                                                        — {role.description}
                                                                    </span>
                                                                )}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {form.formState.errors.papel && (
                                        <p className="mt-1 text-xs text-red-500">
                                            {form.formState.errors.papel.message}
                                        </p>
                                    )}

                                    {/* Callout: descrição do papel selecionado */}
                                    <PapelCallout
                                        papel={form.watch("papel")}
                                        fixedRoleValues={FIXED_ROLE_VALUES}
                                        customRoles={activeCustomRoles}
                                    />
                                </div>
                            </fieldset>
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
        </div>
    );
}
