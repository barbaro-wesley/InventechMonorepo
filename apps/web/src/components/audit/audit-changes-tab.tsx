"use client";

import { useState } from "react";
import { Search, Filter, Eye, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuditChangeLogs, useAuditedEntities } from "@/hooks/audit/use-audit";
import type { AuditAction, AuditLog } from "@/services/audit/audit.service";

// ─── Labels ──────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<AuditAction, { label: string; className: string }> = {
  CREATE: { label: "Criação", className: "bg-green-100 text-green-700" },
  UPDATE: { label: "Alteração", className: "bg-blue-100 text-blue-700" },
  DELETE: { label: "Exclusão", className: "bg-red-100 text-red-700" },
  RESTORE: { label: "Restauração", className: "bg-amber-100 text-amber-700" },
};

const ENTITY_LABEL: Record<string, string> = {
  Equipment: "Equipamento",
  EquipmentType: "Tipo de equipamento",
  EquipmentSubtype: "Subtipo de equipamento",
  EquipmentMovement: "Movimentação de equipamento",
  EquipmentManual: "Manual de equipamento",
  EquipmentCustomFieldDefinition: "Campo personalizado",
  EquipmentCustomFieldValue: "Valor de campo personalizado",
  ServiceOrder: "Ordem de serviço",
  ServiceOrderTechnician: "Técnico da OS",
  ServiceOrderComment: "Comentário da OS",
  ServiceOrderTask: "Tarefa da OS",
  ServiceOrderCostItem: "Custo da OS",
  ServiceOrderChecklist: "Checklist da OS",
  Maintenance: "Manutenção",
  MaintenanceSchedule: "Agenda de manutenção",
  MaintenanceGroup: "Grupo de manutenção",
  User: "Usuário",
  Client: "Cliente",
  Company: "Empresa",
  CostCenter: "Centro de custo",
  Location: "Localização",
  Accessory: "Acessório",
  AccessoryCategory: "Categoria de acessório",
  AccessoryAssignment: "Vínculo de acessório",
  AccessoryMovement: "Movimentação de acessório",
  AccessoryMaintenance: "Manutenção de acessório",
  StockItem: "Item de estoque",
  StockMovement: "Movimentação de estoque",
  StockCategory: "Categoria de estoque",
  StockPoint: "Ponto de estoque",
  Attachment: "Anexo",
  CustomRole: "Perfil personalizado",
  Laudo: "Laudo",
  Printer: "Impressora",
  Scan: "Digitalização",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Nome",
  brand: "Marca",
  model: "Modelo",
  serialNumber: "Nº de série",
  patrimonyNumber: "Patrimônio",
  status: "Status",
  criticality: "Criticidade",
  observations: "Observações",
  description: "Descrição",
  title: "Título",
  priority: "Prioridade",
  email: "E-mail",
  phone: "Telefone",
  role: "Perfil",
  passwordHash: "Senha",
  purchaseValue: "Valor de compra",
  currentValue: "Valor atual",
  purchaseDate: "Data de compra",
  warrantyStart: "Início da garantia",
  warrantyEnd: "Fim da garantia",
  locationId: "Localização",
  currentLocationId: "Localização atual",
  costCenterId: "Centro de custo",
  typeId: "Tipo",
  subtypeId: "Subtipo",
  clientId: "Cliente",
  equipmentId: "Equipamento",
  quantity: "Quantidade",
  deletedAt: "Excluído em",
  createdAt: "Criado em",
};

const entityLabel = (e: string) => ENTITY_LABEL[e] ?? e;
const fieldLabel = (f: string) => FIELD_LABEL[f] ?? f;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string" && ISO_DATE.test(v)) return formatDate(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Linhas a exibir no detalhe: diff (from/to) ou snapshot completo. */
function detailRows(log: AuditLog): Array<{ field: string; from?: unknown; to?: unknown }> {
  if (log.changes) {
    return Object.entries(log.changes).map(([field, c]) => ({ field, from: c.from, to: c.to }));
  }
  if (log.action === "CREATE" && log.after) {
    return Object.entries(log.after).map(([field, to]) => ({ field, to }));
  }
  if (log.before) {
    return Object.entries(log.before).map(([field, from]) => ({ field, from }));
  }
  return [];
}

