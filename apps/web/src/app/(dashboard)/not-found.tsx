import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
            <p className="text-8xl font-extrabold" style={{ color: "var(--primary)" }}>
                404
            </p>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
                Página não encontrada
            </h1>
            <p className="text-sm max-w-sm" style={{ color: "var(--muted-foreground)" }}>
                A página que você está procurando não existe ou ainda está em desenvolvimento.
            </p>
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--gradient-brand)" }}
            >
                <Home className="w-4 h-4" />
                Voltar ao Dashboard
            </Link>
        </div>
    );
}
