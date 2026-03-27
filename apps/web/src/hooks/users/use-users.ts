import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { usersService } from "@/services/users/users.service";
import { getErrorMessage } from "@/lib/api";
import type { CreateUserDto, UpdateUserDto, ListUsersParams } from "@/types/user";

export const userKeys = {
    all: ["users"] as const,
    list: (params?: ListUsersParams) => ["users", "list", params] as const,
    detail: (id: string) => ["users", "detail", id] as const,
};

export function useUsers(params?: ListUsersParams) {
    return useQuery({
        queryKey: userKeys.list(params),
        queryFn: () => usersService.list(params),
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: CreateUserDto) => usersService.create(dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
            toast.success("Usuário criado com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useUpdateUser(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: UpdateUserDto) => usersService.update(id, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
            toast.success("Usuário atualizado com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => usersService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
            toast.success("Usuário removido com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}