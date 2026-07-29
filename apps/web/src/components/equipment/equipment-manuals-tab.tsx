'use client';

import React, { useState, useRef } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  ExternalLink,
  FileText,
  Type,
  Link2,
  Upload,
  Loader2,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import {
  useManuals,
  useCreateManual,
  useUpdateManual,
  useDeleteManual,
} from "@/hooks/equipment/use-manuals";
import {
  manualService,
  EquipmentManual,
  ManualType,
} from "@/services/equipment/manual.service";
import type { Equipment } from "@/services/equipment/equipment.service";
import { toast } from "sonner";

const TYPE_LABELS: Record<ManualType, string> = {
  PDF: "PDF",
  TEXTO: "Texto",
  LINK: "Link / URL",
};

const TYPE_ICONS: Record<ManualType, React.ReactNode> = {
  PDF: <FileText className="w-4 h-4 text-rose-500" />,
  TEXTO: <Type className="w-4 h-4 text-blue-500" />,
  LINK: <Link2 className="w-4 h-4 text-violet-500" />,
};

const TYPE_COLORS: Record<ManualType, string> = {
  PDF: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900",
  TEXTO: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
  LINK: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900",
};

interface FormState {
  titulo: string;
  descricao: string;
  tipo: ManualType;
  conteudoTexto: string;
  url: string;
  ativo: boolean;
  file: File | null;
}

const EMPTY_FORM: FormState = {
  titulo: "",
  descricao: "",
  tipo: "PDF",
  conteudoTexto: "",
  url: "",
  ativo: true,
  file: null,
};

interface EquipmentManualsTabProps {
  equipment: Equipment;
}

export function EquipmentManualsTab({ equipment }: EquipmentManualsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentManual | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: manuals = [], isLoading } = useManuals(equipment.id);
  const createManual = useCreateManual(equipment.id);
  const updateManual = useUpdateManual(equipment.id);
  const deleteManual = useDeleteManual(equipment.id);

  function handleTypeChange(tipo: ManualType) {
    setForm((f) => ({ ...f, tipo, file: null, conteudoTexto: "", url: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) {
      toast.error("Informe o título do manual");
      return;
    }

    if (form.tipo === "PDF" && !form.file) {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    if (form.tipo === "TEXTO" && !form.conteudoTexto.trim()) {
      toast.error("Preencha o conteúdo do manual");
      return;
    }
    if (form.tipo === "LINK" && !form.url.trim()) {
      toast.error("Informe a URL do manual");
      return;
    }

    createManual.mutate(
      {
        payload: {
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          tipo: form.tipo,
          conteudoTexto: form.tipo === "TEXTO" ? form.conteudoTexto : undefined,
          url: form.tipo === "LINK" ? form.url : undefined,
          ativo: form.ativo,
        },
        file: form.tipo === "PDF" ? form.file ?? undefined : undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm(EMPTY_FORM);
        },
      }
    );
  }

  function handleOpenPdf(manual: EquipmentManual) {
    window.open(manualService.getDownloadUrl(equipment.id, manual.id), "_blank");
  }

  function handleToggleAtivo(manual: EquipmentManual) {
    updateManual.mutate({ manualId: manual.id, payload: { ativo: !manual.ativo } });
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      {/* ── Tab Header Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            Manuais e Instruções
            <span className="text-xs font-normal text-muted-foreground">
              ({manuals.length} {manuals.length === 1 ? "manual" : "manuais"})
            </span>
          </h3>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowForm((v) => !v);
            setForm(EMPTY_FORM);
          }}
          className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
        >
          {showForm ? <X className="w-3.5 h-3.5 mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
          {showForm ? "Cancelar" : "Adicionar manual"}
        </Button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">Cadastrar Novo Manual</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowForm(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: Manual de Operação e Manutenção"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                className="bg-white dark:bg-slate-950"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">Descrição</Label>
              <Input
                placeholder="Breve descrição ou observações (opcional)"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                className="bg-white dark:bg-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo do Manual</Label>
              <Select value={form.tipo} onValueChange={(v) => handleTypeChange(v as ManualType)}>
                <SelectTrigger className="bg-white dark:bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">Arquivo PDF</SelectItem>
                  <SelectItem value="TEXTO">Texto Corrido / Instruções</SelectItem>
                  <SelectItem value="LINK">Link / URL Externa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end pb-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, ativo: checked }))}
                  id="tab-manual-ativo"
                />
                <Label htmlFor="tab-manual-ativo" className="text-xs font-medium cursor-pointer">
                  Manual ativo para consulta
                </Label>
              </div>
            </div>

            {/* Sub-inputs por tipo */}
            {form.tipo === "PDF" && (
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">
                  Arquivo PDF <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileRef}
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setForm((f) => ({ ...f, file }));
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    className="bg-white dark:bg-slate-950 text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    {form.file ? "Alterar arquivo" : "Selecionar arquivo PDF"}
                  </Button>
                  {form.file && (
                    <span className="text-xs text-muted-foreground truncate">
                      {form.file.name} ({formatBytes(form.file.size)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {form.tipo === "TEXTO" && (
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">
                  Conteúdo do Manual / Instruções <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Escreva aqui as instruções de uso, cuidados ou procedimentos de manutenção..."
                  value={form.conteudoTexto}
                  onChange={(e) => setForm((f) => ({ ...f, conteudoTexto: e.target.value }))}
                  rows={4}
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            )}

            {form.tipo === "LINK" && (
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">
                  URL / Link do Manual <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="url"
                  placeholder="https://exemplo.com/manual.pdf"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createManual.isPending}
              className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createManual.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar manual"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : manuals.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 text-center">
          <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhum manual cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Cadastre manuais em PDF, links externos ou instruções de texto para este equipamento.
          </p>
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="mt-4 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Adicionar manual
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {manuals.map((manual) => {
            const isExpanded = expandedId === manual.id;
            return (
              <div
                key={manual.id}
                className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all ${
                  !manual.ativo ? "opacity-60 bg-slate-50/50 dark:bg-slate-950/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {TYPE_ICONS[manual.tipo]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {manual.titulo}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            TYPE_COLORS[manual.tipo]
                          }`}
                        >
                          {TYPE_LABELS[manual.tipo]}
                        </span>
                        {!manual.ativo && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                            Inativo
                          </span>
                        )}
                      </div>
                      {manual.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5">{manual.descricao}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {manual.sizeBytes ? `${formatBytes(manual.sizeBytes)} · ` : ""}
                        Criado por {manual.createdBy.name} em{" "}
                        {new Date(manual.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {manual.tipo === "PDF" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPdf(manual)}
                        className="h-8 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Abrir PDF
                      </Button>
                    )}

                    {manual.tipo === "LINK" && manual.url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(manual.url!, "_blank")}
                        className="h-8 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Acessar Link
                      </Button>
                    )}

                    {manual.tipo === "TEXTO" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedId(isExpanded ? null : manual.id)}
                        className="h-8 text-xs"
                      >
                        {isExpanded ? "Ocultar" : "Ver texto"}
                      </Button>
                    )}

                    <button
                      type="button"
                      title={manual.ativo ? "Desativar manual" : "Ativar manual"}
                      onClick={() => handleToggleAtivo(manual)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {manual.ativo ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                    </button>

                    <button
                      type="button"
                      title="Excluir manual"
                      onClick={() => setDeleteTarget(manual)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded text content */}
                {isExpanded && manual.tipo === "TEXTO" && manual.conteudoTexto && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs text-foreground whitespace-pre-wrap font-sans">
                    {manual.conteudoTexto}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover manual</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o manual <strong>{deleteTarget?.titulo}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteManual.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteManual.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
