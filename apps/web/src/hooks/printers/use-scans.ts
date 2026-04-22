import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  scansService,
  type Scan,
  type ListScansParams,
} from "@/services/printers/scans.service";

export const scanKeys = {
  all: () => ["scans"] as const,
  list: (params?: ListScansParams) => ["scans", "list", params] as const,
};

export function useScans(params?: ListScansParams) {
  return useQuery<Scan[]>({
    queryKey: scanKeys.list(params),
    queryFn: () => scansService.list(params),
    staleTime: 30 * 1000,
  });
}

export function useDeleteScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => scansService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scanKeys.all() });
      toast.success("Digitalização removida!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
