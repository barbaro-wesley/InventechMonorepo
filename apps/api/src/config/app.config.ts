import { registerAs } from '@nestjs/config'

// Último recurso, usado só quando nem FRONTEND_URL nem ALLOWED_ORIGINS estão no .env.
// Aponta para o domínio de produção porque o QR Code das etiquetas é lido por celular,
// fora do servidor — cair em localhost gera etiqueta impressa inútil.
export const DEFAULT_FRONTEND_URL = 'https://intranet.hcrmarau.com.br'

/** Primeira origem HTTP(S) de ALLOWED_ORIGINS (lista separada por vírgula). */
function firstAllowedOrigin(): string | undefined {
  return process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .find((origin) => origin.startsWith('http://') || origin.startsWith('https://'))
}

/**
 * URL pública do frontend, sem barra no final.
 *
 * Ordem: FRONTEND_URL → primeira origem de ALLOWED_ORIGINS → DEFAULT_FRONTEND_URL.
 * ALLOWED_ORIGINS entra na cadeia porque já é o domínio real do ambiente (tanto em
 * produção quanto em dev), o que faz o QR Code das etiquetas seguir o ambiente sem
 * depender de uma segunda variável no .env.
 */
export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL?.trim() || firstAllowedOrigin() || DEFAULT_FRONTEND_URL
  return url.replace(/\/+$/, '')
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.APP_PORT ?? '3000', 10),
  frontendUrl: getFrontendUrl(),

  // JWT
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  // Webhook interno do OCR worker
  scanWebhookSecret: process.env.SCAN_WEBHOOK_SECRET,
}))