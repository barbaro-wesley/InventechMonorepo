import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { checklistTemplatesService } from "@/services/checklist-templates/checklist-templates.service";
import type {
  ChecklistFieldDefinition,
  CreateChecklistTemplateDto,
  ListChecklistTemplatesParams,
  UpdateChecklistTemplateDto,
} from "@/services/checklist-templates/checklist-templates.types";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const checklistTemplateKeys = {
  all: ["checklist-templates"] as const,
  list: (params?: ListChecklistTemplatesParams) =>
    ["checklist-templates", "list", params] as const,
  detail: (id: string) => ["checklist-templates", "detail", id] as const,
  checklist: (serviceOrderId: string) =>
    ["service-order-checklist", serviceOrderId] as const,
};

// ─── Templates ────────────────────────────────────────────────────────────────

export function useChecklistTemplates(params?: ListChecklistTemplatesParams) {
  return useQuery({
    queryKey: checklistTemplateKeys.list(params),
    queryFn: () => checklistTemplatesService.list(params),
  });
}

export function useChecklistTemplateDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: checklistTemplateKeys.detail(id),
    queryFn: () => checklistTemplatesService.getById(id),
    enabled: enabled && !!id,
  });
}

export function useCreateChecklistTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateChecklistTemplateDto) =>
      checklistTemplatesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistTemplateKeys.all });
      toast.success("Template criado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateChecklistTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateChecklistTemplateDto) =>
      checklistTemplatesService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistTemplateKeys.all });
      toast.success("Template atualizado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteChecklistTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checklistTemplatesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistTemplateKeys.all });
      toast.success("Template excluído.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCloneChecklistTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checklistTemplatesService.clone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistTemplateKeys.all });
      toast.success("Template duplicado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ─── Checklist na OS ─────────────────────────────────────────────────────────

export function useServiceOrderChecklist(
  clientId: string | null | undefined,
  serviceOrderId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: checklistTemplateKeys.checklist(serviceOrderId),
    queryFn: () => checklistTemplatesService.getChecklist(clientId!, serviceOrderId),
    enabled: enabled && !!clientId && !!serviceOrderId,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useFillChecklist(clientId: string, serviceOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: ChecklistFieldDefinition[]) =>
      checklistTemplatesService.fillChecklist(clientId, serviceOrderId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.checklist(serviceOrderId),
      });
      toast.success("Checklist salvo.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCompleteChecklist(clientId: string, serviceOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields?: ChecklistFieldDefinition[]) =>
      checklistTemplatesService.completeChecklist(clientId, serviceOrderId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.checklist(serviceOrderId),
      });
      toast.success("Checklist concluído!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReopenChecklist(clientId: string, serviceOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      checklistTemplatesService.reopenChecklist(clientId, serviceOrderId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.checklist(serviceOrderId),
      });
      toast.success("Checklist reaberto.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
