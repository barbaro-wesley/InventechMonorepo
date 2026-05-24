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
  ArrowRight,
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

const firstPasswordSchema = z
  .object({
    newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirme sua senha"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type TwoFAFormData = z.infer<typeof twoFASchema>;
type FirstPasswordFormData = z.infer<typeof firstPasswordSchema>;

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    login,
    isLoggingIn,
    requires2FA,
    twoFAUserId,
    verify2FA,
    isVerifying2FA,
    requiresPasswordChange,
    changeToken,
    setFirstPassword,
    isSettingFirstPassword,
  } = useAuth();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const twoFAForm = useForm<TwoFAFormData>({
    resolver: zodResolver(twoFASchema),
    defaultValues: { code: "" },
  });

  const firstPasswordForm = useForm<FirstPasswordFormData>({
    resolver: zodResolver(firstPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  function handleLogin(data: LoginFormData) {
    login({ email: data.email, password: data.password });
  }

  function handle2FA(data: TwoFAFormData) {
    if (!twoFAUserId) return;
    verify2FA({ userId: twoFAUserId, code: data.code });
  }

  function handleFirstPassword(data: FirstPasswordFormData) {
    if (!changeToken) return;
    setFirstPassword({ token: changeToken, newPassword: data.newPassword });
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
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
  // Step 3: Definir senha inicial
  // ---------------------------------------------------------------------------
  if (requiresPasswordChange) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full mx-auto">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
              <KeyRound className="w-6 h-6 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">
              Defina sua senha
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Este é seu primeiro acesso. Crie uma senha de sua escolha para continuar.
            </p>
          </div>

          <form
            onSubmit={firstPasswordForm.handleSubmit(handleFirstPassword)}
            className="space-y-5"
            noValidate
          >
            {/* Nova Senha */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  placeholder="Mínimo 6 caracteres"
                  className={cn(
                    "w-full h-12 rounded-xl border bg-white dark:bg-zinc-800/60 pl-4 pr-12",
                    "text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                    "outline-none transition-all duration-200",
                    firstPasswordForm.formState.errors.newPassword
                      ? "border-red-400 focus:ring-2 focus:ring-red-500/20"
                      : "border-zinc-200 dark:border-zinc-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  )}
                  {...firstPasswordForm.register("newPassword")}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  onClick={() => setShowNewPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {firstPasswordForm.formState.errors.newPassword && (
                <p className="text-xs text-red-500 font-medium">
                  {firstPasswordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  className={cn(
                    "w-full h-12 rounded-xl border bg-white dark:bg-zinc-800/60 pl-4 pr-12",
                    "text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                    "outline-none transition-all duration-200",
                    firstPasswordForm.formState.errors.confirmPassword
                      ? "border-red-400 focus:ring-2 focus:ring-red-500/20"
                      : "border-zinc-200 dark:border-zinc-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  )}
                  {...firstPasswordForm.register("confirmPassword")}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {firstPasswordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-red-500 font-medium">
                  {firstPasswordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSettingFirstPassword}
              className="w-full h-12 mt-1 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25"
            >
              {isSettingFirstPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSettingFirstPassword ? "Salvando..." : "Definir senha e entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Tela de Login
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col w-full">
      {/* Logo mobile */}
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">
          InvenTech
        </span>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">
          Bem-vindo de volta
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Insira suas credenciais para continuar
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={loginForm.handleSubmit(handleLogin)}
        className="space-y-5"
        noValidate
      >
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="nome@empresa.com.br"
            className={cn(
              "w-full h-12 rounded-xl border bg-white dark:bg-zinc-800/60 px-4",
              "text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
              "outline-none transition-all duration-200",
              loginForm.formState.errors.email
                ? "border-red-400 focus:ring-2 focus:ring-red-500/20"
                : "border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            )}
            {...loginForm.register("email")}
          />
          {loginForm.formState.errors.email && (
            <p className="text-xs text-red-500 font-medium">
              {loginForm.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
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
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
              className={cn(
                "w-full h-12 rounded-xl border bg-white dark:bg-zinc-800/60 pl-4 pr-12",
                "text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                "outline-none transition-all duration-200",
                loginForm.formState.errors.password
                  ? "border-red-400 focus:ring-2 focus:ring-red-500/20"
                  : "border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              )}
              {...loginForm.register("password")}
            />
            <button
              type="button"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
          className="w-full h-12 mt-1 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-indigo-500/25"
        >
          {isLoggingIn ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : null}
          <span>{isLoggingIn ? "Entrando..." : "Entrar"}</span>
          {!isLoggingIn && (
            <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform duration-200" />
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-3 text-xs text-zinc-400 dark:text-zinc-600 font-medium">
          <Link href="#" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            Privacidade
          </Link>
          <span>·</span>
          <Link href="#" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            Termos
          </Link>
          <span>·</span>
          <Link href="#" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            Suporte
          </Link>
        </div>
      </div>
    </div>
  );
}
