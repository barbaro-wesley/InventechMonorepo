"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    MoreHorizontal,
    Loader2,
    Bell,
    BellOff,
    CheckCircle2,
    XCircle,
} from "lucide-react";

import {
    useAlertRules,
    useDeleteAlertRule,
    useToggleAlertRule,
} from "@/hooks/alert-rules/use-alert-rules";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { AlertRule } from "@inventech/shared-types";
import { AlertRuleSheet, EVENT_TYPE_LABELS } from "@/components/alert-rules/alert-rule-sheet";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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

const CHANNEL_LABELS: Record<string, string> = {
    EMAIL:     "E-mail",
    WEBSOCKET: "In-app",
    TELEGRAM:  "Telegram",
};

export default function AlertasPage() {
    const permissions = usePermissions();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [eventFilter, setEventFilter] = useState<string>("");
    const [createOpen, setCreateOpen] = useState(false);
    const [editRule, setEditRule] = useState<AlertRule | null>(null);
    const [deleteRule, setDeleteRule] = useState<AlertRule | null>(null);

    const { data, isLoading } = useAlertRules({
        page,
        limit: 10,
        search: search || undefined,
        triggerEvent: (eventFilter || undefined) as AlertRule["triggerEvent"] | undefined,
    });

    const deleteMutation = useDeleteAlertRule();
    const toggleMutation = useToggleAlertRule();

    const canManage = permissions.isManager || (permissions.user?.customRoleId
        ? permissions.canAccess("alert-rule", "create")
        : false);
    const canDelete = permissions.isRole("SUPER_ADMIN", "COMPANY_ADMIN") || (permissions.user?.customRoleId
        ? permissions.canAccess("alert-rule", "delete")
        : false);

    function handleDelete() {
        if (!deleteRule) return;
        deleteMutation.mutate(deleteRule.id, {
            onSuccess: () => setDeleteRule(null),
        });
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Regras de Alerta
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {data?.pagination?.total ?? 0} regra{data?.pagination?.total !== 1 ? "s" : ""} configurada{data?.pagination?.total !== 1 ? "s" : ""}
                    </p>
                </div>
                {canManage && (
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova regra
                    </Button>
                )}
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por nome…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <Select
                    value={eventFilter || "_all"}
                    onValueChange={(v) => {
                        setEventFilter(v === "_all" ? "" : v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-56">
                        <SelectValue placeholder="Filtrar por evento" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">Todos os eventos</SelectItem>
                        {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Tabela */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                            <TableHead className="w-10">Ativo</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Evento</TableHead>
                            <TableHead>Canais</TableHead>
                            <TableHead>Disparos</TableHead>
                            <TableHead>Último disparo</TableHead>
                            <TableHead className="w-10" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                                </TableCell>
                            </TableRow>
                        ) : (data?.data?.length ?? 0) === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                                    Nenhuma regra de alerta encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data?.map((rule) => (
                                <TableRow key={rule.id}>
                                    <TableCell>
                                        <Switch
                                            checked={rule.isActive}
                                            onCheckedChange={() => toggleMutation.mutate(rule.id)}
                                            disabled={toggleMutation.isPending || !canManage}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {rule.name}
                                            </p>
                                            {rule.description && (
                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                                    {rule.description}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {EVENT_TYPE_LABELS[rule.triggerEvent] ?? rule.triggerEvent}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1 flex-wrap">
                                            {rule.channels.map((ch) => (
                                                <Badge
                                                    key={ch}
                                                    variant="outline"
                                                    className="text-xs text-slate-500"
                                                >
                                                    {CHANNEL_LABELS[ch] ?? ch}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
                                            {rule.fireCount}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {rule.lastFiredAt ? (
                                            <span className="text-sm text-slate-500">
                                                {new Date(rule.lastFiredAt).toLocaleString("pt-BR", {
                                                    dateStyle: "short",
                                                    timeStyle: "short",
                                                })}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-slate-400">Nunca</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {canManage && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="w-8 h-8">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setEditRule(rule)}>
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => toggleMutation.mutate(rule.id)}
                                                        disabled={toggleMutation.isPending}
                                                    >
                                                        {rule.isActive ? (
                                                            <span className="flex items-center gap-2">
                                                                <BellOff className="w-3.5 h-3.5" /> Desativar
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-2">
                                                                <Bell className="w-3.5 h-3.5" /> Ativar
                                                            </span>
                                                        )}
                                                    </DropdownMenuItem>
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => setDeleteRule(rule)}
                                                            >
                                                                Remover
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
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

            {/* Sheet — Criar / Editar */}
            <AlertRuleSheet
                open={createOpen || !!editRule}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreateOpen(false);
                        setEditRule(null);
                    }
                }}
                rule={editRule}
            />

            {/* Confirmação de remoção */}
            <AlertDialog
                open={!!deleteRule}
                onOpenChange={(open) => !open && setDeleteRule(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover regra</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover a regra{" "}
                            <strong>{deleteRule?.name}</strong>? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteMutation.isPending ? (
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
