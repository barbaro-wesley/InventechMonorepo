"use client";

import React, { useState, useCallback } from "react";

import {
  Plus,
  Search,
  Loader2,
  FileText,
  Copy,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  X,
  GripVertical,
  Variable,
  ToggleLeft,
  ToggleRight,
  Table2,
  AlignLeft,
  AlignJustify,
  Hash,
  Calendar,
  CheckSquare,
  ListChecks,
  List,
  Minus,
  Heading,
  Image,
  Eye,
} from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useLaudoTemplates,
  useCreateLaudoTemplate,
  useUpdateLaudoTemplate,
  useDeleteLaudoTemplate,
  useCloneLaudoTemplate,
  laudoTemplateKeys,
} from "@/hooks/laudo-templates/use-laudo-templates";
import { laudoTemplatesService } from "@/services/laudo-templates/laudo-templates.service";
import { getErrorMessage } from "@/lib/api";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { cn } from "@/lib/utils";
import type { LaudoTemplate, LaudoFieldType, LaudoReferenceType, LaudoSignatureConfig } from "@/services/laudo-templates/laudo-templates.types";
import {
  REFERENCE_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  AVAILABLE_VARIABLES,
} from "@/services/laudo-templates/laudo-templates.types";
import { SignatureConfigSection } from "@/components/laudos/signature-config-section";
import { TemplatePreviewDialog } from "@/components/laudos/template-preview-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPE_ICONS: Record<LaudoFieldType, React.ElementType> = {
  SHORT_TEXT: AlignLeft,
  LONG_TEXT: AlignJustify,
  NUMBER: Hash,
  DATE: Calendar,
  TABLE: Table2,
  MULTI_SELECT: ListChecks,
  SINGLE_SELECT: List,
  CHECKBOX: CheckSquare,
  HEADING: Heading,
  DIVIDER: Minus,
  IMAGE: Image,
};

const REFERENCE_TYPE_COLORS: Record<LaudoReferenceType, string> = {
  MAINTENANCE: "bg-blue-50 text-blue-700 border-blue-200",
  SERVICE_ORDER: "bg-violet-50 text-violet-700 border-violet-200",
  CUSTOM: "bg-slate-50 text-slate-600 border-slate-200",
};

const REFERENCE_TYPE_ACCENT: Record<LaudoReferenceType, string> = {
  MAINTENANCE: "bg-blue-500",
  SERVICE_ORDER: "bg-violet-500",
  CUSTOM: "bg-slate-400",
};

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const fieldSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().min(1, "Rótulo obrigatório"),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  order: z.number(),
  width: z.enum(["full", "half"]).optional(),
  variable: z.string().optional(),
  options: z.array(z.string()).optional(),
  tableColumns: z
    .array(z.object({ key: z.string(), label: z.string(), type: z.enum(["text", "number"]).optional() }))
    .optional(),
});

const templateFormSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  description: z.string().optional(),
  referenceType: z.enum(["MAINTENANCE", "SERVICE_ORDER", "CUSTOM"]),
  fields: z.array(fieldSchema).min(1, "Adicione pelo menos um campo"),
  isActive: z.boolean().optional(),
  isSharedWithClients: z.boolean().optional(),
  signatureConfig: z.any().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden animate-pulse">
      <div className="h-1 bg-slate-200 dark:bg-slate-700" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
        <div className="flex gap-2 mt-4">
          <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-full" />
          <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onClone,
  onPreview,
  onToggleActive,
  isTogglingActive,
  isLoadingEdit,
}: {
  template: LaudoTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  onPreview: () => void;
  onToggleActive: () => void;
  isTogglingActive: boolean;
  isLoadingEdit: boolean;
}) {
  const fieldCount = template.fields?.length ?? 0;

  return (
    <div className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
      {/* Accent bar */}
      <div className={cn("h-1 w-full flex-shrink-0", REFERENCE_TYPE_ACCENT[template.referenceType])} />

      <div className="p-5 flex-1 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                {template.title}
              </h3>
              {template.createdBy && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  por {template.createdBy.name}
                </p>
              )}
            </div>
          </div>

          {/* Active toggle */}
          <button
            onClick={onToggleActive}
            disabled={isTogglingActive}
            className="flex-shrink-0 mt-0.5"
            title={template.isActive ? "Desativar template" : "Ativar template"}
          >
            {isTogglingActive ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : template.isActive ? (
              <ToggleRight className="w-5 h-5 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>

        {/* Description */}
        {template.description && (
          <p className="text-xs text-slate-500 line-clamp-2">{template.description}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn("text-xs", REFERENCE_TYPE_COLORS[template.referenceType])}
          >
            {REFERENCE_TYPE_LABELS[template.referenceType]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              template.isActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-500 border-slate-200"
            )}
          >
            {template.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {/* Field count */}
        <p className="text-xs text-slate-400">
          {fieldCount} campo{fieldCount !== 1 ? "s" : ""}
          {template._count?.laudos != null && (
            <span> · {template._count.laudos} laudo{template._count.laudos !== 1 ? "s" : ""}</span>
          )}
        </p>
      </div>

      {/* Actions footer */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 gap-1"
          onClick={onPreview}
        >
          <Eye className="w-3 h-3" />
          Visualizar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 gap-1"
          onClick={onEdit}
          disabled={isLoadingEdit}
        >
          {isLoadingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pencil className="w-3 h-3" />}
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 gap-1"
          onClick={onClone}
        >
          <Copy className="w-3 h-3" />
          Duplicar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 gap-1 ml-auto"
          onClick={onDelete}
        >
          <Trash2 className="w-3 h-3" />
          Excluir
        </Button>
      </div>
    </div>
  );
}

// ─── FieldRow — one row in the field builder ─────────────────────────────────

function FieldRow({
  index,
  total,
  control,
  register,
  errors,
  watch,
  setValue,
  getValues,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  control: any;
  register: any;
  errors: any;
  watch: any;
  setValue: (name: string, value: any) => void;
  getValues: (name: string) => any;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const fieldType = watch(`fields.${index}.type`) as LaudoFieldType;
  const Icon = FIELD_TYPE_ICONS[fieldType] ?? AlignLeft;
  const hasOptions = fieldType === "MULTI_SELECT" || fieldType === "SINGLE_SELECT";
  const isTable = fieldType === "TABLE";
  const isLayout = fieldType === "HEADING" || fieldType === "DIVIDER";

  const [optionInput, setOptionInput] = useState("");
  const [colInput, setColInput] = useState("");

  const options: string[] = watch(`fields.${index}.options`) ?? [];
  const columns = watch(`fields.${index}.tableColumns`) ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700/50">
        <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />

        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
            {FIELD_TYPE_LABELS[fieldType] ?? "Campo"}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3 h-3 text-slate-500" />
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 ml-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Row body */}
      <div className="p-3 space-y-3">
        {/* Type + Label row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Tipo</Label>
            <Controller
              control={control}
              name={`fields.${index}.type`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_TYPE_LABELS) as LaudoFieldType[]).map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {FIELD_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {!isLayout && (
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">
                Rótulo <span className="text-rose-400">*</span>
              </Label>
              <Input
                {...register(`fields.${index}.label`)}
                placeholder="Ex: Número de série"
                className="h-8 text-xs"
              />
              {errors?.fields?.[index]?.label && (
                <p className="text-xs text-rose-500">{errors.fields[index].label.message}</p>
              )}
            </div>
          )}

          {isLayout && (
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Texto</Label>
              <Input
                {...register(`fields.${index}.label`)}
                placeholder={fieldType === "HEADING" ? "Título da seção" : "—"}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>

        {!isLayout && (
          <div className="grid grid-cols-2 gap-2">
            {/* Placeholder */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Placeholder</Label>
              <Input
                {...register(`fields.${index}.placeholder`)}
                placeholder="Texto de ajuda..."
                className="h-8 text-xs"
              />
            </div>

            {/* Width */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Largura</Label>
              <Controller
                control={control}
                name={`fields.${index}.width`}
                render={({ field }) => (
                  <Select value={field.value ?? "full"} onValueChange={field.onChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full" className="text-xs">Largura total</SelectItem>
                      <SelectItem value="half" className="text-xs">Metade</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        )}

        {!isLayout && (
          <div className="flex items-center justify-between">
            {/* Required toggle */}
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name={`fields.${index}.required`}
                render={({ field }) => (
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    id={`required-${index}`}
                  />
                )}
              />
              <Label htmlFor={`required-${index}`} className="text-xs text-slate-500 cursor-pointer">
                Campo obrigatório
              </Label>
            </div>

            {/* Variable selector */}
            <Controller
              control={control}
              name={`fields.${index}.variable`}
              render={({ field }) => (
                <div className="flex items-center gap-1.5">
                  <Variable className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                  >
                    <SelectTrigger className="h-7 text-xs w-44 border-dashed">
                      <SelectValue placeholder="Variável automática" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="__none__" className="text-xs text-slate-400">
                        Nenhuma
                      </SelectItem>
                      {AVAILABLE_VARIABLES.map((v) => (
                        <SelectItem key={v.value} value={v.value} className="text-xs">
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          </div>
        )}

        {/* Options — for SELECT types */}
        {hasOptions && (
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Opções</Label>
            <div className="flex gap-1.5">
              <Input
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                placeholder="Nova opção..."
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!optionInput.trim()) return;
                    const current: string[] = getValues(`fields.${index}.options`) ?? [];
                    if (!current.includes(optionInput.trim())) {
                      setValue(`fields.${index}.options`, [...current, optionInput.trim()]);
                    }
                    setOptionInput("");
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  if (!optionInput.trim()) return;
                  const current: string[] = getValues(`fields.${index}.options`) ?? [];
                  if (!current.includes(optionInput.trim())) {
                    setValue(`fields.${index}.options`, [...current, optionInput.trim()]);
                  }
                  setOptionInput("");
                }}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {options.map((opt: string, oi: number) => (
                <span
                  key={oi}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
                >
                  {opt}
                  <button
                    type="button"
                    onClick={() => {
                      const current: string[] = getValues(`fields.${index}.options`) ?? [];
                      setValue(
                        `fields.${index}.options`,
                        current.filter((_, i) => i !== oi)
                      );
                    }}
                    className="hover:text-rose-500 ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {options.length === 0 && (
                <p className="text-xs text-slate-300 italic">Sem opções definidas</p>
              )}
            </div>
          </div>
        )}

        {/* Table columns */}
        {isTable && (
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Colunas da tabela</Label>
            <div className="flex gap-1.5">
              <Input
                value={colInput}
                onChange={(e) => setColInput(e.target.value)}
                placeholder="Nome da coluna..."
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!colInput.trim()) return;
                    const key = colInput.trim().toLowerCase().replace(/\s+/g, "_");
                    const current = getValues(`fields.${index}.tableColumns`) ?? [];
                    setValue(`fields.${index}.tableColumns`, [
                      ...current,
                      { key, label: colInput.trim(), type: "text" },
                    ]);
                    setColInput("");
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  if (!colInput.trim()) return;
                  const key = colInput.trim().toLowerCase().replace(/\s+/g, "_");
                  const current = getValues(`fields.${index}.tableColumns`) ?? [];
                  setValue(`fields.${index}.tableColumns`, [
                    ...current,
                    { key, label: colInput.trim(), type: "text" },
                  ]);
                  setColInput("");
                }}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {columns.map((col: any, ci: number) => (
                <span
                  key={ci}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  {col.label}
                  <button
                    type="button"
                    onClick={() => {
                      const current = getValues(`fields.${index}.tableColumns`) ?? [];
                      setValue(
                        `fields.${index}.tableColumns`,
                        current.filter((_: any, i: number) => i !== ci)
                      );
                    }}
                    className="hover:text-rose-500 ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {columns.length === 0 && (
                <p className="text-xs text-slate-300 italic">Sem colunas definidas</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template Form (shared by create + edit) ──────────────────────────────────

function TemplateForm({
  form,
  isLoading,
  formId,
}: {
  form: ReturnType<typeof useForm<TemplateFormData>>;
  isLoading: boolean;
  formId: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const signatureConfig: LaudoSignatureConfig | null | undefined = watch("signatureConfig");

  const { fields, append, remove, swap } = useFieldArray({ control, name: "fields" });

  const addField = useCallback(
    (type: LaudoFieldType) => {
      append({
        id: Math.random().toString(36).slice(2),
        type,
        label: "",
        order: fields.length,
        required: false,
        width: "full",
      });
    },
    [append, fields.length]
  );

  return (
    <form id={formId} className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">
          Título <span className="text-rose-400">*</span>
        </Label>
        <Input
          id="title"
          {...register("title")}
          placeholder="Ex: Laudo de Manutenção Preventiva"
          disabled={isLoading}
        />
        {errors.title && (
          <p className="text-xs text-rose-500">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Descreva quando este template deve ser usado..."
          rows={2}
          disabled={isLoading}
          className="resize-none text-sm"
        />
      </div>

      {/* Reference type + isActive (edit only) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>
            Tipo de referência <span className="text-rose-400">*</span>
          </Label>
          <Controller
            control={control}
            name="referenceType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAINTENANCE">Manutenção</SelectItem>
                  <SelectItem value="SERVICE_ORDER">Ordem de Serviço</SelectItem>
                  <SelectItem value="CUSTOM">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.referenceType && (
            <p className="text-xs text-rose-500">{errors.referenceType.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="flex items-center gap-2 h-10">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                  disabled={isLoading}
                  id="isActive"
                />
              )}
            />
            <Label htmlFor="isActive" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
              {watch("isActive") !== false ? "Ativo" : "Inativo"}
            </Label>
          </div>
        </div>
      </div>

      {/* Field builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Campos <span className="text-rose-400">*</span>{" "}
            <span className="text-slate-400 font-normal text-xs">
              ({fields.length} {fields.length === 1 ? "campo" : "campos"})
            </span>
          </Label>
        </div>

        {errors.fields && !Array.isArray(errors.fields) && (
          <p className="text-xs text-rose-500">{(errors.fields as any).message}</p>
        )}

        {/* Existing fields */}
        <div className="space-y-2">
          {fields.map((field, index) => (
            <FieldRow
              key={field.id}
              index={index}
              total={fields.length}
              control={control}
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue as any}
              getValues={getValues as any}
              onRemove={() => remove(index)}
              onMove={(dir) => {
                if (dir === "up" && index > 0) swap(index, index - 1);
                if (dir === "down" && index < fields.length - 1) swap(index, index + 1);
              }}
            />
          ))}
        </div>

        {/* Add field buttons */}
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs text-slate-400 mb-2 font-medium">Adicionar campo</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                "SHORT_TEXT",
                "LONG_TEXT",
                "NUMBER",
                "DATE",
                "TABLE",
                "MULTI_SELECT",
                "SINGLE_SELECT",
                "CHECKBOX",
                "IMAGE",
                "HEADING",
                "DIVIDER",
              ] as LaudoFieldType[]
            ).map((type) => {
              const Icon = FIELD_TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => addField(type)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
                >
                  <Icon className="w-3 h-3 text-slate-400" />
                  {FIELD_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Signature config */}
      <SignatureConfigSection
        value={signatureConfig}
        onChange={(cfg) => setValue("signatureConfig", cfg)}
        disabled={isLoading}
      />

      {/* Preview button — floating */}
      <div className="sticky bottom-0 pt-4 pb-1 bg-gradient-to-t from-white via-white dark:from-slate-950 dark:via-slate-950">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          className="w-full gap-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-all"
        >
          <Eye className="w-4 h-4" />
          Visualizar preview do template
        </Button>
      </div>

      {/* Preview dialog */}
      <TemplatePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={watch("title")}
        description={watch("description")}
        referenceType={watch("referenceType")}
        fields={fields.map((f, i) => ({
          ...f,
          ...(getValues(`fields.${i}` as any) ?? {}),
        })) as any}
        signatureConfig={signatureConfig}
      />
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LaudoTemplatesPage() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [refTypeFilter, setRefTypeFilter] = useState<LaudoReferenceType | "ALL">("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<LaudoTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LaudoTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<LaudoTemplate | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

  const { data, isLoading } = useLaudoTemplates(
    refTypeFilter !== "ALL" ? { referenceType: refTypeFilter, limit: 100 } : { limit: 100 }
  );

  const createMutation = useCreateLaudoTemplate();
  const deleteMutation = useDeleteLaudoTemplate();
  const cloneMutation = useCloneLaudoTemplate();

  // ── Forms ────────────────────────────────────────────────────────────────────

  const createForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      title: "",
      description: "",
      referenceType: "MAINTENANCE",
      fields: [],
      isActive: true,
      signatureConfig: null,
    },
  });

  const editForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
  });

  // Update mutation instance changes per editTemplate
  const updateMutation = useUpdateLaudoTemplate(editTemplate?.id ?? "");

  async function openEdit(template: LaudoTemplate) {
    setLoadingEditId(template.id);
    try {
      const full = await laudoTemplatesService.getById(template.id);
      setEditTemplate(full);
      editForm.reset({
        title: full.title,
        description: full.description ?? "",
        referenceType: full.referenceType,
        fields: (full.fields ?? []).map((f, i) => ({ ...f, order: i })),
        isActive: full.isActive,
        signatureConfig: full.signatureConfig ?? null,
      });
    } catch {
      toast.error("Erro ao carregar template");
    } finally {
      setLoadingEditId(null);
    }
  }

  function handleCreate(data: TemplateFormData) {
    createMutation.mutate(
      {
        title: data.title,
        description: data.description,
        referenceType: data.referenceType,
        fields: data.fields.map((f, i) => ({ ...f, order: i })) as any,
        signatureConfig: data.signatureConfig ?? null,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          createForm.reset();
        },
      }
    );
  }

  function handleUpdate(data: TemplateFormData) {
    if (!editTemplate) return;
    updateMutation.mutate(
      {
        title: data.title,
        description: data.description,
        referenceType: data.referenceType,
        fields: data.fields.map((f, i) => ({ ...f, order: i })) as any,
        isActive: data.isActive,
        signatureConfig: data.signatureConfig ?? null,
      },
      {
        onSuccess: () => {
          setEditTemplate(null);
          editForm.reset();
        },
      }
    );
  }

  function handleToggleActive(template: LaudoTemplate) {
    setTogglingId(template.id);
    laudoTemplatesService
      .update(template.id, { isActive: !template.isActive })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: laudoTemplateKeys.all });
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setTogglingId(null));
  }

  // ── Filtered list ────────────────────────────────────────────────────────────

  const templates = (data?.data ?? []).filter((t) => {
    if (!search) return true;
    return t.title.toLowerCase().includes(search.toLowerCase());
  });

  const canCreate = permissions.isManager || permissions.isTechnician || permissions.canAccess('laudo-template', 'create');
  const canEdit = permissions.isManager || permissions.canAccess('laudo-template', 'update');

  const canAccesPage = permissions.isCompanyLevel || permissions.canAccess('laudo-template', 'list');

  if (!canAccesPage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/25">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              Templates de Laudo
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isLoading
                ? "Carregando..."
                : total > 0
                  ? `${total} template${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`
                  : "Nenhum template cadastrado"}
            </p>
          </div>
        </div>

        {canCreate && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar por título..."
            className="pl-9 bg-white dark:bg-slate-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
          {(["ALL", "MAINTENANCE", "SERVICE_ORDER", "CUSTOM"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRefTypeFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                refTypeFilter === f
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              {f === "ALL" ? "Todos" : REFERENCE_TYPE_LABELS[f as LaudoReferenceType]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {search || refTypeFilter !== "ALL" ? "Nenhum template encontrado" : "Nenhum template cadastrado"}
          </h3>
          <p className="text-sm text-slate-400 max-w-xs mb-4">
            {search || refTypeFilter !== "ALL"
              ? "Tente ajustar os filtros de busca."
              : "Crie templates reutilizáveis para gerar laudos de manutenção."}
          </p>
          {canCreate && !search && refTypeFilter === "ALL" && (
            <Button
              onClick={() => setCreateOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Criar primeiro template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => openEdit(template)}
              onDelete={() => setDeleteTarget(template)}
              onClone={() => cloneMutation.mutate(template.id)}
              onPreview={() => setPreviewTarget(template)}
              onToggleActive={() => handleToggleActive(template)}
              isTogglingActive={togglingId === template.id && updateMutation.isPending}
              isLoadingEdit={loadingEditId === template.id}
            />
          ))}  
        </div>
      )}

      {/* ── Create Drawer ── */}
      <Drawer open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); createForm.reset(); } else setCreateOpen(true); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Novo template de laudo</DrawerTitle>
            <DrawerDescription>
              Defina os campos que farão parte dos laudos gerados com este template.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <TemplateForm
              form={createForm}
              isLoading={createMutation.isPending}
              formId="create-template-form"
            />
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="outline"
              onClick={() => { setCreateOpen(false); createForm.reset(); }}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-template-form"
              onClick={createForm.handleSubmit(handleCreate)}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar template
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Edit Drawer ── */}
      <Drawer
        open={!!editTemplate}
        onOpenChange={(open) => { if (!open) { setEditTemplate(null); editForm.reset(); } }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar template</DrawerTitle>
            <DrawerDescription>
              Altere os campos e configurações do template.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <TemplateForm
              form={editForm}
              isLoading={updateMutation.isPending}
              formId="edit-template-form"
            />
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="outline"
              onClick={() => { setEditTemplate(null); editForm.reset(); }}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="edit-template-form"
              onClick={editForm.handleSubmit(handleUpdate)}
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteTarget?.title}</strong>? Esta ação não pode ser
              desfeita. Templates com laudos vinculados não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget.id, {
                  onSettled: () => setDeleteTarget(null),
                });
              }}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Preview from card ── */}
      {previewTarget && (
        <TemplatePreviewDialog
          open={!!previewTarget}
          onOpenChange={(open) => !open && setPreviewTarget(null)}
          title={previewTarget.title}
          description={previewTarget.description ?? ""}
          referenceType={previewTarget.referenceType}
          fields={previewTarget.fields ?? []}
          signatureConfig={previewTarget.signatureConfig}
        />
      )}
    </div>
  );
}
