"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthResetPasswordRedirectInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    useEffect(() => {
        const url = token ? `/reset-password?token=${token}` : "/forgot-password";
        router.replace(url);
    }, [token, router]);

    return null;
}

export default function AuthResetPasswordRedirect() {
    return (
        <Suspense>
            <AuthResetPasswordRedirectInner />
        </Suspense>
    );
}
