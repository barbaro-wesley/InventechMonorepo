import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { tenantsService } from "@/services/companies/companies.service";
import { getErrorMessage } from "@/lib/api";
import type {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateReportSettingsDto,
  ListTenantsParams,
} from "@/types/company";

export const tenantKeys = {
  all: ["tenants"] as const,
  list: (params?: ListTenantsParams) =>
    ["tenants", "list", params] as const,
  detail: (id: string) => ["tenants", "detail", id] as const,
  license: (id: string) => ["tenants", "license", id] as const,
  licenses: (params?: object) => ["tenants", "licenses", params] as const,
};

export function useTenants(params?: ListTenantsParams) {
  return useQuery({
    queryKey: tenantKeys.list(params),
    queryFn: () => tenantsService.list(params),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: tenantKeys.detail(id),
    queryFn: () => tenantsService.getById(id),
    enabled: !!id,
  });
}

export function useTenantLicense(id: string) {
  return useQuery({
    queryKey: tenantKeys.license(id),
    queryFn: () => tenantsService.getLicense(id),
    enabled: !!id,
  });
}

export function useAllLicenses(params?: {
  expiringInDays?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: tenantKeys.licenses(params),
    queryFn: () => tenantsService.getAllLicenses(params),
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTenantDto) => tenantsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Empresa criada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateTenant(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateTenantDto) => tenantsService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Empresa atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useSuspendTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      tenantsService.suspend(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Empresa suspensa com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useActivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantsService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Empresa reativada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateLicense(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { expiresAt?: string; notes?: string }) =>
      tenantsService.updateLicense(tenantId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Licença atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateTrial(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { trialEndsAt: string }) =>
      tenantsService.updateTrial(tenantId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Período de trial atualizado!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUploadTenantLogo(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => tenantsService.uploadLogo(tenantId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Logo atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateReportSettings(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateReportSettingsDto) =>
      tenantsService.updateReportSettings(tenantId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      toast.success("Configurações de relatório salvas!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
