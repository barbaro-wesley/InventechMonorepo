import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { AuthUser } from "@/types/auth";

interface AuthState {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    setUser: (user: AuthUser | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        immer((set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,

            setUser: (user) =>
                set((state) => {
                    state.user = user;
                    state.isAuthenticated = user !== null;
                    state.isLoading = false;
                }),

            setLoading: (loading) =>
                set((state) => {
                    state.isLoading = loading;
                }),

            logout: () =>
                set((state) => {
                    state.user = null;
                    state.isAuthenticated = false;
                    state.isLoading = false;
                }),
        })),
        {
            name: "inventech-auth",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

// Selectors
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useIsAuthLoading = () => useAuthStore((s) => s.isLoading);