import { Prisma } from '@prisma/client'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Resolve a janela de análise a partir dos filtros da query.
 *
 * O front envia `YYYY-MM-DD`. `new Date('2026-07-29')` é interpretado como
 * meia-noite **UTC**, o que no fuso do Brasil equivale a 21h do dia anterior:
 * a janela ficava deslocada 3h e o último dia inteiro ficava de fora, porque
 * as consultas comparam `<= end`. Aqui a data pura é resolvida no fuso do
 * servidor e o fim vai até o último milissegundo do dia informado.
 *
 * Timestamps completos (ISO com hora) passam sem alteração.
 */
export function resolvePeriod(startDate?: string, endDate?: string) {
  return { start: parseStart(startDate), end: parseEnd(endDate) }
}

function parseStart(value?: string): Date {
  if (!value) return startOfYear()
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00`)
  return new Date(value)
}

function parseEnd(value?: string): Date {
  if (!value) return new Date()
  if (DATE_ONLY.test(value)) return new Date(`${value}T23:59:59.999`)
  return new Date(value)
}

function startOfYear(): Date {
  const d = new Date()
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export type Granularity = 'day' | 'week' | 'month'

/**
 * Granularidade padrão em função do tamanho da janela. Agrupar 30 dias por
 * mês produzia um gráfico de um ou dois pontos, que na tela parece um gráfico
 * quebrado.
 */
export function pickGranularity(start: Date, end: Date): Granularity {
  const days = (end.getTime() - start.getTime()) / 86_400_000
  if (days <= 45)  return 'day'
  if (days <= 180) return 'week'
  return 'month'
}

/** Fragmentos SQL (unidade do DATE_TRUNC, passo da série e formato do rótulo). */
export function granularityParts(granularity: string) {
  if (granularity === 'day') {
    return { unit: Prisma.sql`'day'`,  step: Prisma.sql`'1 day'::interval`,  format: 'YYYY-MM-DD' }
  }
  if (granularity === 'week') {
    return { unit: Prisma.sql`'week'`, step: Prisma.sql`'1 week'::interval`, format: 'IYYY-"W"IW' }
  }
  return { unit: Prisma.sql`'month'`,  step: Prisma.sql`'1 month'::interval`, format: 'YYYY-MM' }
}
