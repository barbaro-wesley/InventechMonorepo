"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Loader2,
  Building2,
  ClipboardList,
  Mail,
  FileText,
  Phone,
  Users,
  Upload,
  ImageIcon,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useClients, useCreateClient, useUpdateClient, useUploadClientLogo } from "@/hooks/clients/use-clients";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { cn } from "@/lib/utils";
import type { Client } from "@/types/client";

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
    accent: "bg-slate-300 dark:bg-slate-600",
    dot: "bg-slate-400",
  },
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createClientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
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
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    phone: z.string().optional(),
  }),
});

const updateClientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
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
// ClientCard — clique no card navega para /clientes/[id]
// ---------------------------------------------------------------------------

function ClientCard({
  client,
  onEdit,
}: {
  client: Client;
  onEdit: (e: React.MouseEvent) => void;
}) {
  const router = useRouter();
  const status = STATUS_CONFIG[client.status];
  const avatarBg = getAvatarColor(client.name);
  const initials = getInitials(client.name);
  const isActive = client.status === "ACTIVE";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/clientes/${client.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/clientes/${client.id}`)}
      className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      {/* Status accent top bar */}
      <div className={cn("h-1 w-full flex-shrink-0", status.accent)} />

      <div className="p-5 flex-1 flex flex-col gap-4">

        {/* Avatar + Name + Edit button */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none shadow-sm",
              avatarBg
            )}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {client.name}
            </h3>
            {client.document && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{client.document}</p>
            )}
          </div>

          {/* Editar — parar propagação para não navegar */}
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
          >
            Editar
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={cn("text-xs w-fit", status.badge)}>
            <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0", status.dot)} />
            {status.label}
          </Badge>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all duration-150" />
        </div>

        {/* Contato */}
        <div className="space-y-1.5">
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
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {client._count?.serviceOrders ?? 0}
          </span>
          <span className="text-slate-400">ordens</span>
        </div>
        <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {client._count?.users ?? 0}
          </span>
          <span className="text-slate-400">usuários</span>
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
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
          </div>
        </div>
        <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse w-16" />
        <div className="space-y-2">
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-full" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-2/3" />
        </div>
      </div>
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// StatsBar — compacto e elegante
// ---------------------------------------------------------------------------

function StatsBar({ clients }: { clients: Client[] }) {
  const active = clients.filter((c) => c.status === "ACTIVE").length;
  const inactive = clients.length - active;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[
        {
          label: "Total",
          value: clients.length,
          icon: Building2,
          color: "text-slate-700 dark:text-slate-200",
          bg: "bg-slate-100 dark:bg-slate-800",
        },
        {
          label: "Ativos",
          value: active,
          icon: null,
          dot: "bg-emerald-500",
          color: "text-emerald-700 dark:text-emerald-400",
          bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
        },
        {
          label: "Inativos",
          value: inactive,
          icon: null,
          dot: "bg-slate-400",
          color: "text-slate-500 dark:text-slate-400",
          bg: "bg-slate-100 dark:bg-slate-800",
        },
      ].map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium",
            stat.bg
          )}
        >
          {"dot" in stat && stat.dot && (
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", stat.dot)} />
          )}
          <span className={cn("tabular-nums font-semibold", stat.color)}>
            {stat.value}
          </span>
          <span className="text-slate-400 dark:text-slate-500">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function ClientesPage() {
  const permissions = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [clientLogoPreview, setClientLogoPreview] = useState<string | null>(null);

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

  function handleEdit(client: Client, e: React.MouseEvent) {
    e.stopPropagation(); // impede navegação pelo card
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

  // Filtro de status local (os dados já vêm paginados, filtrar sobre o que tem)
  const allClients = data?.data ?? [];
  const clients =
    statusFilter === "ALL"
      ? allClients
      : allClients.filter((c) => c.status === statusFilter);

  const hasFilters = !!search || statusFilter !== "ALL";

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/25">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              Prestadores de Serviço
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isLoading
                ? "Carregando..."
                : total > 0
                  ? `${total} prestador${total !== 1 ? "es" : ""} cadastrado${total !== 1 ? "s" : ""}`
                  : "Nenhum prestador cadastrado"}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 transition-all duration-150"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Prestador
        </Button>
      </div>

      {/* ── Stats + Filtros (mesma linha quando há dados) ── */}
      {!isLoading && allClients.length > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <StatsBar clients={allClients} />

          <div className="flex gap-1.5 flex-shrink-0">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border",
                  statusFilter === s
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {s === "ALL" ? "Todos" : s === "ACTIVE" ? "Ativos" : "Inativos"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Busca ── */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nome, CNPJ..."
          className="pl-9 bg-white dark:bg-slate-900"
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
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {hasFilters ? "Nenhum prestador encontrado" : "Nenhum prestador cadastrado"}
          </h3>
          <p className="text-sm text-slate-400 max-w-xs">
            {hasFilters
              ? "Tente ajustar os filtros ou a busca."
              : "Cadastre o primeiro prestador para começar."}
          </p>
          {!hasFilters && (
            <Button
              size="sm"
              className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Prestador
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={(e) => handleEdit(client, e)}
            />
          ))}
        </div>
      )}

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs">
            Página{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{page}</span>
            {" "}de{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{totalPages}</span>
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
                      placeholder="1000"
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
                <div>
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
            <DrawerDescription>{editClient?.name}</DrawerDescription>
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

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                <div>
                  <Label htmlFor="edit-name">Nome *</Label>
                  <Input id="edit-name" className="mt-1.5" {...updateForm.register("name")} />
                  {updateForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-500">
                      {updateForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-document">CNPJ</Label>
                    <Input id="edit-document" className="mt-1.5" {...updateForm.register("document")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Telefone</Label>
                    <Input id="edit-phone" className="mt-1.5" {...updateForm.register("phone")} />
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
              </div>
            </form>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => setEditClient(null)}>
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
    </div>
  );
}