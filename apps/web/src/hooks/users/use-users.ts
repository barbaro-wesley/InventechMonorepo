import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { usersService } from "@/services/users/users.service";
import { authService } from "@/services/auth/auth.service";
import { getErrorMessage } from "@/lib/api";
import type { CreateUserDto, UpdateUserDto, ListUsersParams } from "@/types/user";
import { useAuthStore } from "@/store/auth.store";

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

export function useUpdateProfile() {
    const setUser = useAuthStore((s) => s.setUser);

    return useMutation({
        mutationFn: (dto: UpdateUserDto) => usersService.updateProfile(dto),
        onSuccess: async () => {
            // Atualiza o store com os dados mais recentes do servidor
            try {
                const fresh = await authService.me();
                setUser(fresh);
            } catch { /* silencioso */ }
            toast.success("Perfil atualizado!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useUploadAvatar() {
    const setUser = useAuthStore((s) => s.setUser);

    return useMutation({
        mutationFn: (file: File) => usersService.uploadAvatar(file),
        onSuccess: async () => {
            try {
                const fresh = await authService.me();
                setUser(fresh);
            } catch { /* silencioso */ }
            toast.success("Foto atualizada!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useChangePassword() {
    return useMutation({
        mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
            usersService.changePassword(currentPassword, newPassword),
        onSuccess: () => {
            toast.success("Senha alterada com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}