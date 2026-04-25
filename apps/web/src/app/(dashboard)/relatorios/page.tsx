"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Settings2,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEquipmentTypes } from "@/hooks/equipment/use-equipment-types";
import { useCostCenters } from "@/hooks/equipment/use-cost-centers";
import { useMaintenanceGroups } from "@/hooks/maintenance-groups/use-maintenance-groups";
import { api, getErrorMessage } from "@/lib/api";
import { useCurrentUser } from "@/store/auth.store";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type EquipmentStatus = "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "SCRAPPED" | "BORROWED";
type EquipmentCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  UNDER_MAINTENANCE: "Em manutenção",
  SCRAPPED: "Descartado",
  BORROWED: "Emprestado",
};

const CRIT_LABEL: Record<EquipmentCriticality, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  ACTIVE: "border-emerald-300 text-emerald-700 bg-emerald-50 data-[selected=true]:bg-emerald-600 data-[selected=true]:text-white data-[selected=true]:border-emerald-600",
  INACTIVE: "border-gray-300 text-gray-600 bg-gray-50 data-[selected=true]:bg-gray-500 data-[selected=true]:text-white data-[selected=true]:border-gray-500",
  UNDER_MAINTENANCE: "border-blue-300 text-blue-700 bg-blue-50 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white data-[selected=true]:border-blue-600",
  SCRAPPED: "border-red-300 text-red-700 bg-red-50 data-[selected=true]:bg-red-600 data-[selected=true]:text-white data-[selected=true]:border-red-600",
  BORROWED: "border-amber-300 text-amber-700 bg-amber-50 data-[selected=true]:bg-amber-600 data-[selected=true]:text-white data-[selected=true]:border-amber-600",
};

const CRIT_COLOR: Record<EquipmentCriticality, string> = {
  LOW: "border-emerald-300 text-emerald-700 bg-emerald-50 data-[selected=true]:bg-emerald-600 data-[selected=true]:text-white data-[selected=true]:border-emerald-600",
  MEDIUM: "border-blue-300 text-blue-700 bg-blue-50 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white data-[selected=true]:border-blue-600",
  HIGH: "border-amber-300 text-amber-700 bg-amber-50 data-[selected=true]:bg-amber-600 data-[selected=true]:text-white data-[selected=true]:border-amber-600",
  CRITICAL: "border-red-300 text-red-700 bg-red-50 data-[selected=true]:bg-red-600 data-[selected=true]:text-white data-[selected=true]:border-red-600",
};

// ─── All available equipment columns ─────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  category: string;
  defaultSelected: boolean;
}

const EQUIPMENT_COLUMNS: ColumnDef[] = [
  // Identificação
  { key: "patrimony",      label: "Patrimônio",     category: "Identificação",  defaultSelected: true },
  { key: "serial",         label: "Nº Série",        category: "Identificação",  defaultSelected: false },
  { key: "anvisaNumber",   label: "Nº ANVISA",       category: "Identificação",  defaultSelected: false },
  { key: "invoiceNumber",  label: "Nº NF",           category: "Identificação",  defaultSelected: false },
  // Equipamento
  { key: "name",           label: "Nome",            category: "Equipamento",    defaultSelected: true },
  { key: "brand",          label: "Marca/Modelo",    category: "Equipamento",    defaultSelected: true },
  { key: "type",           label: "Tipo/Subtipo",    category: "Equipamento",    defaultSelected: true },
  { key: "group",          label: "Grupo",           category: "Equipamento",    defaultSelected: false },
  // Localização
  { key: "location",       label: "Local",           category: "Localização",    defaultSelected: true },
  { key: "costCenter",     label: "Centro de Custo", category: "Localização",    defaultSelected: true },
  // Estado
  { key: "status",         label: "Status",          category: "Estado",         defaultSelected: true },
  { key: "criticality",    label: "Criticidade",     category: "Estado",         defaultSelected: true },
  // Financeiro
  { key: "purchaseValue",  label: "Vlr. Compra",     category: "Financeiro",     defaultSelected: false },
  { key: "currentValue",   label: "Vlr. Atual",      category: "Financeiro",     defaultSelected: false },
  { key: "purchaseDate",   label: "Dt. Compra",      category: "Financeiro",     defaultSelected: false },
  { key: "warrantyEnd",    label: "Garantia até",    category: "Financeiro",     defaultSelected: true },
  { key: "warrantyStart",  label: "Garantia desde",  category: "Financeiro",     defaultSelected: false },
  // Técnico
  { key: "voltage",        label: "Tensão",          category: "Técnico",        defaultSelected: false },
  { key: "power",          label: "Potência",        category: "Técnico",        defaultSelected: false },
  { key: "btus",           label: "BTUs",            category: "Técnico",        defaultSelected: false },
  { key: "ipAddress",      label: "Endereço IP",     category: "Técnico",        defaultSelected: false },
  { key: "operatingSystem",label: "S.O.",            category: "Técnico",        defaultSelected: false },
  // Outros
  { key: "observations",   label: "Observações",     category: "Outros",         defaultSelected: false },
];

