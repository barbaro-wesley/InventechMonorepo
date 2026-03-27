import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1",
    withCredentials: true,
    timeout: 30_000,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.response.use(
    (response: AxiosResponse) => {
        if (response.data && "data" in response.data) {
            return { ...response, data: response.data.data };
        }
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
            _retry?: boolean;
        };

        const isRefreshRequest = originalRequest.url?.includes("/auth/refresh");
        if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
            originalRequest._retry = true;
            try {
                await api.post("/auth/refresh");
                return api(originalRequest);
            } catch {
                if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
                    window.location.href = "/login";
                }
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);

export function getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        return (
            error.response?.data?.message ??
            error.response?.data?.error ??
            error.message
        );
    }
    if (error instanceof Error) return error.message;
    return "Ocorreu um erro inesperado";
}