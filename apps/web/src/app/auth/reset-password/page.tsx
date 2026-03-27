"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthResetPasswordRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    useEffect(() => {
        const url = token ? `/reset-password?token=${token}` : "/forgot-password";
        router.replace(url);
    }, [token, router]);

    return null;
}
