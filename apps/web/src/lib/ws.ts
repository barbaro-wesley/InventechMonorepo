/**
 * Resolve a URL base do servidor WebSocket.
 *
 * Em desenvolvimento: usa NEXT_PUBLIC_WS_URL (ex: http://localhost:3000)
 * Em produção sem variável definida: usa window.location.origin para que
 * o Socket.IO conecte no mesmo host/porta do browser, passando pelo Nginx.
 */
export function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:3000'
}
