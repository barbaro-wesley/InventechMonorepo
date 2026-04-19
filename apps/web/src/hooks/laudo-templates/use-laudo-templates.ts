import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { laudoTemplatesService } from "@/services/laudo-templates/laudo-templates.service";
import { getErrorMessage } from "@/lib/api";
import type {
  CreateLaudoTemplateDto,
  UpdateLaudoTemplateDto,
  ListLaudoTemplatesParams,
} from "@/services/laudo-templates/laudo-templates.types";

export const laudoTemplateKeys = {
  all: ["laudo-templates"] as const,
  list: (params?: ListLaudoTemplatesParams) =>
    ["laudo-templates", "list", params] as const,
  detail: (id: string) => ["laudo-templates", "detail", id] as const,
};

export function useLaudoTemplates(params?: ListLaudoTemplatesParams) {
  return useQuery({
    queryKey: laudoTemplateKeys.list(params),
    queryFn: () => laudoTemplatesService.list(params),
  });
}

export function useLaudoTemplate(id: string) {
  return useQuery({
    queryKey: laudoTemplateKeys.detail(id),
    queryFn: () => laudoTemplatesService.getById(id),
    enabled: !!id,
  });
}

export function useCreateLaudoTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLaudoTemplateDto) =>
      laudoTemplatesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: laudoTemplateKeys.all });
      toast.success("Template criado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateLaudoTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateLaudoTemplateDto) =>
      laudoTemplatesService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: laudoTemplateKeys.all });
      toast.success("Template atualizado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteLaudoTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => laudoTemplatesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: laudoTemplateKeys.all });
      toast.success("Template excluído com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCloneLaudoTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => laudoTemplatesService.clone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: laudoTemplateKeys.all });
      toast.success("Template duplicado com sucesso!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
