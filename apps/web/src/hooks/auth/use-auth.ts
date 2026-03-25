"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authService } from "@/services/auth/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { getErrorMessage } from "@/lib/api";

export const authKeys = {
    me: ["auth", "me"] as const,
};

export function useAuth() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { setUser, logout: storeLogout } = useAuthStore();
    const [requires2FA, setRequires2FA] = useState(false);

    // Busca usuário atual
    const { isLoading } = useQuery({
        queryKey: authKeys.me,
        queryFn: async () => {
            const user = await authService.me();
            setUser(user);
            return user;
        },
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    // Login
    const loginMutation = useMutation({
        mutationFn: ({ email, password }: { email: string; password: string }) =>
            authService.login(email, password),

        onSuccess: (response) => {
            if (response.requires2FA) {
                setRequires2FA(true);
                toast.info("Código de verificação enviado para seu e-mail.");
                return;
            }
            setUser(response.user);
            toast.success(`Bem-vindo, ${response.user.name.split(" ")[0]}!`);
            router.push("/dashboard");
        },

        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    // Verificação 2FA
    const verify2FAMutation = useMutation({
        mutationFn: (code: string) => authService.verify2FA(code),
        onSuccess: async () => {
            const user = await authService.me();
            setUser(user);
            toast.success(`Bem-vindo, ${user.name.split(" ")[0]}!`);
            router.push("/dashboard");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    // Logout
    const logoutMutation = useMutation({
        mutationFn: authService.logout,
        onSettled: () => {
            storeLogout();
            queryClient.clear();
            router.push("/login");
        },
    });

    // Forgot password
    const forgotPasswordMutation = useMutation({
        mutationFn: (email: string) => authService.forgotPassword(email),
        onSuccess: () => {
            toast.success("Se o e-mail existir, você receberá o link em breve.");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    return {
        isLoading,
        requires2FA,

        login: loginMutation.mutate,
        isLoggingIn: loginMutation.isPending,

        verify2FA: verify2FAMutation.mutate,
        isVerifying2FA: verify2FAMutation.isPending,

        logout: logoutMutation.mutate,
        isLoggingOut: logoutMutation.isPending,

        forgotPassword: forgotPasswordMutation.mutate,
        isSendingForgot: forgotPasswordMutation.isPending,
        forgotPasswordSuccess: forgotPasswordMutation.isSuccess,
    };
}