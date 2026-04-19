export type LaudoFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "TABLE"
  | "MULTI_SELECT"
  | "SINGLE_SELECT"
  | "CHECKBOX"
  | "HEADING"
  | "DIVIDER";

export type LaudoReferenceType = "MAINTENANCE" | "SERVICE_ORDER" | "CUSTOM";

export interface LaudoTableColumn {
  key: string;
  label: string;
  type?: "text" | "number";
}

export interface LaudoFieldDefinition {
  id: string;
  type: LaudoFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  order: number;
  width?: "full" | "half";
  options?: string[];
  tableColumns?: LaudoTableColumn[];
  variable?: string;
}

export interface LaudoTemplate {
  id: string;
  companyId: string;
  createdById: string;
  title: string;
  description?: string | null;
  referenceType: LaudoReferenceType;
  fields: LaudoFieldDefinition[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy?: { id: string; name: string };
  _count?: { laudos: number };
}

export interface CreateLaudoTemplateDto {
  title: string;
  description?: string;
  referenceType: LaudoReferenceType;
  fields: LaudoFieldDefinition[];
}

export interface UpdateLaudoTemplateDto {
  title?: string;
  description?: string;
  referenceType?: LaudoReferenceType;
  fields?: LaudoFieldDefinition[];
  isActive?: boolean;
}

export interface ListLaudoTemplatesParams {
  referenceType?: LaudoReferenceType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export const REFERENCE_TYPE_LABELS: Record<LaudoReferenceType, string> = {
  MAINTENANCE: "Manutenção",
  SERVICE_ORDER: "Ordem de Serviço",
  CUSTOM: "Personalizado",
};

export const FIELD_TYPE_LABELS: Record<LaudoFieldType, string> = {
  SHORT_TEXT: "Texto curto",
  LONG_TEXT: "Texto longo",
  NUMBER: "Número",
  DATE: "Data",
  TABLE: "Tabela",
  MULTI_SELECT: "Múltipla escolha",
  SINGLE_SELECT: "Escolha única",
  CHECKBOX: "Caixa de seleção",
  HEADING: "Título de seção",
  DIVIDER: "Divisor",
};

export const AVAILABLE_VARIABLES = [
  { value: "{equipment_name}", label: "Nome do equipamento" },
  { value: "{equipment_model}", label: "Modelo do equipamento" },
  { value: "{equipment_brand}", label: "Marca do equipamento" },
  { value: "{equipment_serial}", label: "Nº de série" },
  { value: "{equipment_patrimony}", label: "Nº de patrimônio" },
  { value: "{equipment_location}", label: "Localização do equipamento" },
  { value: "{equipment_type}", label: "Tipo do equipamento" },
  { value: "{equipment_status}", label: "Status do equipamento" },
  { value: "{client_name}", label: "Nome do cliente" },
  { value: "{client_document}", label: "CNPJ do cliente" },
  { value: "{client_phone}", label: "Telefone do cliente" },
  { value: "{client_email}", label: "E-mail do cliente" },
  { value: "{company_name}", label: "Nome da empresa" },
  { value: "{company_document}", label: "CNPJ da empresa" },
  { value: "{technician_name}", label: "Nome do técnico" },
  { value: "{technician_email}", label: "E-mail do técnico" },
  { value: "{service_order_number}", label: "Nº da OS" },
  { value: "{service_order_title}", label: "Título da OS" },
  { value: "{service_order_type}", label: "Tipo da OS" },
  { value: "{service_order_status}", label: "Status da OS" },
  { value: "{maintenance_type}", label: "Tipo de manutenção" },
  { value: "{maintenance_title}", label: "Título da manutenção" },
  { value: "{maintenance_scheduled_at}", label: "Data agendada (manutenção)" },
  { value: "{date_today}", label: "Data de hoje" },
  { value: "{datetime_now}", label: "Data e hora atual" },
  { value: "{year}", label: "Ano atual" },
  { value: "{month}", label: "Mês atual" },
];
