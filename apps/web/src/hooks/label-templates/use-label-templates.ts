import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { labelTemplatesService } from "@/services/label-templates/label-templates.service";
import { getErrorMessage } from "@/lib/api";
import type {
  CreateLabelTemplateDto,
  UpdateLabelTemplateDto,
  ListLabelTemplatesParams,
  LabelReferenceType,
} from "@/services/label-templates/label-templates.types";

export const labelTemplateKeys = {
  all: ["label-templates"] as const,
  list: (params?: ListLabelTemplatesParams) =>
    ["label-templates", "list", params] as const,
  detail: (id: string) => ["label-templates", "detail", id] as const,
  variables: (referenceType: LabelReferenceType) =>
    ["label-templates", "variables", referenceType] as const,
};

export function useLabelTemplates(params?: ListLabelTemplatesParams) {
  return useQuery({
    queryKey: labelTemplateKeys.list(params),
    queryFn: () => labelTemplatesService.list(params),
  });
}

export function useLabelVariables(referenceType: LabelReferenceType) {
  return useQuery({
    queryKey: labelTemplateKeys.variables(referenceType),
    queryFn: () => labelTemplatesService.getVariables(referenceType),
    staleTime: 1000 * 60 * 30,
  });
}

export function useCreateLabelTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLabelTemplateDto) => labelTemplatesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelTemplateKeys.all });
      toast.success("Etiqueta criada com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateLabelTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateLabelTemplateDto) => labelTemplatesService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelTemplateKeys.all });
      toast.success("Etiqueta atualizada com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteLabelTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => labelTemplatesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelTemplateKeys.all });
      toast.success("Etiqueta excluída com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCloneLabelTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => labelTemplatesService.clone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelTemplateKeys.all });
      toast.success("Etiqueta duplicada com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
