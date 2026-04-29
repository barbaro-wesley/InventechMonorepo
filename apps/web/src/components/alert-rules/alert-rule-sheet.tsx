"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, Variable, Eye } from "lucide-react";

import {
    useCreateAlertRule,
    useUpdateAlertRule,
    useAlertRuleVariables,
    usePreviewAlertRuleEmail,
} from "@/hooks/alert-rules/use-alert-rules";
import { useCustomRoles } from "@/hooks/permissions/use-permissions";
import type { AlertRule } from "@inventech/shared-types";
import { EventType, NotificationChannel } from "@inventech/shared-types";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// ─── Labels ───────────────────────────────────────────────────────────────────

export const EVENT_TYPE_LABELS: Record<string, string> = {
    OS_CREATED_NO_TECHNICIAN:    "OS criada sem técnico",
    OS_TECHNICIAN_ASSIGNED:      "Técnico atribuído à OS",
    OS_TECHNICIAN_ASSUMED:       "Técnico assumiu a OS",
    OS_COMPLETED:                "OS concluída",
    OS_APPROVED:                 "OS aprovada",
    OS_REJECTED:                 "OS rejeitada",
    OS_UNASSIGNED_ALERT:         "Alerta de OS sem técnico",
    EQUIPMENT_CREATED:           "Equipamento criado",
    EQUIPMENT_MOVED:             "Equipamento movido",
    EQUIPMENT_WARRANTY_EXPIRING: "Garantia de equipamento vencendo",
    PREVENTIVE_GENERATED:        "Preventiva gerada",
    MAINTENANCE_OVERDUE:         "Manutenção em atraso",
    USER_CREATED:                "Usuário criado",
    USER_DEACTIVATED:            "Usuário desativado",
    DAILY_SUMMARY:               "Resumo diário",
};

const ROLE_LABELS: Record<string, string> = {
    COMPANY_ADMIN:   "Admin da empresa",
    COMPANY_MANAGER: "Gerente",
    TECHNICIAN:      "Técnico",
    CLIENT_ADMIN:    "Admin do prestador",
    CLIENT_USER:     "Usuário do prestador",
    CLIENT_VIEWER:   "Visualizador do prestador",
};

const OPERATOR_LABELS: Record<string, string> = {
    eq:       "igual a",
    neq:      "diferente de",
    gt:       "maior que",
    gte:      "maior ou igual a",
    lt:       "menor que",
    lte:      "menor ou igual a",
    contains: "contém",
    in:       "está em",
};

const CHANNEL_CONFIG = [
    { value: NotificationChannel.EMAIL,     label: "E-mail" },
    { value: NotificationChannel.WEBSOCKET, label: "Notificação in-app" },
    { value: NotificationChannel.TELEGRAM,  label: "Telegram" },
];

const RECIPIENT_ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

// ─── Schema ───────────────────────────────────────────────────────────────────

const conditionSchema = z.object({
    field:    z.string().min(1, "Campo obrigatório"),
    operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"]),
    value:    z.string().min(1, "Valor obrigatório"),
});

const alertRuleSchema = z.object({
    name:                   z.string().min(1, "Nome obrigatório"),
    description:            z.string().optional(),
    isActive:               z.boolean(),
    triggerEvent:           z.string().min(1, "Evento obrigatório"),
    conditions:             z.array(conditionSchema),
    headerColor:            z.string(),
    headerTitle:            z.string().min(1, "Título obrigatório"),
    bodyTemplate:           z.string().min(1, "Corpo obrigatório"),
    tableFields:            z.array(z.string()),
    buttonLabel:            z.string().optional(),
    buttonUrlTemplate:      z.string().optional(),
    footerNote:             z.string().optional(),
    recipientRoles:         z.array(z.string()),
    recipientGroupIds:      z.array(z.string()),
    recipientUserIds:       z.array(z.string()),
    recipientContextual:    z.array(z.string()),
    recipientCustomRoleIds: z.array(z.string()),
    channels:               z.array(z.string()).min(1, "Selecione ao menos um canal"),
});

