import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { companiesService } from "@/services/companies/companies.service";
import { getErrorMessage } from "@/lib/api";
import type {
  CreateCompanyDto,
  UpdateCompanyDto,
  ListCompaniesParams,
} from "@/types/company";

export const companyKeys = {
  all: ["companies"] as const,
  list: (params?: ListCompaniesParams) =>
    ["companies", "list", params] as const,
  detail: (id: string) => ["companies", "detail", id] as const,
  license: (id: string) => ["companies", "license", id] as const,
  licenses: (params?: object) => ["companies", "licenses", params] as const,
};

export function useCompanies(params?: ListCompaniesParams) {
  return useQuery({
    queryKey: companyKeys.list(params),
    queryFn: () => companiesService.list(params),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: companyKeys.detail(id),
    queryFn: () => companiesService.getById(id),
    enabled: !!id,
  });
}

export function useCompanyLicense(id: string) {
  return useQuery({
    queryKey: companyKeys.license(id),
    queryFn: () => companiesService.getLicense(id),
    enabled: !!id,
  });
}

export function useAllLicenses(params?: {
  expiringInDays?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: companyKeys.licenses(params),
    queryFn: () => companiesService.getAllLicenses(params),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCompanyDto) => companiesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      toast.success("Empresa criada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateCompany(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCompanyDto) => companiesService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      toast.success("Empresa atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useSuspendCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      companiesService.suspend(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      toast.success("Empresa suspensa com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useActivateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      toast.success("Empresa reativada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateLicense(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { expiresAt?: string; notes?: string }) =>
      companiesService.updateLicense(companyId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      toast.success("Licença atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateTrial(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { trialEndsAt: string }) =>
      companiesService.updateTrial(companyId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      toast.success("Período de trial atualizado!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}