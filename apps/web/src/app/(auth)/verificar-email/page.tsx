"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";

import { authService } from "@/services/auth/auth.service";
import { getErrorMessage } from "@/lib/api";

// ---------------------------------------------------------------------------
// Inner component (needs Suspense because uses useSearchParams)
// ---------------------------------------------------------------------------

type Status = "loading" | "success" | "error" | "missing";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [status, setStatus] = useState<Status>(token ? "loading" : "missing");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!token) return;

        authService
            .verifyEmail(token)
            .then(() => setStatus("success"))
            .catch((err) => {
                setErrorMessage(getErrorMessage(err));
                setStatus("error");
            });
    }, [token]);

    // ── Token ausente na URL ──
    if (status === "missing") {
        return (
            <div className="space-y-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950">
                    <XCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Link inválido
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                        O link de verificação está incompleto. Verifique o email que você recebeu e clique no link novamente.
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

    // ── Verificando ──
    if (status === "loading") {
        return (
            <div className="space-y-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Verificando email...
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Aguarde um momento.
                    </p>
                </div>
            </div>
        );
    }

    // ── Sucesso ──
    if (status === "success") {
        return (
            <div className="space-y-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Email verificado!
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                        Sua conta está ativa. Faça login para acessar o sistema.
                    </p>
                </div>
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Ir para o login
                </Link>
            </div>
        );
    }

    // ── Erro (token inválido / expirado) ──
    return (
        <div className="space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 dark:bg-red-950">
                <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    Link inválido ou expirado
                </h1>
                <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                    {errorMessage || "O link de verificação não é válido ou já foi utilizado. Solicite um novo email de verificação."}
                </p>
            </div>
            <div className="space-y-3">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Ir para o login
                </Link>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page (wraps content in Suspense — required for useSearchParams)
// ---------------------------------------------------------------------------

export default function VerificarEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-6 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950">
                        <MailCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                            Verificação de email
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">Carregando...</p>
                    </div>
                </div>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    );
}
