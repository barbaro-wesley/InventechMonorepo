"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, BarChart2, Cable, CalendarDays, ChevronDown, ChevronRight,
  ClipboardList, DollarSign, Loader2, MapPin, Pencil, Tag, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessorySheet } from "@/components/accessories/accessory-sheet";
import { useAccessoryById, useAccessoryHistory, useDeleteAccessory } from "@/hooks/accessories/use-accessories";
import { usePermissions } from "@/hooks/auth/use-permissions";
import type { AccessoryStatus, AccessoryCriticality, AccessoryOwnership } from "@/services/accessories/accessories.service";

const STATUS_LABEL: Record<AccessoryStatus, string> = {
  AVAILABLE: "Disponível", IN_USE: "Em uso", UNDER_MAINTENANCE: "Em manutenção",
  LOANED: "Emprestado", SCRAPPED: "Baixado", LOST: "Extraviado",
};
const STATUS_COLOR: Record<AccessoryStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  IN_USE: "bg-blue-100 text-blue-700 border-blue-200",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-700 border-amber-200",
  LOANED: "bg-purple-100 text-purple-700 border-purple-200",
  SCRAPPED: "bg-red-100 text-red-500 border-red-200",
  LOST: "bg-gray-100 text-gray-500 border-gray-200",
};
const CRITICALITY_LABEL: Record<AccessoryCriticality, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica",
};
const CRITICALITY_COLOR: Record<AccessoryCriticality, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};
const OWNERSHIP_LABEL: Record<AccessoryOwnership, string> = {
  COMPANY: "Empresa", CLIENT: "Cliente", LEASED: "Locado", DONATED: "Doado",
};
const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: "Preventiva", CORRECTIVE: "Corretiva", INITIAL_ACCEPTANCE: "Aceite Inicial",
  EXTERNAL_SERVICE: "Serviço Externo", TECHNOVIGILANCE: "Tecnovigilância",
  TRAINING: "Treinamento", IMPROPER_USE: "Uso Indevido", DEACTIVATION: "Desativação",
};

