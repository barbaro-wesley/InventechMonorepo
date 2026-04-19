"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Loader2, FileText, X, ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLaudoTemplates } from "@/hooks/laudo-templates/use-laudo-templates";
import { useCreateLaudo, useUpdateLaudo } from "@/hooks/laudos/use-laudos";
import { laudosService } from "@/services/laudos/laudos.service";
import { laudoTemplatesService } from "@/services/laudo-templates/laudo-templates.service";
import type {
  LaudoTemplate,
  LaudoFieldDefinition,
  LaudoReferenceType,
} from "@/services/laudo-templates/laudo-templates.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LaudoFillDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: (laudoId: string) => void;
  serviceOrderId?: string;
  maintenanceId?: string;
  clientId?: string;
  technicianId?: string;
  referenceType?: LaudoReferenceType;
  existingLaudoId?: string | null;
}

type FieldValues = Record<string, any>;

// ─── Individual field renderers ───────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: LaudoFieldDefinition;
  value: any;
  onChange: (v: any) => void;
  disabled: boolean;
}) {
  if (field.type === "HEADING") {
    return (
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
        {field.label}
      </h3>
    );
  }

  if (field.type === "DIVIDER") {
    return <hr className="border-slate-200 dark:border-slate-700" />;
  }

  if (field.type === "IMAGE") {
    return (
      <div className="space-y-1.5">
        <Input
          type="file"
          accept="image/*"
          disabled={disabled}
          className="h-9 text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => onChange(ev.target?.result ?? "");
            reader.readAsDataURL(file);
          }}
        />
        {value && (
          <img
            src={value}
            alt="preview"
            className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
          />
        )}
      </div>
    );
  }

  if (field.type === "SHORT_TEXT" || field.type === "NUMBER" || field.type === "DATE") {
    return (
      <Input
        type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ""}
        disabled={disabled}
        className="h-9 text-sm"
      />
    );
  }

  if (field.type === "LONG_TEXT") {
    return (
      <Textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ""}
        disabled={disabled}
        rows={3}
        className="text-sm resize-none"
      />
    );
  }

  if (field.type === "CHECKBOX") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={`field-${field.id}`}
          checked={!!value}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <label htmlFor={`field-${field.id}`} className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          {field.placeholder ?? "Marcar"}
        </label>
      </div>
    );
  }

  if (field.type === "SINGLE_SELECT") {
    const opts = field.options ?? [];
    if (opts.length <= 5) {
      return (
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt === value ? "" : opt)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                value === opt
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }
    return (
      <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={field.placeholder ?? "Selecionar..."} />
        </SelectTrigger>
        <SelectContent>
          {opts.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "MULTI_SELECT") {
    const opts = field.options ?? [];
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (checked) onChange(selected.filter((v) => v !== opt));
                else onChange([...selected, opt]);
              }}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                checked
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
              )}
            >
              {opt}
            </button>
          );
        })}
        {opts.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sem opções definidas no template</p>
        )}
      </div>
    );
  }

  if (field.type === "TABLE") {
    const cols = field.tableColumns ?? [];
    const rows: Record<string, string>[] = Array.isArray(value) ? value : [];

    const addRow = () => {
      const emptyRow = cols.reduce<Record<string, string>>((acc, col) => {
        acc[col.key] = "";
        return acc;
      }, {});
      onChange([...rows, emptyRow]);
    };

    const updateCell = (rowIdx: number, colKey: string, cellValue: string) => {
      const updated = rows.map((row, i) =>
        i === rowIdx ? { ...row, [colKey]: cellValue } : row
      );
      onChange(updated);
    };

    const removeRow = (rowIdx: number) => {
      onChange(rows.filter((_, i) => i !== rowIdx));
    };

    if (cols.length === 0) {
      return <p className="text-xs text-slate-400 italic">Tabela sem colunas definidas no template</p>;
    }

    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                {cols.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                    {col.label}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  {cols.map((col) => (
                    <td key={col.key} className="px-2 py-1.5">
                      <Input
                        type={col.type === "number" ? "number" : "text"}
                        value={row[col.key] ?? ""}
                        onChange={(e) => updateCell(ri, col.key, e.target.value)}
                        disabled={disabled}
                        className="h-7 text-xs border-0 shadow-none focus-visible:ring-1 focus-visible:ring-blue-500 bg-transparent"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      disabled={disabled}
                      className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-300 hover:text-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="px-3 py-4 text-center text-slate-400 italic text-xs">
                    Nenhuma linha adicionada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={disabled}
          className="h-7 text-xs gap-1.5"
        >
          <Plus className="w-3 h-3" />
          Adicionar linha
        </Button>
      </div>
    );
  }

  return null;
}

// ─── LaudoFillDrawer ─────────────────────────────────────────────────────────

export function LaudoFillDrawer({
  open,
  onClose,
  onSaved,
  serviceOrderId,
  maintenanceId,
  clientId,
  technicianId,
  referenceType = "SERVICE_ORDER",
  existingLaudoId,
}: LaudoFillDrawerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<LaudoTemplate | null>(null);
  const [fields, setFields] = useState<LaudoFieldDefinition[]>([]);
  const [values, setValues] = useState<FieldValues>({});
  const [notes, setNotes] = useState("");
  const [savedLaudoId, setSavedLaudoId] = useState<string | null>(existingLaudoId ?? null);
  const [checkingDraft, setCheckingDraft] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [signing, setSigning] = useState(false);

  function buildInitialValues(fieldList: LaudoFieldDefinition[]): FieldValues {
    const init: FieldValues = {};
    fieldList.forEach((f) => {
      const stored = (f as any).value;
      if (stored !== undefined && stored !== null) {
        init[f.id] = stored;
      } else if (f.type === "TABLE" || f.type === "MULTI_SELECT") {
        init[f.id] = [];
      } else if (f.type === "CHECKBOX") {
        init[f.id] = false;
      } else {
        init[f.id] = "";
      }
    });
    return init;
  }

  function sanitizeFields(raw: any[]): LaudoFieldDefinition[] {
    return raw.filter(
      (f) => f !== null && typeof f === "object" && !Array.isArray(f) && typeof f.type === "string"
    ) as LaudoFieldDefinition[];
  }

  const { data: templatesData, isLoading: loadingTemplates } = useLaudoTemplates({
    referenceType,
    isActive: true,
    limit: 100,
  });

  useEffect(() => {
    if (!open || !existingLaudoId) return;
    setLoadingExisting(true);
    laudosService.getById(existingLaudoId)
      .then((laudo) => {
        const fieldList = sanitizeFields(laudo.fields as any[] ?? []);
        setSavedLaudoId(laudo.id);
        setNotes(laudo.notes ?? "");
        setFields(fieldList);
        setValues(buildInitialValues(fieldList));
        setSelectedTemplate({ id: laudo.templateId ?? "", title: laudo.title, signatureConfig: laudo.template?.signatureConfig } as any);
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingLaudoId]);

  useEffect(() => {
    if (!open || !serviceOrderId || savedLaudoId || existingLaudoId) return;
    setCheckingDraft(true);
    laudosService.findDraftForServiceOrder(serviceOrderId)
      .then((draft) => {
        if (draft) {
          const fieldList = sanitizeFields(draft.fields as any[] ?? []);
          setSavedLaudoId(draft.id);
          setNotes(draft.notes ?? "");
          setFields(fieldList);
          setValues(buildInitialValues(fieldList));
          setSelectedTemplate({ id: draft.templateId ?? "", title: draft.title, signatureConfig: draft.template?.signatureConfig } as any);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingDraft(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceOrderId]);

  const createLaudo = useCreateLaudo();
  const updateLaudo = useUpdateLaudo(savedLaudoId ?? "");

  const templates = templatesData?.data ?? [];

  // Whether the selected template requires e-sign
  const templateRequiresSignature = !!(selectedTemplate as any)?.signatureConfig?.requireSignature;

  const handleSelectTemplate = useCallback(
    async (tpl: LaudoTemplate) => {
      setLoadingTemplate(true);
      try {
        const [full, preview] = await Promise.all([
          laudoTemplatesService.getById(tpl.id),
          laudosService.previewFields({
            templateId: tpl.id,
            clientId,
            serviceOrderId,
            maintenanceId,
            technicianId,
          }),
        ]);
        const fieldList = sanitizeFields(preview.fields ?? full.fields ?? []);
        if (fieldList.length === 0) {
          toast.error("Este template não possui campos válidos. Edite o template para adicionar campos.");
          return;
        }
        setSelectedTemplate(full);
        setFields(fieldList);
        setValues(buildInitialValues(fieldList));
      } catch {
        toast.error("Erro ao carregar template.");
      } finally {
        setLoadingTemplate(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId, serviceOrderId, maintenanceId, technicianId]
  );

  const setFieldValue = useCallback((fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const buildFilledFields = (): LaudoFieldDefinition[] =>
    fields.map((f) => ({ ...f, value: values[f.id] ?? null }));

  // Save laudo (returns the laudo id)
  const doSave = async (): Promise<string> => {
    if (!selectedTemplate) throw new Error("No template");
    const filledFields = buildFilledFields();

    if (savedLaudoId) {
      await updateLaudo.mutateAsync({ fields: filledFields, notes: notes || undefined });
      return savedLaudoId;
    } else {
      const laudo = await createLaudo.mutateAsync({
        title: selectedTemplate.title,
        referenceType,
        templateId: selectedTemplate.id,
        serviceOrderId,
        maintenanceId,
        clientId,
        technicianId,
        fields: filledFields,
        notes: notes || undefined,
      });
      setSavedLaudoId(laudo.id);
      return laudo.id;
    }
  };

  const handleSave = async () => {
    try {
      const laudoId = await doSave();
      toast.success("Laudo salvo com sucesso!");
      onSaved(laudoId);
    } catch {
      // error already toasted by hook
    }
  };

  const handleSaveAndSign = async () => {
    try {
      const laudoId = await doSave();
      setSigning(true);
      try {
        // Generate (or regenerate) PDF so pdfUrl is stored before signing
        await laudosService.regeneratePdf(laudoId);
        // Initiate sign — backend auto-resolves signers from template signatureConfig
        await laudosService.initiateSign(laudoId, { signers: [] });
        toast.success("Laudo enviado para assinatura!");
        onSaved(laudoId);
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? "Erro ao iniciar assinatura";
        toast.error(msg);
      } finally {
        setSigning(false);
      }
    } catch {
      // save error already toasted by hook
    }
  };

  const isSaving = createLaudo.isPending || updateLaudo.isPending || loadingTemplate || loadingExisting || signing;

  const handleClose = () => {
    if (!savedLaudoId) {
      setSelectedTemplate(null);
      setFields([]);
      setValues({});
      setNotes("");
    }
    onClose();
  };

  const visibleFields = fields.filter((f) => f.type !== "HEADING" && f.type !== "DIVIDER");
  const requiredFilled = visibleFields
    .filter((f) => f.required)
    .every((f) => {
      const v = values[f.id];
      if (f.type === "TABLE") return Array.isArray(v) && v.length > 0;
      if (f.type === "MULTI_SELECT") return Array.isArray(v) && v.length > 0;
      if (f.type === "CHECKBOX") return !!v;
      return v !== "" && v !== null && v !== undefined;
    });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && handleClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            {selectedTemplate ? `Preencher: ${selectedTemplate.title}` : "Criar Laudo Técnico"}
          </DrawerTitle>
          <DrawerDescription>
            {selectedTemplate
              ? savedLaudoId && existingLaudoId === null
                ? "Rascunho encontrado — continue preenchendo ou salve para vincular à OS."
                : "Preencha os campos abaixo. Campos com * são obrigatórios."
              : "Selecione um template para iniciar o preenchimento do laudo."}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-5">
          {/* Template selector */}
          {!selectedTemplate && (
            <div className="space-y-3">
              {checkingDraft || loadingTemplates ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando templates...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum template ativo encontrado para este tipo de OS.
                </p>
              ) : (
                <div className="grid gap-2">
                  {templates.map((tpl) => {
                    const hasSignature = !!(tpl as any).signatureConfig?.requireSignature;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl)}
                        className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                            {tpl.title}
                          </p>
                          {tpl.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{tpl.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-slate-400">{tpl.fields?.length ?? 0} campos</p>
                            {hasSignature && (
                              <span className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                                <ShieldCheck className="w-3 h-3" />
                                Requer assinatura
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Field form */}
          {selectedTemplate && fields.length > 0 && (
            <div className="space-y-4">
              {!savedLaudoId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setFields([]);
                    setValues({});
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ← Trocar template
                </button>
              )}

              {/* Signature badge */}
              {templateRequiresSignature && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                  <ShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <p className="text-xs text-violet-700 dark:text-violet-300">
                    Este template requer assinatura eletrônica. Após salvar, o laudo será enviado automaticamente para os signatários configurados.
                  </p>
                </div>
              )}

              {fields.map((field, idx) => {
                const fieldKey = field.id || `field-${idx}`;
                const isLayout = field.type === "HEADING" || field.type === "DIVIDER";

                if (isLayout) {
                  return (
                    <div key={fieldKey}>
                      <FieldInput
                        field={field}
                        value={values[field.id]}
                        onChange={(v) => setFieldValue(field.id, v)}
                        disabled={isSaving}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={fieldKey}
                    className={cn("space-y-1.5", field.width === "half" ? "sm:w-1/2" : "w-full")}
                  >
                    <Label className="text-sm text-slate-700 dark:text-slate-300">
                      {field.label}
                      {field.required && <span className="text-rose-400 ml-0.5">*</span>}
                    </Label>
                    <FieldInput
                      field={field}
                      value={values[field.id]}
                      onChange={(v) => setFieldValue(field.id, v)}
                      disabled={isSaving}
                    />
                    {field.type !== "CHECKBOX" && field.placeholder && field.type !== "SHORT_TEXT" && field.type !== "LONG_TEXT" && (
                      <p className="text-xs text-slate-400">{field.placeholder}</p>
                    )}
                  </div>
                );
              })}

              {/* Notes */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-sm text-slate-600 dark:text-slate-400">Observações gerais</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações adicionais sobre este laudo..."
                  rows={2}
                  disabled={isSaving}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          )}
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            {savedLaudoId ? "Fechar" : "Cancelar"}
          </Button>

          {selectedTemplate && (
            <>
              {/* Save only — always available */}
              <Button
                onClick={handleSave}
                disabled={isSaving || !requiredFilled}
                variant={templateRequiresSignature ? "outline" : "default"}
                className={templateRequiresSignature ? "" : "bg-blue-600 hover:bg-blue-700 text-white"}
              >
                {(createLaudo.isPending || updateLaudo.isPending) && !signing && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {savedLaudoId ? "Atualizar laudo" : "Salvar rascunho"}
              </Button>

              {/* Save + Sign — shown when template has signatureConfig */}
              {templateRequiresSignature && (
                <Button
                  onClick={handleSaveAndSign}
                  disabled={isSaving || !requiredFilled}
                  className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                >
                  {signing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {!signing && <Send className="w-4 h-4" />}
                  Salvar e assinar
                </Button>
              )}
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
