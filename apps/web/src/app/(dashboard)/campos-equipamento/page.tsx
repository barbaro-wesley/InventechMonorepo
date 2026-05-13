"use client";

import { useState, useRef, useEffect } from "react";
import {
    Plus, Pencil, Trash2, GripVertical, ToggleLeft, ToggleRight,
    Type, Hash, Calendar, ToggleRight as BoolIcon, ChevronDown, X, Settings2,
} from "lucide-react";

import {
    useCustomFieldDefinitions,
    useCreateCustomFieldDefinition,
    useUpdateCustomFieldDefinition,
    useDeleteCustomFieldDefinition,
} from "@/hooks/equipment/use-custom-fields";
import type { CustomFieldDefinition, CustomFieldType } from "@/services/equipment/custom-fields.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";

// ─── Constantes ───────────────────────────────────────────────────────────────

const FIELD_TYPES: {
    value: CustomFieldType;
    label: string;
    description: string;
    icon: React.ElementType;
}[] = [
    { value: "TEXT",    label: "Texto",    description: "Campo livre",      icon: Type },
    { value: "NUMBER",  label: "Número",   description: "Valor numérico",   icon: Hash },
    { value: "DATE",    label: "Data",     description: "Calendário",       icon: Calendar },
    { value: "BOOLEAN", label: "Sim/Não",  description: "Caixa de seleção", icon: BoolIcon },
    { value: "SELECT",  label: "Seleção",  description: "Lista de opções",  icon: ChevronDown },
];

const FIELD_TYPE_MAP = Object.fromEntries(
    FIELD_TYPES.map((t) => [t.value, t])
) as Record<CustomFieldType, typeof FIELD_TYPES[number]>;

// ─── Options chip input ───────────────────────────────────────────────────────

