import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  printersService,
  type Printer,
  type ListPrintersParams,
  type CreatePrinterDto,
  type UpdatePrinterDto,
} from "@/services/printers/printers.service";

export const printerKeys = {
  all: () => ["printers"] as const,
  list: (params?: ListPrintersParams) => ["printers", "list", params] as const,
  detail: (id: string) => ["printers", "detail", id] as const,
};

export function usePrinters(params?: ListPrintersParams) {
  return useQuery<Printer[]>({
    queryKey: printerKeys.list(params),
    queryFn: () => printersService.list(params),
    staleTime: 30 * 1000,
  });
}

export function usePrinter(id: string) {
  return useQuery<Printer>({
    queryKey: printerKeys.detail(id),
    queryFn: () => printersService.get(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCreatePrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePrinterDto) => printersService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: printerKeys.all() });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdatePrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePrinterDto }) =>
      printersService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: printerKeys.all() });
      toast.success("Impressora atualizada!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeletePrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => printersService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: printerKeys.all() });
      toast.success("Impressora removida!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
