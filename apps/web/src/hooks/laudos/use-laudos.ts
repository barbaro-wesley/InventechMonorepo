import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { laudosService, type CreateLaudoDto, type UpdateLaudoDto } from "@/services/laudos/laudos.service";
import { getErrorMessage } from "@/lib/api";

export function useCreateLaudo() {
  return useMutation({
    mutationFn: (dto: CreateLaudoDto) => laudosService.create(dto),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateLaudo(id: string) {
  return useMutation({
    mutationFn: (dto: UpdateLaudoDto) => laudosService.update(id, dto),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
