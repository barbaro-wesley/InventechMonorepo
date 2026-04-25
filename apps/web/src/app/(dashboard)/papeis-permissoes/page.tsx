"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Shield, ShieldCheck, RotateCcw, Check, X, Users,
  AlertTriangle, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  usePermissionMatrix, useUpsertPermission, useRemovePermission,
  useResetPermissions, useCustomRoles, useCreateCustomRole,
  useUpdateCustomRole, useDeleteCustomRole, useSetCustomRolePermissions,
} from "@/hooks/permissions/use-permissions";
import type { CustomRole, PermissionMatrixItem } from "@/services/permissions/permissions.service";
import { useCurrentUser } from "@/store/auth.store";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { useCompanies } from "@/hooks/companies/use-companies";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_SYSTEM_ROLES = [
  "SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER",
  "TECHNICIAN", "CLIENT_ADMIN", "CLIENT_USER", "CLIENT_VIEWER",
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Admin Empresa",
  COMPANY_MANAGER: "Gerente",
  TECHNICIAN: "Técnico",
  CLIENT_ADMIN: "Admin Prestador",
  CLIENT_USER: "Usuário Prestador",
  CLIENT_VIEWER: "Visualizador Prestador",
};

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700 border-red-200",
  COMPANY_ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  COMPANY_MANAGER: "bg-blue-100 text-blue-700 border-blue-200",
  TECHNICIAN: "bg-green-100 text-green-700 border-green-200",
  CLIENT_ADMIN: "bg-orange-100 text-orange-700 border-orange-200",
  CLIENT_USER: "bg-yellow-100 text-yellow-700 border-yellow-200",
  CLIENT_VIEWER: "bg-gray-100 text-gray-600 border-gray-200",
};

const RESOURCE_LABEL: Record<string, string> = {
  "equipment": "Equipamentos",
  "cost-center": "Centros de Custo",
  "location": "Localizações",
  "equipment-type": "Tipos de Equipamento",
  "movement": "Movimentos",
  "storage": "Arquivos",
  "user": "Usuários",
  "client": "Prestadores",
  "service-order": "Ordens de Serviço",
  "maintenance": "Manutenções",
  "maintenance-schedule": "Agend. Preventivos",
  "maintenance-group": "Grupos de Manutenção",
  "dashboard": "Dashboard",
  "report": "Relatórios",
  "permission": "Permissões",
  "custom-role": "Papéis Personalizados",
};

const ACTION_LABEL: Record<string, string> = {
  browse: "Navegar", list: "Listar", read: "Ver", create: "Criar", update: "Editar",
  delete: "Deletar", upload: "Upload", download: "Download",
  "upload-logo": "Upload Logo", assume: "Assumir", depreciation: "Depreciação",
  "update-status": "Alterar Status", "manage-techs": "Gerenciar Técnicos",
  comment: "Comentar", task: "Tarefas", return: "Devolver",
  trigger: "Disparar", "create-sub": "Criar Subtipo", "update-sub": "Editar Subtipo",
  "delete-sub": "Deletar Subtipo", company: "Empresa", platform: "Plataforma",
  client: "Cliente", "service-orders": "OS", equipment: "Equipamentos",
  preventive: "Preventivos", technicians: "Técnicos", financial: "Financeiro",
  manage: "Gerenciar", assign: "Atribuir",
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
});
type RoleForm = z.infer<typeof roleSchema>;

// ─── PermissionRow ────────────────────────────────────────────────────────────

