import type { NextConfig } from "next";

const securityHeaders = [
  // Impede que a página seja embutida em iframe (clickjacking)
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Impede MIME-type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Controla informações do Referer enviadas em requisições
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Desativa features sensíveis do browser que a app não usa
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Força HTTPS por 1 ano (apenas quando HTTPS está configurado)
  ...(process.env.NEXT_PUBLIC_HTTPS === "true"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
      ]
    : []),
  // Content Security Policy — restringe origens de scripts, estilos e conexões
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js precisa de inline scripts para hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Estilos inline usados pelo Tailwind/shadcn
      "style-src 'self' 'unsafe-inline'",
      // Imagens: self + data URIs + MinIO/S3 público (avatares e logos)
      `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_STORAGE_URL ?? "http://localhost:9000"}`,
      // Fontes locais
      "font-src 'self'",
      // API backend (ajuste a porta/domínio conforme ambiente)
      // HTTP para REST + WS para Socket.IO
      (() => {
        const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/api.*$/, "")
        const wsOrigin  = apiOrigin.replace(/^http/, "ws")
        return `connect-src 'self' ${apiOrigin} ${wsOrigin}`
      })(),
      // PDF proxy da API embutido via iframe na página de assinatura
      (() => {
        const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/api.*$/, "")
        return `frame-src 'self' ${apiOrigin}`
      })(),
      // Sem frames externos
      "frame-ancestors 'none'",
      // Sem plugins
      "object-src 'none'",
      // Formulários só submetem para o próprio domínio
      "form-action 'self'",
      // Upgrade requisições HTTP para HTTPS (apenas quando HTTPS está configurado)
      ...(process.env.NEXT_PUBLIC_HTTPS === "true" ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Habilita output standalone para deploy em containers Docker
  // Gera um servidor Node.js mínimo em .next/standalone
  output: "standalone",

  // Define a raiz do monorepo para o Turbopack resolver pacotes corretamente
  turbopack: {
    root: "../../",
  },

  // O Socket.IO exige a barra final em /socket.io/ — sem isto o Next
  // redireciona (308) removendo a barra. Só ativa junto com o proxy.
  skipTrailingSlashRedirect: !!process.env.API_PROXY_TARGET,

  // Proxy opcional para a API (ex.: GitHub Codespaces no navegador).
  // Quando API_PROXY_TARGET está definido, o front chama /api/v1 e /socket.io
  // no próprio domínio e o Next repassa para a API — evita problemas de CSP,
  // CORS e cookie entre subdomínios diferentes. Sem a variável, nada muda.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
    if (!target) return [];
    return [
      { source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` },
      { source: "/socket.io/:path*", destination: `${target}/socket.io/:path*` },
    ];
  },

  async headers() {
    return [
      {
        // Aplica em todas as rotas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