function StatusBadge({ status }: { status: AccessoryStatus }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

function CriticalityBadge({ criticality }: { criticality: AccessoryCriticality }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${CRITICALITY_COLOR[criticality]}`}>{CRITICALITY_LABEL[criticality]}</span>;
}

function StatCard({ icon: Icon, iconClass, label, children }: {
  icon: React.ElementType; iconClass: string; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</p>
        <div className="text-sm font-bold leading-tight mt-0.5 truncate text-foreground">{children}</div>
      </div>
    </div>
  );
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[130px_1fr] gap-3 items-start py-1"><span className="text-xs text-muted-foreground pt-0.5">{label}</span><span className="text-sm font-medium text-foreground break-words">{children}</span></div>;
}

function SectionCard({ title, action, children, className = "" }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>{action}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function fmtDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function fmtCurrency(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - new Date().getTime()) / 86400000);
}

type TabId = "info" | "history";

export default function AccessoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canAccess } = usePermissions();
  const canEdit = canAccess("accessories", "update");
  const canDelete = canAccess("accessories", "delete");
  const [tab, setTab] = useState<TabId>("info");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: accessory, isLoading } = useAccessoryById(id);
  const { data: history, isLoading: historyLoading } = useAccessoryHistory(id, tab === "history");
  const deleteAccessory = useDeleteAccessory();

  if (isLoading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!accessory) return (
    <div className="flex flex-col items-center py-32">
      <Cable className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">Acessório não encontrado.</p>
      <Link href="/acessorios" className="mt-4 text-sm text-primary hover:underline">← Voltar para acessórios</Link>
    </div>
  );

  const warrantyDays = accessory.warrantyEnd
    ? daysUntil(accessory.warrantyEnd)
    : null;
  const historyCount = history
    ? history.statusHistory.length + history.assignments.length + history.movements.length + history.maintenances.length
    : undefined;
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "info", label: "Informações" },
    { id: "history", label: "Histórico", count: historyCount },
  ];

  return (
    <div className="space-y-5 pb-10">
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/acessorios" className="hover:text-foreground transition-colors">Acessórios</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate max-w-[60vw]">{accessory.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2"><StatusBadge status={accessory.status} /><CriticalityBadge criticality={accessory.criticality} /></div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{accessory.name}</h1>
            <p className="text-sm text-muted-foreground mt-1 uppercase tracking-wide font-medium">{accessory.category?.name ?? "Sem categoria"}</p>
            {warrantyDays !== null && warrantyDays <= 30 && (
              <p className={`flex items-center gap-1 text-xs mt-2 ${warrantyDays <= 0 ? "text-red-600" : "text-amber-600"}`}>
                <AlertTriangle className="w-3.5 h-3.5" />{warrantyDays <= 0 ? "Garantia vencida" : `Garantia em ${warrantyDays} dias`}
              </p>
            )}
          </div>
          {(canEdit || canDelete) && <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>}
            {canDelete && <DropdownMenu>
              <DropdownMenuTrigger asChild><Button>Mais ações<ChevronDown className="w-4 h-4 ml-2" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />Remover acessório
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard icon={Tag} iconClass="bg-blue-50 text-blue-600" label="Patrimônio"><span className="font-mono">{accessory.patrimonyNumber ?? "—"}</span></StatCard>
          <StatCard icon={Cable} iconClass="bg-blue-50 text-blue-600" label="Status">{STATUS_LABEL[accessory.status]}</StatCard>
          <StatCard icon={BarChart2} iconClass="bg-violet-50 text-violet-600" label="Criticidade"><CriticalityBadge criticality={accessory.criticality} /></StatCard>
          <StatCard icon={DollarSign} iconClass="bg-emerald-50 text-emerald-600" label="Valor de compra">{fmtCurrency(accessory.purchaseValue)}</StatCard>
          <StatCard icon={CalendarDays} iconClass="bg-blue-50 text-blue-600" label="Data de cadastro">{fmtDate(accessory.createdAt)}</StatCard>
        </div>

        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto [&::-webkit-scrollbar]:hidden pt-2">
          {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${tab === item.id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {item.label}{item.count !== undefined && item.count > 0 && <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${tab === item.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{item.count}</span>}
          </button>)}
        </div>
      </div>

      {tab === "info" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard title="Informações Gerais" className="lg:col-span-2" action={canEdit && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditOpen(true)}><Pencil className="w-3.5 h-3.5 mr-1.5" />Editar informações</Button>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            <div>
              <InfoField label="Patrimônio"><span className="font-mono">{accessory.patrimonyNumber ?? "—"}</span></InfoField>
              <InfoField label="Descrição">{accessory.name}</InfoField>
              <InfoField label="Categoria">{accessory.category?.name ?? "—"}</InfoField>
              <InfoField label="Marca">{accessory.brand ?? "—"}</InfoField>
              <InfoField label="Modelo">{accessory.model ?? "—"}</InfoField>
              <InfoField label="Número de Série"><span className="font-mono">{accessory.serialNumber ?? "—"}</span></InfoField>
              <InfoField label="Nº ANVISA">{accessory.anvisaNumber ?? "—"}</InfoField>
            </div>
            <div>
              <InfoField label="QR Code"><span className="font-mono">{accessory.qrCode ?? "—"}</span></InfoField>
              <InfoField label="Propriedade">{OWNERSHIP_LABEL[accessory.ownership]}</InfoField>
              <InfoField label="Localização">{accessory.currentLocation?.name ?? "—"}</InfoField>
              <InfoField label="Equipamento">{accessory.currentEquipment ? <Link href={`/equipamentos/${accessory.currentEquipment.id}`} className="text-primary hover:underline">{accessory.currentEquipment.name}</Link> : "—"}</InfoField>
              <InfoField label="Status"><StatusBadge status={accessory.status} /></InfoField>
              <InfoField label="Criticidade"><CriticalityBadge criticality={accessory.criticality} /></InfoField>
              <InfoField label="Última Manutenção">{fmtDate(accessory.lastMaintenanceAt)}</InfoField>
            </div>
            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
              <InfoField label="Observações"><span className="whitespace-pre-wrap">{accessory.observations ?? "—"}</span></InfoField>
            </div>
          </div>
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title="Localização Atual">
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4">
              <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center flex-shrink-0"><MapPin className="w-[18px] h-[18px] text-blue-600" /></div>
              <div className="min-w-0"><p className="text-sm font-bold text-blue-700 dark:text-blue-400">{accessory.currentLocation?.name ?? "Sem localização"}</p>
                {accessory.currentEquipment && <Link href={`/equipamentos/${accessory.currentEquipment.id}`} className="text-xs text-primary hover:underline">{accessory.currentEquipment.name}</Link>}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Financeiro">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Valor de Compra</p><p className="text-base font-bold mt-0.5 text-foreground">{fmtCurrency(accessory.purchaseValue)}</p></div>
              <div><p className="text-xs text-muted-foreground">Data de Aquisição</p><p className="text-sm font-semibold mt-0.5 text-foreground">{fmtDate(accessory.purchaseDate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Início da Garantia</p><p className="text-sm font-semibold mt-0.5 text-foreground">{fmtDate(accessory.warrantyStart)}</p></div>
              <div><p className="text-xs text-muted-foreground">Fim da Garantia</p><p className="text-sm font-semibold mt-0.5 text-foreground">{fmtDate(accessory.warrantyEnd)}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Nota Fiscal</p><p className="text-sm font-semibold mt-0.5 text-foreground">{accessory.invoiceNumber ?? "—"}</p></div>
            </div>
          </SectionCard>
          <SectionCard title="Manutenção">
            <InfoField label="Total">{accessory.totalMaintenances}</InfoField>
            <InfoField label="Última">{fmtDate(accessory.lastMaintenanceAt)}</InfoField>
          </SectionCard>
        </div>
      </div>}

      {tab === "history" && <div className="space-y-5">
        {historyLoading ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl border border-border bg-muted/30 animate-pulse" />)}</div>
          : !history || historyCount === 0 ? <SectionCard title="Histórico"><div className="py-10 text-center"><ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhum histórico registrado</p></div></SectionCard>
          : <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title="Histórico de Status">
              {history.statusHistory.length ? <div className="space-y-3">{history.statusHistory.map((item) => <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><StatusBadge status={item.toStatus} /><span className="text-xs text-muted-foreground">{fmtDate(item.createdAt)}</span></div>
                <p className="text-xs text-muted-foreground mt-2">{item.changedBy?.name ?? "—"}{item.reason ? ` · ${item.reason}` : ""}</p>
              </div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum registro.</p>}
            </SectionCard>
            <SectionCard title="Vínculos com Equipamentos">
              {history.assignments.length ? <div className="space-y-3">{history.assignments.map((item) => <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2"><Link href={`/equipamentos/${item.equipmentId}`} className="text-sm font-semibold text-primary hover:underline">{item.equipment.name}</Link>{item.isActive && <span className="text-[10px] font-bold text-blue-700">Ativo</span>}</div>
                <p className="text-xs text-muted-foreground mt-1">{fmtDate(item.assignedAt)}{item.unassignedAt ? ` → ${fmtDate(item.unassignedAt)}` : ""} · {item.assignedBy.name}</p>
                {item.reason && <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>}
              </div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum vínculo.</p>}
            </SectionCard>
            <SectionCard title="Movimentações">
              {history.movements.length ? <div className="space-y-3">{history.movements.map((item) => <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{item.type === "LOAN" ? "Empréstimo" : "Transferência"}</span><span className="text-xs text-muted-foreground">{fmtDate(item.createdAt)}</span></div>
                <p className="text-xs text-muted-foreground mt-1">{item.originLocation?.name ?? "—"} → {item.destinationLocation?.name ?? "—"}</p>
              </div>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma movimentação.</p>}
            </SectionCard>
            <SectionCard title="Manutenções">
              {history.maintenances.length ? <div className="space-y-3">{history.maintenances.map((item) => <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{item.title}</span><span className="text-xs text-muted-foreground">{item.completedAt ? "Concluída" : "Pendente"}</span></div>
                <p className="text-xs text-muted-foreground mt-1">{MAINTENANCE_TYPE_LABEL[item.type] ?? item.type}{item.technician ? ` · ${item.technician.name}` : ""}{item.completedAt ? ` · ${fmtDate(item.completedAt)}` : ""}</p>
              </div>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma manutenção.</p>}
            </SectionCard>
          </div>}
      </div>}

      <AccessorySheet open={editOpen} editTarget={accessory} onClose={() => setEditOpen(false)} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover acessório?</AlertDialogTitle><AlertDialogDescription>O acessório <strong>{accessory.name}</strong> será removido. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteAccessory.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteAccessory.mutate(accessory.id, { onSuccess: () => router.push("/acessorios") })}>{deleteAccessory.isPending ? "Removendo..." : "Remover"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
