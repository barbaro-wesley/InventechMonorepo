import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  scansService,
  type Scan,
  type ListScansParams,
  type UpdateScanMetadataPayload,
} from "@/services/printers/scans.service";

export const scanKeys = {
  all: () => ["scans"] as const,
  list: (params?: Omit<ListScansParams, "cursor">) =>
    ["scans", "list", params] as const,
};

export function useScans(params?: Omit<ListScansParams, "cursor">) {
  return useInfiniteQuery({
    queryKey: scanKeys.list(params),
    queryFn: ({ pageParam }) =>
      scansService.list({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      // Vista plana para consumo simples
      scans: data.pages.flatMap((p) => p.data) as Scan[],
      hasNextPage: data.pages[data.pages.length - 1]?.hasNextPage ?? false,
    }),
  });
}

export function useUpdateScanMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateScanMetadataPayload }) =>
      scansService.updateMetadata(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scanKeys.all() });
      toast.success("Metadados atualizados!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
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
