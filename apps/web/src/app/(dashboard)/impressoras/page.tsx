"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Printer,
  Copy,
  Check,
  ScanLine,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  usePrinters,
  useCreatePrinter,
  useUpdatePrinter,
  useDeletePrinter,
} from "@/hooks/printers/use-printers";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { scansService } from "@/services/printers/scans.service";
import type { Printer as PrinterType } from "@/services/printers/printers.service";

// ─── IP validation ────────────────────────────────────────────────────────────

const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

const printerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  ipAddress: z.string().min(1, "IP obrigatório").regex(ipRegex, "Formato de IP inválido"),
  brand: z.string().optional(),
  model: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),
});
type PrinterForm = z.infer<typeof printerSchema>;

// ─── SFTP Card ────────────────────────────────────────────────────────────────

function CopyInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copiado!" : "Copiar diretório"}
      className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-white hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? "Copiado!" : "Copiar"}</span>
    </button>
  );
}

function SftpCard({ sftpConfig }: { sftpConfig: PrinterType["sftpConfig"] }) {
  const [copied, setCopied] = useState(false);

  if (!sftpConfig) return null;

  const text = `Protocolo:        SFTP\nHost:             ${sftpConfig.host}\nPorta:            ${sftpConfig.port}\nUsuário:          ${sftpConfig.username}\nDiretório remoto: ${sftpConfig.remoteDirectory}`;

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-slate-50 p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configuração SFTP
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={handleCopy}>
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar configuração"}
        </Button>
      </div>
      <div className="font-mono text-xs space-y-1 text-foreground">
        <div className="flex gap-2"><span className="text-muted-foreground w-36">Host:</span><span>{sftpConfig.host}</span></div>
        <div className="flex gap-2"><span className="text-muted-foreground w-36">Porta:</span><span>{sftpConfig.port}</span></div>
        <div className="flex gap-2"><span className="text-muted-foreground w-36">Usuário:</span><span>{sftpConfig.username}</span></div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-36">Diretório remoto:</span>
          <span className="font-semibold">{sftpConfig.remoteDirectory}</span>
          <CopyInline value={sftpConfig.remoteDirectory} />
        </div>
      </div>
    </div>
  );
}

// ─── SFTP Success Modal ───────────────────────────────────────────────────────

function SftpSuccessModal({
  open,
  printer,
  onClose,
}: {
  open: boolean;
  printer: PrinterType | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!printer?.sftpConfig) return null;

  const { sftpConfig } = printer;
  const text = `Protocolo:        SFTP\nHost:             ${sftpConfig.host}\nPorta:            ${sftpConfig.port}\nUsuário:          ${sftpConfig.username}\nDiretório:        ${sftpConfig.remoteDirectory}`;

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "var(--primary)20" }}
            >
              <Printer className="w-4 h-4" style={{ color: "var(--primary)" }} />
            </div>
            Impressora cadastrada!
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Configure o seguinte no painel da impressora:
        </p>

        <div className="rounded-lg border border-border bg-slate-50 p-4 font-mono text-xs space-y-1.5">
          <div className="flex gap-2"><span className="text-muted-foreground w-28">Protocolo:</span><span>SFTP</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-28">Host:</span><span>{sftpConfig.host}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-28">Porta:</span><span>{sftpConfig.port}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-28">Usuário:</span><span>{sftpConfig.username}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-28">Diretório:</span>
            <span className="font-semibold">{sftpConfig.remoteDirectory}</span>
            <CopyInline value={sftpConfig.remoteDirectory} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="gap-1.5" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Printer Form Sheet ───────────────────────────────────────────────────────

