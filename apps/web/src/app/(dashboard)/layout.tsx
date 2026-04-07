"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    ClipboardList,
    Wrench,
    CalendarClock,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    Users,
    Building2,
    Contact,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    ShieldAlert,
    BadgeCheck,
    Layers,
    Landmark,
    ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/hooks/auth/use-auth";
import { useCurrentUser } from "@/store/auth.store";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { usePermissions } from "@/hooks/auth/use-permissions";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/auth";
import { ROLE_LABELS } from "@/types/auth";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
    roles: Role[];
    /** resource:action — usado para verificar acesso de usuários com papel personalizado */
    permission?: string;
};

type NavSection = {
    sectionLabel?: string;
    sectionKey: string;
    collapsible?: boolean;
    items: NavItem[];
};

const navSections: NavSection[] = [
    {
        sectionKey: "principal",
        items: [
            {
                label: "Dashboard",
                href: "/dashboard",
                icon: LayoutDashboard,
                roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN", "CLIENT_USER"],
                permission: "dashboard:company",
            },
        ],
    },
    {
        sectionLabel: "Operações",
        sectionKey: "operacoes",
        collapsible: true,
        items: [
            {
                label: "Ordens de Serviço",
                href: "/operacional",
                icon: ClipboardList,
                roles: ["COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN", "CLIENT_USER"],
                permission: "service-order:list",
            },
            {
                label: "Equipamentos",
                href: "/equipamentos",
                icon: Wrench,
                roles: ["COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN", "CLIENT_USER"],
                permission: "equipment:list",
            },
            {
                label: "Preventivas ",
                href: "/preventivas",
                icon: CalendarClock,
                roles: ["COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN", "CLIENT_USER"],
                permission: "maintenance-schedule:list",
            },
        ],
    },
    {
        sectionLabel: "Administração",
        sectionKey: "administracao",
        collapsible: true,
        items: [
            {
                label: "Usuários",
                href: "/usuarios",
                icon: Users,
                roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "CLIENT_ADMIN"],
                permission: "user:list",
            },
            {
                label: "Prestadores",
                href: "/clientes",
                icon: Contact,
                roles: ["COMPANY_ADMIN", "COMPANY_MANAGER"],
                permission: "client:list",
            },
            {
                label: "Grupos de Manutenção",
                href: "/grupos-manutencao",
                icon: Wrench,
                roles: ["COMPANY_ADMIN", "COMPANY_MANAGER"],
                permission: "maintenance-group:list",
            },
            {
                label: "Tipos de Equipamento",
                href: "/tipos-de-equipamento",
                icon: Layers,
                roles: ["COMPANY_ADMIN", "COMPANY_MANAGER"],
                permission: "equipment-type:list",
            },
            {
                label: "Centros de Custo",
                href: "/centros-de-custo",
                icon: Landmark,
                roles: ["COMPANY_ADMIN", "COMPANY_MANAGER"],
                permission: "cost-center:list",
            },
            {
                label: "Empresas",
                href: "/empresas",
                icon: Building2,
                roles: ["SUPER_ADMIN"],
            },
            {
                label: "Licenças",
                href: "/licencas",
                icon: BadgeCheck,
                roles: ["SUPER_ADMIN"],
            },
            {
                label: "Logs de Auditoria",
                href: "/logs-auditoria",
                icon: ShieldAlert,
                roles: ["SUPER_ADMIN"],
            },
            {
                label: "Papéis & Permissões",
                href: "/papeis-permissoes",
                icon: ShieldCheck,
                roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
                permission: "permission:manage",
            },
        ],
    },
    {
        sectionLabel: "Análise",
        sectionKey: "analise",
        collapsible: true,
        items: [
            {
                label: "Relatórios",
                href: "/relatorios",
                icon: BarChart3,
                roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"],
                permission: "report:company",
            },
            {
                label: "Configurações",
                href: "/configuracoes",
                icon: Settings,
                roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
            },
        ],
    },
];

