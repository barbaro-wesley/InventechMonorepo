"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/hooks/auth/use-auth";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().min(1, "E-mail obrigatório").email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

const twoFASchema = z.object({
  code: z
    .string()
    .min(6, "Código deve ter 6 dígitos")
    .max(6, "Código deve ter 6 dígitos")
    .regex(/^\d+$/, "Apenas números"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type TwoFAFormData = z.infer<typeof twoFASchema>;

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const {
    login,
    isLoggingIn,
    requires2FA,
    twoFAUserId,
    verify2FA,
    isVerifying2FA,
  } = useAuth();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const twoFAForm = useForm<TwoFAFormData>({
    resolver: zodResolver(twoFASchema),
    defaultValues: { code: "" },
  });

  function handleLogin(data: LoginFormData) {
    login({ email: data.email, password: data.password });
  }

  function handle2FA(data: TwoFAFormData) {
    if (!twoFAUserId) return;
    verify2FA({ userId: twoFAUserId, code: data.code });
  }

  // ---------------------------------------------------------------------------
  // Tela de 2FA
  // ---------------------------------------------------------------------------
  if (requires2FA) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full mx-auto">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
              <KeyRound className="w-6 h-6 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">
              Verificação em duas etapas
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Insira o código de 6 dígitos enviado para seu e-mail
            </p>
          </div>

          <form
            onSubmit={twoFAForm.handleSubmit(handle2FA)}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                Código de verificação
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoFocus
                className={cn(
                  "w-full h-12 rounded-lg border bg-white dark:bg-zinc-900 px-4 text-center",
                  "font-mono text-2xl tracking-[0.5em]",
                  "text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700",
                  "outline-none transition-all duration-200",
                  twoFAForm.formState.errors.code
                    ? "border-red-400 focus:ring-2 focus:ring-red-500/20"
                    : "border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                )}
                {...twoFAForm.register("code")}
              />
              {twoFAForm.formState.errors.code && (
                <p className="text-xs text-red-500 font-medium">
                  {twoFAForm.formState.errors.code.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying2FA}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20"
            >
              {isVerifying2FA && <Loader2 className="w-4 h-4 animate-spin" />}
              {isVerifying2FA ? "Verificando..." : "Confirmar Código"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Não recebeu o código?{" "}
            <button
              type="button"
              className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              onClick={() => window.location.reload()}
            >
              Voltar ao login
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Tela de Login
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col">
      {/* Logo mobile */}
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md shadow-indigo-500/25">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
          InvenTech
        </span>
      </div>

      {/* Container */}
      <div className="w-full mx-auto">

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Insira suas credenciais corporativas
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={loginForm.handleSubmit(handleLogin)}
          className="space-y-5"
          noValidate
        >
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                autoComplete="email"
                placeholder="nome@empresa.com.br"
                className={cn(
                  "w-full h-11 rounded-lg border bg-white dark:bg-zinc-900 pl-10 pr-4",
                  "text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                  "outline-none transition-all duration-200",
                  loginForm.formState.errors.email
                    ? "border-red-400 focus:ring-2 focus:ring-red-500/20"
                    : "border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                )}
                {...loginForm.register("email")}
              />
            </div>
            {loginForm.formState.errors.email && (
              <p className="text-xs text-red-500 font-medium">
                {loginForm.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Senha
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••"
                className={cn(
                  "w-full h-11 rounded-lg border bg-white dark:bg-zinc-900 pl-10 pr-11",
                  "text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                  "outline-none transition-all duration-200",
                  loginForm.formState.errors.password
                    ? "border-red-400 focus:ring-2 focus:ring-red-500/20"
                    : "border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                )}
                {...loginForm.register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {loginForm.formState.errors.password && (
              <p className="text-xs text-red-500 font-medium">
                {loginForm.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-11 mt-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-md shadow-indigo-500/20"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            <span>
              {isLoggingIn ? "Entrando..." : "Entrar"}
            </span>
            {!isLoggingIn && (
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform duration-200" />
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
          © {new Date().getFullYear()} InvenTech. Todos os direitos reservados.
        </p>
        <div className="flex items-center justify-center gap-3 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
          <Link href="#" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            Privacidade
          </Link>
          <span>·</span>
          <Link href="#" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            Termos
          </Link>
          <span>·</span>
          <Link href="#" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            Suporte
          </Link>
        </div>
      </div>
    </div>
  );
}
