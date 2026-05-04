export type ChecklistFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "TABLE"
  | "MULTI_SELECT"
  | "SINGLE_SELECT"
  | "CHECKBOX"
  | "HEADING"
  | "DIVIDER"
  | "IMAGE";

export interface ChecklistTableColumn {
  key: string;
  label: string;
  type?: "text" | "number";
}

export interface ChecklistFieldDefinition {
  id: string;
  type: ChecklistFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  order: number;
  width?: "full" | "half";
  options?: string[];
  tableColumns?: ChecklistTableColumn[];
  value?: unknown;
}

export interface ChecklistTemplate {
  id: string;
  companyId: string;
  clientId?: string | null;
  createdById: string;
  title: string;
  description?: string | null;
  fields: ChecklistFieldDefinition[];
  isActive: boolean;
  isSharedWithClients: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy?: { id: string; name: string };
  client?: { id: string; name: string } | null;
  _count?: { schedules: number };
}

export interface CreateChecklistTemplateDto {
  title: string;
  description?: string;
  fields: ChecklistFieldDefinition[];
  clientId?: string;
  isSharedWithClients?: boolean;
}

export interface UpdateChecklistTemplateDto {
  title?: string;
  description?: string;
  fields?: ChecklistFieldDefinition[];
  isActive?: boolean;
  isSharedWithClients?: boolean;
}

export interface ListChecklistTemplatesParams {
  search?: string;
  clientId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedChecklistTemplates {
  data: ChecklistTemplate[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const CHECKLIST_FIELD_TYPE_LABELS: Record<ChecklistFieldType, string> = {
  SHORT_TEXT: "Texto curto",
  LONG_TEXT: "Texto longo",
  NUMBER: "Número",
  DATE: "Data",
  TABLE: "Tabela",
  MULTI_SELECT: "Múltipla escolha",
  SINGLE_SELECT: "Escolha única",
  CHECKBOX: "Caixa de seleção",
  HEADING: "Título de seção",
  DIVIDER: "Separador",
  IMAGE: "Imagem",
};

// ─── ServiceOrderChecklist (preenchimento na OS) ──────────────────────────────

export interface ServiceOrderChecklist {
  id: string;
  fields: ChecklistFieldDefinition[];
  completedAt: string | null;
  completedBy?: { id: string; name: string } | null;
  template?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}
