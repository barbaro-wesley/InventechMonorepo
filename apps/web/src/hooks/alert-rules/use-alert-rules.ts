import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { alertRulesService } from "@/services/alert-rules/alert-rules.service";
import { getErrorMessage } from "@/lib/api";
import type {
    CreateAlertRuleDto,
    UpdateAlertRuleDto,
    ListAlertRulesParams,
} from "@inventech/shared-types";

export const alertRuleKeys = {
    all: ["alert-rules"] as const,
    list: (params?: ListAlertRulesParams) => ["alert-rules", "list", params] as const,
    detail: (id: string) => ["alert-rules", "detail", id] as const,
    variables: () => ["alert-rules", "meta", "variables"] as const,
};

export function useAlertRules(params?: ListAlertRulesParams) {
    return useQuery({
        queryKey: alertRuleKeys.list(params),
        queryFn: () => alertRulesService.list(params),
    });
}

export function useAlertRule(id: string) {
    return useQuery({
        queryKey: alertRuleKeys.detail(id),
        queryFn: () => alertRulesService.getById(id),
        enabled: !!id,
    });
}

export function useAlertRuleVariables() {
    return useQuery({
        queryKey: alertRuleKeys.variables(),
        queryFn: () => alertRulesService.getVariableRegistry(),
        staleTime: 1000 * 60 * 10, // 10 min — registry doesn't change at runtime
    });
}

export function useCreateAlertRule() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: CreateAlertRuleDto) => alertRulesService.create(dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: alertRuleKeys.all });
            toast.success("Regra de alerta criada com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useUpdateAlertRule(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: UpdateAlertRuleDto) => alertRulesService.update(id, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: alertRuleKeys.all });
            queryClient.invalidateQueries({ queryKey: alertRuleKeys.detail(id) });
            toast.success("Regra atualizada com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useDeleteAlertRule() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => alertRulesService.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: alertRuleKeys.all });
            toast.success("Regra removida com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useToggleAlertRule() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => alertRulesService.toggle(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: alertRuleKeys.all });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function usePreviewAlertRuleEmail() {
    return useMutation({
        mutationFn: ({ id, sampleData }: { id: string; sampleData?: Record<string, string> }) =>
            alertRulesService.previewEmail(id, sampleData),
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}