function PermissionRow({ item }: { item: PermissionMatrixItem }) {
  const [expanded, setExpanded] = useState(false);
  const upsert = useUpsertPermission();
  const remove = useRemovePermission();
  const { isSuperAdmin } = usePermissions();

  function toggle(role: string) {
    const has = item.effectiveRoles.includes(role);
    // SUPER_ADMIN não pode ser removido
    if (role === "SUPER_ADMIN") return;
    const next = has
      ? item.effectiveRoles.filter((r) => r !== role)
      : [...item.effectiveRoles, role];
    upsert.mutate({ resource: item.resource, action: item.action, allowedRoles: next });
  }

  function resetToDefault() {
    remove.mutate({ resource: item.resource, action: item.action });
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{ACTION_LABEL[item.action] ?? item.action}</span>
          {item.isOverridden && (
            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 border">Customizado</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {item.effectiveRoles.filter((r) => r !== "SUPER_ADMIN").map((r) => (
            <span key={r} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLOR[r] ?? "bg-gray-100 text-gray-600"}`}>
              {ROLE_LABEL[r] ?? r}
            </span>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <div className="flex flex-wrap gap-2 mb-3">
            {ALL_SYSTEM_ROLES.map((role) => {
              const active = item.effectiveRoles.includes(role);
              const isLocked = role === "SUPER_ADMIN" || !isSuperAdmin;
              return (
                <button
                  key={role}
                  disabled={isLocked || upsert.isPending || remove.isPending}
                  onClick={() => toggle(role)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all
                    ${active
                      ? `${ROLE_COLOR[role]} opacity-100`
                      : "bg-white border-border text-muted-foreground opacity-60 hover:opacity-90"
                    }
                    ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  {active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {ROLE_LABEL[role]}
                  {role === "SUPER_ADMIN" && <Shield className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
          {item.isOverridden && isSuperAdmin && (
            <button
              onClick={resetToDefault}
              disabled={remove.isPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restaurar padrão
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ResourceSection ──────────────────────────────────────────────────────────

function ResourceSection({ resource, items }: { resource: string; items: PermissionMatrixItem[] }) {
  const [open, setOpen] = useState(false);
  const overrideCount = items.filter((i) => i.isOverridden).length;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-semibold text-sm">{RESOURCE_LABEL[resource] ?? resource}</span>
          <span className="text-xs text-muted-foreground">{items.length} ações</span>
          {overrideCount > 0 && (
            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 border">
              {overrideCount} customizada{overrideCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4 space-y-2">
          {items.map((item) => (
            <PermissionRow key={`${item.resource}:${item.action}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CustomRoleSheet ──────────────────────────────────────────────────────────

function CustomRoleSheet({
  open, editTarget, matrixResources, targetCompanyId, onClose,
}: {
  open: boolean;
  editTarget: CustomRole | null;
  matrixResources: Record<string, string[]>;
  targetCompanyId?: string;
  onClose: () => void;
}) {
  const create = useCreateCustomRole(targetCompanyId);
  const update = useUpdateCustomRole(editTarget?.id ?? "", targetCompanyId);
  const setPerms = useSetCustomRolePermissions(editTarget?.id ?? "", targetCompanyId);
  const isPending = create.isPending || update.isPending || setPerms.isPending;

  // Selected permissions as "resource:action" set
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (!editTarget) return new Set();
    return new Set(editTarget.permissions.map((p) => `${p.resource}:${p.action}`));
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    values: editTarget ? { name: editTarget.name, description: editTarget.description ?? "" } : { name: "", description: "" },
  });

  function togglePerm(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleResource(resource: string, actions: string[]) {
    const keys = actions.map((a) => `${resource}:${a}`);
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function handleClose() {
    reset();
    setSelected(new Set());
    onClose();
  }

  async function onSubmit(data: RoleForm) {
    const perms = [...selected].map((key) => {
      const [resource, ...rest] = key.split(":");
      return { resource, action: rest.join(":") };
    });

    if (editTarget) {
      update.mutate(
        { name: data.name, description: data.description || undefined },
        {
          onSuccess: async () => {
            await setPerms.mutateAsync(perms);
            handleClose();
          },
        },
      );
    } else {
      create.mutate(
        { name: data.name, description: data.description || undefined },
        {
          onSuccess: async (role) => {
            // After creation, set permissions on the newly created role
            await customRolesService_setPerms(role.id, perms);
            handleClose();
          },
        },
      );
    }
  }

  // Workaround: need direct service call for create flow since hook ID isn't set yet
  async function customRolesService_setPerms(id: string, perms: { resource: string; action: string }[]) {
    const { customRolesService } = await import("@/services/permissions/permissions.service");
    await customRolesService.setPermissions(id, perms, targetCompanyId);
  }

  const totalResources = Object.keys(matrixResources);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="overflow-y-auto" style={{ maxWidth: "680px", width: "100%" }}>
        <SheetHeader>
          <SheetTitle>{editTarget ? "Editar papel" : "Novo papel personalizado"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Defina o nome e quais ações este papel pode executar.
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          {/* Identificação */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do papel *</Label>
              <Input id="name" placeholder="Ex: Supervisor TI" className="mt-1" {...register("name")} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" placeholder="Descreva o propósito deste papel" className="mt-1" {...register("description")} />
            </div>
          </div>

          {/* Permissões */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold">Permissões</Label>
              <span className="text-xs text-muted-foreground">{selected.size} selecionada{selected.size !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {totalResources.map((resource) => {
                const actions = matrixResources[resource];
                const keys = actions.map((a) => `${resource}:${a}`);
                const checked = keys.filter((k) => selected.has(k)).length;
                const allChecked = checked === keys.length;
                const someChecked = checked > 0 && !allChecked;

                return (
                  <div key={resource} className="border border-border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleResource(resource, actions)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                        ${allChecked ? "bg-primary border-primary" : someChecked ? "bg-primary/30 border-primary" : "border-border bg-white"}`}
                      >
                        {(allChecked || someChecked) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-xs font-semibold">{RESOURCE_LABEL[resource] ?? resource}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{checked}/{keys.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                      {actions.map((action) => {
                        const key = `${resource}:${action}`;
                        const on = selected.has(key);
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => togglePerm(key)}
                            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all
                              ${on ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}
                          >
                            {ACTION_LABEL[action] ?? action}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : editTarget ? "Salvar" : "Criar papel"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PapeisPermissoesPage() {
  const [tab, setTab] = useState<"system" | "custom">("custom");
  const [roleSheet, setRoleSheet] = useState<{ open: boolean; target: CustomRole | null }>({ open: false, target: null });
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isCompanyAdmin = currentUser?.role === "COMPANY_ADMIN";
  // SUPER_ADMIN without a company needs to pick one; otherwise use their own
  const needsCompanySelector = isSuperAdmin && !currentUser?.companyId;
  const effectiveCompanyId = needsCompanySelector
    ? (selectedCompanyId || undefined)
    : (currentUser?.companyId ?? undefined);

  const { data: companiesPage } = useCompanies({ limit: 100 });
  const companies = companiesPage?.data ?? [];

  const { data: matrix, isLoading: matrixLoading } = usePermissionMatrix();
  const { data: customRoles = [], isLoading: rolesLoading } = useCustomRoles(effectiveCompanyId);
  const deleteRole = useDeleteCustomRole(effectiveCompanyId);
  const reset = useResetPermissions();

  // Group matrix by resource
  const grouped = matrix?.matrix.reduce<Record<string, PermissionMatrixItem[]>>((acc, item) => {
    if (!acc[item.resource]) acc[item.resource] = [];
    acc[item.resource].push(item);
    return acc;
  }, {}) ?? {};

  const totalOverrides = matrix?.matrix.filter((i) => i.isOverridden).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Papéis & Permissões
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure o que cada papel pode acessar na plataforma.
          </p>
        </div>
        {tab === "custom" && effectiveCompanyId && (isSuperAdmin || isCompanyAdmin) && (
          <Button onClick={() => setRoleSheet({ open: true, target: null })}>
            <Plus className="w-4 h-4 mr-2" />
            Novo papel
          </Button>
        )}
        {tab === "system" && totalOverrides > 0 && isSuperAdmin && (
          <Button variant="outline" onClick={() => setResetConfirm(true)}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar todos os padrões
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
        {[
          { key: "custom", label: "Papéis personalizados", icon: Users },
          { key: "system", label: "Permissões por papel de sistema", icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
              ${tab === key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Papéis personalizados ─────────────────────────────────────── */}
      {tab === "custom" && (
        <>
          {/* Company selector for SUPER_ADMIN without their own company */}
          {needsCompanySelector && (
            <div className="bg-white rounded-xl border border-border px-5 py-4 flex flex-wrap items-center gap-4">
              <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium mb-1">Selecione a empresa</p>
                <p className="text-xs text-muted-foreground">Gerencie os papéis personalizados de uma empresa específica.</p>
              </div>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-white w-full sm:w-auto sm:min-w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Selecione uma empresa...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Prompt to select company before showing roles */}
          {needsCompanySelector && !selectedCompanyId ? (
            <div className="bg-white rounded-xl border border-border py-16 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Selecione uma empresa acima</p>
              <p className="text-xs text-muted-foreground mt-1">Os papéis personalizados são criados por empresa.</p>
            </div>
          ) : rolesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-white border border-border animate-pulse" />)}
            </div>
          ) : customRoles.length === 0 ? (
            <div className="bg-white rounded-xl border border-border py-16 text-center">
              <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Nenhum papel personalizado criado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Crie papéis com permissões específicas e atribua a usuários.
              </p>
              {(isSuperAdmin || isCompanyAdmin) && (
                <Button className="mt-4" onClick={() => setRoleSheet({ open: true, target: null })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeiro papel
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {customRoles.map((role) => (
                <div key={role.id} className="bg-white rounded-xl border border-border px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{role.name}</span>
                      <Badge className={role.isActive ? "bg-green-100 text-green-700 border-green-200 border" : "bg-gray-100 text-gray-500 border border-gray-200"}>
                        {role.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <Users className="w-3 h-3 inline mr-0.5" />
                        {role._count.users} usuário{role._count.users !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mb-2">{role.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Sem permissões configuradas</span>
                      ) : (
                        <>
                          {role.permissions.slice(0, 6).map((p) => (
                            <span key={`${p.resource}:${p.action}`}
                              className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {RESOURCE_LABEL[p.resource] ?? p.resource}: {ACTION_LABEL[p.action] ?? p.action}
                            </span>
                          ))}
                          {role.permissions.length > 6 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              +{role.permissions.length - 6} mais
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {(isSuperAdmin || isCompanyAdmin) && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setRoleSheet({ open: true, target: role })}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget(role)}
                        disabled={role._count.users > 0}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Permissões de sistema ─────────────────────────────────────── */}
      {tab === "system" && (
        <>
          {/* Legend */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
              <div>
                <p className="font-semibold mb-0.5">Como funciona</p>
                <p className="text-xs text-blue-700">
                  Clique em uma ação para expandir e toggle os papéis que têm acesso.
                  Alterações ficam ativas imediatamente. Use "Restaurar padrão" por ação para reverter individualmente,
                  ou "Restaurar todos os padrões" para resetar tudo.
                  <strong className="ml-1">SUPER_ADMIN sempre tem acesso total e não pode ser removido.</strong>
                </p>
              </div>
            </div>
          </div>

          {totalOverrides > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {totalOverrides} permissão{totalOverrides > 1 ? "ões" : ""} com configuração personalizada
            </div>
          )}

          {matrixLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-white border border-border animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([resource, items]) => (
                <ResourceSection key={resource} resource={resource} items={items} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Sheet: criar/editar papel */}
      <CustomRoleSheet
        key={roleSheet.target?.id ?? "new"}
        open={roleSheet.open}
        editTarget={roleSheet.target}
        matrixResources={matrix?.resources ?? {}}
        targetCompanyId={effectiveCompanyId}
        onClose={() => setRoleSheet({ open: false, target: null })}
      />

      {/* Dialog: deletar papel */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover papel "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os usuários com este papel voltarão a usar o papel de sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { deleteRole.mutate(deleteTarget!.id); setDeleteTarget(null); }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: reset geral */}
      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar todas as permissões?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove todos os overrides e volta aos padrões do sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { reset.mutate(); setResetConfirm(false); }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
