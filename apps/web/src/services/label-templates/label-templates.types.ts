export type LabelReferenceType = "EQUIPMENT" | "SERVICE_ORDER" | "STANDALONE";

export type LabelElementType =
  | "text"
  | "qrcode"
  | "image"
  | "table"
  | "line"
  | "rect";

export interface LabelElementBase {
  id: string;
  type: LabelElementType;
  /** posição/dimensão em milímetros (mm) */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface LabelTextElement extends LabelElementBase {
  type: "text";
  content: string;
  fontSize: number; // pt
  fontWeight?: "normal" | "bold";
  italic?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
  /** Na impressão em folha (mala-direta), indica se o conteúdo varia por etiqueta. */
  perCell?: boolean;
}

export interface LabelQrElement extends LabelElementBase {
  type: "qrcode";
  value: string;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  /** Na impressão em folha (mala-direta), indica se o valor varia por etiqueta. */
  perCell?: boolean;
}

export interface LabelImageElement extends LabelElementBase {
  type: "image";
  source: "company_logo";
  fit?: "contain" | "cover";
}

/** Colunas disponíveis na tabela de OS preventivas. */
export type LabelTableColumnKey =
  | "number"
  | "createdAt"
  | "description"
  | "status"
  | "client"
  | "technician";

export interface LabelTableColumn {
  key: LabelTableColumnKey;
  label: string;
  width: number; // peso relativo da coluna
}

export interface LabelTableElement extends LabelElementBase {
  type: "table";
  source: "preventive_os";
  columns: LabelTableColumn[];
  fontSize: number; // pt
  headerBold?: boolean;
  showHeader?: boolean;
  showBorders?: boolean;
  maxRows?: number;
  color?: string;
}

/** Linha divisória (horizontal ou vertical) dentro da etiqueta. */
export interface LabelLineElement extends LabelElementBase {
  type: "line";
  color?: string;
  thickness?: number; // mm
  orientation?: "horizontal" | "vertical";
}

/** Retângulo/moldura (preenchimento e/ou borda). */
export interface LabelRectElement extends LabelElementBase {
  type: "rect";
  fill?: string;
  borderColor?: string;
  borderWidth?: number; // mm
  radius?: number; // mm
}

export type LabelElement =
  | LabelTextElement
  | LabelQrElement
  | LabelImageElement
  | LabelTableElement
  | LabelLineElement
  | LabelRectElement;

// ─── Folha de impressão (imposição em A4/A3/A5) ────────────────────────────────

export type PaperSize = "A4" | "A3" | "A5";

export interface LabelSheet {
  enabled: boolean;
  paperSize: PaperSize;
  orientation: "portrait" | "landscape";
  marginTop: number; // mm
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  columns: number;
  rows: number;
  gapX: number; // mm
  gapY: number;
}

/** Dimensões ISO 216 em mm (retrato: largura × altura). */
export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
};

export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  A4: "A4 (210 × 297 mm)",
  A3: "A3 (297 × 420 mm)",
  A5: "A5 (148 × 210 mm)",
};

export const DEFAULT_SHEET: LabelSheet = {
  enabled: false,
  paperSize: "A4",
  orientation: "portrait",
  marginTop: 10,
  marginRight: 10,
  marginBottom: 10,
  marginLeft: 10,
  columns: 3,
  rows: 8,
  gapX: 2,
  gapY: 2,
};

/** Dimensões reais da folha (mm), aplicando a orientação. */
export function getPaperDimensions(
  size: PaperSize,
  orientation: "portrait" | "landscape",
): { width: number; height: number } {
  const dims = PAPER_SIZES[size] ?? PAPER_SIZES.A4;
  return orientation === "landscape"
    ? { width: dims.height, height: dims.width }
    : { width: dims.width, height: dims.height };
}

export interface LabelLayout {
  width: number; // mm
  height: number; // mm
  unit: "mm";
  background?: string;
  elements: LabelElement[];
  /** Configuração padrão de impressão em folha (opcional). */
  sheet?: LabelSheet;
}

export interface LabelTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  referenceType: LabelReferenceType;
  layout: LabelLayout;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
}

export interface LabelVariable {
  key: string;
  label: string;
}

export interface CreateLabelTemplateDto {
  name: string;
  description?: string;
  referenceType: LabelReferenceType;
  layout: LabelLayout;
  isDefault?: boolean;
  isActive?: boolean;
}

export type UpdateLabelTemplateDto = Partial<CreateLabelTemplateDto>;

export interface ListLabelTemplatesParams {
  referenceType?: LabelReferenceType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedLabelTemplates {
  data: LabelTemplate[];
  total: number;
  page: number;
  limit: number;
}

export const REFERENCE_TYPE_LABELS: Record<LabelReferenceType, string> = {
  EQUIPMENT: "Equipamento",
  SERVICE_ORDER: "Ordem de Serviço",
  STANDALONE: "Avulsa",
};

/** Uma etiqueta da folha (mala-direta): mapa { elementId: valor }. */
export interface RenderSheetCell {
  overrides?: Record<string, string>;
}

export interface RenderSheetParams {
  sheet?: LabelSheet;
  /** Etiquetas avulsas: conteúdo de cada etiqueta. */
  cells?: RenderSheetCell[];
  /** Modo entidade: distribui equipamentos/OS pelo grid. */
  entityIds?: string[];
}
