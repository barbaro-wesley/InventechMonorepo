import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/reset-password",
  "/verify-email",
  "/verificar-email",
];

const STATIC_PATHS = ["/_next", "/favicon.ico", "/images", "/icons"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora arquivos estáticos
  if (STATIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.has("access_token") ||
    request.cookies.has("refresh_token");

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Autenticado tentando acessar login → vai pro dashboard
  if (isPublicRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Não autenticado tentando acessar rota protegida → vai pro login
  if (!isPublicRoute && !hasSession && pathname !== "/") {
    const loginUrl = new URL("/login", request.url);
    const { search } = request.nextUrl;
    loginUrl.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Rota raiz → redireciona
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSession ? "/dashboard" : "/login", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
