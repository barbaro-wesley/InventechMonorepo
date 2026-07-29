"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Pencil,
  Printer,
  Tag,
  Wrench,
  BarChart2,
  DollarSign,
  CalendarDays,
  MapPin,
  ArrowRightLeft,
  HandCoins,
  RotateCcw,
  ClipboardList,
  CalendarClock,
  BookOpen,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Trash2,
  Loader2,
  Upload,
  X,
  Plus,
  Cable,
  Settings2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  useEquipmentById,
  useDeleteEquipment,
  useRecalculateDepreciation,
  useEquipmentServiceOrders,
} from "@/hooks/equipment/use-equipment";
import { useMovements, useReturnEquipment } from "@/hooks/equipment/use-movements";
import { useEquipmentAccessories } from "@/hooks/accessories/use-accessories";
import { useAttachments, useDeleteAttachment, useUploadAttachment } from "@/hooks/storage/use-attachments";
import { useMaintenanceSchedules, useToggleSchedule } from "@/hooks/maintenance/use-maintenance-schedule";
import { useManuals } from "@/hooks/equipment/use-manuals";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { equipmentService } from "@/services/equipment/equipment.service";
import type { Equipment, EquipmentStatus, EquipmentCriticality } from "@/services/equipment/equipment.service";
import type { Movement } from "@/services/equipment/movements.service";
import type { MaintenanceSchedule } from "@/services/maintenance/maintenance-schedule.service";
import { storageService } from "@/services/storage/storage.service";
import { EquipmentFormSheet } from "@/components/equipment/equipment-form-sheet";
import { EquipmentMovementSheet } from "@/components/equipment/equipment-movement-sheet";
import { EquipmentQrLabelModal } from "@/components/equipment/equipment-qr-label-modal";
import { EquipmentManualsSheet } from "@/components/equipment/equipment-manuals-sheet";
import { EquipmentOsCreateSheet } from "@/components/equipment/equipment-os-create-sheet";
import { EquipmentScheduleCreateSheet } from "@/components/equipment/equipment-schedule-create-sheet";
import { EquipmentAccessoriesTab } from "@/components/equipment/equipment-accessories-tab";
import { EquipmentManualsTab } from "@/components/equipment/equipment-manuals-tab";
import { OsDetailDrawer } from "@/app/(operacional)/operacional/_components/os-detail-drawer";

// ─── Label / color maps ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  ACTIVE: "Ativo",
  BORROWED: "Emprestado",
  UNDER_MAINTENANCE: "Em manutenção",
  INACTIVE: "Inativo",
  DISPOSED: "Descartado",
};

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  BORROWED: "bg-amber-100 text-amber-700 border-amber-200",
  UNDER_MAINTENANCE: "bg-blue-100 text-blue-700 border-blue-200",
  INACTIVE: "bg-gray-100 text-gray-500 border-gray-200",
  DISPOSED: "bg-red-100 text-red-500 border-red-200",
};

const STATUS_TEXT: Record<EquipmentStatus, string> = {
  ACTIVE: "text-emerald-600",
  BORROWED: "text-amber-600",
  UNDER_MAINTENANCE: "text-blue-600",
  INACTIVE: "text-gray-500",
  DISPOSED: "text-red-500",
};

const CRITICALITY_LABEL: Record<EquipmentCriticality, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const CRITICALITY_COLOR: Record<EquipmentCriticality, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};

const OS_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  AWAITING_PICKUP: "Aguardando",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  COMPLETED_APPROVED: "Aprovada",
  COMPLETED_REJECTED: "Reprovada",
  CANCELLED: "Cancelada",
};
const OS_STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-700",
  AWAITING_PICKUP: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-violet-100 text-violet-700",
  COMPLETED_APPROVED: "bg-emerald-100 text-emerald-700",
  COMPLETED_REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};
const OS_TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: "Preventiva",
  CORRECTIVE: "Corretiva",
  INITIAL_ACCEPTANCE: "Aceite Inicial",
  EXTERNAL_SERVICE: "Serviço Externo",
  TECHNOVIGILANCE: "Tecnovigilância",
  TRAINING: "Treinamento",
  IMPROPER_USE: "Uso Indevido",
  DEACTIVATION: "Desativação",
};
const ACC_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  UNDER_MAINTENANCE: "Em manutenção",
  LOANED: "Emprestado",
  SCRAPPED: "Baixado",
  LOST: "Extraviado",
};
const ACC_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700",
  IN_USE: "bg-blue-100 text-blue-700",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-700",
  LOANED: "bg-purple-100 text-purple-700",
  SCRAPPED: "bg-red-100 text-red-500",
  LOST: "bg-gray-100 text-gray-500",
};

