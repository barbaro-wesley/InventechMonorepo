"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useUpdateUser } from "@/hooks/users/use-users";
import { useAssignCustomRole, useCustomRoles } from "@/hooks/permissions/use-permissions";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { useCurrentUser } from "@/store/auth.store";
import { ROLE_LABELS } from "@/types/auth";
import type { User, UpdateUserDto } from "@/types/user";
import type { Role } from "@/types/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ALL_ROLE_OPTIONS: { value: Role; label: string; forRoles: Role[] }[] = [
  { value: "SUPER_ADMIN",     label: "Super Admin",        forRoles: [] },
  { value: "COMPANY_ADMIN",   label: "Administrador",      forRoles: ["SUPER_ADMIN"] },
  { value: "COMPANY_MANAGER", label: "Gerente",            forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN"] },
  { value: "TECHNICIAN",      label: "Técnico",            forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"] },
  { value: "CLIENT_ADMIN",    label: "Admin do Cliente",   forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"] },
  { value: "CLIENT_USER",     label: "Usuário do Cliente", forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"] },
  { value: "CLIENT_VIEWER",   label: "Visualizador",       forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"] },
  { value: "MEMBER",          label: "Membro",             forRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"] },
];

export const STATUS_CONFIG = {
  ACTIVE:     { label: "Ativo",           className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  INACTIVE:   { label: "Inativo",         className: "bg-slate-100 text-slate-600 border-slate-200" },
  SUSPENDED:  { label: "Suspenso",        className: "bg-orange-50 text-orange-700 border-orange-200" },
  UNVERIFIED: { label: "Não verificado",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  BLOCKED:    { label: "Bloqueado",       className: "bg-red-50 text-red-700 border-red-200" },
};

function EditUserForm({
  user,
  roleOptions,
  isPending,
  onSave,
  onCancel,
}: {
  user: User;
  roleOptions: { value: Role; label: string }[];
  isPending: boolean;
  onSave: (dto: UpdateUserDto) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [status, setStatus] = useState<UpdateUserDto["status"]>(user.status);
  const [role, setRole] = useState<Role>(user.role as Role);

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
    setStatus(user.status);
    setRole(user.role as Role);
  }, [user]);

  return (
    <div className="mt-6 space-y-4">
      <div>
        <Label htmlFor="edit-name">Nome</Label>
        <Input id="edit-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="edit-phone">Telefone</Label>
        <Input id="edit-phone" className="mt-1.5" placeholder="(51) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as UpdateUserDto["status"])}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Papel de sistema</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!roleOptions.find((o) => o.value === role) && (
              <SelectItem value={role}>{ROLE_LABELS[role as keyof typeof ROLE_LABELS]}</SelectItem>
            )}
            {roleOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SheetFooter className="pt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button disabled={isPending || !name.trim()} onClick={() => onSave({ name, phone: phone || undefined, status, role })}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </SheetFooter>
    </div>
  );
}

export function UserManagementSheets({
  editUser,
  assignRoleUser,
  onEditUserChange,
  onAssignRoleUserChange,
}: {
  editUser: User | null;
  assignRoleUser: User | null;
  onEditUserChange: (user: User | null) => void;
  onAssignRoleUserChange: (user: User | null) => void;
}) {
  const permissions = usePermissions();
  const currentUser = useCurrentUser();
  
  const updateUser = useUpdateUser(editUser?.id ?? "");
  const assignCustomRole = useAssignCustomRole();

  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>("");

  useEffect(() => {
    if (assignRoleUser) {
      setSelectedCustomRoleId(assignRoleUser.customRoleId ?? "");
    }
  }, [assignRoleUser]);

  const effectiveCompanyId = assignRoleUser?.companyId || editUser?.companyId || currentUser?.companyId || "";
  const { data: customRoles = [] } = useCustomRoles(effectiveCompanyId);

  const roleOptions = ALL_ROLE_OPTIONS.filter(
    (opt) => permissions.role && opt.forRoles.includes(permissions.role as Role)
  );

  return (
    <>
      {/* Sheet — Editar usuário */}
      <Sheet open={!!editUser} onOpenChange={(open) => { if (!open) onEditUserChange(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar usuário</SheetTitle>
            <p className="text-sm text-muted-foreground">{editUser?.name}</p>
          </SheetHeader>
          {editUser && (
            <EditUserForm
              user={editUser}
              roleOptions={roleOptions}
              isPending={updateUser.isPending}
              onSave={(dto) => updateUser.mutate(dto, { onSuccess: () => onEditUserChange(null) })}
              onCancel={() => onEditUserChange(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet — Atribuir papel personalizado */}
      <Sheet
        open={!!assignRoleUser}
        onOpenChange={(open) => { if (!open) onAssignRoleUserChange(null); }}
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
                  <SelectItem value="_none">Nenhum (usar papel de sistema)</SelectItem>
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

            {selectedCustomRoleId && selectedCustomRoleId !== "_none" && (() => {
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
            <Button variant="outline" onClick={() => onAssignRoleUserChange(null)}>Cancelar</Button>
            <Button
              disabled={assignCustomRole.isPending}
              onClick={() => {
                if (!assignRoleUser) return;
                assignCustomRole.mutate(
                  { userId: assignRoleUser.id, customRoleId: selectedCustomRoleId === "_none" ? null : (selectedCustomRoleId || null) },
                  { onSuccess: () => onAssignRoleUserChange(null) }
                );
              }}
            >
              {assignCustomRole.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
