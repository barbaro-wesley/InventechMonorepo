"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, KeyRound, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { authService } from "@/services/auth/auth.service";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const schema = z
    .object({
        password: z.string().min(6, "Mínimo 6 caracteres"),
        confirm: z.string().min(1, "Confirme a senha"),
    })
    .refine((d) => d.password === d.confirm, {
        message: "As senhas não coincidem",
        path: ["confirm"],
    });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { password: "", confirm: "" },
    });

    useEffect(() => {
        if (!token) {
            toast.error("Link inválido ou expirado.");
            router.replace("/forgot-password");
        }
    }, [token, router]);

    async function onSubmit(data: FormData) {
        if (!token) return;
        setIsSubmitting(true);
        try {
            await authService.resetPassword(token, data.password);
            setSuccess(true);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    if (success) {
        return (
            <div className="space-y-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Senha redefinida!
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                        Sua senha foi atualizada com sucesso. Faça login com a nova senha.
                    </p>
                </div>
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Ir para o login
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </Link>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 mb-3">
                    <KeyRound className="w-5 h-5 text-blue-600" />
                </div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    Nova senha
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    Escolha uma senha segura para sua conta.
                </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Nova senha
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Mínimo 6 caracteres"
                            className={cn(
                                "w-full px-3 py-2.5 pr-10 rounded-lg border text-sm",
                                "bg-white dark:bg-slate-900",
                                "text-slate-900 dark:text-slate-100 placeholder:text-slate-400",
                                "outline-none transition-colors",
                                form.formState.errors.password
                                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                    : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            )}
                            {...form.register("password")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {form.formState.errors.password && (
                        <p className="mt-1 text-xs text-red-500">
                            {form.formState.errors.password.message}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Confirmar senha
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirm ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Repita a senha"
                            className={cn(
                                "w-full px-3 py-2.5 pr-10 rounded-lg border text-sm",
                                "bg-white dark:bg-slate-900",
                                "text-slate-900 dark:text-slate-100 placeholder:text-slate-400",
                                "outline-none transition-colors",
                                form.formState.errors.confirm
                                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                    : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            )}
                            {...form.register("confirm")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            tabIndex={-1}
                        >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {form.formState.errors.confirm && (
                        <p className="mt-1 text-xs text-red-500">
                            {form.formState.errors.confirm.message}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                        "w-full flex items-center justify-center gap-2",
                        "px-4 py-2.5 rounded-lg text-sm font-medium",
                        "bg-blue-600 hover:bg-blue-700 text-white transition-colors",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    )}
                >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "Salvando..." : "Redefinir senha"}
                </button>
            </form>
        </div>
    );
}
