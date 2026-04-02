"use client";

import { useState } from "react";
import { Plus, Search, MoreHorizontal, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useUsers, useCreateUser, useDeleteUser } from "@/hooks/users/use-users";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { useCustomRoles, useAssignCustomRole } from "@/hooks/permissions/use-permissions";
import { useCurrentUser } from "@/store/auth.store";
import { ROLE_LABELS } from "@/types/auth";
import type { User } from "@/types/user";
import type { Role } from "@/types/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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

// Papéis de sistema que cada papel pode atribuir (hierarquia)
const ALL_ROLE_OPTIONS: { value: Role; label: string; forRoles: Role[] }[] = [
    { value: "SUPER_ADMIN",     label: "Super Admin",        forRoles: [] }, // ninguém pode atribuir SUPER_ADMIN via UI
    { value: "COMPANY_ADMIN",   label: "Administrador",      forRoles: ["SUPER_ADMIN"] },
    { value: "COMPANY_MANAGER", label: "Gerente",            forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN"] },
    { value: "TECHNICIAN",      label: "Técnico",            forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"] },
    { value: "CLIENT_ADMIN",    label: "Admin do Cliente",   forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"] },
    { value: "CLIENT_USER",     label: "Usuário do Cliente", forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"] },
    { value: "CLIENT_VIEWER",   label: "Visualizador",       forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"] },
];

const STATUS_CONFIG = {
    ACTIVE:     { label: "Ativo",           className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    INACTIVE:   { label: "Inativo",         className: "bg-slate-100 text-slate-600 border-slate-200" },
    SUSPENDED:  { label: "Suspenso",        className: "bg-orange-50 text-orange-700 border-orange-200" },
    UNVERIFIED: { label: "Não verificado",  className: "bg-amber-50 text-amber-700 border-amber-200" },
    BLOCKED:    { label: "Bloqueado",       className: "bg-red-50 text-red-700 border-red-200" },
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
    name: z.string().min(1, "Nome obrigatório"),
    email: z.email("E-mail inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    role: z.enum([
        "COMPANY_ADMIN",
        "COMPANY_MANAGER",
        "TECHNICIAN",
        "CLIENT_ADMIN",
        "CLIENT_USER",
        "CLIENT_VIEWER",
    ]),
    customRoleId: z.string().optional(),
    phone: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function UsuariosPage() {
    const permissions = usePermissions();
    const currentUser = useCurrentUser();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteUser, setDeleteUser] = useState<User | null>(null);
    const [assignRoleUser, setAssignRoleUser] = useState<User | null>(null);
    const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>("");

    const { data, isLoading } = useUsers({ page, limit: 10, search: search || undefined });
    const createUser = useCreateUser();
    const deleteUserMutation = useDeleteUser();
    const assignCustomRole = useAssignCustomRole();

    // Custom roles da empresa — "" desabilita a query (SUPER_ADMIN sem empresa)
    const effectiveTenantId = currentUser?.tenantId || "";
    const { data: customRoles = [] } = useCustomRoles(effectiveTenantId);
    const activeCustomRoles = customRoles.filter((r) => r.isActive);

    // Papéis de sistema disponíveis para o usuário atual (hierarquia)
    const roleOptions = ALL_ROLE_OPTIONS.filter(
        (opt) => permissions.role && opt.forRoles.includes(permissions.role as Role)
    );

    const form = useForm<CreateUserForm>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { name: "", email: "", password: "", phone: "", customRoleId: "" },
    });

    function handleCreate(formData: CreateUserForm) {
        const { customRoleId, ...userDto } = formData;
        createUser.mutate(userDto, {
            onSuccess: (created) => {
                // Se papel personalizado selecionado, atribuir logo após criar
                if (customRoleId && created?.id) {
                    assignCustomRole.mutate(
                        { userId: created.id, customRoleId },
                        { onSettled: () => { setCreateOpen(false); form.reset(); } }
                    );
                } else {
                    setCreateOpen(false);
                    form.reset();
                }
            },
        });
    }

    function handleDelete() {
        if (!deleteUser) return;
        deleteUserMutation.mutate(deleteUser.id, {
            onSuccess: () => setDeleteUser(null),
        });
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Usuários
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {data?.pagination?.total ?? 0} usuário{data?.pagination?.total !== 1 ? "s" : ""} cadastrado{data?.pagination?.total !== 1 ? "s" : ""}
                    </p>
                </div>
                {permissions.canManageUsers && (
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo usuário
                    </Button>
                )}
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por nome ou e-mail..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Tabela */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                            <TableHead>Usuário</TableHead>
                            <TableHead>Perfil</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="w-10" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                                </TableCell>
                            </TableRow>
                        ) : (data?.data?.length ?? 0) === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                                    Nenhum usuário encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data?.map((user) => {
                                const status = STATUS_CONFIG[user.status];
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                                        {getInitials(user.name)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {user.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                                    {ROLE_LABELS[user.role]}
                                                </span>
                                                {user.customRoleId && (
                                                    <span className="text-xs text-primary font-medium">
                                                        {customRoles.find((r) => r.id === user.customRoleId)?.name ?? "Papel personalizado"}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn("text-xs", status.className)}
                                            >
                                                {status.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-500">
                                                {user.phone ?? "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {permissions.canManageUsers && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="w-8 h-8">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setAssignRoleUser(user);
                                                                setSelectedCustomRoleId(user.customRoleId ?? "");
                                                            }}
                                                        >
                                                            Atribuir papel personalizado
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
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Paginação */}
            {data && (data.pagination?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>
                        Página {page} de {data.pagination?.totalPages}
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
                            disabled={page === data.pagination?.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            )}

            {/* Drawer — Criar usuário */}
            <Drawer
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) form.reset();
                }}
            >
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Novo usuário</DrawerTitle>
                        <DrawerDescription>
                            Preencha os dados para cadastrar um novo usuário.
                        </DrawerDescription>
                    </DrawerHeader>

                    <DrawerBody>
                        <form
                            id="create-user-form"
                            onSubmit={form.handleSubmit(handleCreate)}
                            className="space-y-4"
                        >
                            <div>
                                <Label htmlFor="name">Nome</Label>
                                <Input
                                    id="name"
                                    placeholder="Nome completo"
                                    className="mt-1.5"
                                    {...form.register("name")}
                                />
                                {form.formState.errors.name && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.formState.errors.name.message}
                                    </p>
                                )}
                            </div>

                            <div>
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
                                <Label htmlFor="password">Senha</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Mín. 6 caracteres"
                                    className="mt-1.5"
                                    {...form.register("password")}
                                />
                                {form.formState.errors.password && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.formState.errors.password.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="role">Papel de sistema</Label>
                                <Select
                                    onValueChange={(value: string) =>
                                        form.setValue("role", value as CreateUserForm["role"])
                                    }
                                >
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="Selecione o papel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel className="text-xs text-muted-foreground">Papéis de sistema</SelectLabel>
                                            {roleOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {form.formState.errors.role && (
                                    <p className="mt-1 text-xs text-red-500">
                                        {form.formState.errors.role.message}
                                    </p>
                                )}
                            </div>

                            {activeCustomRoles.length > 0 && (
                                <div>
                                    <Label htmlFor="customRoleId">Papel personalizado <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                                    <Select
                                        onValueChange={(value: string) =>
                                            form.setValue("customRoleId", value === "_none" ? "" : value)
                                        }
                                    >
                                        <SelectTrigger className="mt-1.5">
                                            <SelectValue placeholder="Nenhum (usar papel de sistema)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_none">Nenhum</SelectItem>
                                            <SelectSeparator />
                                            <SelectGroup>
                                                <SelectLabel className="text-xs text-muted-foreground">Papéis personalizados</SelectLabel>
                                                {activeCustomRoles.map((role) => (
                                                    <SelectItem key={role.id} value={role.id}>
                                                        <div>
                                                            <span>{role.name}</span>
                                                            {role.description && (
                                                                <span className="text-xs text-muted-foreground ml-1.5">— {role.description}</span>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        O papel personalizado substitui as permissões do papel de sistema.
                                    </p>
                                </div>
                            )}

                            <div>
                                <Label htmlFor="phone">Telefone (opcional)</Label>
                                <Input
                                    id="phone"
                                    placeholder="(51) 99999-9999"
                                    className="mt-1.5"
                                    {...form.register("phone")}
                                />
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

            {/* Sheet — Atribuir papel personalizado */}
            <Sheet
                open={!!assignRoleUser}
                onOpenChange={(open) => { if (!open) setAssignRoleUser(null); }}
            >
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Papel personalizado</SheetTitle>
                        <p className="text-sm text-muted-foreground">
                            Atribua um papel personalizado para <strong>{assignRoleUser?.name}</strong>.
                            O papel personalizado substitui as permissões do papel de sistema.
                        </p>
                    </SheetHeader>

                    <div className="mt-6 space-y-4">
                        <div>
                            <Label>Papel personalizado</Label>
                            <Select
                                value={selectedCustomRoleId}
                                onValueChange={setSelectedCustomRoleId}
                            >
                                <SelectTrigger className="mt-1.5">
                                    <SelectValue placeholder="Nenhum (usar papel de sistema)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Nenhum (usar papel de sistema)</SelectItem>
                                    {customRoles.filter((r) => r.isActive).map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            {role.name}
                                            {role.description && (
                                                <span className="text-muted-foreground ml-1 text-xs">— {role.description}</span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!effectiveCompanyId && (
                                <p className="text-xs text-amber-600 mt-2">
                                    Sua conta SUPER_ADMIN não está vinculada a uma empresa. Papéis personalizados são criados por empresa.
                                </p>
                            )}
                            {effectiveCompanyId && customRoles.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Nenhum papel personalizado criado. Crie papéis em{" "}
                                    <a href="/papeis-permissoes" className="text-primary underline">Papéis & Permissões</a>.
                                </p>
                            )}
                        </div>

                        {selectedCustomRoleId && (() => {
                            const role = customRoles.find((r) => r.id === selectedCustomRoleId);
                            if (!role || role.permissions.length === 0) return null;
                            return (
                                <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Permissões deste papel ({role.permissions.length})</p>
                                    <div className="flex flex-wrap gap-1">
                                        {role.permissions.slice(0, 12).map((p) => (
                                            <span key={`${p.resource}:${p.action}`} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                                {p.resource}:{p.action}
                                            </span>
                                        ))}
                                        {role.permissions.length > 12 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{role.permissions.length - 12}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <SheetFooter className="mt-6">
                        <Button variant="outline" onClick={() => setAssignRoleUser(null)}>Cancelar</Button>
                        <Button
                            disabled={assignCustomRole.isPending}
                            onClick={() => {
                                if (!assignRoleUser) return;
                                assignCustomRole.mutate(
                                    { userId: assignRoleUser.id, customRoleId: selectedCustomRoleId || null },
                                    { onSuccess: () => setAssignRoleUser(null) }
                                );
                            }}
                        >
                            {assignCustomRole.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Confirmação de remoção */}
            <AlertDialog
                open={!!deleteUser}
                onOpenChange={(open: boolean) => !open && setDeleteUser(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover{" "}
                            <strong>{deleteUser?.name}</strong>? Esta ação não pode ser
                            desfeita.
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
