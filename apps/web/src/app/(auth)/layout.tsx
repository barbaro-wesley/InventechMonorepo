import { ThemeToggle } from "@/components/theme-toggle";
import { Settings2, ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Painel Esquerdo — Branding ── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-zinc-950 w-full lg:w-[52%] xl:w-1/2 p-12 xl:p-16">

        {/* Glows */}
        <div className="absolute top-1/4 -left-20 w-[420px] h-[420px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-[300px] h-[300px] rounded-full bg-violet-600/15 blur-[90px] pointer-events-none translate-x-1/3" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">InvenTech</span>
        </div>

        {/* Conteúdo central */}
        <div className="relative z-10 space-y-8">

          {/* Heading */}
          <div>
            <h1 className="text-3xl xl:text-[2.6rem] font-bold text-white leading-tight tracking-tight mb-3">
              Gestão inteligente<br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
                de ativos e manutenções
              </span>
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
              Centralize preventivas, ordens de serviço e ativos em uma única plataforma.
            </p>
          </div>

          {/* Módulos em destaque */}
          <div className="grid grid-cols-2 gap-3">
            {/* Preventivas */}
            <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30">
                  <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Preventivas</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white leading-none">12</p>
                <p className="text-xs text-indigo-400/80 mt-1">agendadas este mês</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1 flex-1 rounded-full bg-indigo-500/20 overflow-hidden">
                  <div className="h-full w-[75%] rounded-full bg-indigo-400" />
                </div>
                <span className="text-[10px] text-indigo-400 font-medium">75%</span>
              </div>
            </div>

            {/* Ordens de Serviço */}
            <div className="bg-violet-500/10 border border-violet-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500/20 border border-violet-500/30">
                  <ClipboardList className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Ordens</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white leading-none">8</p>
                <p className="text-xs text-violet-400/80 mt-1">abertas em andamento</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1 flex-1 rounded-full bg-violet-500/20 overflow-hidden">
                  <div className="h-full w-[62%] rounded-full bg-violet-400" />
                </div>
                <span className="text-[10px] text-violet-400 font-medium">62%</span>
              </div>
            </div>
          </div>

          {/* Lista de OS recentes */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Recentes</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Ao vivo</span>
              </div>
            </div>
            <div>
              {[
                {
                  id: "OS-1042",
                  asset: "Compressor #3",
                  type: "Preventiva",
                  status: "Em andamento",
                  icon: Clock,
                  iconCls: "text-blue-400",
                  pill: "bg-blue-500/15 text-blue-300 border-blue-500/25",
                },
                {
                  id: "OS-1041",
                  asset: "Gerador Industrial A",
                  type: "Corretiva",
                  status: "Concluída",
                  icon: CheckCircle2,
                  iconCls: "text-emerald-400",
                  pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
                },
                {
                  id: "OS-1040",
                  asset: "Bomba Hidráulica #7",
                  type: "Preventiva",
                  status: "Pendente",
                  icon: AlertCircle,
                  iconCls: "text-amber-400",
                  pill: "bg-amber-500/15 text-amber-300 border-amber-500/25",
                },
              ].map((os, i) => (
                <div
                  key={os.id}
                  className={`flex items-center justify-between px-4 py-3 ${i < 2 ? "border-b border-zinc-800/60" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <os.icon className={`w-3.5 h-3.5 shrink-0 ${os.iconCls}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 leading-none">{os.id}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{os.asset}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border shrink-0 ml-3 ${os.pill}`}>
                    {os.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="relative z-10">
          <p className="text-xs text-zinc-700">© {new Date().getFullYear()} InvenTech</p>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="relative flex flex-col items-center justify-center flex-1 min-h-screen lg:min-h-0 p-6 sm:p-10 bg-zinc-50 dark:bg-zinc-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/60 via-transparent to-transparent dark:from-indigo-950/20 pointer-events-none" />
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
          <ThemeToggle />
        </div>
        <div className="relative w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