function OptionsInput({
    options,
    onChange,
}: {
    options: string[];
    onChange: (opts: string[]) => void;
}) {
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const add = () => {
        const trimmed = inputValue.trim();
        if (!trimmed || options.includes(trimmed)) return;
        onChange([...options, trimmed]);
        setInputValue("");
        inputRef.current?.focus();
    };

    const remove = (index: number) => {
        onChange(options.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            add();
        }
        if (e.key === "Backspace" && inputValue === "" && options.length > 0) {
            remove(options.length - 1);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border bg-muted/30 min-h-[40px]">
                    {options.map((opt, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-background border text-sm font-medium shadow-sm"
                        >
                            {opt}
                            <button
                                type="button"
                                onClick={() => remove(i)}
                                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                aria-label={`Remover ${opt}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite uma opção e pressione Enter..."
                    className="flex-1"
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={add}
                    disabled={!inputValue.trim()}
                    className="shrink-0"
                >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar
                </Button>
            </div>

            {options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    Adicione pelo menos uma opção para este campo.
                </p>
            )}
        </div>
    );
}

// ─── Form Sheet ───────────────────────────────────────────────────────────────

interface FieldFormState {
    name: string;
    fieldType: CustomFieldType;
    required: boolean;
    options: string[];
}

function FieldSheet({
    open,
    onClose,
    editing,
}: {
    open: boolean;
    onClose: () => void;
    editing?: CustomFieldDefinition;
}) {
    const create = useCreateCustomFieldDefinition();
    const update = useUpdateCustomFieldDefinition();

    const defaultForm = (): FieldFormState => ({
        name: editing?.name ?? "",
        fieldType: editing?.fieldType ?? "TEXT",
        required: editing?.required ?? false,
        options: (editing?.options as string[]) ?? [],
    });

    const [form, setForm] = useState<FieldFormState>(defaultForm);

    useEffect(() => {
        setForm(defaultForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing?.id, open]);

    const resetAndClose = () => {
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const opts = form.fieldType === "SELECT" ? form.options : undefined;

        if (editing) {
            await update.mutateAsync({
                id: editing.id,
                data: { name: form.name, fieldType: form.fieldType, required: form.required, options: opts },
            });
        } else {
            await create.mutateAsync({
                name: form.name,
                fieldType: form.fieldType,
                required: form.required,
                options: opts,
            });
        }
        resetAndClose();
    };

    const isPending = create.isPending || update.isPending;
    const canSubmit = form.name.trim().length >= 1 &&
        (form.fieldType !== "SELECT" || form.options.length > 0);

    return (
        <Sheet open={open} onOpenChange={(o) => !o && resetAndClose()}>
            <SheetContent className="flex flex-col overflow-hidden w-full sm:max-w-[460px]">
                <SheetHeader className="shrink-0">
                    <SheetTitle>{editing ? "Editar campo" : "Novo campo personalizado"}</SheetTitle>
                    <SheetDescription>
                        Campos personalizados aparecem no cadastro de todos os equipamentos da empresa.
                    </SheetDescription>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-6 flex-1 overflow-y-auto py-4 pr-1"
                >
                    {/* Nome */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cf-name">
                            Nome do campo <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="cf-name"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: CNES, Registro ANVISA, Potência..."
                            required
                        />
                    </div>

                    {/* Tipo — grade de cards */}
                    <div className="flex flex-col gap-2">
                        <Label>
                            Tipo de campo <span className="text-destructive">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {FIELD_TYPES.map(({ value, label, description, icon: Icon }) => {
                                const selected = form.fieldType === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, fieldType: value }))}
                                        className={cn(
                                            "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                                            selected
                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
                                        )}
                                    >
                                        <Icon className={cn("w-4 h-4", selected ? "text-primary" : "text-muted-foreground")} />
                                        <span className={cn("text-sm font-medium leading-tight", selected ? "text-primary" : "")}>
                                            {label}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground leading-tight">
                                            {description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Opções (somente SELECT) */}
                    {form.fieldType === "SELECT" && (
                        <div className="flex flex-col gap-2">
                            <Label>
                                Opções <span className="text-destructive">*</span>
                            </Label>
                            <OptionsInput
                                options={form.options}
                                onChange={(opts) => setForm((f) => ({ ...f, options: opts }))}
                            />
                        </div>
                    )}

                    {/* Obrigatório */}
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">Campo obrigatório</span>
                            <span className="text-xs text-muted-foreground">
                                Bloqueia o salvamento se estiver vazio
                            </span>
                        </div>
                        <Switch
                            id="cf-required"
                            checked={form.required}
                            onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))}
                        />
                    </div>
                </form>

                <SheetFooter className="shrink-0 pt-2 border-t">
                    <Button type="button" variant="outline" onClick={resetAndClose} className="flex-1">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={isPending || !canSubmit}
                        className="flex-1"
                        onClick={handleSubmit}
                    >
                        {isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar campo"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CamposEquipamentoPage() {
    const { data: definitions = [], isLoading } = useCustomFieldDefinitions();
    const toggleActive = useUpdateCustomFieldDefinition();
    const deleteField = useDeleteCustomFieldDefinition();

    const [sheetOpen, setSheetOpen] = useState(false);
    const [editing, setEditing] = useState<CustomFieldDefinition | undefined>();
    const [deleteTarget, setDeleteTarget] = useState<CustomFieldDefinition | undefined>();

    const openCreate = () => {
        setEditing(undefined);
        setSheetOpen(true);
    };

    const openEdit = (def: CustomFieldDefinition) => {
        setEditing(def);
        setSheetOpen(true);
    };

    const handleToggle = (def: CustomFieldDefinition) => {
        toggleActive.mutate({ id: def.id, data: { isActive: !def.isActive } });
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteField.mutateAsync(deleteTarget.id);
        setDeleteTarget(undefined);
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted shrink-0 mt-0.5">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Campos Personalizados</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Campos extras exibidos no cadastro de todos os equipamentos da empresa.
                        </p>
                    </div>
                </div>
                <Button onClick={openCreate} size="sm">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Novo campo
                </Button>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 rounded-lg border bg-muted/30 animate-pulse" />
                    ))}
                </div>
            )}

            {/* Vazio */}
            {!isLoading && definitions.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                        <Settings2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Nenhum campo personalizado</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Clique em &ldquo;Novo campo&rdquo; para começar.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Criar primeiro campo
                    </Button>
                </div>
            )}

            {/* Lista */}
            {!isLoading && definitions.length > 0 && (
                <div className="rounded-xl border divide-y overflow-hidden">
                    {definitions.map((def) => {
                        const { icon: Icon, label } = FIELD_TYPE_MAP[def.fieldType];
                        return (
                            <div
                                key={def.id}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3.5 transition-colors",
                                    !def.isActive && "bg-muted/20 opacity-60"
                                )}
                            >
                                <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0 cursor-grab" />

                                <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted shrink-0">
                                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={cn(
                                            "text-sm font-medium",
                                            !def.isActive && "line-through text-muted-foreground"
                                        )}>
                                            {def.name}
                                        </span>
                                        {!def.isActive && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                                                Inativo
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Badge variant="secondary" className="text-[11px] h-4 px-1.5 font-normal">
                                            {label}
                                        </Badge>
                                        {def.required && (
                                            <Badge variant="outline" className="text-[11px] h-4 px-1.5 font-normal text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                                                Obrigatório
                                            </Badge>
                                        )}
                                        {def.fieldType === "SELECT" && Array.isArray(def.options) && (
                                            <span className="text-[11px] text-muted-foreground">
                                                {(def.options as string[]).length} opção{(def.options as string[]).length !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title={def.isActive ? "Desativar campo" : "Ativar campo"}
                                        onClick={() => handleToggle(def)}
                                    >
                                        {def.isActive
                                            ? <ToggleRight className="w-4 h-4 text-green-600" />
                                            : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                        }
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Editar campo"
                                        onClick={() => openEdit(def)}
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        title="Remover campo"
                                        onClick={() => setDeleteTarget(def)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <FieldSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                editing={editing}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(undefined)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover campo personalizado?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O campo <strong>{deleteTarget?.name}</strong> e todos os seus valores salvos
                            em equipamentos serão removidos permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
