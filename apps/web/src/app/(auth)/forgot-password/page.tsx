"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/auth/use-auth";
import { cn } from "@/lib/utils";

const schema = z.object({
    email: z.string().min(1, "E-mail obrigatório").email("E-mail inválido"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
    const { forgotPassword, isSendingForgot, forgotPasswordSuccess } = useAuth();

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { email: "" },
    });

    // Tela de sucesso
    if (forgotPasswordSuccess) {
        return (
            <div className="space-y-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950">
                    <Mail className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Verifique seu e-mail
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                        Se o endereço informado tiver uma conta, você receberá o link de
                        redefinição em breve.
                    </p>
                </div>
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao login
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
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    Recuperar senha
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    Informe seu e-mail e enviaremos um link de redefinição.
                </p>
            </div>

            <form
                onSubmit={form.handleSubmit((d) => forgotPassword(d.email))}
                className="space-y-4"
                noValidate
            >
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        E-mail
                    </label>
                    <input
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        className={cn(
                            "w-full px-3 py-2.5 rounded-lg border text-sm",
                            "bg-white dark:bg-slate-900",
                            "text-slate-900 dark:text-slate-100 placeholder:text-slate-400",
                            "outline-none transition-colors",
                            form.formState.errors.email
                                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        )}
                        {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                        <p className="mt-1 text-xs text-red-500">
                            {form.formState.errors.email.message}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSendingForgot}
                    className={cn(
                        "w-full flex items-center justify-center gap-2",
                        "px-4 py-2.5 rounded-lg text-sm font-medium",
                        "bg-blue-600 hover:bg-blue-700 text-white transition-colors",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    )}
                >
                    {isSendingForgot && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSendingForgot ? "Enviando..." : "Enviar link de recuperação"}
                </button>
            </form>
        </div>
    );
}