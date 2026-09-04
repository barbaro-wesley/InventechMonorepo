import { LabelSheet, PaperSize } from './dto/label-template.dto'

// Dimensões ISO 216 em milímetros (modo retrato: largura × altura).
export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
}

export const PAPER_SIZE_KEYS: PaperSize[] = ['A4', 'A3', 'A5']

export const DEFAULT_SHEET: LabelSheet = {
  enabled: false,
  paperSize: 'A4',
  orientation: 'portrait',
  marginTop: 10,
  marginRight: 10,
  marginBottom: 10,
  marginLeft: 10,
  columns: 3,
  rows: 8,
  gapX: 2,
  gapY: 2,
}

/** Dimensões reais da folha (mm), aplicando a orientação. */
export function getPaperDimensions(
  size: PaperSize,
  orientation: 'portrait' | 'landscape',
): { width: number; height: number } {
  const dims = PAPER_SIZES[size] ?? PAPER_SIZES.A4
  return orientation === 'landscape'
    ? { width: dims.height, height: dims.width }
    : { width: dims.width, height: dims.height }
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, v))
}

/** Garante que a configuração de folha tem forma válida (defensivo). */
export function sanitizeSheet(raw: any): LabelSheet {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SHEET }
  const paperSize: PaperSize = PAPER_SIZE_KEYS.includes(raw.paperSize)
    ? raw.paperSize
    : 'A4'
  return {
    enabled: !!raw.enabled,
    paperSize,
    orientation: raw.orientation === 'landscape' ? 'landscape' : 'portrait',
    marginTop: clampNum(raw.marginTop, 0, 100, DEFAULT_SHEET.marginTop),
    marginRight: clampNum(raw.marginRight, 0, 100, DEFAULT_SHEET.marginRight),
    marginBottom: clampNum(raw.marginBottom, 0, 100, DEFAULT_SHEET.marginBottom),
    marginLeft: clampNum(raw.marginLeft, 0, 100, DEFAULT_SHEET.marginLeft),
    columns: Math.round(clampNum(raw.columns, 1, 50, DEFAULT_SHEET.columns)),
    rows: Math.round(clampNum(raw.rows, 1, 50, DEFAULT_SHEET.rows)),
    gapX: clampNum(raw.gapX, 0, 100, DEFAULT_SHEET.gapX),
    gapY: clampNum(raw.gapY, 0, 100, DEFAULT_SHEET.gapY),
  }
}
