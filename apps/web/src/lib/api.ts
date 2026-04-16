import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1",
    withCredentials: true,
    timeout: 30_000,
    headers: {
        "Content-Type": "application/json",
    },
});

// When sending FormData, remove the Content-Type default so the browser sets it
// automatically with the correct multipart/form-data boundary.
api.interceptors.request.use((config) => {
    if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
    }
    return config;
});

// Mutex to prevent multiple simultaneous refresh calls (token rotation race condition).
// If several requests fail with 401 at the same time, only the first actually calls
// /auth/refresh — the rest wait for that same promise to resolve/reject.
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
    (response: AxiosResponse) => {
        if (response.data && "data" in response.data) {
            // Paginated responses — preserve the full envelope so services can access pagination
            if ("pagination" in response.data) {
                return response;
            }
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
                // Share a single refresh call across all concurrent 401s
                if (!refreshPromise) {
                    refreshPromise = api.post("/auth/refresh").then(() => {
                        refreshPromise = null;
                    }).catch((err) => {
                        refreshPromise = null;
                        throw err;
                    });
                }
                await refreshPromise;
                return api(originalRequest);
            } catch {
                // Limpa os cookies HTTP-only no servidor antes de redirecionar.
                // Sem isso, o proxy.ts vê os cookies expirados e redireciona
                // de /login de volta ao /dashboard causando loop infinito.
                if (typeof window !== "undefined") {
                    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
                    try {
                        await fetch(`${baseURL}/auth/logout`, {
                            method: "POST",
                            credentials: "include",
                        });
                    } catch {
                        // Ignora erros de logout — o redirect acontece de qualquer forma
                    }
                    if (!window.location.pathname.startsWith("/login")) {
                        window.location.href = "/login";
                    }
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