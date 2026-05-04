import { ThemeToggle } from "@/components/theme-toggle";
import { Settings2, ClipboardList, BarChart3 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Painel Esquerdo — Branding ── */}
      <div className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden bg-zinc-950 border-r border-zinc-800/50 py-6">

        {/* Glow effects */}
        <div className="absolute top-[-10%] left-[-5%] w-[550px] h-[550px] rounded-full bg-indigo-500/15 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-5%] right-[-10%] w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[110px] pointer-events-none" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Conteúdo */}
        <div className="relative z-10 text-center w-full max-w-xs xl:max-w-sm px-6 xl:px-8">

          {/* Logo card */}
          <div className="inline-flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl px-5 py-3 mb-5 xl:mb-7 shadow-xl">
            <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 2V16M2.5 5.5L15.5 12.5M15.5 5.5L2.5 12.5"
                  stroke="white"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-lg xl:text-xl tracking-tight">
              InvenTech
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl xl:text-4xl font-semibold text-white leading-tight mb-1.5 tracking-tight">
            Gestão Inteligente
          </h1>
          <p className="text-base xl:text-xl font-medium bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent mb-3 xl:mb-4">
            de Ativos e Manutenções
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed mx-auto mb-5 xl:mb-6">
            Controle preventivas, corretivas e ordens de serviço em uma plataforma centralizada.
          </p>

          {/* Badges — destaque para Preventivas e OS */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-5 xl:mb-6">
            {[
              { Icon: Settings2, label: "Preventivas", featured: true },
              { Icon: ClipboardList, label: "Ordens de Serviço", featured: true },
              { Icon: BarChart3, label: "Ativos", featured: false },
            ].map((cat) => (
              <div
                key={cat.label}
                className={
                  cat.featured
                    ? "inline-flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-500/30 rounded-full px-3.5 py-1.5 text-xs text-indigo-300 font-semibold hover:bg-indigo-500/20 transition-colors"
                    : "inline-flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 rounded-full px-3.5 py-1.5 text-xs text-zinc-400 font-medium hover:bg-zinc-800/60 hover:border-zinc-700 transition-colors"
                }
              >
                <cat.Icon className={`w-3 h-3 ${cat.featured ? "text-indigo-400" : "text-zinc-500"}`} />
                {cat.label}
              </div>
            ))}
          </div>

          {/* Stats — destaque para Preventivas */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Preventivas", value: "12", sub: "este mês", featured: true },
              { label: "OS abertas", value: "8", sub: "em andamento", featured: true },
              { label: "No prazo", value: "98%", sub: "concluídas", featured: false },
            ].map((stat) => (
              <div
                key={stat.label}
                className={
                  stat.featured
                    ? "bg-indigo-500/10 border border-indigo-500/25 rounded-xl p-2.5 text-left"
                    : "bg-zinc-900/60 border border-zinc-800 rounded-xl p-2.5 text-left"
                }
              >
                <p className="text-[10px] text-zinc-500 mb-1 leading-none truncate">{stat.label}</p>
                <p className="text-base font-bold text-white leading-none mb-1">{stat.value}</p>
                <p className={`text-[10px] font-medium leading-none ${stat.featured ? "text-indigo-400" : "text-emerald-400"}`}>
                  {stat.sub}
                </p>
              </div>
            ))}
          </div>

          {/* OS mockup card com gradient border */}
          <div className="p-px rounded-2xl bg-gradient-to-b from-indigo-500/40 via-indigo-500/10 to-zinc-800/20 shadow-lg shadow-indigo-500/10">
            <div className="w-full bg-zinc-900/95 backdrop-blur-md rounded-[15px] p-4 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Ordens de Serviço
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">Ao vivo</span>
                </div>
              </div>
              <div className="space-y-0">
                {[
                  { id: "OS-1042", asset: "Compressor #3", status: "Em andamento", cls: "bg-blue-500/15 text-blue-400" },
                  { id: "OS-1041", asset: "Gerador Industrial A", status: "Concluída", cls: "bg-emerald-500/15 text-emerald-400" },
                  { id: "OS-1040", asset: "Bomba Hidráulica #7", status: "Pendente", cls: "bg-amber-500/15 text-amber-400" },
                ].map((os, i) => (
                  <div
                    key={os.id}
                    className={`flex items-center justify-between py-2.5 ${i < 2 ? "border-b border-zinc-800/60" : ""}`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{os.id}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{os.asset}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${os.cls}`}>
                      {os.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="relative flex items-center justify-center min-h-screen p-6 sm:p-8 lg:min-h-0 bg-white dark:bg-zinc-950">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-100/50 blur-[80px] pointer-events-none dark:bg-indigo-500/5" />
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
          <ThemeToggle />
        </div>
        <div className="relative w-full max-w-sm sm:max-w-md">{children}</div>
      </div>
    </div>
  );
}