// ─── Small presentational helpers ───────────────────────────────────────────────

function StatusBadge({ status }: { status: EquipmentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function CriticalityBadge({ criticality }: { criticality: EquipmentCriticality }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${CRITICALITY_COLOR[criticality]}`}
    >
      {CRITICALITY_LABEL[criticality]}
    </span>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  label,
  children,
}: {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</p>
        <div className="text-sm font-bold leading-tight mt-0.5 truncate text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 items-start py-1">
      <span className="text-xs text-muted-foreground pt-0.5">{label}</span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-sm ${
        className ?? ""
      }`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function fmtCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function daysUntil(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function AttachmentIcon({ category, className }: { category: string; className?: string }) {
  const cls = className ?? "w-5 h-5";
  if (category === "image") return <FileImage className={`${cls} text-blue-500`} />;
  if (category === "spreadsheet") return <FileSpreadsheet className={`${cls} text-emerald-500`} />;
  if (category === "archive") return <FileArchive className={`${cls} text-amber-500`} />;
  return <FileText className={`${cls} text-rose-500`} />;
}

// ─── Movement feed row ──────────────────────────────────────────────────────────

function MovementFeedItem({ movement }: { movement: Movement }) {
  const isLoan = movement.type === "LOAN";
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isLoan ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
        }`}
      >
        {isLoan ? <HandCoins className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">
          {isLoan ? "Empréstimo para" : "Transferido para"} {movement.destination.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {fmtDateTime(movement.createdAt)}
          {movement.requester?.name ? ` · ${movement.requester.name}` : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────────

type TabId = "info" | "accessories" | "movements" | "history" | "schedules" | "manuals";

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canAccess } = usePermissions();

  const canEdit = canAccess("equipment", "update");
  const canDelete = canAccess("equipment", "delete");
  const canMove = canAccess("movement", "create");
  const canCreateOs = canAccess("service-order", "create");
  const canSchedule = canAccess("maintenance-schedule", "create");

  const [tab, setTab] = useState<TabId>("info");
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [manualsOpen, setManualsOpen] = useState(false);
  const [osOpen, setOsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedOs, setSelectedOs] = useState<{ id: string; clientId: string | null } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: equipment, isLoading } = useEquipmentById(id);

  const { data: accessories = [] } = useEquipmentAccessories(id);
  const { data: movements = [] } = useMovements(id);
  const { data: attachments = [], isLoading: attachmentsLoading } = useAttachments("EQUIPMENT", id);
  const { data: schedulesData } = useMaintenanceSchedules({ equipmentId: id });
  const schedules = schedulesData?.data ?? [];
  const { data: manuals = [] } = useManuals(id);

  const recalcDepreciation = useRecalculateDepreciation();
  const deleteEquipment = useDeleteEquipment();
  const uploadAttachment = useUploadAttachment("EQUIPMENT", id);
  const deleteAttachment = useDeleteAttachment("EQUIPMENT", id);
  const returnEquipment = useReturnEquipment(id);
  const toggleSchedule = useToggleSchedule();

  const {
    data: historyData,
    isLoading: historyLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useEquipmentServiceOrders(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="flex flex-col items-center py-32">
        <Wrench className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Equipamento não encontrado.</p>
        <Link href="/equipamentos" className="mt-4 text-sm text-primary hover:underline">
          ← Voltar para equipamentos
        </Link>
      </div>
    );
  }

  const eq: Equipment = equipment;
  const categoryLine = [eq.type?.name, eq.subtype?.name].filter(Boolean).join(" › ");
  const currentLocationName = eq.currentLocation?.name ?? eq.location?.name ?? null;
  const activeMovement = movements.find((m) => m.status === "ACTIVE");
  const historyItems = historyData?.pages.flatMap((p) => p.data) ?? [];
  const upcomingSchedules = [...schedules]
    .filter((s) => s.isActive)
    .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());

  function handleUploadClick() {
    fileInputRef.current?.click();
  }
  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadAttachment.mutate(file);
    e.target.value = "";
  }
  function handleDelete() {
    deleteEquipment.mutate(eq.id, { onSuccess: () => router.push("/equipamentos") });
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "info", label: "Informações" },
    { id: "accessories", label: "Acessórios", count: accessories.length },
    { id: "movements", label: "Movimentações", count: movements.length },
    { id: "history", label: "Histórico", count: eq.totalServiceOrders },
    { id: "schedules", label: "Preventivas", count: schedules.length },
    { id: "manuals", label: "Manuais", count: manuals.length },
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* ── Top Main Card Container (Red Box 1) ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/equipamentos" className="hover:text-foreground transition-colors">
            Equipamentos
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate max-w-[60vw]">{eq.name}</span>
        </div>

        {/* Header (Badges + Name + Subtitle + Action Buttons) */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={eq.status} />
              <CriticalityBadge criticality={eq.criticality} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {eq.name}
            </h1>
            {categoryLine && (
              <p className="text-sm text-muted-foreground mt-1 uppercase tracking-wide font-medium">
                {categoryLine}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
            <Button variant="outline" onClick={() => setQrOpen(true)}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir etiqueta
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Mais ações
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canMove && eq.status === "ACTIVE" && (
                  <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Movimentar
                  </DropdownMenuItem>
                )}
                {canCreateOs && (
                  <DropdownMenuItem onClick={() => setOsOpen(true)}>
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Nova OS
                  </DropdownMenuItem>
                )}
                {canSchedule && (
                  <DropdownMenuItem onClick={() => setScheduleOpen(true)}>
                    <CalendarClock className="w-4 h-4 mr-2" />
                    Agendar preventiva
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => window.open(equipmentService.getLifeCyclePdfUrl(eq.id), "_blank")}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Ficha de vida
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab("manuals")}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Manuais
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover equipamento
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stat cards row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard icon={Tag} iconClass="bg-blue-50 text-blue-600" label="Patrimônio">
            <span className="font-mono">{eq.patrimonyNumber ?? "—"}</span>
          </StatCard>
          <StatCard icon={Wrench} iconClass="bg-blue-50 text-blue-600" label="Status">
            <span className={STATUS_TEXT[eq.status]}>{STATUS_LABEL[eq.status]}</span>
          </StatCard>
          <StatCard icon={BarChart2} iconClass="bg-violet-50 text-violet-600" label="Criticidade">
            <CriticalityBadge criticality={eq.criticality} />
          </StatCard>
          <StatCard icon={DollarSign} iconClass="bg-emerald-50 text-emerald-600" label="Valor de compra">
            {fmtCurrency(eq.purchaseValue)}
          </StatCard>
          <StatCard icon={CalendarDays} iconClass="bg-blue-50 text-blue-600" label="Data de cadastro">
            {fmtDate(eq.createdAt)}
          </StatCard>
        </div>

        {/* Tabs Bar (Red Box 2) */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto [&::-webkit-scrollbar]:hidden pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                tab === t.id
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                    tab === t.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Info tab ── */}
      {tab === "info" && (
        <div className="space-y-5">
          {/* Row A: Informações Gerais + right column */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Informações Gerais */}
            <SectionCard
              title="Informações Gerais"
              className="lg:col-span-2"
              action={
                canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Editar informações
                  </Button>
                )
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                <div>
                  <InfoField label="Patrimônio">
                    <span className="font-mono">{eq.patrimonyNumber ?? "—"}</span>
                  </InfoField>
                  <InfoField label="Descrição">{eq.name}</InfoField>
                  <InfoField label="Categoria">{eq.type?.name ?? "—"}</InfoField>
                  <InfoField label="Fabricante">{eq.brand ?? "—"}</InfoField>
                  <InfoField label="Modelo">{eq.model ?? "—"}</InfoField>
                  <InfoField label="Número de Série">
                    <span className="font-mono">{eq.serialNumber ?? "—"}</span>
                  </InfoField>
                  <InfoField label="Nº ANVISA">{eq.anvisaNumber ?? "—"}</InfoField>
                </div>
                <div>
                  <InfoField label="Centro de Custo">{eq.costCenter?.name ?? "—"}</InfoField>
                  <InfoField label="Localização">{currentLocationName ?? "—"}</InfoField>
                  <InfoField label="Setor">{eq.type?.group?.name ?? "—"}</InfoField>
                  <InfoField label="Subtipo">{eq.subtype?.name ?? "—"}</InfoField>
                  <InfoField label="Status">
                    <StatusBadge status={eq.status} />
                  </InfoField>
                  <InfoField label="Criticidade">
                    <CriticalityBadge criticality={eq.criticality} />
                  </InfoField>
                  <InfoField label="Última Manutenção">{fmtDate(eq.lastMaintenanceAt)}</InfoField>
                </div>
                <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <InfoField label="Observações">
                    <span className="whitespace-pre-wrap">{eq.observations ?? "—"}</span>
                  </InfoField>
                </div>
              </div>
            </SectionCard>

            {/* Right column */}
            <div className="space-y-5">
              {/* Localização Atual */}
              <SectionCard title="Localização Atual">
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4">
                  <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-[18px] h-[18px] text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                      {currentLocationName ?? "Sem localização"}
                    </p>
                    {eq.costCenter && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {eq.costCenter.name}
                        {eq.costCenter.code ? ` (${eq.costCenter.code})` : ""}
                      </p>
                    )}
                    {eq.type?.group?.name && (
                      <p className="text-xs text-muted-foreground">{eq.type.group.name}</p>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Financeiro */}
              <SectionCard title="Financeiro">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor de Compra</p>
                    <p className="text-base font-bold mt-0.5 text-foreground">
                      {fmtCurrency(eq.purchaseValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Aquisição</p>
                    <p className="text-sm font-semibold mt-0.5 text-foreground">
                      {fmtDate(eq.purchaseDate)}
                    </p>
                  </div>
                  {eq.currentValue != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Atual</p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">
                        {fmtCurrency(eq.currentValue)}
                      </p>
                    </div>
                  )}
                  {eq.depreciationRate != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Depreciação</p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">
                        {eq.depreciationRate}% /ano
                      </p>
                    </div>
                  )}
                  {eq.invoiceNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Nota Fiscal</p>
                      <p className="text-sm font-semibold mt-0.5 font-mono text-foreground">
                        {eq.invoiceNumber}
                      </p>
                    </div>
                  )}
                  {eq.warrantyStart && (
                    <div>
                      <p className="text-xs text-muted-foreground">Início da Garantia</p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">
                        {fmtDate(eq.warrantyStart)}
                      </p>
                    </div>
                  )}
                  {eq.warrantyEnd && (
                    <div>
                      <p className="text-xs text-muted-foreground">Fim da Garantia</p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">
                        {fmtDate(eq.warrantyEnd)}
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 h-8 text-xs"
                  disabled={recalcDepreciation.isPending}
                  onClick={() => recalcDepreciation.mutate(eq.id)}
                >
                  <BarChart2 className="w-3.5 h-3.5 mr-2 text-primary" />
                  {recalcDepreciation.isPending ? "Recalculando..." : "Recalcular depreciação"}
                </Button>
              </SectionCard>

              {/* Ficha Técnica */}
              {(eq.ipAddress || eq.operatingSystem || eq.voltage || eq.power || eq.btus != null) && (
                <SectionCard title="Ficha Técnica">
                  <div className="grid grid-cols-2 gap-4">
                    {eq.ipAddress && (
                      <div>
                        <p className="text-xs text-muted-foreground">Endereço IP</p>
                        <p className="text-sm font-semibold mt-0.5 font-mono text-foreground">
                          {eq.ipAddress}
                        </p>
                      </div>
                    )}
                    {eq.operatingSystem && (
                      <div>
                        <p className="text-xs text-muted-foreground">Sistema Operacional</p>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">
                          {eq.operatingSystem}
                        </p>
                      </div>
                    )}
                    {eq.voltage && (
                      <div>
                        <p className="text-xs text-muted-foreground">Tensão</p>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">
                          {eq.voltage}
                        </p>
                      </div>
                    )}
                    {eq.power && (
                      <div>
                        <p className="text-xs text-muted-foreground">Potência</p>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">
                          {eq.power}
                        </p>
                      </div>
                    )}
                    {eq.btus != null && (
                      <div>
                        <p className="text-xs text-muted-foreground">BTUs</p>
                        <p className="text-sm font-semibold mt-0.5 text-foreground">
                          {eq.btus.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>
          </div>

          {/* Campos Personalizados */}
          {(eq.customFieldValues?.filter((cf) => cf.value).length ?? 0) > 0 && (
            <SectionCard title="Campos Personalizados">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
                {eq.customFieldValues!.filter((cf) => cf.value).map((cf) => (
                  <InfoField key={cf.definitionId} label={cf.definition.name}>
                    {cf.value}
                  </InfoField>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Row B: Acessórios + Movimentações + Preventivas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Acessórios */}
            <SectionCard
              title="Acessórios"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-primary"
                  onClick={() => setTab("accessories")}
                >
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                  Gerenciar acessórios
                </Button>
              }
            >
              {accessories.length === 0 ? (
                <div className="py-6 text-center">
                  <Cable className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum acessório vinculado</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span>Nome</span>
                    <span>Código</span>
                    <span>Situação</span>
                  </div>
                  {accessories.slice(0, 3).map((acc) => (
                    <div
                      key={acc.id}
                      className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2 text-sm"
                    >
                      <span className="font-medium truncate text-foreground">{acc.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {acc.patrimonyNumber ?? acc.serialNumber ?? "—"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ACC_STATUS_COLOR[acc.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ACC_STATUS_LABEL[acc.status] ?? acc.status}
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTab("accessories")}
                    className="mt-2 text-xs text-primary hover:underline font-medium"
                  >
                    Ver todos os acessórios ({accessories.length})
                  </button>
                </div>
              )}
            </SectionCard>

            {/* Últimas Movimentações */}
            <SectionCard
              title="Últimas Movimentações"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-primary"
                  onClick={() => setTab("movements")}
                >
                  Ver todas
                </Button>
              }
            >
              <div className="space-y-4">
                {movements.slice(0, 4).map((m) => (
                  <MovementFeedItem key={m.id} movement={m} />
                ))}
                {/* Registro de cadastro */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-500 dark:bg-slate-800">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      Cadastro do equipamento
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(eq.createdAt)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Próximas Preventivas */}
            <SectionCard
              title="Próximas Preventivas"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-primary"
                  onClick={() => setTab("schedules")}
                >
                  Ver todas
                </Button>
              }
            >
              {upcomingSchedules.length === 0 ? (
                <div className="py-6 text-center">
                  <CalendarClock className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma preventiva agendada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSchedules.slice(0, 3).map((sch) => {
                    const days = daysUntil(sch.nextRunAt);
                    return (
                      <div key={sch.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <CalendarClock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug truncate text-foreground">
                            {sch.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Programada para: {fmtDate(sch.nextRunAt)}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground flex-shrink-0 whitespace-nowrap">
                          {days >= 0 ? `Em ${days} dia${days === 1 ? "" : "s"}` : "Atrasada"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Row C: Anexos e Documentos */}
          <SectionCard
            title="Anexos e Documentos"
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleUploadClick}
                disabled={uploadAttachment.isPending}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {uploadAttachment.isPending ? "Enviando..." : "Adicionar anexo"}
              </Button>
            }
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              onChange={handleUpload}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {attachmentsLoading ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl border border-border bg-muted/30 animate-pulse"
                  />
                ))
              ) : (
                attachments.map((att) => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => window.open(storageService.getDownloadUrl(att.id), "_blank")}
                    className="group relative flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-left hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                      <AttachmentIcon category={att.category} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-foreground">{att.fileName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(att.fileName.split(".").pop() ?? "arquivo").toUpperCase()} · {att.sizeFormatted}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">{fmtDate(att.createdAt)}</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAttachment.mutate(att.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          deleteAttachment.mutate(att.id);
                        }
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))
              )}
              {/* Upload dropzone */}
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={uploadAttachment.isPending}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors p-3.5 min-h-[76px] text-muted-foreground hover:text-primary disabled:opacity-50"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs text-center">
                  Arraste arquivos ou <span className="text-primary font-medium">clique para enviar</span>
                </span>
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Accessories tab ── */}
      {tab === "accessories" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
          <EquipmentAccessoriesTab equipmentId={eq.id} />
        </div>
      )}

      {/* ── Movements tab ── */}
      {tab === "movements" && (
        <div className="space-y-3">
          {activeMovement && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start justify-between gap-3">
              <div className="text-sm space-y-0.5">
                <p className="font-semibold text-amber-800">Movimentação ativa</p>
                <p className="text-amber-700 text-xs">
                  {activeMovement.origin.name} → {activeMovement.destination.name}
                </p>
                {activeMovement.expectedReturnAt && (
                  <p className="text-amber-600 text-xs">
                    Retorno previsto: {fmtDate(activeMovement.expectedReturnAt)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0"
                disabled={returnEquipment.isPending}
                onClick={() => returnEquipment.mutate({ movementId: activeMovement.id })}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                {returnEquipment.isPending ? "..." : "Devolver"}
              </Button>
            </div>
          )}
          {movements.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 text-center">
              <ArrowRightLeft className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <MovementFeedItem movement={m} />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        m.status === "ACTIVE"
                          ? "bg-amber-100 text-amber-700"
                          : m.status === "RETURNED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {m.status === "ACTIVE" ? "Ativo" : m.status === "RETURNED" ? "Devolvido" : "Cancelado"}
                    </span>
                  </div>
                  {m.reason && (
                    <p className="text-xs text-muted-foreground italic mt-2 pl-11">
                      &quot;{m.reason}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div className="space-y-2">
          {historyLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border border-border bg-muted/30 animate-pulse" />
            ))
          ) : historyItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 text-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço registrada</p>
            </div>
          ) : (
            <>
              {historyItems.map((os) => (
                <button
                  key={os.id}
                  type="button"
                  onClick={() => setSelectedOs({ id: os.id, clientId: os.clientId })}
                  className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                        #{os.number}
                      </span>
                      <span className="text-sm font-medium truncate">{os.title}</span>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        OS_STATUS_COLOR[os.status] ?? ""
                      }`}
                    >
                      {OS_STATUS_LABEL[os.status] ?? os.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {OS_TYPE_LABEL[os.maintenanceType] ?? os.maintenanceType}
                    </span>
                    <span>{fmtDate(os.createdAt)}</span>
                  </div>
                </button>
              ))}
              {hasNextPage && (
                <button
                  type="button"
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Schedules tab ── */}
      {tab === "schedules" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {schedules.length === 0
                ? "Nenhum agendamento cadastrado"
                : `${schedules.length} agendamento${schedules.length > 1 ? "s" : ""}`}
            </p>
            {canSchedule && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setScheduleOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Novo agendamento
              </Button>
            )}
          </div>
          {schedules.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 text-center">
              <CalendarClock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento de manutenção preventiva</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((sch: MaintenanceSchedule) => (
                <div
                  key={sch.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          sch.isActive ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <CalendarClock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground">{sch.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Próxima: {fmtDate(sch.nextRunAt)}
                          {sch.assignedTechnician ? ` · ${sch.assignedTechnician.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {sch.isActive ? "Ativo" : "Inativo"}
                      </span>
                      <button
                        type="button"
                        disabled={toggleSchedule.isPending}
                        onClick={() => toggleSchedule.mutate({ id: sch.id, isActive: !sch.isActive })}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
                      >
                        {sch.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Manuais tab ── */}
      {tab === "manuals" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <EquipmentManualsTab equipment={eq} />
        </div>
      )}

      {/* ── Sheets & modals ── */}
      <EquipmentFormSheet open={editOpen} editTarget={eq} onClose={() => setEditOpen(false)} />
      <EquipmentMovementSheet open={moveOpen} equipment={eq} onClose={() => setMoveOpen(false)} />
      <EquipmentQrLabelModal open={qrOpen} equipment={eq} onClose={() => setQrOpen(false)} />
      {manualsOpen && (
        <EquipmentManualsSheet equipment={eq} open={manualsOpen} onClose={() => setManualsOpen(false)} />
      )}
      <EquipmentOsCreateSheet equipment={eq} open={osOpen} onClose={() => setOsOpen(false)} />
      <EquipmentScheduleCreateSheet
        equipment={eq}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />

      <OsDetailDrawer
        osId={selectedOs?.id ?? null}
        clientId={selectedOs?.clientId ?? null}
        open={!!selectedOs}
        onClose={() => setSelectedOs(null)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover equipamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{eq.name}</strong>?
              {eq._count.serviceOrders > 0 && (
                <>
                  {" "}
                  As <strong>{eq._count.serviceOrders} OS vinculada(s)</strong> também serão removidas.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteEquipment.isPending}
              onClick={handleDelete}
            >
              {deleteEquipment.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
