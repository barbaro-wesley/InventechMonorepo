"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Loader2,
  Building2,
  ClipboardList,
  Mail,
  FileText,
  Phone,
  MoreHorizontal,
  Users,
  Upload,
  ImageIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useClients, useCreateClient, useUpdateClient, useUploadClientLogo } from "@/hooks/clients/use-clients";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { cn } from "@/lib/utils";
import type { Client } from "@/types/client";

import { ClientUsersDrawer } from "@/components/clients/client-users-drawer";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const STATUS_CONFIG = {
  ACTIVE: {
    label: "Ativo",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accent: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  INACTIVE: {
    label: "Inativo",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    accent: "bg-slate-400",
    dot: "bg-slate-400",
  },
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createClientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  admin: z.object({
    name: z.string().min(1, "Nome do administrador obrigatório"),
    email: z.email("E-mail inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    phone: z.string().optional(),
  }),
});

const updateClientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type CreateClientForm = z.infer<typeof createClientSchema>;
type UpdateClientForm = z.infer<typeof updateClientSchema>;

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

// ---------------------------------------------------------------------------
// ClientCard
// ---------------------------------------------------------------------------

function ClientCard({
  client,
  onEdit,
  onManageUsers,
}: {
  client: Client;
  onEdit: () => void;
  onManageUsers: () => void;
}) {
  const status = STATUS_CONFIG[client.status];
  const avatarBg = getAvatarColor(client.name);
  const initials = getInitials(client.name);

  return (
    <div className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700">
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
                <DropdownMenuItem onClick={onEdit}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onManageUsers}>
                  Gerenciar usuários
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/clientes/${client.id}`}>Ver detalhes</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Name */}
        <div className="mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
            {client.name}
          </h3>
          {client.document && (
            <p className="text-xs text-slate-400 mt-0.5">{client.document}</p>
          )}
        </div>

        {/* Status */}
        <Badge variant="outline" className={cn("text-xs w-fit", status.badge)}>
          <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0", status.dot)} />
          {status.label}
        </Badge>

        {/* Contact */}
        <div className="mt-4 space-y-1.5 flex-1">
          {client.email && (
            <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
              <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Phone className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span>{client.phone}</span>
            </div>
          )}
          {!client.email && !client.phone && (
            <p className="text-xs text-slate-300 dark:text-slate-600 italic">
              Sem contato cadastrado
            </p>
          )}
        </div>
      </div>

      {/* Stats footer */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {client._count?.serviceOrders ?? 0}
          </span>
          <span className="text-slate-400 hidden sm:inline">ordens</span>
        </div>
        <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {client._count?.users ?? 0}
          </span>
          <span className="text-slate-400 hidden sm:inline">usuários</span>
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
// Página
// ---------------------------------------------------------------------------

export default function ClientesPage() {
  const permissions = usePermissions();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [clientLogoPreview, setClientLogoPreview] = useState<string | null>(null);
  const [manageUsersClient, setManageUsersClient] = useState<Client | null>(null);

  const { data, isLoading } = useClients({
    page,
    limit: 12,
    search: search || undefined,
  });

  const createClient = useCreateClient();
  const updateClient = useUpdateClient(editClient?.id ?? "");
  const uploadClientLogo = useUploadClientLogo(editClient?.id ?? "");

  const createForm = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      document: "",
      email: "",
      phone: "",
      status: "ACTIVE",
      address: { street: "", number: "", neighborhood: "", city: "", state: "", zip: "" },
      admin: { name: "", email: "", password: "", phone: "" },
    },
  });

  const updateForm = useForm<UpdateClientForm>({
    resolver: zodResolver(updateClientSchema),
  });

  function handleCreate(formData: CreateClientForm) {
    createClient.mutate(formData, {
      onSuccess: () => {
        setCreateOpen(false);
        createForm.reset();
      },
    });
  }

  function handleEdit(client: Client) {
    setEditClient(client);
    setClientLogoPreview(client.logoUrl ?? null);
    updateForm.reset({
      name: client.name,
      document: client.document ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      status: client.status,
    });
  }

  function handleClientLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setClientLogoPreview(URL.createObjectURL(file));
    uploadClientLogo.mutate(file);
  }

  function handleUpdate(formData: UpdateClientForm) {
    updateClient.mutate(formData, {
      onSuccess: () => {
        setEditClient(null);
        updateForm.reset();
      },
    });
  }

  if (!permissions.canManageClients) {
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
  const clients = data?.data ?? [];
  const hasFilters = !!search;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Clientes
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {!isLoading && total > 0
                ? `${total} cliente${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`
                : isLoading
                ? "Carregando..."
                : "Nenhum cliente cadastrado"}
            </p>
          </div>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Novo cliente
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Buscar cliente..."
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* ── Grid / states ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
            {hasFilters ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </h3>
          <p className="text-sm text-slate-400 max-w-xs">
            {hasFilters
              ? "Tente ajustar a busca."
              : "Comece cadastrando o primeiro cliente."}
          </p>
          {!hasFilters && (
            <Button size="sm" className="mt-5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={() => handleEdit(client)}
              onManageUsers={() => setManageUsersClient(client)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 pt-2">
          <span>Página {page} de {totalPages}</span>
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

      {/* ── Drawer — Criar cliente ── */}
      <Drawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) createForm.reset();
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Novo cliente</DrawerTitle>
            <DrawerDescription>
              Preencha os dados abaixo para cadastrar um novo cliente.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <form
              id="create-client-form"
              onSubmit={createForm.handleSubmit(handleCreate)}
              className="space-y-6"
            >
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Dados do cliente
                </p>
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    placeholder="Nome do cliente"
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
                    placeholder="contato@cliente.com"
                    className="mt-1.5"
                    {...createForm.register("email")}
                  />
                  {createForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-500">
                      {createForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Endereço
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="street">Rua</Label>
                    <Input
                      id="street"
                      placeholder="Av. Ipiranga"
                      className="mt-1.5"
                      {...createForm.register("address.street")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="number">Número</Label>
                    <Input
                      id="number"
                      placeholder="6690"
                      className="mt-1.5"
                      {...createForm.register("address.number")}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="Porto Alegre"
                      className="mt-1.5"
                      {...createForm.register("address.city")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      placeholder="RS"
                      maxLength={2}
                      className="mt-1.5"
                      {...createForm.register("address.state")}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="zip">CEP</Label>
                  <Input
                    id="zip"
                    placeholder="00000-000"
                    className="mt-1.5"
                    {...createForm.register("address.zip")}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Administrador do cliente
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Criado junto ao cliente. Poderá gerenciar usuários dentro da sua empresa.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="admin-name">Nome *</Label>
                    <Input
                      id="admin-name"
                      placeholder="Nome completo"
                      className="mt-1.5"
                      {...createForm.register("admin.name")}
                    />
                    {createForm.formState.errors.admin?.name && (
                      <p className="mt-1 text-xs text-red-500">
                        {createForm.formState.errors.admin.name.message}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="admin-email">E-mail *</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@cliente.com"
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
                    <Label htmlFor="admin-password">Senha *</Label>
                    <Input
                      id="admin-password"
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
                    <Label htmlFor="admin-phone">Telefone</Label>
                    <Input
                      id="admin-phone"
                      placeholder="(00) 0000-0000"
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
              form="create-client-form"
              disabled={createClient.isPending}
            >
              {createClient.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Criar cliente
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Drawer — Editar cliente ── */}
      <Drawer
        open={!!editClient}
        onOpenChange={(open) => {
          if (!open) {
            setEditClient(null);
            setClientLogoPreview(null);
            updateForm.reset();
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar cliente</DrawerTitle>
            <DrawerDescription>
              {editClient?.name}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <form
              id="update-client-form"
              onSubmit={updateForm.handleSubmit(handleUpdate)}
              className="space-y-4"
            >
              {/* Logo */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Logo
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-800">
                    {clientLogoPreview ? (
                      <img
                        src={clientLogoPreview}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div>
                    <Label
                      htmlFor="client-logo-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {uploadClientLogo.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploadClientLogo.isPending ? "Enviando..." : "Selecionar logo"}
                    </Label>
                    <input
                      id="client-logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="sr-only"
                      onChange={handleClientLogoChange}
                    />
                    <p className="mt-1 text-xs text-slate-400">PNG, JPG ou SVG — máx. 2MB</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  className="mt-1.5"
                  {...updateForm.register("name")}
                />
                {updateForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-500">
                    {updateForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-document">CNPJ</Label>
                  <Input
                    id="edit-document"
                    className="mt-1.5"
                    {...updateForm.register("document")}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <Input
                    id="edit-phone"
                    className="mt-1.5"
                    {...updateForm.register("phone")}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  className="mt-1.5"
                  {...updateForm.register("email")}
                />
                {updateForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-500">
                    {updateForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  defaultValue={editClient?.status}
                  onValueChange={(value) =>
                    updateForm.setValue("status", value as "ACTIVE" | "INACTIVE")
                  }
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
            </form>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditClient(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="update-client-form"
              disabled={updateClient.isPending}
            >
              {updateClient.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ClientUsersDrawer
        client={manageUsersClient}
        open={!!manageUsersClient}
        onOpenChange={(open) => !open && setManageUsersClient(null)}
      />
    </div>
  );
}
