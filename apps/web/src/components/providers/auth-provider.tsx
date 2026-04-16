"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { authService } from "@/services/auth/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { authKeys } from "@/hooks/auth/use-auth";

const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/reset-password",
  "/verify-email",
  "/verificar-email",
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setUser, setLoading } = useAuthStore();

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const { isLoading, isError } = useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const user = await authService.me();
      setUser(user);
      return user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !isPublicRoute,
  });

  useEffect(() => {
    if (isLoading) return;
    // O interceptor do axios já trata o redirect quando tokens expiram (401).
    // Este effect é o fallback para outros erros (rede, 403, etc).
    // Limpa o store para que o proxy.ts não redirecione de /login de volta
    // ao dashboard com dados obsoletos no sessionStorage.
    if (isError && !isPublicRoute) {
      setUser(null);
    }
  }, [isLoading, isError, isPublicRoute, setUser]);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  return <>{children}</>;
}