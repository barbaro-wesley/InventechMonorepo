import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  customFieldsService,
  type CreateCustomFieldDefinitionInput,
  type UpdateCustomFieldDefinitionInput,
  type CustomFieldValueInput,
} from "@/services/equipment/custom-fields.service";

export const customFieldKeys = {
  definitions: () => ["equipment", "custom-field-definitions"] as const,
  values: (equipmentId: string) => ["equipment", equipmentId, "custom-field-values"] as const,
};

export function useCustomFieldDefinitions() {
  return useQuery({
    queryKey: customFieldKeys.definitions(),
    queryFn: () => customFieldsService.listDefinitions(),
    staleTime: 60 * 1000,
  });
}

export function useCreateCustomFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomFieldDefinitionInput) =>
      customFieldsService.createDefinition(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customFieldKeys.definitions() });
      toast.success("Campo personalizado criado");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUpdateCustomFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomFieldDefinitionInput }) =>
      customFieldsService.updateDefinition(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customFieldKeys.definitions() });
      toast.success("Campo atualizado");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useDeleteCustomFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customFieldsService.deleteDefinition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customFieldKeys.definitions() });
      toast.success("Campo removido");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useReorderCustomFieldDefinitions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => customFieldsService.reorder(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customFieldKeys.definitions() });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useCustomFieldValues(equipmentId: string) {
  return useQuery({
    queryKey: customFieldKeys.values(equipmentId),
    queryFn: () => customFieldsService.getValues(equipmentId),
    enabled: !!equipmentId,
    staleTime: 30 * 1000,
  });
}

export function useUpsertCustomFieldValues(equipmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomFieldValueInput[]) =>
      customFieldsService.upsertValues(equipmentId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customFieldKeys.values(equipmentId) });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
