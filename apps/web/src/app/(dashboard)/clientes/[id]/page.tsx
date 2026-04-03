"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  FileText,
  Users,
  ClipboardList,
  MapPin,
  Pencil,
  Loader2,
  Plus,
  MoreHorizontal,
  Trash2,
  UserCheck,
  Upload,
  ImageIcon,
  Save,
  CheckCircle2,
  XCircle,
  Wrench,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  useClient,
  useUpdateClient,
  useUploadClientLogo,
  useClientMaintenanceGroups,
  useAssignMaintenanceGroup,
  useRemoveMaintenanceGroup,
} from "@/hooks/clients/use-clients";
import { useMaintenanceGroups } from "@/hooks/maintenance-groups/use-maintenance-groups";
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
} from "@/hooks/users/use-users";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { UserManagementSheets, STATUS_CONFIG } from "@/components/users/user-management-sheets";
import { ROLE_LABELS } from "@/types/auth";
import type { User } from "@/types/user";
import type { Client } from "@/types/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500",
  "bg-orange-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
  "bg-pink-500", "bg-teal-500",
];

const CLIENT_STATUS_CONFIG = {
  ACTIVE: {
    label: "Ativo",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
  INACTIVE: {
    label: "Inativo",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    icon: XCircle,
    iconColor: "text-slate-400",
  },
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updateClientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reportName: z.string().optional(),
});

const createUserSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["CLIENT_ADMIN", "CLIENT_USER", "CLIENT_VIEWER"], {
    message: "O papel base é obrigatório.",
  }),
  phone: z.string().optional(),
});

type UpdateClientForm = z.infer<typeof updateClientSchema>;
type CreateUserForm = z.infer<typeof createUserSchema>;

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

// ---------------------------------------------------------------------------
// InfoField
// ---------------------------------------------------------------------------

function InfoField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <p className="text-sm text-slate-900 dark:text-slate-100">{value || "—"}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UsersTab
// ---------------------------------------------------------------------------

