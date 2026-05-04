import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Painel Esquerdo — Branding ── */}
      <div className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden bg-zinc-950">
        
        {/* Glow effects */}
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-zinc-800/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-zinc-800/10 blur-[100px] pointer-events-none" />

        {/* Grid pattern sutil */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Conteúdo */}
        <div className="relative z-10 text-center max-w-md px-8">
          {/* Logo card */}
          <div className="inline-flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl px-6 py-3.5 mb-10 shadow-sm">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z"
                  stroke="currentColor"
                  className="text-zinc-950"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 2V16M2.5 5.5L15.5 12.5M15.5 5.5L2.5 12.5"
                  stroke="currentColor"
                  className="text-zinc-950"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              InvenTech
            </span>
          </div>

          {/* Heading principal */}
          <h1 className="text-4xl font-semibold text-white leading-tight mb-2 tracking-tight">
            Gestão Inteligente
          </h1>
          <p className="text-xl font-medium text-zinc-400 mb-6">
            de Ativos e Manutenções
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-sm mx-auto mb-10">
            Otimize o ciclo de vida dos seus equipamentos. Controle preventivas, corretivas e ordens de serviço em uma plataforma centralizada e eficiente.
          </p>

          {/* Category badges */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { icon: "⚙️", label: "Preventivas e Corretivas" },
              { icon: "📋", label: "Ordens de Serviço" },
              { icon: "📊", label: "Gestão de Ativos" },
            ].map((cat) => (
              <div
                key={cat.label}
                className="inline-flex items-center gap-2 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-300 font-medium transition-colors hover:bg-zinc-800/50"
              >
                <span className="text-xs">{cat.icon}</span>
                {cat.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="relative flex items-center justify-center p-6 sm:p-8 bg-white dark:bg-zinc-950">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}