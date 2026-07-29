/**
 * Formatação de prazos de SLA.
 *
 * Os prazos são armazenados em horas no backend. Exibir tudo em horas fica
 * ilegível para prazos longos (uma preventiva de 30 dias virava "720h"), então
 * a apresentação converte para dias sempre que faz sentido.
 */

/** 720 → "30d", 72 → "3d", 26 → "1d 2h", 4 → "4h" */
export function formatDurationHours(totalHours: number): string {
  const hours = Math.max(0, Math.round(totalHours))
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest === 0 ? `${days}d` : `${days}d ${rest}h`
}

/** Mesma formatação a partir de uma diferença em milissegundos. */
export function formatDurationMs(ms: number): string {
  const absMs = Math.abs(ms)
  if (absMs < 3_600_000) return '<1h'
  return formatDurationHours(absMs / 3_600_000)
}

/**
 * Duração com granularidade adaptativa: mostra minutos só quando o prazo é
 * curto o bastante para eles importarem. "29d 23h", "3h 20min", "45min".
 */
export function formatDurationDetailed(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const restHours = hours % 24
    return restHours === 0 ? `${days}d` : `${days}d ${restHours}h`
  }
  if (hours > 0) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`
  return `${minutes}min`
}

// ─── Conversão de unidade para os campos de configuração ─────────────────────

export type SlaUnit = 'hours' | 'days'

/**
 * Unidade natural para editar um prazo: dias quando é múltiplo exato de 24h,
 * horas caso contrário. Evita mostrar "720" num campo rotulado como horas.
 */
export function naturalUnit(hours: number): SlaUnit {
  return hours >= 24 && hours % 24 === 0 ? 'days' : 'hours'
}

export function toUnit(hours: number, unit: SlaUnit): number {
  return unit === 'days' ? hours / 24 : hours
}

export function toHours(value: number, unit: SlaUnit): number {
  return unit === 'days' ? value * 24 : value
}