function changesSummary(log: AuditLog) {
  if (log.changes) {
    const fields = Object.keys(log.changes).filter((f) => f !== "deletedAt");
    if (!fields.length) return log.action === "DELETE" ? "Registro excluído" : log.action === "RESTORE" ? "Registro restaurado" : "—";
    const names = fields.slice(0, 3).map(fieldLabel).join(", ");
    return fields.length > 3 ? `${names} +${fields.length - 3}` : names;
  }
  if (log.action === "CREATE") return "Registro criado";
  if (log.action === "DELETE") return "Registro excluído";
  return "—";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AuditChangesTab() {
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState<AuditAction | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data: entities } = useAuditedEntities();
  const { data: logs, isLoading } = useAuditChangeLogs({
    page,
    limit: 20,
    search: search || undefined,
    entity: entity || undefined,
    action: action || undefined,
    dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
  });

  const selectClass =
    "text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 p-4 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por e-mail do usuário, ID do registro ou rota..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            className={selectClass}
            style={{ color: "var(--foreground)" }}
          >
            <option value="">Todas as entidades</option>
            {entities?.map((e) => (
              <option key={e.entity} value={e.entity}>
                {entityLabel(e.entity)} ({e.count})
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditAction | "");
              setPage(1);
            }}
            className={selectClass}
            style={{ color: "var(--foreground)" }}
          >
            <option value="">Todas as ações</option>
            {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a].label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className={selectClass}
            style={{ color: "var(--foreground)" }}
            aria-label="Data inicial"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className={selectClass}
            style={{ color: "var(--foreground)" }}
            aria-label="Data final"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Ação", "Registro", "Alterações", "Usuário", "Empresa", "Data/Hora", ""].map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50 animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs?.data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Nenhuma alteração encontrada.
                </td>
              </tr>
            ) : (
              logs?.data.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelected(log)}
                >
                  <td className="px-4 py-3">
                    <Badge className={`${ACTION_LABEL[log.action].className} border-0 text-xs`}>
                      {ACTION_LABEL[log.action].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                      {entityLabel(log.entity)}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {log.entityId.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                    {changesSummary(log)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user || log.userEmail ? (
                      <>
                        <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                          {log.user?.name ?? log.userEmail}
                        </p>
                        <p className="text-xs text-muted-foreground">{log.user?.email ?? log.userEmail}</p>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Sistema</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {log.company?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Ver
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {logs && logs.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {logs.pagination.total} registros · Página {logs.pagination.page} de{" "}
            {logs.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!logs.pagination.hasPrevPage}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!logs.pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <AuditLogDetailDialog log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ─── Detalhe: Campo | Valor anterior | Novo valor ─────────────────────────────

function AuditLogDetailDialog({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const rows = log ? detailRows(log) : [];
  const isDiff = !!log?.changes;
  const isCreate = log?.action === "CREATE" && !isDiff;

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        {log && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge className={`${ACTION_LABEL[log.action].className} border-0 text-xs`}>
                  {ACTION_LABEL[log.action].label}
                </Badge>
                {entityLabel(log.entity)}
              </DialogTitle>
              <DialogDescription>
                {log.user?.name ?? log.userEmail ?? "Sistema"} · {formatDate(log.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <Meta label="ID do registro" value={log.entityId} mono />
              <Meta label="Empresa" value={log.company?.name ?? "—"} />
              <Meta label="E-mail" value={log.user?.email ?? log.userEmail ?? "—"} />
              <Meta label="IP" value={log.ipAddress ?? "—"} mono />
              <Meta label="Rota" value={log.method ?? "—"} mono />
              <Meta label="Requisição" value={log.requestId ?? "—"} mono />
            </dl>

            <div className="overflow-auto border border-border rounded-lg mt-2">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Campo</th>
                    {!isCreate && (
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {isDiff ? "Valor anterior" : "Valor"}
                      </th>
                    )}
                    {isDiff && <th className="w-6" />}
                    {(isDiff || isCreate) && (
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {isDiff ? "Novo valor" : "Valor"}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        Sem detalhes registrados.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.field} className="border-t border-border/50 align-top">
                        <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {fieldLabel(r.field)}
                          {FIELD_LABEL[r.field] && (
                            <span className="block text-[10px] font-mono text-muted-foreground">{r.field}</span>
                          )}
                        </td>
                        {!isCreate && (
                          <td className={`px-3 py-2 break-all ${isDiff ? "text-red-700 bg-red-50/50" : "text-muted-foreground"}`}>
                            {formatValue(r.from)}
                          </td>
                        )}
                        {isDiff && (
                          <td className="py-2 text-muted-foreground">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </td>
                        )}
                        {(isDiff || isCreate) && (
                          <td className={`px-3 py-2 break-all ${isDiff ? "text-green-700 bg-green-50/50" : "text-muted-foreground"}`}>
                            {formatValue(r.to)}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`truncate ${mono ? "font-mono" : ""}`} style={{ color: "var(--foreground)" }} title={value}>
        {value}
      </dd>
    </div>
  );
}
