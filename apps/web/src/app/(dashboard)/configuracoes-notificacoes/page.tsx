"use client";

import { useState } from "react";
import {
    Bell,
    BellOff,
    Pencil,
    Loader2,
    Mail,
    MessageCircle,
    MonitorSmartphone,
    Save,
    X,
    Users,
    UserCheck,
    ShieldCheck,
} from "lucide-react";

import {
    useNotificationConfigs,
    useUpsertNotificationConfig,
    useToggleNotificationConfig,
} from "@/hooks/notification-configs/use-notification-configs";
import { useMaintenanceGroups } from "@/hooks/maintenance-groups/use-maintenance-groups";
import { useUsers } from "@/hooks/users/use-users";
import { useQuery } from "@tanstack/react-query";
import { customRolesService } from "@/services/permissions/permissions.service";
import {
    CONTEXTUAL_LABELS,
    ROLE_LABELS,
    CHANNEL_LABELS,
    type NotificationConfigItem,
    type UserRole,
    type ContextualRecipient,
    type NotificationChannel,
} from "@/services/notification-configs/notification-configs.service";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CONFIGURABLE_ROLES: UserRole[] = [
    "COMPANY_ADMIN",
    "COMPANY_MANAGER",
    "TECHNICIAN",
    "CLIENT_ADMIN",
];

const ALL_CONTEXTUAL: ContextualRecipient[] = [
    "OS_REQUESTER",
    "OS_ASSIGNED_TECHNICIANS",
    "OS_GROUP_TECHNICIANS",
    "OS_CLIENT_ADMINS",
    "OS_ASSIGNED_TECHNICIAN",
];

const ALL_CHANNELS: NotificationChannel[] = ["EMAIL", "TELEGRAM", "WEBSOCKET"];