function UsersTab({ client }: { client: Client }) {
  const permissions = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [assignRoleUser, setAssignRoleUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data, isLoading } = useUsers({ clientId: client.id, limit: 100 });
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "" as any, phone: "" },
  });

  function handleCreate(formData: CreateUserForm) {
    createUser.mutate(
      {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone || undefined,
        clientId: client.id,
        companyId: client.companyId,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          createForm.reset();
        },
      }
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  const users = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {users.length} usuário{users.length !== 1 ? "s" : ""} vinculado{users.length !== 1 ? "s" : ""}
        </p>
        {permissions.canManageUsers && !createOpen && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo usuário
          </Button>
        )}
      </div>

      {/* Create form */}
      {createOpen && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold mb-4">Adicionar usuário</h4>
          <form id="create-client-user-form" onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="u-name">Nome *</Label>
                <Input id="u-name" className="mt-1.5" {...createForm.register("name")} />
                {createForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-500">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="u-email">E-mail *</Label>
                <Input id="u-email" type="email" className="mt-1.5" {...createForm.register("email")} />
                {createForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-500">{createForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="u-password">Senha *</Label>
                <Input id="u-password" type="password" placeholder="Mínimo 6 caracteres" className="mt-1.5" {...createForm.register("password")} />
                {createForm.formState.errors.password && (
                  <p className="mt-1 text-xs text-red-500">{createForm.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="u-role">Papel *</Label>
                <Select
                  value={createForm.watch("role")}
                  onValueChange={(v) => createForm.setValue("role", v as CreateUserForm["role"])}
                >
                  <SelectTrigger id="u-role" className="mt-1.5">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLIENT_ADMIN">Admin do Cliente</SelectItem>
                    <SelectItem value="CLIENT_USER">Usuário do Cliente</SelectItem>
                    <SelectItem value="CLIENT_VIEWER">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
                {createForm.formState.errors.role && (
                  <p className="mt-1 text-xs text-red-500">{createForm.formState.errors.role.message}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="u-phone">Telefone</Label>
                <Input id="u-phone" placeholder="(00) 90000-0000" className="mt-1.5" {...createForm.register("phone")} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button size="sm" type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum usuário vinculado</p>
          <p className="text-xs text-slate-400 mt-1">Adicione o primeiro usuário deste cliente.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((user) => {
              const statusCfg = STATUS_CONFIG[user.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.INACTIVE;
              return (
                <div key={user.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
                      getAvatarColor(user.name)
                    )}>
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span className="truncate">{user.email}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="outline" className={cn("text-xs hidden sm:inline-flex", statusCfg.className)}>
                      {statusCfg.label}
                    </Badge>
                    {permissions.canManageUsers && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(user)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAssignRoleUser(user)}>Atribuir papel</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(user)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <UserManagementSheets
        editUser={editUser}
        assignRoleUser={assignRoleUser}
        onEditUserChange={setEditUser}
        onAssignRoleUserChange={setAssignRoleUser}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover <strong>{deleteTarget?.name}</strong>? Esta ação impedirá o acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              {deleteUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsTab
// ---------------------------------------------------------------------------

function SettingsTab({ client }: { client: Client }) {
  const updateClient = useUpdateClient(client.id);
  const uploadLogo = useUploadClientLogo(client.id);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<UpdateClientForm>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      name: client.name,
      document: client.document ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      status: client.status as "ACTIVE" | "INACTIVE",
      reportName: (client as any).reportName ?? "",
    },
  });

  function handleSave(data: UpdateClientForm) {
    updateClient.mutate({
      name: data.name,
      document: data.document || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      status: data.status,
    });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogo.mutate(file);
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Logo section */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Logo do cliente</h3>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800 overflow-hidden flex-shrink-0">
            {(client as any).logoUrl ? (
              <img src={(client as any).logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">PNG, JPG, WEBP ou SVG. Máx. 2MB.</p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadLogo.isPending}
            >
              {uploadLogo.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {uploadLogo.isPending ? "Enviando..." : "Fazer upload"}
            </Button>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Dados cadastrais</h3>
        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="s-name">Nome *</Label>
              <Input id="s-name" className="mt-1.5" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="s-document">CNPJ / CPF</Label>
              <Input id="s-document" className="mt-1.5" {...form.register("document")} />
            </div>
            <div>
              <Label htmlFor="s-email">E-mail</Label>
              <Input id="s-email" type="email" className="mt-1.5" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="s-phone">Telefone</Label>
              <Input id="s-phone" className="mt-1.5" {...form.register("phone")} />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as "ACTIVE" | "INACTIVE")}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="INACTIVE">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={updateClient.isPending}>
              {updateClient.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton header
// ---------------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <div className="flex items-start gap-6">
      <Skeleton className="w-20 h-20 rounded-2xl flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupsTab
// ---------------------------------------------------------------------------

function GroupsTab({ clientId }: { clientId: string }) {
  const { data: assigned = [], isLoading: assignedLoading } = useClientMaintenanceGroups(clientId);
  const { data: allGroups = [], isLoading: groupsLoading } = useMaintenanceGroups({ isActive: true });
  const assign = useAssignMaintenanceGroup(clientId);
  const remove = useRemoveMaintenanceGroup(clientId);

  const assignedGroupIds = new Set(assigned.map((a) => a.group.id));
  const available = allGroups.filter((g) => !assignedGroupIds.has(g.id));

  const isLoading = assignedLoading || groupsLoading;

  return (
    <div className="space-y-6">
      {/* Grupos vinculados */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Grupos vinculados
          <span className="ml-2 text-xs font-normal text-slate-400">
            Definem quais tipos de equipamento este cliente pode visualizar
          </span>
        </h3>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />)}
          </div>
        ) : assigned.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-10 text-center">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum grupo vinculado</p>
            <p className="text-xs text-slate-400 mt-1">Vincule um grupo abaixo para liberar acesso aos equipamentos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assigned.map((a) => (
              <div
                key={a.group.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: a.group.color ?? "#94a3b8" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.group.name}</p>
                  {a.group.description && (
                    <p className="text-xs text-slate-500 truncate">{a.group.description}</p>
                  )}
                  {a.group.equipmentTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.group.equipmentTypes.map((t) => (
                        <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(a.group.id)}
                  className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Remover vínculo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar grupo */}
      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Adicionar grupo</h3>
          <div className="space-y-2">
            {available.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: g.color ?? "#94a3b8" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{g.name}</p>
                  {g.description && (
                    <p className="text-xs text-slate-500 truncate">{g.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={assign.isPending}
                  onClick={() => assign.mutate(g.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Vincular
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState("overview");

  const { data: client, isLoading, error } = useClient(id);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="text-slate-500">Cliente não encontrado ou sem permissão de acesso.</p>
        <Button variant="outline" onClick={() => router.push("/clientes")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const status = client ? CLIENT_STATUS_CONFIG[client.status as keyof typeof CLIENT_STATUS_CONFIG] ?? CLIENT_STATUS_CONFIG.INACTIVE : null;
  const avatarBg = client ? getAvatarColor(client.name) : "bg-slate-300";
  const initials = client ? getInitials(client.name) : "";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Back nav */}
      <div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para clientes
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Top accent */}
        <div className={cn("h-1.5 w-full", status?.dot ? `bg-${status.dot.replace("bg-", "")}` : "bg-slate-300")} />

        <div className="p-6">
          {isLoading ? (
            <HeaderSkeleton />
          ) : client ? (
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Avatar / Logo */}
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 select-none overflow-hidden",
                (client as any).logoUrl ? "bg-white border border-slate-200" : avatarBg
              )}>
                {(client as any).logoUrl ? (
                  <img src={(client as any).logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  initials
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{client.name}</h1>
                  {status && (
                    <Badge variant="outline" className={cn("text-xs shrink-0", status.badge)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block", status.dot)} />
                      {status.label}
                    </Badge>
                  )}
                </div>

                {client.document && (
                  <p className="text-sm text-slate-500 mb-3">{client.document}</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  {client.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {client.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-3 flex-shrink-0">
                <div className="text-center sm:text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{client._count?.users ?? 0}</p>
                  <p className="text-xs text-slate-400">usuários</p>
                </div>
                <div className="w-px h-8 sm:w-full sm:h-px bg-slate-100 dark:bg-slate-800" />
                <div className="text-center sm:text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{client._count?.serviceOrders ?? 0}</p>
                  <p className="text-xs text-slate-400">ordens de serviço</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-100 dark:bg-slate-800/50 w-full sm:w-auto">
          <TabsTrigger value="overview" className="gap-2">
            <Building2 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Usuários
            {client && (client._count?.users ?? 0) > 0 && (
              <span className="ml-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-full px-1.5 py-0.5 font-medium">
                {client._count?.users ?? 0}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Ordens de Serviço
            {client && (client._count?.serviceOrders ?? 0) > 0 && (
              <span className="ml-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-full px-1.5 py-0.5 font-medium">
                {client._count?.serviceOrders ?? 0}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <Wrench className="w-4 h-4" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Pencil className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-6">
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : client ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Informações Gerais</h2>
                <div className="grid sm:grid-cols-2 gap-5">
                  <InfoField label="Nome" value={client.name} icon={Building2} />
                  <InfoField label="Documento (CNPJ/CPF)" value={client.document} icon={FileText} />
                  <InfoField label="E-mail" value={client.email} icon={Mail} />
                  <InfoField label="Telefone" value={client.phone} icon={Phone} />
                  <InfoField label="Cadastrado em" value={formatDate(client.createdAt as any)} icon={ClipboardList} />
                  <InfoField label="Última atualização" value={formatDate(client.updatedAt as any)} icon={ClipboardList} />
                </div>
              </div>

              {(client as any).address && (
                <>
                  <div className="border-t border-slate-100 dark:border-slate-800" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      Endereço
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-5">
                      {Object.entries((client as any).address as Record<string, string>).map(([k, v]) => (
                        <InfoField key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-6">
          {client ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <UsersTab client={client} />
            </div>
          ) : isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : null}
        </TabsContent>

        {/* Service Orders */}
        <TabsContent value="orders" className="mt-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="py-16 text-center">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">Ordens de Serviço</p>
              <p className="text-xs text-slate-400 mt-1">
                {client
                  ? (client._count?.serviceOrders ?? 0) > 0
                    ? `${client._count?.serviceOrders} ordens vinculadas a este cliente.`
                    : "Nenhuma ordem de serviço vinculada a este cliente."
                  : "Carregando..."}
              </p>
              <Link href={`/ordens-de-servico?clientId=${id}`}>
                <Button variant="outline" size="sm" className="mt-4">
                  Ver ordens de serviço
                </Button>
              </Link>
            </div>
          </div>
        </TabsContent>

        {/* Grupos de Manutenção */}
        <TabsContent value="groups" className="mt-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            {client ? (
              <GroupsTab clientId={client.id} />
            ) : isLoading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : null}
          </div>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-6">
          {client ? (
            <SettingsTab client={client} />
          ) : isLoading ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
