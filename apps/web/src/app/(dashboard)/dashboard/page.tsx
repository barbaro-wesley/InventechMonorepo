"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Users,
  Contact,
  Wrench,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  UserX,
  CalendarClock,
  Activity,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  MonitorDot,
} from "lucide-react";

import { usePlatformDashboard, useCompanyDashboard, useClientDashboard } from "@/hooks/dashboard/use-dashboard";
import { useUpcomingPreventives } from "@/hooks/maintenance/use-maintenance-schedule";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { useCurrentUser } from "@/store/auth.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoje";
  if (days === 1) return "há 1 dia";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return `há ${months} mês${months > 1 ? "es" : ""}`;
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500",
    "bg-orange-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
  ];
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const COMPANY_STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  ACTIVE:    { label: "Ativa",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  TRIAL:     { label: "Trial",    badge: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-500" },
  SUSPENDED: { label: "Suspensa", badge: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-500" },
  INACTIVE:  { label: "Inativa",  badge: "bg-slate-100 text-slate-600 border-slate-200",      dot: "bg-slate-400" },
};

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-start gap-4",
        onClick && "cursor-pointer hover:shadow-md transition-shadow"
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", accent)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert Row
// ---------------------------------------------------------------------------

function AlertRow({
  count,
  label,
  icon: Icon,
  color,
  onClick,
}: {
  count: number;
  label: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      onClick={onClick}
      className={cn("flex items-center gap-3 p-3 rounded-xl border", color, onClick && "cursor-pointer")}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">
        <strong>{count}</strong> {label}
      </span>
      {onClick && <ArrowRight className="w-3.5 h-3.5" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar
// ---------------------------------------------------------------------------

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-24 text-right shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-8 text-right shrink-0">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming Preventives Card
// ---------------------------------------------------------------------------

function UpcomingPreventivesCard() {
  const router = useRouter();
  const { data: schedules = [], isLoading } = useUpcomingPreventives(30);
  const [open, setOpen] = useState(false);

  if (isLoading || schedules.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header — clicável para expandir */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Preventivas nos próximos 30 dias
          </h2>
          <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
            {schedules.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); router.push("/preventivas"); }}
          >
            Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
          {open
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </div>
      </div>

      {/* Lista expandida */}
      {open && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {schedules.map((s) => {
            const days = Math.ceil((new Date(s.nextRunAt).getTime() - Date.now()) / 86_400_000);
            const urgency =
              days <= 7  ? "text-red-600 font-bold" :
              days <= 15 ? "text-orange-600 font-semibold" :
              "text-violet-600";
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => router.push("/preventivas")}
              >
                {/* ícone */}
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>

                {/* info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{s.title}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {s.equipment.name}
                    {s.client && <> · <span className="text-slate-500">{s.client.name}</span></>}
                    {s.group  && <> · <span>{s.group.name}</span></>}
                  </p>
                </div>

                {/* data */}
                <div className="flex-shrink-0 text-right">
                  <p className={cn("text-xs", urgency)}>
                    {days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `em ${days} dias`}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(s.nextRunAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonDash() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 h-52" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Super Admin Dashboard
// ---------------------------------------------------------------------------

function SuperAdminDashboard() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching } = usePlatformDashboard();

  if (isLoading) return <SkeletonDash />;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <XCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-slate-500">Não foi possível carregar o dashboard.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { companyMetrics, userMetrics, clientMetrics, equipmentTotal, osMetrics, licenseAlerts, recentCompanies } = data;
  const totalAlerts =
    companyMetrics.byStatus.suspended +
    companyMetrics.byStatus.inactive +
    licenseAlerts.length +
    userMetrics.blocked;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Visão geral da plataforma · atualizado às{" "}
            {new Date(data.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Empresas"
          value={companyMetrics.total}
          icon={Building2}
          accent="bg-blue-500"
          sub={`${companyMetrics.byStatus.active} ativas · ${companyMetrics.byStatus.trial} trial`}
          onClick={() => router.push("/empresas")}
        />
        <StatCard
          label="Usuários"
          value={userMetrics.total}
          icon={Users}
          accent="bg-violet-500"
          sub={`${userMetrics.active} ativos`}
        />
        <StatCard
          label="Prestadores"
          value={clientMetrics.total}
          icon={Contact}
          accent="bg-emerald-500"
          sub={`${clientMetrics.active} ativos`}
        />
        <StatCard
          label="Equipamentos"
          value={equipmentTotal}
          icon={Wrench}
          accent="bg-orange-500"
        />
      </div>

      {/* Row 2: OS + Alertas + Empresas por status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* OS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ordens de serviço</h2>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{osMetrics.total}</span>
            <span className="text-sm text-slate-400">total na plataforma</span>
          </div>
          <div className="space-y-3">
            <HBar label="Abertas" value={osMetrics.open} max={Math.max(osMetrics.total, 1)} color="bg-blue-400" />
            <HBar label="Em andamento" value={osMetrics.inProgress} max={Math.max(osMetrics.total, 1)} color="bg-violet-400" />
            <HBar label="Urgentes" value={osMetrics.urgent} max={Math.max(osMetrics.total, 1)} color="bg-red-400" />
          </div>
          {osMetrics.urgent > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {osMetrics.urgent} OS urgente{osMetrics.urgent > 1 ? "s" : ""} em aberto
              </p>
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Alertas</h2>
            </div>
            {totalAlerts > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                {totalAlerts}
              </span>
            )}
          </div>
          {totalAlerts === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm text-slate-400">Nenhum alerta ativo</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AlertRow
                count={companyMetrics.byStatus.suspended}
                label={`empresa${companyMetrics.byStatus.suspended !== 1 ? "s" : ""} suspensa${companyMetrics.byStatus.suspended !== 1 ? "s" : ""}`}
                icon={ShieldAlert}
                color="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                onClick={() => router.push("/empresas")}
              />
              <AlertRow
                count={companyMetrics.byStatus.inactive}
                label={`empresa${companyMetrics.byStatus.inactive !== 1 ? "s" : ""} inativa${companyMetrics.byStatus.inactive !== 1 ? "s" : ""}`}
                icon={XCircle}
                color="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                onClick={() => router.push("/empresas")}
              />
              <AlertRow
                count={licenseAlerts.length}
                label={`licença${licenseAlerts.length !== 1 ? "s" : ""} vencendo em 30 dias`}
                icon={CalendarClock}
                color="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
              />
              <AlertRow
                count={userMetrics.blocked}
                label={`usuário${userMetrics.blocked !== 1 ? "s" : ""} bloqueado${userMetrics.blocked !== 1 ? "s" : ""}`}
                icon={UserX}
                color="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
              />
              <AlertRow
                count={userMetrics.unverified}
                label={`não verificado${userMetrics.unverified !== 1 ? "s" : ""}`}
                icon={Users}
                color="bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
          )}
        </div>

        {/* Empresas por status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Empresas por status</h2>
          </div>
          <div className="space-y-3">
            <HBar label="Ativas" value={companyMetrics.byStatus.active} max={Math.max(companyMetrics.total, 1)} color="bg-emerald-400" />
            <HBar label="Trial" value={companyMetrics.byStatus.trial} max={Math.max(companyMetrics.total, 1)} color="bg-blue-400" />
            <HBar label="Suspensas" value={companyMetrics.byStatus.suspended} max={Math.max(companyMetrics.total, 1)} color="bg-red-400" />
            <HBar label="Inativas" value={companyMetrics.byStatus.inactive} max={Math.max(companyMetrics.total, 1)} color="bg-slate-300" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400">
              Total:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{companyMetrics.total}</span>{" "}
              empresa{companyMetrics.total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Row 3: Licenças + Empresas recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Licenças vencendo */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Licenças vencendo em 30 dias
              </h2>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push("/empresas")}>
              Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
          {licenseAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm text-slate-400">Nenhuma licença vencendo nos próximos 30 dias</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {licenseAlerts.map((company) => {
                const days = company.trialEndsAt ? daysUntil(company.trialEndsAt) : null;
                const statusCfg = COMPANY_STATUS_CONFIG[company.status] ?? COMPANY_STATUS_CONFIG.ACTIVE;
                const urgencyColor =
                  days != null && days <= 7 ? "text-red-600 font-bold" :
                  days != null && days <= 15 ? "text-orange-600 font-semibold" :
                  "text-amber-600";
                return (
                  <div
                    key={company.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/empresas/${company.id}`)}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0", getAvatarColor(company.name))}>
                      {getInitials(company.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{company.name}</p>
                      <p className="text-xs text-slate-400">{company._count.users} usuário{company._count.users !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant="outline" className={cn("text-xs block mb-1", statusCfg.badge)}>
                        {statusCfg.label}
                      </Badge>
                      {days != null && (
                        <p className={cn("text-xs", urgencyColor)}>
                          {days > 0 ? `${days} dia${days !== 1 ? "s" : ""}` : "Venceu"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Empresas recentes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cadastros recentes</h2>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push("/empresas")}>
              Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
          {recentCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Building2 className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Nenhuma empresa cadastrada</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentCompanies.map((company) => {
                const statusCfg = COMPANY_STATUS_CONFIG[company.status] ?? COMPANY_STATUS_CONFIG.ACTIVE;
                return (
                  <div
                    key={company.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/empresas/${company.id}`)}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0", getAvatarColor(company.name))}>
                      {getInitials(company.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{company.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{company._count.users} usuário{company._count.users !== 1 ? "s" : ""}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{company._count.clients} cliente{company._count.clients !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant="outline" className={cn("text-xs block mb-1", statusCfg.badge)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusCfg.dot)} />
                        {statusCfg.label}
                      </Badge>
                      <p className="text-xs text-slate-400">{timeAgo(company.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Company Dashboard (COMPANY_ADMIN / COMPANY_MANAGER)
// ---------------------------------------------------------------------------

function CompanyDashboard() {
  const user = useCurrentUser();
  const { data, isLoading, isError, refetch, isFetching } = useCompanyDashboard();
  const { data: upcomingSchedules = [] } = useUpcomingPreventives(30);
  const [equipmentByTypeOpen, setEquipmentByTypeOpen] = useState(false);

  if (isLoading) return <SkeletonDash />;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <XCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-slate-500">Não foi possível carregar o dashboard.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { osMetrics, equipmentMetrics, alerts, topTechnicians, groupMetrics } = data;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Bem-vindo de volta, {user?.name?.split(" ")[0]}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="OS abertas"
          value={osMetrics.byStatus.open}
          icon={ClipboardList}
          accent="bg-blue-500"
          sub="aguardando atendimento"
        />
        <StatCard
          label="Em andamento"
          value={osMetrics.byStatus.inProgress}
          icon={Activity}
          accent="bg-violet-500"
        />
        <StatCard
          label="Urgentes"
          value={osMetrics.urgent}
          icon={AlertTriangle}
          accent={osMetrics.urgent > 0 ? "bg-red-500" : "bg-slate-400"}
        />
        <StatCard
          label="Disponibilidade"
          value={`${equipmentMetrics.availabilityRate}%`}
          icon={Wrench}
          accent={equipmentMetrics.availabilityRate >= 80 ? "bg-emerald-500" : "bg-orange-500"}
          sub={`${equipmentMetrics.total} equipamentos`}
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Alertas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Alertas</h2>
            </div>
            {alerts.total > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                {alerts.total}
              </span>
            )}
          </div>
          {alerts.total === 0 && alerts.equipmentUnderMaintenance === 0 && alerts.warrantyExpiring === 0 && upcomingSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm text-slate-400">Nenhum alerta ativo</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AlertRow count={alerts.unassignedOs} label="OS sem técnico no painel" icon={ClipboardList} color="bg-red-50 text-red-700 border-red-200" />
              <AlertRow count={alerts.overdueAlerts} label="OS com alerta de atraso" icon={Clock} color="bg-orange-50 text-orange-700 border-orange-200" />
              <AlertRow count={alerts.equipmentUnderMaintenance} label="equipamentos em manutenção" icon={Wrench} color="bg-amber-50 text-amber-700 border-amber-200" />
              <AlertRow count={alerts.warrantyExpiring} label="garantias vencendo em 30 dias" icon={CalendarClock} color="bg-blue-50 text-blue-700 border-blue-200" />
              <AlertRow count={upcomingSchedules.length} label="preventivas nos próximos 30 dias" icon={CalendarRange} color="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-400" />
            </div>
          )}
        </div>

        {/* Equipamentos */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Equipamentos</h2>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{equipmentMetrics.total}</span>
            <span className="text-sm text-slate-400">cadastrados</span>
          </div>
          <div className="space-y-3">
            <HBar label="Ativos" value={equipmentMetrics.byStatus.active} max={Math.max(equipmentMetrics.total, 1)} color="bg-emerald-400" />
            <HBar label="Manutenção" value={equipmentMetrics.byStatus.underMaintenance} max={Math.max(equipmentMetrics.total, 1)} color="bg-amber-400" />
            <HBar label="Inativos" value={equipmentMetrics.byStatus.inactive} max={Math.max(equipmentMetrics.total, 1)} color="bg-slate-300" />
            <HBar label="Descartados" value={equipmentMetrics.byStatus.scrapped} max={Math.max(equipmentMetrics.total, 1)} color="bg-red-300" />
          </div>
          {equipmentMetrics.critical > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 font-medium">
                {equipmentMetrics.critical} de criticidade crítica
              </p>
            </div>
          )}
        </div>

        {/* Grupos */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Grupos de manutenção</h2>
          </div>
          {groupMetrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Nenhum grupo ativo</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {groupMetrics.slice(0, 5).map((g) => (
                <div key={g.group_id} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 truncate">{g.group_name}</span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{g.total_os}</span>
                    <span className="text-slate-400">OS</span>
                    {g.open_os > 0 && <span className="text-blue-500">({g.open_os})</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preventivas nos próximos 30 dias */}
      <UpcomingPreventivesCard />

      {/* Equipamentos por tipo */}
      {equipmentMetrics.byType && equipmentMetrics.byType.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setEquipmentByTypeOpen((v) => !v)}
            onKeyDown={(e) => e.key === "Enter" && setEquipmentByTypeOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <MonitorDot className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Equipamentos por tipo</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {equipmentMetrics.total} equipamento{equipmentMetrics.total !== 1 ? "s" : ""} · {equipmentMetrics.byType.length} tipo{equipmentMetrics.byType.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {equipmentByTypeOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
          </div>
          {equipmentByTypeOpen && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 space-y-3">
              {equipmentMetrics.byType.map((item) => {
                const pct = equipmentMetrics.total > 0
                  ? Math.round((item.count / equipmentMetrics.total) * 100)
                  : 0;
                return (
                  <div key={item.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{item.name}</span>
                      <span className="text-sm text-slate-500 tabular-nums">
                        {item.count} <span className="text-xs text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Top técnicos */}
      {topTechnicians.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Top técnicos — últimos 30 dias</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {topTechnicians.map((t, i) => {
              const rate = t.total_os > 0 ? Math.round((t.completed_os / t.total_os) * 100) : 0;
              return (
                <div key={t.technician_id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-slate-400 w-5 text-center">#{i + 1}</span>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", getAvatarColor(t.name))}>
                    {getInitials(t.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.name}</p>
                    <p className="text-xs text-slate-400">
                      {t.completed_os} concluídas de {t.total_os} OS
                      {t.avg_hours != null && ` · média ${t.avg_hours}h`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{rate}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Client Dashboard
// ---------------------------------------------------------------------------

const OS_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  AWAITING_PICKUP: { label: "No Painel",        color: "bg-slate-100 text-slate-600" },
  OPEN:            { label: "Atribuída",         color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS:     { label: "Em Andamento",      color: "bg-violet-100 text-violet-700" },
  COMPLETED:       { label: "Aguard. Aprovação", color: "bg-amber-100 text-amber-700" },
  COMPLETED_APPROVED: { label: "Aprovada",       color: "bg-emerald-100 text-emerald-700" },
  COMPLETED_REJECTED: { label: "Reprovada",      color: "bg-red-100 text-red-700" },
  CANCELLED:       { label: "Cancelada",         color: "bg-slate-100 text-slate-500" },
};

const PRIORITY_LABELS: Record<string, { label: string; dot: string }> = {
  LOW:    { label: "Baixa",   dot: "bg-slate-400" },
  MEDIUM: { label: "Média",   dot: "bg-blue-500" },
  HIGH:   { label: "Alta",    dot: "bg-orange-500" },
  URGENT: { label: "Urgente", dot: "bg-red-500" },
};

function ClientDashboard() {
  const user = useCurrentUser();
  const clientId = user?.clientId ?? "";
  const { data, isLoading, isError, refetch, isFetching } = useClientDashboard(clientId);

  if (isLoading) return <SkeletonDash />;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <XCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-slate-500">Não foi possível carregar o dashboard.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { osMetrics, equipmentMetrics, recentOs } = data;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Bem-vindo de volta, {user?.name?.split(" ")[0]}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total de OS"
          value={osMetrics.total}
          icon={ClipboardList}
          accent="bg-blue-500"
          sub={`${osMetrics.active} ativas`}
        />
        <StatCard
          label="Em andamento"
          value={osMetrics.byStatus.inProgress}
          icon={Activity}
          accent="bg-violet-500"
        />
        <StatCard
          label="Urgentes"
          value={osMetrics.urgent}
          icon={AlertTriangle}
          accent={osMetrics.urgent > 0 ? "bg-red-500" : "bg-slate-400"}
        />
        <StatCard
          label="Disponibilidade"
          value={`${equipmentMetrics.availabilityRate}%`}
          icon={Wrench}
          accent={equipmentMetrics.availabilityRate >= 80 ? "bg-emerald-500" : "bg-orange-500"}
          sub={`${equipmentMetrics.total} equipamentos`}
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Status das OS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">OS por status</h2>
          </div>
          <div className="space-y-2.5">
            <HBar label="No Painel"    value={osMetrics.byStatus.awaitingPickup} max={Math.max(osMetrics.total, 1)} color="bg-slate-400" />
            <HBar label="Atribuídas"   value={osMetrics.byStatus.open}           max={Math.max(osMetrics.total, 1)} color="bg-blue-400" />
            <HBar label="Andamento"    value={osMetrics.byStatus.inProgress}     max={Math.max(osMetrics.total, 1)} color="bg-violet-400" />
            <HBar label="Ag. Aprovação" value={osMetrics.byStatus.completed}    max={Math.max(osMetrics.total, 1)} color="bg-amber-400" />
            <HBar label="Aprovadas"    value={osMetrics.byStatus.approved}       max={Math.max(osMetrics.total, 1)} color="bg-emerald-400" />
          </div>
          {osMetrics.avgResolutionHours != null && (
            <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
              <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Tempo médio de resolução: <strong>{osMetrics.avgResolutionHours}h</strong>
              </p>
            </div>
          )}
        </div>

        {/* Equipamentos */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Equipamentos</h2>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{equipmentMetrics.total}</span>
            <span className="text-sm text-slate-400">cadastrados</span>
          </div>
          <div className="space-y-3">
            <HBar label="Ativos"      value={equipmentMetrics.byStatus.active}           max={Math.max(equipmentMetrics.total, 1)} color="bg-emerald-400" />
            <HBar label="Manutenção"  value={equipmentMetrics.byStatus.underMaintenance} max={Math.max(equipmentMetrics.total, 1)} color="bg-amber-400" />
            <HBar label="Inativos"    value={equipmentMetrics.byStatus.inactive}         max={Math.max(equipmentMetrics.total, 1)} color="bg-slate-300" />
            <HBar label="Descartados" value={equipmentMetrics.byStatus.scrapped}         max={Math.max(equipmentMetrics.total, 1)} color="bg-red-300" />
          </div>
          {equipmentMetrics.critical > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 font-medium">
                {equipmentMetrics.critical} de criticidade crítica
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Preventivas nos próximos 30 dias */}
      <UpcomingPreventivesCard />

      {/* OS Recentes */}
      {recentOs.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">OS recentes</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentOs.map((os) => {
              const statusCfg = OS_STATUS_LABELS[os.status] ?? { label: os.status, color: "bg-slate-100 text-slate-600" };
              const priorityCfg = PRIORITY_LABELS[os.priority] ?? { label: os.priority, dot: "bg-slate-400" };
              const technician = os.technicians[0]?.technician;
              return (
                <div key={os.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-slate-400 w-10 shrink-0">#{os.number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{os.title}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {os.equipment?.name ?? "Sem equipamento"}
                      {technician && ` · ${technician.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full", statusCfg.color)}>
                      {statusCfg.label}
                    </span>
                    <span className={cn("w-2 h-2 rounded-full", priorityCfg.dot)} title={priorityCfg.label} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Page entry point — renders view based on role
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const permissions = usePermissions();
  if (permissions.isSuperAdmin) return <SuperAdminDashboard />;
  if (permissions.isClientLevel) return <ClientDashboard />;
  return <CompanyDashboard />;
}