const COLUMN_CATEGORIES = Array.from(new Set(EQUIPMENT_COLUMNS.map((c) => c.category)));

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadReport(
  path: string,
  params: Record<string, string | string[] | undefined>,
  filename: string
) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) {
      if (Array.isArray(v)) {
        if (v.length) query.set(k, v.join(","));
      } else {
        query.set(k, v);
      }
    }
  }

  const response = await api.get(`/reports/${path}?${query.toString()}`, {
    responseType: "blob",
  });

  const ext = path.endsWith("excel") ? "xlsx" : "pdf";
  const url = URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chip toggle ──────────────────────────────────────────────────────────────

function ChipToggle({
  label,
  selected,
  colorClass,
  onClick,
}: {
  label: string;
  selected: boolean;
  colorClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-selected={selected}
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${colorClass}`}
    >
      {label}
    </button>
  );
}

// ─── Multi Select ─────────────────────────────────────────────────────────────

function MultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder,
  label,
}: {
  options: { label: string; value: string }[];
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal h-9 px-3 py-2 text-sm bg-transparent border-input hover:bg-accent hover:text-accent-foreground"
          >
            <span className="truncate">
              {selectedValues.length === 0
                ? placeholder
                : `${selectedValues.length} selecionado(s)`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={selectedValues.includes(opt.value)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selectedValues, opt.value]);
                } else {
                  onChange(selectedValues.filter((v) => v !== opt.value));
                }
              }}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  collapsible = false,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
        onClick={() => collapsible && setOpen((o) => !o)}
      >
        {title}
        {collapsible && (open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Equipment Report Tab ─────────────────────────────────────────────────────

function EquipmentReport() {
  const { data: types = [] } = useEquipmentTypes({ limit: 100 } as any);
  const { data: costCenters = [] } = useCostCenters({ limit: 100, isActive: true } as any);

  const [statuses, setStatuses] = useState<EquipmentStatus[]>([]);
  const [criticalities, setCriticalities] = useState<EquipmentCriticality[]>([]);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [costCenterIds, setCostCenterIds] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState("none");
  const [orderBy, setOrderBy] = useState("name");

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    EQUIPMENT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.key)
  );

  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  const toggleStatus = (s: EquipmentStatus) =>
    setStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const toggleCriticality = (c: EquipmentCriticality) =>
    setCriticalities((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const toggleColumn = (key: string) =>
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const selectAllCategory = (cat: string) => {
    const catKeys = EQUIPMENT_COLUMNS.filter((c) => c.category === cat).map((c) => c.key);
    const allSelected = catKeys.every((k) => selectedColumns.includes(k));
    setSelectedColumns((prev) =>
      allSelected ? prev.filter((k) => !catKeys.includes(k)) : [...new Set([...prev, ...catKeys])]
    );
  };

  const params: Record<string, string | string[] | undefined> = {
    ...(statuses.length > 0 && { status: statuses.join(",") }),
    ...(criticalities.length > 0 && { criticality: criticalities.join(",") }),
    ...(typeIds.length > 0 && { typeId: typeIds.join(",") }),
    ...(costCenterIds.length > 0 && { costCenterId: costCenterIds.join(",") }),
    ...(groupBy !== "none" && { groupBy }),
    ...(orderBy !== "name" && { orderBy }),
    columns: selectedColumns.join(","),
  };

  const handleDownload = async (format: "excel" | "pdf") => {
    if (selectedColumns.length === 0) {
      toast.error("Selecione pelo menos uma coluna.");
      return;
    }
    setLoading(format);
    try {
      await downloadReport(`equipment/${format}`, params, "Equipamentos");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Section title="Filtros" collapsible>
        <div className="space-y-4">
          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Status</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABEL) as EquipmentStatus[]).map((s) => (
                <ChipToggle
                  key={s}
                  label={STATUS_LABEL[s]}
                  selected={statuses.includes(s)}
                  colorClass={STATUS_COLOR[s]}
                  onClick={() => toggleStatus(s)}
                />
              ))}
            </div>
          </div>

          {/* Criticidade */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Criticidade</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CRIT_LABEL) as EquipmentCriticality[]).map((c) => (
                <ChipToggle
                  key={c}
                  label={CRIT_LABEL[c]}
                  selected={criticalities.includes(c)}
                  colorClass={CRIT_COLOR[c]}
                  onClick={() => toggleCriticality(c)}
                />
              ))}
            </div>
          </div>

          {/* Tipo / CC */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MultiSelect
              label="Tipo de equipamento"
              placeholder="Todos os tipos"
              options={(types as any[]).map((t: any) => ({ label: t.name, value: t.id }))}
              selectedValues={typeIds}
              onChange={setTypeIds}
            />

            <MultiSelect
              label="Centro de custo"
              placeholder="Todos"
              options={(costCenters as any[]).map((cc: any) => ({
                label: cc.code ? `${cc.code} — ${cc.name}` : cc.name,
                value: cc.id,
              }))}
              selectedValues={costCenterIds}
              onChange={setCostCenterIds}
            />
          </div>
        </div>
      </Section>

      {/* Agrupamento e ordenação */}
      <Section title="Agrupamento e ordenação" collapsible>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Agrupar por</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="criticality">Criticidade</SelectItem>
                <SelectItem value="type">Tipo</SelectItem>
                <SelectItem value="location">Local</SelectItem>
                <SelectItem value="costCenter">Centro de custo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Separa os equipamentos em seções no relatório.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ordenar por</Label>
            <Select value={orderBy} onValueChange={setOrderBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome (A-Z)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="criticality">Criticidade</SelectItem>
                <SelectItem value="type">Tipo</SelectItem>
                <SelectItem value="costCenter">Centro de custo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ordenação dentro de cada grupo (ou geral, sem agrupamento).
            </p>
          </div>
        </div>
      </Section>

      {/* Colunas */}
      <Section title={`Colunas (${selectedColumns.length} selecionadas)`} collapsible>
        <div className="space-y-4">
          {COLUMN_CATEGORIES.map((cat) => {
            const catCols = EQUIPMENT_COLUMNS.filter((c) => c.category === cat);
            const allSelected = catCols.every((c) => selectedColumns.includes(c.key));
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {cat}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => selectAllCategory(cat)}
                  >
                    {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {catCols.map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      data-selected={selectedColumns.includes(col.key)}
                      onClick={() => toggleColumn(col.key)}
                      className="px-3 py-1 rounded-md border text-xs font-medium transition-colors
                        border-border text-muted-foreground bg-background
                        data-[selected=true]:border-primary data-[selected=true]:text-primary data-[selected=true]:bg-primary/10"
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setSelectedColumns(EQUIPMENT_COLUMNS.map((c) => c.key))}
            >
              Selecionar todas
            </button>
            <span className="text-xs text-muted-foreground">·</span>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                setSelectedColumns(
                  EQUIPMENT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.key)
                )
              }
            >
              Restaurar padrão
            </button>
            <span className="text-xs text-muted-foreground">·</span>
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
              onClick={() => setSelectedColumns([])}
            >
              Limpar
            </button>
          </div>
        </div>
      </Section>

      {/* Preview das colunas selecionadas */}
      {selectedColumns.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">Ordem das colunas no relatório:</p>
          <div className="flex flex-wrap gap-1">
            {selectedColumns.map((key) => {
              const col = EQUIPMENT_COLUMNS.find((c) => c.key === key);
              return (
                <Badge key={key} variant="secondary" className="text-xs">
                  {col?.label ?? key}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => handleDownload("excel")}
          disabled={loading !== null || selectedColumns.length === 0}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading === "excel" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Exportar Excel
        </Button>
        <Button
          onClick={() => handleDownload("pdf")}
          disabled={loading !== null || selectedColumns.length === 0}
          variant="outline"
          className="gap-2"
        >
          {loading === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Exportar PDF
        </Button>
      </div>
    </div>
  );
}

// ─── Service Orders Report Tab ────────────────────────────────────────────────

type OsStatus = "OPEN" | "AWAITING_PICKUP" | "IN_PROGRESS" | "COMPLETED" | "COMPLETED_APPROVED" | "COMPLETED_REJECTED" | "CANCELLED";
type OsPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type OsMaintenanceType = "PREVENTIVE" | "CORRECTIVE" | "INITIAL_ACCEPTANCE" | "EXTERNAL_SERVICE" | "TECHNOVIGILANCE" | "TRAINING" | "IMPROPER_USE" | "DEACTIVATION";

const OS_STATUS_LABEL: Record<OsStatus, string> = {
  OPEN: "Aberta",
  AWAITING_PICKUP: "Ag. técnico",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  COMPLETED_APPROVED: "Aprovada",
  COMPLETED_REJECTED: "Reprovada",
  CANCELLED: "Cancelada",
};

const OS_STATUS_COLOR: Record<OsStatus, string> = {
  OPEN: "border-gray-300 text-gray-600 bg-gray-50 data-[selected=true]:bg-gray-500 data-[selected=true]:text-white data-[selected=true]:border-gray-500",
  AWAITING_PICKUP: "border-purple-300 text-purple-700 bg-purple-50 data-[selected=true]:bg-purple-600 data-[selected=true]:text-white data-[selected=true]:border-purple-600",
  IN_PROGRESS: "border-amber-300 text-amber-700 bg-amber-50 data-[selected=true]:bg-amber-600 data-[selected=true]:text-white data-[selected=true]:border-amber-600",
  COMPLETED: "border-blue-300 text-blue-700 bg-blue-50 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white data-[selected=true]:border-blue-600",
  COMPLETED_APPROVED: "border-emerald-300 text-emerald-700 bg-emerald-50 data-[selected=true]:bg-emerald-600 data-[selected=true]:text-white data-[selected=true]:border-emerald-600",
  COMPLETED_REJECTED: "border-red-300 text-red-700 bg-red-50 data-[selected=true]:bg-red-600 data-[selected=true]:text-white data-[selected=true]:border-red-600",
  CANCELLED: "border-zinc-300 text-zinc-500 bg-zinc-50 data-[selected=true]:bg-zinc-500 data-[selected=true]:text-white data-[selected=true]:border-zinc-500",
};

const OS_PRIORITY_LABEL: Record<OsPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const OS_PRIORITY_COLOR: Record<OsPriority, string> = {
  LOW: "border-emerald-300 text-emerald-700 bg-emerald-50 data-[selected=true]:bg-emerald-600 data-[selected=true]:text-white data-[selected=true]:border-emerald-600",
  MEDIUM: "border-blue-300 text-blue-700 bg-blue-50 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white data-[selected=true]:border-blue-600",
  HIGH: "border-amber-300 text-amber-700 bg-amber-50 data-[selected=true]:bg-amber-600 data-[selected=true]:text-white data-[selected=true]:border-amber-600",
  URGENT: "border-red-300 text-red-700 bg-red-50 data-[selected=true]:bg-red-600 data-[selected=true]:text-white data-[selected=true]:border-red-600",
};

const OS_MAINT_LABEL: Record<OsMaintenanceType, string> = {
  PREVENTIVE: "Preventiva",
  CORRECTIVE: "Corretiva",
  INITIAL_ACCEPTANCE: "Aceitação inicial",
  EXTERNAL_SERVICE: "Serviço externo",
  TECHNOVIGILANCE: "Tecnovigilância",
  TRAINING: "Treinamento",
  IMPROPER_USE: "Uso inadequado",
  DEACTIVATION: "Desativação",
};

const DATE_FIELD_LABEL: Record<string, string> = {
  createdAt: "Criação",
  startedAt: "Início",
  completedAt: "Conclusão",
  approvedAt: "Aprovação",
};

interface SimpleOption { id: string; name: string }

function ActiveFiltersBar({
  statuses, priorities, maintTypes,
  onClearStatus, onClearPriority, onClearMaint, onClearAll,
}: {
  statuses: OsStatus[]
  priorities: OsPriority[]
  maintTypes: OsMaintenanceType[]
  onClearStatus: (s: OsStatus) => void
  onClearPriority: (p: OsPriority) => void
  onClearMaint: (m: OsMaintenanceType) => void
  onClearAll: () => void
}) {
  const total = statuses.length + priorities.length + maintTypes.length;
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="text-xs text-muted-foreground mr-1">Filtros ativos:</span>
      {statuses.map((s) => (
        <span key={s} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {OS_STATUS_LABEL[s]}
          <button type="button" onClick={() => onClearStatus(s)}><X className="h-3 w-3" /></button>
        </span>
      ))}
      {priorities.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
          {OS_PRIORITY_LABEL[p]}
          <button type="button" onClick={() => onClearPriority(p)}><X className="h-3 w-3" /></button>
        </span>
      ))}
      {maintTypes.map((m) => (
        <span key={m} className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
          {OS_MAINT_LABEL[m]}
          <button type="button" onClick={() => onClearMaint(m)}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="ml-auto text-xs text-destructive hover:underline">
        Limpar todos
      </button>
    </div>
  );
}

function ServiceOrdersReport() {
  const currentUser = useCurrentUser();
  const isClientAdmin = currentUser?.role === "CLIENT_ADMIN";

  const { data: groupsData } = useMaintenanceGroups({ isActive: true });

  const [clients, setClients] = useState<SimpleOption[]>([]);
  const [assignees, setAssignees] = useState<SimpleOption[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateField, setDateField] = useState("createdAt");

  const [statuses, setStatuses] = useState<OsStatus[]>([]);
  const [priorities, setPriorities] = useState<OsPriority[]>([]);
  const [maintTypes, setMaintTypes] = useState<OsMaintenanceType[]>([]);

  const [clientId, setClientId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [osGroupBy, setOsGroupBy] = useState("none");

  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    api.get("/reports/service-orders/assignees").then(({ data }) => {
      setAssignees((data ?? []).map((u: any) => ({ id: u.id, name: u.name })));
    }).catch(() => {});
    if (isClientAdmin) return;
    api.get("/clients", { params: { limit: 100 } }).then(({ data }) => {
      setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
  }, [isClientAdmin]);

  const toggleStatus = (s: OsStatus) =>
    setStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const togglePriority = (p: OsPriority) =>
    setPriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const toggleMaint = (m: OsMaintenanceType) =>
    setMaintTypes((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const clearAll = () => { setStatuses([]); setPriorities([]); setMaintTypes([]); };

  const groups: SimpleOption[] = (groupsData as any)?.data ?? groupsData ?? [];

  const params: Record<string, string | undefined> = {
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(dateField !== "createdAt" && { dateField }),
    ...(statuses.length > 0 && { status: statuses.join(",") }),
    ...(priorities.length > 0 && { priority: priorities.join(",") }),
    ...(maintTypes.length > 0 && { maintenanceType: maintTypes.join(",") }),
    ...(!isClientAdmin && clientId && { clientId }),
    ...(groupId && { groupId }),
    ...(technicianId && { technicianId }),
    ...(osGroupBy !== "none" && { groupBy: osGroupBy }),
  };

  const handleDownload = async (format: "excel" | "pdf") => {
    setLoading(format);
    try {
      await downloadReport(`service-orders/${format}`, params, "OS");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Período */}
      <Section title="Período" collapsible>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Filtrar por data de</Label>
            <Select value={dateField} onValueChange={setDateField}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATE_FIELD_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Status */}
      <Section title="Status" collapsible>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OS_STATUS_LABEL) as OsStatus[]).map((s) => (
            <ChipToggle
              key={s}
              label={OS_STATUS_LABEL[s]}
              selected={statuses.includes(s)}
              colorClass={OS_STATUS_COLOR[s]}
              onClick={() => toggleStatus(s)}
            />
          ))}
        </div>
        {statuses.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Nenhum selecionado = todos os status</p>
        )}
      </Section>

      {/* Prioridade */}
      <Section title="Prioridade" collapsible>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OS_PRIORITY_LABEL) as OsPriority[]).map((p) => (
            <ChipToggle
              key={p}
              label={OS_PRIORITY_LABEL[p]}
              selected={priorities.includes(p)}
              colorClass={OS_PRIORITY_COLOR[p]}
              onClick={() => togglePriority(p)}
            />
          ))}
        </div>
        {priorities.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Nenhuma selecionada = todas as prioridades</p>
        )}
      </Section>

      {/* Tipo de manutenção */}
      <Section title="Tipo de manutenção" collapsible>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OS_MAINT_LABEL) as OsMaintenanceType[]).map((m) => (
            <button
              key={m}
              type="button"
              data-selected={maintTypes.includes(m)}
              onClick={() => toggleMaint(m)}
              className="px-3 py-1 rounded-full border text-xs font-medium transition-colors
                border-border text-muted-foreground bg-background
                data-[selected=true]:border-violet-600 data-[selected=true]:text-violet-700 data-[selected=true]:bg-violet-50"
            >
              {OS_MAINT_LABEL[m]}
            </button>
          ))}
        </div>
        {maintTypes.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Nenhum selecionado = todos os tipos</p>
        )}
      </Section>

      {/* Entidades */}
      <Section title="Entidades" collapsible>
        <div className={`grid grid-cols-1 gap-3 ${isClientAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-4"}`}>
          {!isClientAdmin && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prestador / Cliente</Label>
              <Select value={clientId || "__all__"} onValueChange={(v) => setClientId(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Grupo de manutenção</Label>
            <Select value={groupId || "__all__"} onValueChange={(v) => setGroupId(v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os grupos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Responsável pela OS</Label>
            <Select value={technicianId || "__all__"} onValueChange={(v) => setTechnicianId(v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os responsáveis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os responsáveis</SelectItem>
                {assignees.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* Agrupamento / Quebra */}
      <Section title="Agrupamento (quebra)" collapsible>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Quebrar relatório por</Label>
            <Select value={osGroupBy} onValueChange={setOsGroupBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
                <SelectItem value="maintenanceType">Tipo de manutenção</SelectItem>
                <SelectItem value="client">Cliente / Prestador</SelectItem>
                <SelectItem value="group">Grupo de manutenção</SelectItem>
                <SelectItem value="technician">Técnico responsável</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Insere seções separadas com subtotal por grupo no Excel e PDF.
            </p>
          </div>
        </div>
      </Section>

      {/* Resumo de filtros ativos */}
      <ActiveFiltersBar
        statuses={statuses}
        priorities={priorities}
        maintTypes={maintTypes}
        onClearStatus={(s) => setStatuses((prev) => prev.filter((x) => x !== s))}
        onClearPriority={(p) => setPriorities((prev) => prev.filter((x) => x !== p))}
        onClearMaint={(m) => setMaintTypes((prev) => prev.filter((x) => x !== m))}
        onClearAll={clearAll}
      />

      <div className="flex gap-3">
        <Button
          onClick={() => handleDownload("excel")}
          disabled={loading !== null}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading === "excel" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Exportar Excel
        </Button>
        <Button
          onClick={() => handleDownload("pdf")}
          disabled={loading !== null}
          variant="outline"
          className="gap-2"
        >
          {loading === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Exportar PDF
        </Button>
      </div>
    </div>
  );
}

// ─── Preventive Report Tab ────────────────────────────────────────────────────

type RecurrenceType = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";

const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM: "Personalizada",
};

interface ClientOption { id: string; name: string }

function PreventiveReport() {
  const currentUser = useCurrentUser();
  const isClientAdmin = currentUser?.role === "CLIENT_ADMIN";

  const { data: types = [] } = useEquipmentTypes({ limit: 100 } as any);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [recurrenceTypes, setRecurrenceTypes] = useState<RecurrenceType[]>([]);
  const [isActive, setIsActive] = useState("__all__");
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  // Load clients list for company admins
  useEffect(() => {
    if (isClientAdmin) return;
    api.get("/clients", { params: { limit: 100 } }).then(({ data }) => {
      setClients((data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    });
  }, [isClientAdmin]);

  const toggleRecurrence = (r: RecurrenceType) =>
    setRecurrenceTypes((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const params: Record<string, string | string[] | undefined> = {
    ...(clientId && !isClientAdmin && { clientId }),
    ...(typeIds.length > 0 && { typeId: typeIds.join(",") }),
    ...(recurrenceTypes.length > 0 && { recurrenceType: recurrenceTypes.join(",") }),
    ...(isActive !== "__all__" && { isActive }),
  };

  const handleDownload = async (format: "excel" | "pdf") => {
    setLoading(format);
    try {
      await downloadReport(`preventive/${format}`, params, "Preventivas");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Filtros" collapsible>
        <div className="space-y-4">
          {/* Recorrência — chips */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Recorrência</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RECURRENCE_LABEL) as RecurrenceType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  data-selected={recurrenceTypes.includes(r)}
                  onClick={() => toggleRecurrence(r)}
                  className="px-3 py-1 rounded-full border text-xs font-medium transition-colors
                    border-border text-muted-foreground bg-background
                    data-[selected=true]:border-primary data-[selected=true]:text-primary data-[selected=true]:bg-primary/10"
                >
                  {RECURRENCE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Cliente (company admin only) + Tipo + Status */}
          <div className={`grid grid-cols-1 gap-3 ${isClientAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-4"}`}>
            {!isClientAdmin && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prestador</Label>
                <Select value={clientId || "__all__"} onValueChange={(v) => setClientId(v === "__all__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os prestadores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os prestadores</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <MultiSelect
              label="Tipo de equipamento"
              placeholder="Todos os tipos"
              options={(types as any[]).map((t: any) => ({ label: t.name, value: t.id }))}
              selectedValues={typeIds}
              onChange={setTypeIds}
            />

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={isActive} onValueChange={setIsActive}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="true">Apenas ativos</SelectItem>
                  <SelectItem value="false">Apenas inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Section>

      <div className="flex gap-3">
        <Button
          onClick={() => handleDownload("excel")}
          disabled={loading !== null}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading === "excel" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Exportar Excel
        </Button>
        <Button
          onClick={() => handleDownload("pdf")}
          disabled={loading !== null}
          variant="outline"
          className="gap-2"
        >
          {loading === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Exportar PDF
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Configure filtros, colunas e exporte em Excel ou PDF.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="equipment">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="equipment" className="gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="service-orders" className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            Ordens de Serviço
          </TabsTrigger>
          <TabsTrigger value="preventive" className="gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Preventivas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="mt-4">
          <EquipmentReport />
        </TabsContent>

        <TabsContent value="service-orders" className="mt-4">
          <ServiceOrdersReport />
        </TabsContent>

        <TabsContent value="preventive" className="mt-4">
          <PreventiveReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
