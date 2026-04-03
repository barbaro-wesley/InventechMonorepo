import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { storageService } from "@/services/storage/storage.service";

export const attachmentKeys = {
  entity: (entity: string, entityId: string) =>
    ["attachments", entity, entityId] as const,
};

export function useAttachments(entity: string, entityId: string) {
  return useQuery({
    queryKey: attachmentKeys.entity(entity, entityId),
    queryFn: () => storageService.listByEntity(entity, entityId),
    enabled: !!entityId,
    staleTime: 30 * 1000,
  });
}

export function useUploadAttachment(entity: string, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => storageService.upload(file, entity, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.entity(entity, entityId),
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteAttachment(entity: string, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => storageService.delete(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.entity(entity, entityId),
      });
      toast.success("Arquivo removido!");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