function PrinterSheet({
  open,
  editTarget,
  onClose,
  onCreated,
}: {
  open: boolean;
  editTarget: PrinterType | null;
  onClose: () => void;
  onCreated: (p: PrinterType) => void;
}) {
  const create = useCreatePrinter();
  const update = useUpdatePrinter();
  const isPending = create.isPending || update.isPending;

  const { data: costCenters = [] } = useCostCenters({ limit: 100 });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<PrinterForm>({
    resolver: zodResolver(printerSchema),
    values: editTarget
      ? {
          name: editTarget.name,
          ipAddress: editTarget.ipAddress,
          brand: editTarget.brand ?? "",
          model: editTarget.model ?? "",
          costCenterId: editTarget.costCenterId ?? "",
          notes: editTarget.notes ?? "",
        }
      : { name: "", ipAddress: "", brand: "", model: "", costCenterId: "", notes: "" },
  });

  function buildDto(data: PrinterForm) {
    return {
      name: data.name,
      ipAddress: data.ipAddress,
      brand: data.brand || undefined,
      model: data.model || undefined,
      costCenterId: data.costCenterId || undefined,
      notes: data.notes || undefined,
    };
  }

  function onSubmit(data: PrinterForm) {
    if (editTarget) {
      update.mutate(
        { id: editTarget.id, dto: buildDto(data) },
        { onSuccess: () => { reset(); onClose(); } }
      );
    } else {
      create.mutate(buildDto(data), {
        onSuccess: (printer) => {
          reset();
          onClose();
          onCreated(printer);
        },
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editTarget ? "Editar impressora" : "Nova impressora"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {editTarget ? "Atualize os dados da impressora." : "Cadastre uma nova impressora na rede."}
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nome *</Label>
            <Input id="p-name" placeholder='Ex: Brother RH' {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-ip">IP da Impressora *</Label>
            <Input id="p-ip" placeholder="Ex: 192.168.0.100" {...register("ipAddress")} />
            {errors.ipAddress && <p className="text-xs text-destructive">{errors.ipAddress.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-brand">
                Marca <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input id="p-brand" placeholder="Ex: Brother" {...register("brand")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-model">
                Modelo <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input id="p-model" placeholder="Ex: L6902DW" {...register("model")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Centro de Custo <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Controller
              control={control}
              name="costCenterId"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.name}
                        {cc.code && <span className="text-muted-foreground ml-1">· {cc.code}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-notes">
              Observações <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea id="p-notes" placeholder="Informações adicionais..." rows={3} {...register("notes")} />
          </div>

          <SheetFooter className="mt-auto pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : editTarget ? "Salvar" : "Criar impressora"
              }
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Printer Detail Sheet ─────────────────────────────────────────────────────

function PrinterDetailSheet({
  printer,
  onClose,
  onEdit,
}: {
  printer: PrinterType | null;
  onClose: () => void;
  onEdit: (p: PrinterType) => void;
}) {
  const [tab, setTab] = useState<"info" | "scans">("info");
  const [scans, setScans] = useState<Awaited<ReturnType<typeof scansService.list>>>([]);
  const [loadingScans, setLoadingScans] = useState(false);

  function loadScans() {
    if (!printer) return;
    setLoadingScans(true);
    scansService
      .list({ printerId: printer.id })
      .then((data) => setScans(data.slice(0, 10)))
      .catch(() => toast.error("Erro ao carregar scans"))
      .finally(() => setLoadingScans(false));
  }

  function handleTabChange(t: "info" | "scans") {
    setTab(t);
    if (t === "scans" && scans.length === 0) loadScans();
  }

  if (!printer) return null;

  return (
    <Sheet open={!!printer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle>{printer.name}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{printer.ipAddress}</p>
            </div>
            <Badge
              className={printer.isActive
                ? "bg-green-100 text-green-700 border-0"
                : "bg-gray-100 text-gray-500 border-0"
              }
            >
              {printer.isActive ? "Ativa" : "Inativa"}
            </Badge>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-border mt-4">
          {(["info", "scans"] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "info" ? "Informações" : "Scans recentes"}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {printer.brand && (
                <div>
                  <p className="text-xs text-muted-foreground">Marca</p>
                  <p className="font-medium">{printer.brand}</p>
                </div>
              )}
              {printer.model && (
                <div>
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="font-medium">{printer.model}</p>
                </div>
              )}
              {printer.costCenter && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Centro de Custo</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="font-medium">{printer.costCenter.name}</p>
                    {printer.costCenter.code && (
                      <Badge className="text-xs bg-muted text-muted-foreground border-0 font-mono">
                        {printer.costCenter.code}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Total de Scans</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ScanLine className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{printer._count.scans}</p>
                </div>
              </div>
              {printer.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm mt-0.5">{printer.notes}</p>
                </div>
              )}
            </div>

            <SftpCard sftpConfig={printer.sftpConfig} />

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { onClose(); onEdit(printer); }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar impressora
            </Button>
          </div>
        )}

        {tab === "scans" && (
          <div className="mt-4">
            {loadingScans ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : scans.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <ScanLine className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Nenhum scan encontrado
              </div>
            ) : (
              <div className="space-y-1.5">
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-white text-sm"
                  >
                    <span className="flex-1 truncate font-mono text-xs">{scan.fileName}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(scan.scannedAt).toLocaleDateString("pt-BR")}
                    </span>
                    <Badge
                      className={
                        scan.status === "PROCESSED"
                          ? "bg-green-100 text-green-700 border-0 text-xs"
                          : scan.status === "ERROR"
                          ? "bg-red-100 text-red-700 border-0 text-xs"
                          : "bg-yellow-100 text-yellow-700 border-0 text-xs"
                      }
                    >
                      {scan.status === "PROCESSED" ? "Processado" : scan.status === "ERROR" ? "Erro" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrintersPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PrinterType | null>(null);
  const [detailPrinter, setDetailPrinter] = useState<PrinterType | null>(null);
  const [deletePrinter, setDeletePrinter] = useState<PrinterType | null>(null);
  const [sftpPrinter, setSftpPrinter] = useState<PrinterType | null>(null);

  const [filterCostCenter, setFilterCostCenter] = useState<string>("");
  const [filterActive, setFilterActive] = useState(false);

  const permissions = usePermissions();
  const canCreate = permissions.canSeeNav(["SUPER_ADMIN", "COMPANY_ADMIN"]);
  const canEdit = permissions.canSeeNav(["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"]);
  const canDelete = permissions.canSeeNav(["SUPER_ADMIN", "COMPANY_ADMIN"]);

  const queryParams = {
    ...(filterCostCenter ? { costCenterId: filterCostCenter } : {}),
    ...(filterActive ? { isActive: true } : {}),
  };

  const { data: printers = [], isLoading } = usePrinters(queryParams);
  const { data: costCenters = [] } = useCostCenters({ limit: 100 });
  const remove = useDeletePrinter();
  const update = useUpdatePrinter();

  function openCreate() {
    setEditTarget(null);
    setSheetOpen(true);
  }

  function openEdit(p: PrinterType) {
    setEditTarget(p);
    setSheetOpen(true);
  }

  function handleToggleActive(p: PrinterType) {
    update.mutate({ id: p.id, dto: { isActive: !p.isActive } });
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Impressoras
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie impressoras e suas configurações SFTP.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter: cost center */}
          <Select value={filterCostCenter || "all"} onValueChange={(v) => setFilterCostCenter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm w-48">
              <SelectValue placeholder="Centro de Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter: only active */}
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary rounded"
              checked={filterActive}
              onChange={(e) => setFilterActive(e.target.checked)}
            />
            Somente ativas
          </label>

          {canCreate && (
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nova Impressora
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : printers.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-14 text-center">
          <Printer className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Nenhuma impressora encontrada
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {canCreate ? "Cadastre a primeira impressora." : "Nenhuma impressora cadastrada ainda."}
          </p>
          {canCreate && (
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nova Impressora
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="hidden md:table-cell">Marca / Modelo</TableHead>
                <TableHead className="hidden lg:table-cell">Centro de Custo</TableHead>
                <TableHead className="hidden sm:table-cell">Scans</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((printer) => (
                <TableRow
                  key={printer.id}
                  className="cursor-pointer"
                  onClick={() => setDetailPrinter(printer)}
                >
                  <TableCell className="font-medium">{printer.name}</TableCell>
                  <TableCell className="font-mono text-sm">{printer.ipAddress}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {[printer.brand, printer.model].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {printer.costCenter ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{printer.costCenter.name}</span>
                        {printer.costCenter.code && (
                          <Badge className="text-xs bg-muted text-muted-foreground border-0 font-mono">
                            {printer.costCenter.code}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ScanLine className="w-3.5 h-3.5" />
                      {printer._count.scans}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={printer.isActive
                        ? "bg-green-100 text-green-700 border-0"
                        : "bg-gray-100 text-gray-500 border-0"
                      }
                    >
                      {printer.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Editar"
                            onClick={() => openEdit(printer)}
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={printer.isActive ? "Desativar" : "Ativar"}
                            onClick={() => handleToggleActive(printer)}
                            disabled={update.isPending}
                          >
                            {printer.isActive
                              ? <PowerOff className="w-3.5 h-3.5 text-muted-foreground" />
                              : <Power className="w-3.5 h-3.5 text-green-600" />
                            }
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Excluir"
                          onClick={() => setDeletePrinter(printer)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {printers.length} impressora(s)
          </div>
        </div>
      )}

      {/* ── Form Sheet ── */}
      <PrinterSheet
        open={sheetOpen}
        editTarget={editTarget}
        onClose={() => setSheetOpen(false)}
        onCreated={(p) => setSftpPrinter(p)}
      />

      {/* ── Detail Sheet ── */}
      <PrinterDetailSheet
        printer={detailPrinter}
        onClose={() => setDetailPrinter(null)}
        onEdit={(p) => { setDetailPrinter(null); openEdit(p); }}
      />

      {/* ── SFTP Success Modal ── */}
      <SftpSuccessModal
        open={!!sftpPrinter}
        printer={sftpPrinter}
        onClose={() => setSftpPrinter(null)}
      />

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deletePrinter} onOpenChange={(o) => !o && setDeletePrinter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover impressora</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deletePrinter?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() =>
                deletePrinter &&
                remove.mutate(deletePrinter.id, { onSuccess: () => setDeletePrinter(null) })
              }
            >
              {remove.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</>
                : "Remover"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
