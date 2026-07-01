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
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "@/hooks/auth/use-auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
// Helpers de layout — cartão + cabeçalho compartilhados pelas 3 etapas
// ---------------------------------------------------------------------------

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-2xl border border-border bg-card p-7 sm:p-8 shadow-sm">
      {children}
    </div>
  );
}

function StepHeader({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "primary" | "warning";
  title: string;
  description: string;
}) {
  const toneCls =
    tone === "primary"
      ? "bg-primary/10 border-primary/20 text-primary"
      : "bg-warning/10 border-warning/20 text-warning";

  return (
    <div className="text-center mb-7">
      <div
        className={cn(
          "mx-auto mb-4 w-11 h-11 rounded-xl flex items-center justify-center border",
          toneCls
        )}
      >
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

const fieldErrorCls = "mt-1.5 text-xs font-medium text-destructive";

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
      <AuthCard>
        <StepHeader
          icon={ShieldCheck}
          tone="primary"
          title="Verificação em duas etapas"
          description="Insira o código de 6 dígitos enviado para seu e-mail"
        />

        <form onSubmit={twoFAForm.handleSubmit(handle2FA)} className="space-y-5">
          <div>
            <Label htmlFor="code">Código de verificação</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              autoFocus
              aria-invalid={!!twoFAForm.formState.errors.code}
              className="mt-1.5 h-14 text-center font-mono text-2xl tracking-[0.5em]"
              {...twoFAForm.register("code")}
            />
            {twoFAForm.formState.errors.code && (
              <p className={fieldErrorCls}>{twoFAForm.formState.errors.code.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isVerifying2FA} className="w-full h-11">
            {isVerifying2FA && <Loader2 className="w-4 h-4 animate-spin" />}
            {isVerifying2FA ? "Verificando..." : "Confirmar código"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não recebeu o código?{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
            onClick={() => window.location.reload()}
          >
            Voltar ao login
          </button>
        </p>
      </AuthCard>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 3: Definir senha inicial
  // ---------------------------------------------------------------------------
  if (requiresPasswordChange) {
    return (
      <AuthCard>
        <StepHeader
          icon={KeyRound}
          tone="warning"
          title="Defina sua senha"
          description="Este é seu primeiro acesso. Crie uma senha de sua escolha para continuar."
        />

        <form
          onSubmit={firstPasswordForm.handleSubmit(handleFirstPassword)}
          className="space-y-4"
          noValidate
        >
          {/* Nova Senha */}
          <div>
            <Label htmlFor="newPassword">Nova senha</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                placeholder="Mínimo 6 caracteres"
                aria-invalid={!!firstPasswordForm.formState.errors.newPassword}
                className="h-11 pl-10 pr-11"
                {...firstPasswordForm.register("newPassword")}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowNewPassword((v) => !v)}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {firstPasswordForm.formState.errors.newPassword && (
              <p className={fieldErrorCls}>
                {firstPasswordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          {/* Confirmar Senha */}
          <div>
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repita a senha"
                aria-invalid={!!firstPasswordForm.formState.errors.confirmPassword}
                className="h-11 pl-10 pr-11"
                {...firstPasswordForm.register("confirmPassword")}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {firstPasswordForm.formState.errors.confirmPassword && (
              <p className={fieldErrorCls}>
                {firstPasswordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isSettingFirstPassword} className="w-full h-11 mt-2">
            {isSettingFirstPassword && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSettingFirstPassword ? "Salvando..." : "Definir senha e entrar"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  // ---------------------------------------------------------------------------
  // Tela de Login
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col w-full">
      {/* Logo mobile */}
      <div className="mb-6 flex items-center gap-2.5 lg:hidden">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center gradient-brand shadow-brand">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-lg font-semibold text-foreground tracking-tight">
          InvenTech
        </span>
      </div>

      <AuthCard>
        {/* Heading */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Insira suas credenciais para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <Label htmlFor="email">E-mail</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="nome@empresa.com.br"
                aria-invalid={!!loginForm.formState.errors.email}
                className="h-11 pl-10"
                {...loginForm.register("email")}
              />
            </div>
            {loginForm.formState.errors.email && (
              <p className={fieldErrorCls}>{loginForm.formState.errors.email.message}</p>
            )}
          </div>

          {/* Senha */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline underline-offset-4 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••"
                aria-invalid={!!loginForm.formState.errors.password}
                className="h-11 pl-10 pr-11"
                {...loginForm.register("password")}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {loginForm.formState.errors.password && (
              <p className={fieldErrorCls}>{loginForm.formState.errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-11 mt-2 group"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            <span>{isLoggingIn ? "Entrando..." : "Entrar"}</span>
            {!isLoggingIn && (
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform duration-200" />
            )}
          </Button>
        </form>
      </AuthCard>

      {/* Footer */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground font-medium">
          <Link href="#" className="hover:text-foreground transition-colors">
            Privacidade
          </Link>
          <span className="text-border">·</span>
          <Link href="#" className="hover:text-foreground transition-colors">
            Termos
          </Link>
          <span className="text-border">·</span>
          <Link href="#" className="hover:text-foreground transition-colors">
            Suporte
          </Link>
        </div>
      </div>
    </div>
  );
}
