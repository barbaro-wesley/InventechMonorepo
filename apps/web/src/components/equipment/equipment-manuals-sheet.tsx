'use client'

import { useState, useRef } from 'react'
import {
  BookOpen, Plus, Trash2, ExternalLink, FileText, Type, Link2,
  Upload, Loader2, ChevronDown, ChevronUp, Eye, EyeOff, X,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { useManuals, useCreateManual, useUpdateManual, useDeleteManual } from '@/hooks/equipment/use-manuals'
import { manualService, EquipmentManual, ManualType } from '@/services/equipment/manual.service'
import type { Equipment } from '@/services/equipment/equipment.service'
import { toast } from 'sonner'

const TYPE_LABELS: Record<ManualType, string> = {
  PDF: 'PDF',
  TEXTO: 'Texto',
  LINK: 'Link / URL',
}

const TYPE_ICONS: Record<ManualType, React.ReactNode> = {
  PDF: <FileText className="w-3.5 h-3.5" />,
  TEXTO: <Type className="w-3.5 h-3.5" />,
  LINK: <Link2 className="w-3.5 h-3.5" />,
}

const TYPE_COLORS: Record<ManualType, string> = {
  PDF: 'bg-rose-50 text-rose-600 border-rose-200',
  TEXTO: 'bg-blue-50 text-blue-600 border-blue-200',
  LINK: 'bg-violet-50 text-violet-600 border-violet-200',
}

interface FormState {
  titulo: string
  descricao: string
  tipo: ManualType
  conteudoTexto: string
  url: string
  ativo: boolean
  file: File | null
}

const EMPTY_FORM: FormState = {
  titulo: '',
  descricao: '',
  tipo: 'PDF',
  conteudoTexto: '',
  url: '',
  ativo: true,
  file: null,
}

interface Props {
  equipment: Equipment
  open: boolean
  onClose: () => void
}

export function EquipmentManualsSheet({ equipment, open, onClose }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EquipmentManual | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: manuals = [], isLoading } = useManuals(equipment.id)
  const createManual = useCreateManual(equipment.id)
  const updateManual = useUpdateManual(equipment.id)
  const deleteManual = useDeleteManual(equipment.id)

  function handleClose() {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setExpandedId(null)
    onClose()
  }

  function handleTypeChange(tipo: ManualType) {
    setForm((f) => ({ ...f, tipo, file: null, conteudoTexto: '', url: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return

    if (form.tipo === 'PDF' && !form.file) {
      toast.error('Selecione um arquivo PDF')
      return
    }
    if (form.tipo === 'TEXTO' && !form.conteudoTexto.trim()) {
      toast.error('Preencha o conteúdo do manual')
      return
    }
    if (form.tipo === 'LINK' && !form.url.trim()) {
      toast.error('Informe a URL do manual')
      return
    }

    createManual.mutate(
      {
        payload: {
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          tipo: form.tipo,
          conteudoTexto: form.tipo === 'TEXTO' ? form.conteudoTexto : undefined,
          url: form.tipo === 'LINK' ? form.url : undefined,
          ativo: form.ativo,
        },
        file: form.tipo === 'PDF' ? form.file ?? undefined : undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false)
          setForm(EMPTY_FORM)
        },
      },
    )
  }

  function handleOpenPdf(manual: EquipmentManual) {
    window.open(manualService.getDownloadUrl(equipment.id, manual.id), '_blank')
  }

  function handleToggleAtivo(manual: EquipmentManual) {
    updateManual.mutate({ manualId: manual.id, payload: { ativo: !manual.ativo } })
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const ativos = manuals.filter((m) => m.ativo)
  const inativos = manuals.filter((m) => !m.ativo)

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
        <SheetContent className="overflow-y-auto" style={{ maxWidth: 640, width: '100%' }}>
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-lg font-bold">Manuais e Instruções</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{equipment.name}</p>
              </div>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => { setShowForm((v) => !v); setForm(EMPTY_FORM) }}
              >
                {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                {showForm ? 'Cancelar' : 'Adicionar'}
              </Button>
            </div>
          </SheetHeader>

          {/* ── Formulário de criação ── */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mt-5 p-4 border rounded-xl bg-muted/30 space-y-4">
              <p className="text-sm font-semibold text-foreground">Novo manual</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Título <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Ex: Manual de operação v2"
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Breve descrição (opcional)"
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => handleTypeChange(v as ManualType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PDF">PDF (upload de arquivo)</SelectItem>
                      <SelectItem value="TEXTO">Texto (escrever conteúdo)</SelectItem>
                      <SelectItem value="LINK">Link / URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.tipo === 'PDF' && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Arquivo PDF <span className="text-destructive">*</span></Label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
                    />
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-3 px-3 py-2.5 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground truncate">
                        {form.file ? form.file.name : 'Clique para selecionar um PDF'}
                      </span>
                      {form.file && (
                        <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                          {formatBytes(form.file.size)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {form.tipo === 'TEXTO' && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Conteúdo <span className="text-destructive">*</span></Label>
                    <Textarea
                      placeholder="Escreva as instruções aqui..."
                      rows={6}
                      value={form.conteudoTexto}
                      onChange={(e) => setForm((f) => ({ ...f, conteudoTexto: e.target.value }))}
                    />
                  </div>
                )}

                {form.tipo === 'LINK' && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>URL <span className="text-destructive">*</span></Label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    />
                  </div>
                )}

                <div className="col-span-2 flex items-center gap-2">
                  <Switch
                    id="ativo"
                    checked={form.ativo}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                  />
                  <Label htmlFor="ativo" className="cursor-pointer text-sm">
                    Manual ativo
                  </Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={createManual.isPending}>
                  {createManual.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Salvar manual
                </Button>
              </div>
            </form>
          )}

          {/* ── Lista de manuais ── */}
          <div className="mt-6 space-y-6 pb-8">
            {isLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && manuals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum manual cadastrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Adicione PDFs, textos ou links de instruções para este equipamento
                </p>
              </div>
            )}

            {ativos.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Ativos ({ativos.length})
                </p>
                <div className="space-y-2">
                  {ativos.map((manual) => (
                    <ManualCard
                      key={manual.id}
                      manual={manual}
                      expanded={expandedId === manual.id}
                      onToggleExpand={() => setExpandedId((id) => id === manual.id ? null : manual.id)}
                      onOpenPdf={() => handleOpenPdf(manual)}
                      onToggleAtivo={() => handleToggleAtivo(manual)}
                      onDelete={() => setDeleteTarget(manual)}
                    />
                  ))}
                </div>
              </section>
            )}

            {inativos.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Inativos ({inativos.length})
                </p>
                <div className="space-y-2 opacity-60">
                  {inativos.map((manual) => (
                    <ManualCard
                      key={manual.id}
                      manual={manual}
                      expanded={expandedId === manual.id}
                      onToggleExpand={() => setExpandedId((id) => id === manual.id ? null : manual.id)}
                      onOpenPdf={() => handleOpenPdf(manual)}
                      onToggleAtivo={() => handleToggleAtivo(manual)}
                      onDelete={() => setDeleteTarget(manual)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Confirmação de exclusão ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover manual</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.titulo}</strong>?
              {deleteTarget?.tipo === 'PDF' && ' O arquivo PDF também será excluído do armazenamento.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteManual.mutate(deleteTarget.id)
                  setDeleteTarget(null)
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ManualCard({
  manual, expanded,
  onToggleExpand, onOpenPdf, onToggleAtivo, onDelete,
}: {
  manual: EquipmentManual
  expanded: boolean
  onToggleExpand: () => void
  onOpenPdf: () => void
  onToggleAtivo: () => void
  onDelete: () => void
}) {
  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Tipo badge */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border flex-shrink-0 ${TYPE_COLORS[manual.tipo]}`}>
          {TYPE_ICONS[manual.tipo]}
          {TYPE_LABELS[manual.tipo]}
        </span>

        {/* Título */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{manual.titulo}</p>
          {manual.descricao && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{manual.descricao}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Por {manual.createdBy.name} · {new Date(manual.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {manual.tipo === 'PDF' && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onOpenPdf} title="Abrir PDF">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          )}
          {manual.tipo === 'LINK' && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(manual.url!, '_blank')} title="Abrir link">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          )}
          {manual.tipo === 'TEXTO' && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggleExpand} title={expanded ? 'Recolher' : 'Ver conteúdo'}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onToggleAtivo}
            title={manual.ativo ? 'Desativar' : 'Ativar'}
          >
            {manual.ativo
              ? <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Remover">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Conteúdo expandido (TEXTO) */}
      {manual.tipo === 'TEXTO' && expanded && manual.conteudoTexto && (
        <div className="px-4 pb-4 pt-1 border-t bg-muted/20">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {manual.conteudoTexto}
          </p>
        </div>
      )}

      {/* Info PDF */}
      {manual.tipo === 'PDF' && manual.fileName && (
        <div className="px-4 pb-3 pt-0 flex items-center gap-1.5 text-[11px] text-muted-foreground border-t bg-muted/10">
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{manual.fileName}</span>
          {manual.sizeBytes && <span className="flex-shrink-0">· {formatBytes(manual.sizeBytes)}</span>}
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
