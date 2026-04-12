"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
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
    if (isError && !isPublicRoute) {
      setUser(null);
      router.push("/login");
    }
  }, [isLoading, isError, isPublicRoute, router, setUser]);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  return <>{children}</>;
}