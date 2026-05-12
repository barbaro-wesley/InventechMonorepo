import { api } from "@/lib/api";

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";

export interface CustomFieldDefinition {
  id: string;
  companyId: string;
  name: string;
  fieldType: CustomFieldType;
  required: boolean;
  order: number;
  options: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldValue {
  definitionId: string;
  value: string | null;
  definition: Pick<CustomFieldDefinition, "id" | "name" | "fieldType" | "order">;
}

export interface CustomFieldValueInput {
  definitionId: string;
  value?: string;
}

export interface CreateCustomFieldDefinitionInput {
  name: string;
  fieldType: CustomFieldType;
  required?: boolean;
  order?: number;
  options?: string[];
}

export interface UpdateCustomFieldDefinitionInput {
  name?: string;
  fieldType?: CustomFieldType;
  required?: boolean;
  order?: number;
  options?: string[];
  isActive?: boolean;
}

export const customFieldsService = {
  listDefinitions: (): Promise<CustomFieldDefinition[]> =>
    api.get("/equipment/custom-fields/definitions").then((r) => r.data),

  createDefinition: (data: CreateCustomFieldDefinitionInput): Promise<CustomFieldDefinition> =>
    api.post("/equipment/custom-fields/definitions", data).then((r) => r.data),

  updateDefinition: (id: string, data: UpdateCustomFieldDefinitionInput): Promise<CustomFieldDefinition> =>
    api.patch(`/equipment/custom-fields/definitions/${id}`, data).then((r) => r.data),

  deleteDefinition: (id: string): Promise<{ success: boolean }> =>
    api.delete(`/equipment/custom-fields/definitions/${id}`).then((r) => r.data),

  reorder: (ids: string[]): Promise<CustomFieldDefinition[]> =>
    api.post("/equipment/custom-fields/definitions/reorder", { ids }).then((r) => r.data),

  getValues: (equipmentId: string): Promise<CustomFieldValue[]> =>
    api.get(`/equipment/custom-fields/${equipmentId}/values`).then((r) => r.data),

  upsertValues: (equipmentId: string, values: CustomFieldValueInput[]): Promise<CustomFieldValue[]> =>
    api.post(`/equipment/custom-fields/${equipmentId}/values`, { values }).then((r) => r.data),
};
