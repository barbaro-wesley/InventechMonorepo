export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Painel Esquerdo — Branding ── */}
      <div className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #312e81 40%, #0f172a 100%)",
        }}
      >
        {/* Glow effects */}
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px] pointer-events-none" />

        {/* Grid pattern sutil */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Conteúdo */}
        <div className="relative z-10 text-center max-w-md px-8">
          {/* Logo card */}
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-6 py-3.5 mb-10 shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
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
                  strokeOpacity="0.6"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Inven<span className="text-blue-300">Tech</span>
            </span>
          </div>

          {/* Heading principal */}
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-2">
            Controle Total
          </h1>
          <p className="text-xl font-medium text-blue-200/90 mb-6">
            sobre seus equipamentos
          </p>
          <p className="text-sm text-blue-200/60 leading-relaxed max-w-sm mx-auto mb-10">
            Gerencie computadores, impressoras, equipamentos médicos e manutenções em uma plataforma moderna e intuitiva.
          </p>

          {/* Category badges */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { icon: "🖥", label: "Gestão de TI" },
              { icon: "🏥", label: "Equipamentos Médicos" },
              { icon: "🔧", label: "Manutenções" },
            ].map((cat) => (
              <div
                key={cat.label}
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 text-sm text-white/80 font-medium"
              >
                <span className="text-xs">{cat.icon}</span>
                {cat.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="flex items-center justify-center p-6 sm:p-8 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}