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
  Settings,
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
        {/* Card */}
        <div className="w-full rounded-3xl bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/60 dark:shadow-black/20 border border-slate-100 dark:border-slate-800 px-8 py-10 sm:px-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              }}
            >
              <KeyRound className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              Verificação em duas etapas.
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Insira o código de 6 dígitos enviado para seu e-mail
            </p>
          </div>

          <form
            onSubmit={twoFAForm.handleSubmit(handle2FA)}
            className="space-y-5"
          >
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                Código de verificação
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoFocus
                className={cn(
                  "w-full h-12 rounded-xl border bg-slate-50 dark:bg-slate-800/50 px-4 text-center",
                  "font-mono text-2xl tracking-[0.5em]",
                  "text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600",
                  "outline-none transition-all duration-200",
                  twoFAForm.formState.errors.code
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                )}
                {...twoFAForm.register("code")}
              />
              {twoFAForm.formState.errors.code && (
                <p className="mt-1.5 text-xs text-red-500">
                  {twoFAForm.formState.errors.code.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying2FA}
              className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
              }}
            >
              {isVerifying2FA && <Loader2 className="w-4 h-4 animate-spin" />}
              {isVerifying2FA ? "Verificando..." : "Confirmar Código"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Não recebeu o código?{" "}
            <button
              type="button"
              className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline transition-colors"
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
    <div className="flex flex-col items-center">
      {/* Logo mobile */}
      <div className="mb-6 flex items-center gap-2.5 lg:hidden">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Inven<span className="text-indigo-600 dark:text-indigo-400">Tech</span>
        </span>
      </div>

      {/* Card */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/60 dark:shadow-black/20 border border-slate-100 dark:border-slate-800 px-8 py-10 sm:px-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            }}
          >
            <Settings className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Entre com suas credenciais para continuar
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={loginForm.handleSubmit(handleLogin)}
          className="space-y-5"
          noValidate
        >
          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.com.br"
              className={cn(
                "w-full h-12 rounded-xl border bg-slate-50 dark:bg-slate-800/50 px-4",
                "text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500",
                "outline-none transition-all duration-200",
                loginForm.formState.errors.email
                  ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              )}
              {...loginForm.register("email")}
            />
            {loginForm.formState.errors.email && (
              <p className="mt-1.5 text-xs text-red-500">
                {loginForm.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Senha */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Lock className="w-4 h-4 text-amber-500" />
                Senha
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••"
                className={cn(
                  "w-full h-12 rounded-xl border bg-slate-50 dark:bg-slate-800/50 px-4 pr-11",
                  "text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500",
                  "outline-none transition-all duration-200",
                  loginForm.formState.errors.password
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                )}
                {...loginForm.register("password")}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
              <p className="mt-1.5 text-xs text-red-500">
                {loginForm.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 group"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
            }}
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            <span>
              {isLoggingIn ? "Entrando..." : "Entrar no Sistema"}
            </span>
            {!isLoggingIn && (
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform duration-200" />
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          © 2025 InvenTech. Todos os direitos reservados.
        </p>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <Link href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Privacidade
          </Link>
          <span>·</span>
          <Link href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Termos
          </Link>
          <span>·</span>
          <Link href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Suporte
          </Link>
        </div>
      </div>

    </div>
  );
}