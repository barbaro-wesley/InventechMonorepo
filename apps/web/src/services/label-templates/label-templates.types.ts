export type LabelReferenceType = "EQUIPMENT" | "SERVICE_ORDER";

export type LabelElementType = "text" | "qrcode" | "image";

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
}

export interface LabelQrElement extends LabelElementBase {
  type: "qrcode";
  value: string;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export interface LabelImageElement extends LabelElementBase {
  type: "image";
  source: "company_logo";
  fit?: "contain" | "cover";
}

export type LabelElement =
  | LabelTextElement
  | LabelQrElement
  | LabelImageElement;

export interface LabelLayout {
  width: number; // mm
  height: number; // mm
  unit: "mm";
  background?: string;
  elements: LabelElement[];
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
};
