"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ClipboardList,
    Wrench,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    Bell,
    Users,
    Building2,
} from "lucide-react";

import { useAuth } from "@/hooks/auth/use-auth";
import { useCurrentUser } from "@/store/auth.store";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/auth";

const navItems: {
    label: string;
    href: string;
    icon: React.ElementType;
    roles: Role[];
}[] = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN", "CLIENT_USER"],
        },
        {
            label: "Ordens de Serviço",
            href: "/ordens-de-servico",
            icon: ClipboardList,
            roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN", "CLIENT_USER"],
        },
        {
            label: "Equipamentos",
            href: "/equipamentos",
            icon: Wrench,
            roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN"],
        },
        {
            label: "Usuários",
            href: "/usuarios",
            icon: Users,
            roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
        },
        {
            label: "Empresas",
            href: "/empresas",
            icon: Building2,
            roles: ["SUPER_ADMIN"],
        },
        {
            label: "Relatórios",
            href: "/relatorios",
            icon: BarChart3,
            roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"],
        },
        {
            label: "Configurações",
            href: "/configuracoes",
            icon: Settings,
            roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
        },
    ];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { logout, isLoggingOut } = useAuth();
    const user = useCurrentUser();
    const permissions = usePermissions();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    function getInitials(name: string) {
        return name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    }

    const filteredNavItems = navItems.filter((item) =>
        permissions.role ? item.roles.includes(permissions.role) : false
    );

    const Sidebar = () => (
        <aside className="flex flex-col h-full bg-slate-900 text-white w-60">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-6 py-5 border-b border-white/10">
                <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                        <path
                            d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                        />
                        <path
                            d="M9 2V16M2.5 5.5L15.5 12.5M15.5 5.5L2.5 12.5"
                            stroke="white"
                            strokeWidth="1"
                            strokeOpacity="0.5"
                        />
                    </svg>
                </div>
                <span className="font-semibold text-base tracking-tight">
                    Inventech
                </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 mb-2">
                    Menu
                </p>
                {filteredNavItems.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                isActive
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Usuário */}
            <div className="px-3 py-4 border-t border-white/10">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-white">
                            {user?.name ? getInitials(user.name) : "?"}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            {user?.name ?? "Usuário"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                            {user?.email ?? ""}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => logout()}
                    disabled={isLoggingOut}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mt-1",
                        "text-slate-400 hover:text-white hover:bg-white/10 transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    {isLoggingOut ? "Saindo..." : "Sair"}
                </button>
            </div>
        </aside>
    );

    return (
        <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
            {/* Sidebar desktop */}
            <div className="hidden lg:flex flex-col w-60 flex-shrink-0">
                <div className="fixed top-0 left-0 h-screen w-60">
                    <Sidebar />
                </div>
            </div>

            {/* Sidebar mobile — overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <div className="absolute left-0 top-0 h-full">
                        <Sidebar />
                    </div>
                </div>
            )}

            {/* Conteúdo principal */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header mobile */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Inventech
                    </span>
                    <button className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <Bell className="w-5 h-5" />
                    </button>
                </header>

                {/* Conteúdo */}
                <main className="flex-1 p-6 lg:p-8 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}