type AlertRuleForm = z.infer<typeof alertRuleSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertRuleSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rule?: AlertRule | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AlertRuleSheet({ open, onOpenChange, rule }: AlertRuleSheetProps) {
    const isEditing = !!rule;
    const [activeTab, setActiveTab] = useState("regra");
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");
    const [previewSubject, setPreviewSubject] = useState("");

    const { data: variableRegistry = {} } = useAlertRuleVariables();
    const { data: customRoles = [] } = useCustomRoles();
    const createMutation = useCreateAlertRule();
    const updateMutation = useUpdateAlertRule(rule?.id ?? "");
    const previewMutation = usePreviewAlertRuleEmail();

    const isPending = createMutation.isPending || updateMutation.isPending;

    const form = useForm<AlertRuleForm>({
        resolver: zodResolver(alertRuleSchema),
        defaultValues: {
            name:                   "",
            description:            "",
            isActive:               true,
            triggerEvent:           "",
            conditions:             [],
            headerColor:            "#1e40af",
            headerTitle:            "",
            bodyTemplate:           "",
            tableFields:            [],
            buttonLabel:            "",
            buttonUrlTemplate:      "",
            footerNote:             "",
            recipientRoles:         [],
            recipientGroupIds:      [],
            recipientUserIds:       [],
            recipientContextual:    [],
            recipientCustomRoleIds: [],
            channels:               [NotificationChannel.EMAIL],
        },
    });

    const { fields: conditionFields, append: appendCondition, remove: removeCondition } =
        useFieldArray({ control: form.control, name: "conditions" });

    // Populate form when editing
    useEffect(() => {
        if (rule) {
            form.reset({
                name:                   rule.name,
                description:            rule.description ?? "",
                isActive:               rule.isActive,
                triggerEvent:           rule.triggerEvent,
                conditions:             (rule.conditions ?? []).map((c) => ({
                    ...c,
                    value: Array.isArray(c.value) ? c.value.join(", ") : String(c.value),
                })),
                headerColor:            rule.headerColor,
                headerTitle:            rule.headerTitle,
                bodyTemplate:           rule.bodyTemplate,
                tableFields:            rule.tableFields ?? [],
                buttonLabel:            rule.buttonLabel ?? "",
                buttonUrlTemplate:      rule.buttonUrlTemplate ?? "",
                footerNote:             rule.footerNote ?? "",
                recipientRoles:         rule.recipientRoles ?? [],
                recipientGroupIds:      rule.recipientGroupIds ?? [],
                recipientUserIds:       rule.recipientUserIds ?? [],
                recipientContextual:    rule.recipientContextual ?? [],
                recipientCustomRoleIds: rule.recipientCustomRoleIds ?? [],
                channels:               (rule.channels ?? []) as string[],
            });
        } else {
            form.reset({
                name: "", description: "", isActive: true, triggerEvent: "",
                conditions: [], headerColor: "#1e40af", headerTitle: "",
                bodyTemplate: "", tableFields: [], buttonLabel: "",
                buttonUrlTemplate: "", footerNote: "",
                recipientRoles: [], recipientGroupIds: [], recipientUserIds: [],
                recipientContextual: [], recipientCustomRoleIds: [],
                channels: [NotificationChannel.EMAIL],
            });
        }
        setActiveTab("regra");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rule, open]);

    const selectedEvent = form.watch("triggerEvent");
    const eventMeta = selectedEvent
        ? (variableRegistry as Record<string, { variables: { key: string; label: string }[]; contextualRecipients: { key: string; label: string }[] }>)[selectedEvent]
        : undefined;
    const availableVariables     = eventMeta?.variables ?? [];
    const availableContextuals   = eventMeta?.contextualRecipients ?? [];

    function insertVariable(fieldName: "headerTitle" | "bodyTemplate" | "buttonUrlTemplate", variable: string) {
        const current = form.getValues(fieldName) ?? "";
        form.setValue(fieldName, current + `{{${variable}}}`);
    }

    function toggleChannel(channel: string) {
        const current = form.getValues("channels");
        form.setValue(
            "channels",
            current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
        );
    }

    function toggleRole(role: string) {
        const current = form.getValues("recipientRoles");
        form.setValue(
            "recipientRoles",
            current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
        );
    }

    function toggleContextual(key: string) {
        const current = form.getValues("recipientContextual");
        form.setValue(
            "recipientContextual",
            current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
        );
    }

    function toggleCustomRole(id: string) {
        const current = form.getValues("recipientCustomRoleIds");
        form.setValue(
            "recipientCustomRoleIds",
            current.includes(id) ? current.filter((rId) => rId !== id) : [...current, id],
        );
    }

    function toggleTableField(key: string) {
        const current = form.getValues("tableFields");
        form.setValue(
            "tableFields",
            current.includes(key) ? current.filter((f) => f !== key) : [...current, key],
        );
    }

    async function handlePreview() {
        if (!rule?.id) return;
        const result = await previewMutation.mutateAsync({ id: rule.id });
        setPreviewSubject(result.subject);
        setPreviewHtml(result.html);
        setPreviewOpen(true);
    }

    function handleSubmit(formData: AlertRuleForm) {
        const dto = {
            ...formData,
            triggerEvent: formData.triggerEvent as AlertRule["triggerEvent"],
            channels: formData.channels as AlertRule["channels"],
            conditions: formData.conditions.map((c) => ({
                ...c,
                value: c.operator === "in"
                    ? c.value.split(",").map((v) => v.trim())
                    : c.value,
            })),
            buttonLabel:       formData.buttonLabel || undefined,
            buttonUrlTemplate: formData.buttonUrlTemplate || undefined,
            footerNote:        formData.footerNote || undefined,
            description:       formData.description || undefined,
        };

        if (isEditing) {
            updateMutation.mutate(dto, { onSuccess: () => onOpenChange(false) });
        } else {
            createMutation.mutate(dto as any, { onSuccess: () => onOpenChange(false) });
        }
    }

    const channels             = form.watch("channels");
    const recipientRoles       = form.watch("recipientRoles");
    const recipientContextual  = form.watch("recipientContextual");
    const recipientCustomRoleIds = form.watch("recipientCustomRoleIds");
    const tableFields          = form.watch("tableFields");
    const errors               = form.formState.errors;

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
                    <SheetHeader className="px-6 pt-6 pb-4 border-b">
                        <SheetTitle>
                            {isEditing ? `Editar regra: ${rule.name}` : "Nova regra de alerta"}
                        </SheetTitle>
                    </SheetHeader>

                    <form
                        id="alert-rule-form"
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="flex flex-col flex-1 overflow-hidden"
                    >
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
                            <TabsList className="mx-6 mt-4 mb-2 w-auto justify-start rounded-none border-b bg-transparent p-0 gap-1">
                                <TabsTrigger value="regra" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:border-border data-[state=inactive]:border-transparent px-4 py-2">
                                    Regra
                                </TabsTrigger>
                                <TabsTrigger value="condicoes" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:border-border data-[state=inactive]:border-transparent px-4 py-2">
                                    Condições
                                </TabsTrigger>
                                <TabsTrigger value="template" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:border-border data-[state=inactive]:border-transparent px-4 py-2">
                                    Template
                                </TabsTrigger>
                                <TabsTrigger value="destinatarios" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:border-border data-[state=inactive]:border-transparent px-4 py-2">
                                    Destinatários
                                </TabsTrigger>
                            </TabsList>

                            {/* ── Aba 1: Regra ── */}
                            <TabsContent value="regra" className="flex-1 overflow-y-auto px-6 py-4 space-y-5 mt-0">
                                <div className="flex items-center gap-3">
                                    <Switch
                                        id="isActive"
                                        checked={form.watch("isActive")}
                                        onCheckedChange={(v) => form.setValue("isActive", v)}
                                    />
                                    <Label htmlFor="isActive" className="font-normal cursor-pointer">
                                        Regra ativa
                                    </Label>
                                </div>

                                <div>
                                    <Label htmlFor="name">Nome da regra</Label>
                                    <Input
                                        id="name"
                                        className="mt-1.5"
                                        placeholder="Ex: Alerta de OS sem técnico"
                                        {...form.register("name")}
                                    />
                                    {errors.name && (
                                        <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="description">Descrição (opcional)</Label>
                                    <Textarea
                                        id="description"
                                        className="mt-1.5 resize-none"
                                        rows={2}
                                        placeholder="Descreva o objetivo desta regra…"
                                        {...form.register("description")}
                                    />
                                </div>

                                <div>
                                    <Label>Evento disparador</Label>
                                    <Controller
                                        control={form.control}
                                        name="triggerEvent"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="mt-1.5">
                                                    <SelectValue placeholder="Selecione o evento…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.triggerEvent && (
                                        <p className="mt-1 text-xs text-red-500">{errors.triggerEvent.message}</p>
                                    )}
                                </div>

                                {selectedEvent && availableVariables.length > 0 && (
                                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/50 border p-3">
                                        <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                                            <Variable className="w-3.5 h-3.5" />
                                            Variáveis disponíveis para este evento
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableVariables.map((v) => (
                                                <Badge key={v.key} variant="outline" className="text-xs font-mono cursor-default">
                                                    {`{{${v.key}}}`}
                                                    <span className="ml-1 text-slate-400 font-sans">{v.label}</span>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            {/* ── Aba 2: Condições ── */}
                            <TabsContent value="condicoes" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-medium">Condições de filtro</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Todas as condições devem ser satisfeitas (AND). Deixe vazio para disparar sempre.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => appendCondition({ field: "", operator: "eq", value: "" })}
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        Adicionar
                                    </Button>
                                </div>

                                {conditionFields.length === 0 ? (
                                    <div className="text-center py-10 text-sm text-slate-400 border border-dashed rounded-lg">
                                        Nenhuma condição — a regra será disparada para todo evento do tipo selecionado.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {conditionFields.map((field, index) => (
                                            <div key={field.id} className="flex gap-2 items-start p-3 border rounded-lg bg-slate-50 dark:bg-slate-800/30">
                                                <div className="flex-1 grid grid-cols-3 gap-2">
                                                    <div>
                                                        <Label className="text-xs mb-1">Campo</Label>
                                                        {availableVariables.length > 0 ? (
                                                            <Controller
                                                                control={form.control}
                                                                name={`conditions.${index}.field`}
                                                                render={({ field: f }) => (
                                                                    <Select value={f.value} onValueChange={f.onChange}>
                                                                        <SelectTrigger className="h-8 text-xs">
                                                                            <SelectValue placeholder="Campo…" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {availableVariables.map((v) => (
                                                                                <SelectItem key={v.key} value={v.key} className="text-xs">
                                                                                    {v.label}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                            />
                                                        ) : (
                                                            <Input
                                                                className="h-8 text-xs"
                                                                placeholder="campo"
                                                                {...form.register(`conditions.${index}.field`)}
                                                            />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs mb-1">Operador</Label>
                                                        <Controller
                                                            control={form.control}
                                                            name={`conditions.${index}.operator`}
                                                            render={({ field: f }) => (
                                                                <Select value={f.value} onValueChange={f.onChange}>
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {Object.entries(OPERATOR_LABELS).map(([v, l]) => (
                                                                            <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs mb-1">Valor</Label>
                                                        <Input
                                                            className="h-8 text-xs"
                                                            placeholder="valor"
                                                            {...form.register(`conditions.${index}.value`)}
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 mt-5 text-slate-400 hover:text-red-500 shrink-0"
                                                    onClick={() => removeCondition(index)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* ── Aba 3: Template ── */}
                            <TabsContent value="template" className="flex-1 overflow-y-auto px-6 py-4 space-y-5 mt-0">
                                {availableVariables.length > 0 && (
                                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/50 border p-3">
                                        <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                                            <Variable className="w-3.5 h-3.5" />
                                            Clique para inserir no campo ativo
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableVariables.map((v) => (
                                                <button
                                                    key={v.key}
                                                    type="button"
                                                    onClick={() => insertVariable("bodyTemplate", v.key)}
                                                    className="inline-flex items-center gap-1 text-xs border rounded px-1.5 py-0.5 font-mono hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/30 transition-colors"
                                                >
                                                    {`{{${v.key}}}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="headerColor">Cor do cabeçalho</Label>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <input
                                                type="color"
                                                id="headerColor"
                                                className="h-9 w-12 rounded border cursor-pointer p-0.5"
                                                {...form.register("headerColor")}
                                            />
                                            <Input
                                                className="flex-1 font-mono text-sm"
                                                placeholder="#1e40af"
                                                {...form.register("headerColor")}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-end">
                                        <div
                                            className="h-9 w-full rounded flex items-center justify-center text-white text-xs font-semibold"
                                            style={{ background: form.watch("headerColor") || "#1e40af" }}
                                        >
                                            Prévia do cabeçalho
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="headerTitle">Título do e-mail</Label>
                                    <Input
                                        id="headerTitle"
                                        className="mt-1.5"
                                        placeholder="Ex: Nova OS criada — {{osNumber}}"
                                        {...form.register("headerTitle")}
                                    />
                                    {errors.headerTitle && (
                                        <p className="mt-1 text-xs text-red-500">{errors.headerTitle.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="bodyTemplate">Corpo da mensagem</Label>
                                    <Textarea
                                        id="bodyTemplate"
                                        className="mt-1.5 resize-none font-mono text-sm"
                                        rows={5}
                                        placeholder="<p>Uma nova OS foi aberta por <strong>{{createdBy}}</strong>.</p>"
                                        {...form.register("bodyTemplate")}
                                    />
                                    {errors.bodyTemplate && (
                                        <p className="mt-1 text-xs text-red-500">{errors.bodyTemplate.message}</p>
                                    )}
                                </div>

                                {availableVariables.length > 0 && (
                                    <div>
                                        <Label className="mb-1.5 block">Campos na tabela de detalhes</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {availableVariables.map((v) => (
                                                <button
                                                    key={v.key}
                                                    type="button"
                                                    onClick={() => toggleTableField(v.key)}
                                                    className={`inline-flex items-center gap-1 text-xs border rounded-full px-2.5 py-1 transition-colors ${
                                                        tableFields.includes(v.key)
                                                            ? "bg-blue-600 border-blue-600 text-white"
                                                            : "hover:border-blue-400 text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    {v.label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1.5">
                                            Os campos selecionados aparecem em uma tabela de detalhes no e-mail.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="buttonLabel">Texto do botão (opcional)</Label>
                                        <Input
                                            id="buttonLabel"
                                            className="mt-1.5"
                                            placeholder="Ver OS"
                                            {...form.register("buttonLabel")}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="buttonUrlTemplate">URL do botão (opcional)</Label>
                                        <Input
                                            id="buttonUrlTemplate"
                                            className="mt-1.5"
                                            placeholder="https://app.com/os/{{osId}}"
                                            {...form.register("buttonUrlTemplate")}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="footerNote">Nota de rodapé (opcional)</Label>
                                    <Input
                                        id="footerNote"
                                        className="mt-1.5"
                                        placeholder="Você recebe este e-mail pois está cadastrado como técnico."
                                        {...form.register("footerNote")}
                                    />
                                </div>

                                {isEditing && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePreview}
                                        disabled={previewMutation.isPending}
                                        className="w-full"
                                    >
                                        {previewMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Eye className="w-4 h-4 mr-2" />
                                        )}
                                        Visualizar e-mail
                                    </Button>
                                )}
                            </TabsContent>

                            {/* ── Aba 4: Destinatários ── */}
                            <TabsContent value="destinatarios" className="flex-1 overflow-y-auto px-6 py-4 space-y-6 mt-0">
                                <div>
                                    <p className="text-sm font-medium mb-3">Canais de envio</p>
                                    {errors.channels && (
                                        <p className="mb-2 text-xs text-red-500">{errors.channels.message}</p>
                                    )}
                                    <div className="space-y-2">
                                        {CHANNEL_CONFIG.map((ch) => (
                                            <label
                                                key={ch.value}
                                                className="flex items-center gap-3 cursor-pointer"
                                            >
                                                <Switch
                                                    checked={channels.includes(ch.value)}
                                                    onCheckedChange={() => toggleChannel(ch.value)}
                                                />
                                                <span className="text-sm">{ch.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {availableContextuals.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Destinatários contextuais</p>
                                        <p className="text-xs text-slate-500 mb-3">
                                            Resolvidos automaticamente a partir do contexto da OS/evento.
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableContextuals.map((c) => (
                                                <button
                                                    key={c.key}
                                                    type="button"
                                                    onClick={() => toggleContextual(c.key)}
                                                    className={`text-left text-sm px-3 py-2 border rounded-lg transition-colors ${
                                                        recipientContextual.includes(c.key)
                                                            ? "bg-violet-600 border-violet-600 text-white"
                                                            : "hover:border-violet-400 text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    {c.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <p className="text-sm font-medium mb-1">Perfis destinatários</p>
                                    <p className="text-xs text-slate-500 mb-3">
                                        Todos os usuários ativos com estes perfis receberão o alerta.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {RECIPIENT_ROLES.map((r) => (
                                            <button
                                                key={r.value}
                                                type="button"
                                                onClick={() => toggleRole(r.value)}
                                                className={`text-left text-sm px-3 py-2 border rounded-lg transition-colors ${
                                                    recipientRoles.includes(r.value)
                                                        ? "bg-blue-600 border-blue-600 text-white"
                                                        : "hover:border-blue-400 text-slate-600 dark:text-slate-400"
                                                }`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {customRoles.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Papéis personalizados</p>
                                        <p className="text-xs text-slate-500 mb-3">
                                            Usuários que possuem um dos papéis criados pela sua empresa.
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {customRoles.map((cr) => (
                                                <button
                                                    key={cr.id}
                                                    type="button"
                                                    onClick={() => toggleCustomRole(cr.id)}
                                                    className={`text-left text-sm px-3 py-2 border rounded-lg transition-colors ${
                                                        recipientCustomRoleIds.includes(cr.id)
                                                            ? "bg-blue-600 border-blue-600 text-white"
                                                            : "hover:border-blue-400 text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    {cr.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <SheetFooter className="px-6 py-4 border-t gap-2 flex-row justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" form="alert-rule-form" disabled={isPending}>
                                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {isEditing ? "Salvar alterações" : "Criar regra"}
                            </Button>
                        </SheetFooter>
                    </form>
                </SheetContent>
            </Sheet>

            {/* Preview dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-medium">
                            Prévia: {previewSubject}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden rounded border">
                        <iframe
                            srcDoc={previewHtml}
                            className="w-full h-full"
                            sandbox="allow-same-origin"
                            title="preview-email"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