const SIDEBAR_EXPANDED_W = 240;
const SIDEBAR_COLLAPSED_W = 64;

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { logout, isLoggingOut } = useAuth();
    const user = useCurrentUser();
    const permissions = usePermissions();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Route guard: bloqueia acesso direto por URL a rotas sem permissão
    useEffect(() => {
        if (!user) return;
        const allNavItems = navSections.flatMap((s) => s.items);
        const matched = allNavItems.find(
            (item) => pathname === item.href || pathname.startsWith(item.href + "/")
        );
        if (!matched) return; // /perfil e páginas não listadas são sempre acessíveis
        if (!matched.roles.includes(user.role as Role)) {
            router.replace("/dashboard");
        }
    }, [pathname, user, router]);
    const [collapsed, setCollapsed] = useState(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        operacoes: true,
        administracao: true,
        analise: true,
    });

    function getInitials(name: string) {
        return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
    }

    function toggleSection(key: string) {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    function isItemActive(href: string) {
        return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    }

    const sidebarStyle: React.CSSProperties = {
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRight: "0.8px solid rgb(224, 229, 235)",
        width: collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W,
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
    };

    const Sidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
        <aside
            className="flex flex-col h-full"
            style={isMobile ? { ...sidebarStyle, width: SIDEBAR_EXPANDED_W } : sidebarStyle}
        >
            {/* ── Logo + toggle ── */}
            <div
                className="flex items-center border-b border-border flex-shrink-0"
                style={{
                    height: 56,
                    padding: collapsed && !isMobile ? "0 16px" : "0 16px",
                    justifyContent: collapsed && !isMobile ? "center" : "space-between",
                }}
            >
                <div
                    className="flex items-center gap-3 overflow-hidden"
                    style={{ minWidth: 0, flex: collapsed && !isMobile ? "unset" : 1 }}
                >
                    <div
                        className="p-1.5 rounded-xl flex items-center justify-center flex-shrink-0 shadow-brand"
                        style={{ background: "var(--gradient-brand)" }}
                    >
                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
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
                                strokeOpacity="0.6"
                            />
                        </svg>
                    </div>
                    {(!collapsed || isMobile) && (
                        <span
                            className="text-base font-bold text-gradient-brand whitespace-nowrap overflow-hidden"
                            style={{
                                opacity: collapsed && !isMobile ? 0 : 1,
                                transition: "opacity 0.15s",
                            }}
                        >
                            InvenTech
                        </span>
                    )}
                </div>

                {!isMobile && (
                    <button
                        onClick={() => setCollapsed((v) => !v)}
                        className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
                        style={{ color: "var(--muted-foreground)", marginLeft: collapsed ? 0 : 4 }}
                        title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
                    >
                        {collapsed
                            ? <ChevronsRight className="w-4 h-4" />
                            : <ChevronsLeft className="w-4 h-4" />
                        }
                    </button>
                )}
            </div>

            {/* ── Nav ── */}
            <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
                {navSections.map((section) => {
                    const visibleItems = section.items.filter((item) =>
                        permissions.canSeeNav(item.roles, item.permission)
                    );
                    if (visibleItems.length === 0) return null;

                    const isOpen = !section.collapsible || openSections[section.sectionKey] !== false;
                    const hasActiveChild = visibleItems.some((item) => isItemActive(item.href));
                    const showExpanded = !collapsed || isMobile;

                    return (
                        <div key={section.sectionKey}>
                            {/* Section label / accordion trigger */}
                            {section.sectionLabel && showExpanded && (
                                section.collapsible ? (
                                    <button
                                        onClick={() => toggleSection(section.sectionKey)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 mt-2 rounded-md text-xs font-semibold uppercase tracking-wider hover:bg-muted/60 transition-colors"
                                        style={{ color: hasActiveChild && !isOpen ? "var(--primary)" : "var(--muted-foreground)" }}
                                    >
                                        <span>{section.sectionLabel}</span>
                                        <ChevronDown
                                            className={cn(
                                                "h-3 w-3 transition-transform duration-200",
                                                !isOpen && "-rotate-90"
                                            )}
                                        />
                                    </button>
                                ) : (
                                    <p
                                        className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 mt-2"
                                        style={{ color: "var(--muted-foreground)" }}
                                    >
                                        {section.sectionLabel}
                                    </p>
                                )
                            )}

                            {/* Separator line in collapsed mode for non-first sections */}
                            {section.sectionLabel && !showExpanded && (
                                <div className="my-2 mx-3 border-t border-border" />
                            )}

                            {/* Items */}
                            <div
                                className={cn(
                                    "overflow-hidden transition-all duration-200",
                                    showExpanded && section.collapsible && !isOpen
                                        ? "max-h-0 opacity-0"
                                        : "max-h-[500px] opacity-100"
                                )}
                            >
                                {visibleItems.map((item) => {
                                    const active = isItemActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => isMobile && setSidebarOpen(false)}
                                            title={collapsed && !isMobile ? item.label : undefined}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm transition-colors",
                                                active ? "bg-muted font-medium" : "hover:bg-muted",
                                                collapsed && !isMobile && "justify-center px-0"
                                            )}
                                            style={{ color: active ? "var(--primary)" : "var(--foreground)" }}
                                        >
                                            <item.icon className="w-4 h-4 flex-shrink-0" />
                                            {showExpanded && (
                                                <span className="truncate">{item.label}</span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

        </aside>
    );

    return (
        <div className="min-h-screen flex bg-secondary">
            {/* Sidebar desktop */}
            <div
                className="hidden lg:flex flex-col flex-shrink-0 transition-all duration-250"
                style={{ width: collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W }}
            >
                <div
                    className="fixed top-0 left-0 h-screen"
                    style={{
                        width: collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W,
                        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                >
                    <Sidebar />
                </div>
            </div>

            {/* Sidebar mobile — overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <div className="absolute left-0 top-0 h-full">
                        <Sidebar isMobile />
                    </div>
                </div>
            )}

            {/* Conteúdo principal */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header
                    className="flex items-center justify-between px-4 h-14 sticky top-0 z-30 flex-shrink-0"
                    style={{
                        background: "rgba(255, 255, 255, 0.6)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        borderBottom: "1px solid var(--border)",
                    }}
                >
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-1.5 rounded-md transition-colors hover:bg-muted"
                            style={{ color: "var(--muted-foreground)" }}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <span className="lg:hidden text-base font-bold text-gradient-brand ml-2">
                            InvenTech
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationBell />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-2 hover:bg-muted py-1 px-2 rounded-md transition-colors outline-none border border-transparent hover:border-border">
                                    <div className="hidden md:flex flex-col items-end">
                                        <span className="text-sm font-medium leading-none" style={{ color: "var(--foreground)" }}>
                                            {user?.name ?? "Usuário"}
                                        </span>
                                        <span className="text-xs mt-1.5 leading-none" style={{ color: "var(--muted-foreground)" }}>
                                            {user?.role ? ROLE_LABELS[user.role] : ""}
                                        </span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-border bg-muted">
                                        {user?.avatarUrl ? (
                                            <img src={user.avatarUrl} alt={user.name ?? ""} className="w-full h-full object-cover" />
                                        ) : (
                                            <div
                                                className="w-full h-full flex items-center justify-center text-white text-xs font-semibold"
                                                style={{ background: "var(--gradient-brand)" }}
                                            >
                                                {user?.name ? getInitials(user.name) : "?"}
                                            </div>
                                        )}
                                    </div>
                                    <ChevronDown className="w-4 h-4 ml-1 md:block hidden text-muted-foreground" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 mt-1">
                                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/perfil" className="w-full cursor-pointer flex items-center">
                                        Meu Perfil
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => logout()} disabled={isLoggingOut} className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                                    <LogOut className="w-4 h-4 mr-2" />
                                    {isLoggingOut ? "Saindo..." : "Sair"}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Conteúdo */}
                <main className="flex-1 p-6 lg:p-8 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
