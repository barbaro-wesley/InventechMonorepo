"use client";

import { useState } from "react";
import { Loader2, Plus, UserCheck, MoreHorizontal, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useUsers, useCreateUser, useDeleteUser } from "@/hooks/users/use-users";
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const createUserSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["CLIENT_ADMIN", "CLIENT_USER", "CLIENT_VIEWER"], {
    message: "O papel base é obrigatório para definir a hierarquia no sistema."
  }),
  phone: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function ClientUsersDrawer({
  client,
  open,
  onOpenChange,
}: {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const permissions = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [assignRoleUser, setAssignRoleUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data, isLoading } = useUsers({
    clientId: client?.id,
    limit: 100, // list up to 100 users for simple drawer workflow
  });

  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "" as any, phone: "" },
  });

  function handleCreate(formData: CreateUserForm) {
    if (!client) return;
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
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader>
            <DrawerTitle>Usuários de {client?.name}</DrawerTitle>
            <DrawerDescription>
              Gerencie quem tem acesso aos dados deste cliente.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody className="overflow-y-auto">
            <div className="flex justify-end mb-4">
              {permissions.canManageUsers && !createOpen && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo usuário
                </Button>
              )}
            </div>

            {createOpen && (
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 mb-6">
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
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLIENT_ADMIN">Admin do Cliente</SelectItem>
                          <SelectItem value="CLIENT_USER">Usuário do Cliente</SelectItem>
                          <SelectItem value="CLIENT_VIEWER">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
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

            {isLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum usuário encontrado para este cliente</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {users.map((user) => {
                  const statusCfg = STATUS_CONFIG[user.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.INACTIVE;
                  return (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-sm font-bold flex-shrink-0">
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {user.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            <span className="truncate">{user.email}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="truncate">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-shrink-0">
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
                              <DropdownMenuItem onClick={() => setEditUser(user)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAssignRoleUser(user)}>
                                Atribuir papel
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setDeleteTarget(user)}
                              >
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
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <UserManagementSheets 
        editUser={editUser}
        assignRoleUser={assignRoleUser}
        onEditUserChange={setEditUser}
        onAssignRoleUserChange={setAssignRoleUser}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário do cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover <strong>{deleteTarget?.name}</strong>? Esta ação o impedirá de acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              {deleteUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
