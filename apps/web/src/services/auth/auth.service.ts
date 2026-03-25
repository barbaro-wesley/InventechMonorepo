import { api } from "@/lib/api";
import type { AuthUser, LoginResponse, AuthMeResponse } from "@/types/auth";

export const authService = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const { data } = await api.post<LoginResponse>("/auth/login", {
            email,
            password,
        });
        return data;
    },

    async logout(): Promise<void> {
        await api.post("/auth/logout");
    },

    async refresh(): Promise<void> {
        await api.post("/auth/refresh");
    },

    async me(): Promise<AuthMeResponse> {
        const { data } = await api.get<AuthMeResponse>("/auth/me");
        return data;
    },

    async forgotPassword(email: string): Promise<void> {
        await api.post("/auth/forgot-password", { email });
    },

    async resetPassword(token: string, newPassword: string): Promise<void> {
        await api.post("/auth/reset-password", { token, newPassword });
    },

    async verifyEmail(token: string): Promise<void> {
        await api.post("/auth/verify-email", { token });
    },

    async send2FA(): Promise<void> {
        await api.post("/auth/2fa/send");
    },

    async verify2FA(code: string): Promise<void> {
        await api.post("/auth/2fa/verify", { code });
    },
};