const CHANNEL_ICON: Record<NotificationChannel, React.ReactNode> = {
    EMAIL: <Mail className="h-3.5 w-3.5" />,
    TELEGRAM: <MessageCircle className="h-3.5 w-3.5" />,
    WEBSOCKET: <MonitorSmartphone className="h-3.5 w-3.5" />,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EditForm {
    recipientRoles: UserRole[];
    recipientContextual: ContextualRecipient[];
    recipientGroupIds: string[];
    recipientUserIds: string[];
    recipientCustomRoleIds: string[];
    channels: NotificationChannel[];
}

function buildFormFromConfig(config: NotificationConfigItem): EditForm {
    return {
        recipientRoles: [...config.recipientRoles],
        recipientContextual: [...config.recipientContextual],
        recipientGroupIds: [...config.recipientGroupIds],
        recipientUserIds: [...config.recipientUserIds],
        recipientCustomRoleIds: [...config.recipientCustomRoleIds],
        channels: [...config.channels],
    };
}

function toggleItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ─────────────────────────────────────────────────────────────────────────────
// Destinatários resumidos na tabela
// ─────────────────────────────────────────────────────────────────────────────

function RecipientSummary({ config }: { config: NotificationConfigItem }) {
    const parts: string[] = [];
    config.recipientRoles.forEach((r) => { const l = ROLE_LABELS[r]; if (l) parts.push(l); });
    config.recipientContextual.forEach((c) => parts.push(CONTEXTUAL_LABELS[c]));
    if (config.recipientCustomRoleIds.length > 0) parts.push(`${config.recipientCustomRoleIds.length} papel(s) personalizado(s)`);
    if (config.recipientGroupIds.length > 0) parts.push(`${config.recipientGroupIds.length} grupo(s)`);
    if (config.recipientUserIds.length > 0) parts.push(`${config.recipientUserIds.length} usuário(s)`);

    if (parts.length === 0) {
        return <span className="text-muted-foreground text-sm">Nenhum destinatário</span>;
    }

    return (
        <div className="flex flex-wrap gap-1">
            {parts.slice(0, 3).map((p) => (
                <Badge key={p} variant="secondary" className="text-xs font-normal">{p}</Badge>
            ))}
            {parts.length > 3 && (
                <Badge variant="outline" className="text-xs font-normal">+{parts.length - 3}</Badge>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkbox simples
// ─────────────────────────────────────────────────────────────────────────────

function CheckItem({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">{label}</span>
        </label>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet de edição
// ─────────────────────────────────────────────────────────────────────────────

function EditConfigSheet({
    config,
    open,
    onClose,
}: {
    config: NotificationConfigItem | null;
    open: boolean;
    onClose: () => void;
}) {
    const [form, setForm] = useState<EditForm>(() =>
        config ? buildFormFromConfig(config) : { recipientRoles: [], recipientContextual: [], recipientGroupIds: [], recipientUserIds: [], recipientCustomRoleIds: [], channels: [] },
    );

    const upsertMutation = useUpsertNotificationConfig();
    const { data: groups } = useMaintenanceGroups({ isActive: true });
    const { data: usersResponse } = useUsers({ limit: 200 });
    const { data: customRoles } = useQuery({
        queryKey: ["custom-roles", "for-notification-config"],
        queryFn: () => customRolesService.list(),
    });

    const groupList = Array.isArray(groups) ? groups : [];
    const userList = usersResponse?.data ?? [];
    const customRoleList = Array.isArray(customRoles) ? customRoles.filter((r: any) => r.isActive) : [];

    if (!config) return null;

    const handleSave = () => {
        upsertMutation.mutate({ eventType: config.eventType, dto: form }, { onSuccess: onClose });
    };

    const hasRecipients =
        form.recipientRoles.length > 0 ||
        form.recipientContextual.length > 0 ||
        form.recipientGroupIds.length > 0 ||
        form.recipientUserIds.length > 0 ||
        form.recipientCustomRoleIds.length > 0;

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 overflow-y-auto">
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        {config.label}
                    </SheetTitle>
                    <SheetDescription>
                        Configure quem recebe e por quais canais.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 px-6 space-y-6 py-6">

                    {/* Canais */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Canais de envio</Label>
                        <div className="flex flex-wrap gap-4">
                            {ALL_CHANNELS.map((ch) => (
                                <CheckItem
                                    key={ch}
                                    checked={form.channels.includes(ch)}
                                    onChange={() => setForm((f) => ({ ...f, channels: toggleItem(f.channels, ch) }))}
                                    label={CHANNEL_LABELS[ch]}
                                />
                            ))}
                        </div>
                    </div>

                    <hr className="border-border" />

                    {/* Papéis fixos */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-sm font-semibold">Papéis</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {CONFIGURABLE_ROLES.map((role) => (
                                <CheckItem
                                    key={role}
                                    checked={form.recipientRoles.includes(role)}
                                    onChange={() => setForm((f) => ({ ...f, recipientRoles: toggleItem(f.recipientRoles, role) }))}
                                    label={ROLE_LABELS[role] ?? role}
                                />
                            ))}
                        </div>
                    </div>

                    <hr className="border-border" />

                    {/* Contextuais */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-sm font-semibold">Destinatários contextuais</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Resolvidos dinamicamente com base nos dados do evento.
                        </p>
                        <div className="space-y-2">
                            {ALL_CONTEXTUAL.map((c) => (
                                <CheckItem
                                    key={c}
                                    checked={form.recipientContextual.includes(c)}
                                    onChange={() => setForm((f) => ({ ...f, recipientContextual: toggleItem(f.recipientContextual, c) }))}
                                    label={CONTEXTUAL_LABELS[c]}
                                />
                            ))}
                        </div>
                    </div>

                    <hr className="border-border" />

                    {/* Papéis personalizados */}
                    {customRoleList.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                <Label className="text-sm font-semibold">Papéis personalizados</Label>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto rounded border p-2">
                                {customRoleList.map((r: any) => (
                                    <CheckItem
                                        key={r.id}
                                        checked={form.recipientCustomRoleIds.includes(r.id)}
                                        onChange={() => setForm((f) => ({ ...f, recipientCustomRoleIds: toggleItem(f.recipientCustomRoleIds, r.id) }))}
                                        label={r.name}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <hr className="border-border" />

                    {/* Grupos específicos */}
                    {groupList.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Grupos específicos</Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto rounded border p-2">
                                {groupList.map((g: any) => (
                                    <CheckItem
                                        key={g.id}
                                        checked={form.recipientGroupIds.includes(g.id)}
                                        onChange={() => setForm((f) => ({ ...f, recipientGroupIds: toggleItem(f.recipientGroupIds, g.id) }))}
                                        label={g.name}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Usuários específicos */}
                    {userList.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Usuários específicos</Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto rounded border p-2">
                                {userList.map((u: any) => (
                                    <CheckItem
                                        key={u.id}
                                        checked={form.recipientUserIds.includes(u.id)}
                                        onChange={() => setForm((f) => ({ ...f, recipientUserIds: toggleItem(f.recipientUserIds, u.id) }))}
                                        label={`${u.name}${u.email ? ` (${u.email})` : ""}`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {!hasRecipients && (
                        <p className="text-xs text-destructive">
                            Atenção: nenhum destinatário selecionado. Nenhuma notificação será enviada.
                        </p>
                    )}
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={upsertMutation.isPending}>
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={upsertMutation.isPending}>
                        {upsertMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-1" />
                        )}
                        Salvar
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfiguracoesNotificacoesPage() {
    const { data: configs, isLoading } = useNotificationConfigs();
    const toggleMutation = useToggleNotificationConfig();
    const [editingConfig, setEditingConfig] = useState<NotificationConfigItem | null>(null);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Configurações de Notificações
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Configure quem recebe cada tipo de notificação do sistema e por quais canais.
                </p>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">Ativo</TableHead>
                            <TableHead>Evento</TableHead>
                            <TableHead>Destinatários</TableHead>
                            <TableHead className="w-28">Canais</TableHead>
                            <TableHead className="w-14" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            configs?.map((config) => (
                                <TableRow
                                    key={config.eventType}
                                    className={!config.isActive ? "opacity-50" : undefined}
                                >
                                    <TableCell>
                                        <Switch
                                            checked={config.isActive}
                                            disabled={toggleMutation.isPending}
                                            onCheckedChange={() => toggleMutation.mutate(config.eventType)}
                                        />
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {config.isActive ? (
                                                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                                            ) : (
                                                <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
                                            )}
                                            <div>
                                                <p className="font-medium text-sm">{config.label}</p>
                                                {config.isCustomized && (
                                                    <p className="text-xs text-primary">Personalizado</p>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <RecipientSummary config={config} />
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex gap-1.5 text-muted-foreground">
                                            {config.channels.map((ch) => (
                                                <span key={ch} title={CHANNEL_LABELS[ch]}>
                                                    {CHANNEL_ICON[ch]}
                                                </span>
                                            ))}
                                            {config.channels.length === 0 && (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setEditingConfig(config)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <EditConfigSheet
                key={editingConfig?.eventType}
                config={editingConfig}
                open={!!editingConfig}
                onClose={() => setEditingConfig(null)}
            />
        </div>
    );
}
