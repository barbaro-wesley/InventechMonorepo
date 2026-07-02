"use client";

import { useEffect, useRef, useState } from "react";
import {
    Shield,
    Building2,
    ImageIcon,
    FileText,
    Loader2,
    Save,
    Upload,
    Eye,
    EyeOff,
    KeyRound,
} from "lucide-react";

import { useCurrentUser } from "@/store/auth.store";
import {
    useCompany,
    useUpdateCompany,
    useUpdateReportSettings,
    useUpdateSecuritySettings,
    useUploadCompanyLogo,
} from "@/hooks/companies/use-companies";
import {
    DEFAULT_SECURITY_SETTINGS,
    SECURITY_SETTINGS_LIMITS,
    type CompanySecuritySettings,
} from "@/types/company";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de UI
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
                <p className="text-sm font-semibold">{title}</p>
                {description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                )}
            </div>
            {children}
        </div>
    );
}

function ToggleRow({
    title,
    description,
    checked,
    onChange,
}: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-1">
            <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba: Segurança
// ─────────────────────────────────────────────────────────────────────────────

function SecurityTab({
    companyId,
    enforce2FAForAll,
    settings,
}: {
    companyId: string;
    enforce2FAForAll: boolean;
    settings: CompanySecuritySettings;
}) {
    const update = useUpdateSecuritySettings(companyId);
    const [form, setForm] = useState({
        enforce2FAForAll,
        ...settings,
    });
    const [defaultPassword, setDefaultPassword] = useState("");
    const [showDefaultPassword, setShowDefaultPassword] = useState(false);

    useEffect(() => {
        setForm({ enforce2FAForAll, ...settings });
        setDefaultPassword("");
        setShowDefaultPassword(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    const pwd = SECURITY_SETTINGS_LIMITS.passwordMinLength;
    const att = SECURITY_SETTINGS_LIMITS.maxLoginAttempts;

    const clamp = (v: number, min: number, max: number, fallback: number) =>
        Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : fallback;

    function handleSave() {
        update.mutate({
            enforce2FAForAll: form.enforce2FAForAll,
            requireEmailVerification: form.requireEmailVerification,
            forcePasswordChangeOnFirstLogin: form.forcePasswordChangeOnFirstLogin,
            passwordMinLength: clamp(form.passwordMinLength, pwd.min, pwd.max, DEFAULT_SECURITY_SETTINGS.passwordMinLength),
            maxLoginAttempts: clamp(form.maxLoginAttempts, att.min, att.max, DEFAULT_SECURITY_SETTINGS.maxLoginAttempts),
            ...(defaultPassword ? { defaultFirstAccessPassword: defaultPassword } : {}),
        }, { onSuccess: () => { setDefaultPassword(""); setShowDefaultPassword(false); } });
    }

    function handleClearDefaultPassword() {
        update.mutate({ clearDefaultFirstAccessPassword: true });
    }

    return (
        <div className="space-y-5">
            <SectionCard
                title="Autenticação e acesso"
                description="Políticas aplicadas a todos os usuários desta empresa."
            >
                <ToggleRow
                    title="2FA obrigatório para todos"
                    description="Todos os usuários deverão confirmar o login com um código enviado por e-mail."
                    checked={form.enforce2FAForAll}
                    onChange={(v) => setForm((f) => ({ ...f, enforce2FAForAll: v }))}
                />
                <ToggleRow
                    title="Verificar e-mail ao criar usuário"
                    description="Novos usuários nascem como não verificados e recebem um e-mail de verificação antes de poder acessar."
                    checked={form.requireEmailVerification}
                    onChange={(v) => setForm((f) => ({ ...f, requireEmailVerification: v }))}
                />
                <ToggleRow
                    title="Forçar troca de senha no 1º login"
                    description="Quando o admin define a senha, o usuário é obrigado a trocá-la no primeiro acesso."
                    checked={form.forcePasswordChangeOnFirstLogin}
                    onChange={(v) => setForm((f) => ({ ...f, forcePasswordChangeOnFirstLogin: v }))}
                />
            </SectionCard>

            <SectionCard
                title="Senha e bloqueio"
                description="Limites de segurança para senhas e tentativas de login."
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="passwordMinLength">Tamanho mínimo de senha</Label>
                        <Input
                            id="passwordMinLength"
                            type="number"
                            min={pwd.min}
                            max={pwd.max}
                            className="mt-1.5"
                            value={Number.isNaN(form.passwordMinLength) ? "" : form.passwordMinLength}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, passwordMinLength: e.target.valueAsNumber }))
                            }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Entre {pwd.min} e {pwd.max} caracteres.
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="maxLoginAttempts">Tentativas até bloquear a conta</Label>
                        <Input
                            id="maxLoginAttempts"
                            type="number"
                            min={att.min}
                            max={att.max}
                            className="mt-1.5"
                            value={Number.isNaN(form.maxLoginAttempts) ? "" : form.maxLoginAttempts}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, maxLoginAttempts: e.target.valueAsNumber }))
                            }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Entre {att.min} e {att.max} tentativas falhas.
                        </p>
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                title="Senha padrão de primeiro acesso"
                description="Usuários criados sem senha herdam esta senha e são obrigados a trocá-la no primeiro login."
            >
                <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Status atual:</span>
                    {settings.hasDefaultFirstAccessPassword ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Configurada
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                            Não configurada
                        </Badge>
                    )}
                </div>

                <div>
                    <Label htmlFor="defaultFirstAccessPassword">
                        {settings.hasDefaultFirstAccessPassword ? "Atualizar senha padrão" : "Definir senha padrão"}
                    </Label>
                    <div className="relative mt-1.5">
                        <Input
                            id="defaultFirstAccessPassword"
                            type={showDefaultPassword ? "text" : "password"}
                            placeholder={`Mínimo ${form.passwordMinLength} caracteres`}
                            className="pr-10"
                            value={defaultPassword}
                            onChange={(e) => setDefaultPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowDefaultPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            {showDefaultPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Por segurança, a senha nunca é exibida após salva. Digite um novo valor
                        aqui e clique em &quot;Salvar segurança&quot; para atualizá-la.
                    </p>
                </div>

                {settings.hasDefaultFirstAccessPassword && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearDefaultPassword}
                        disabled={update.isPending}
                    >
                        Remover senha padrão
                    </Button>
                )}
            </SectionCard>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={update.isPending}>
                    {update.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Salvar segurança
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba: Dados da empresa
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileForm {
    name: string;
    email: string;
    phone: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
}

function ProfileTab({
    companyId,
    initial,
}: {
    companyId: string;
    initial: ProfileForm;
}) {
    const update = useUpdateCompany(companyId);
    const [form, setForm] = useState<ProfileForm>(initial);

    useEffect(() => {
        setForm(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <div className="space-y-5">
            <SectionCard title="Identificação">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" className="mt-1.5" value={form.name} onChange={set("name")} />
                    </div>
                    <div>
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" type="email" className="mt-1.5" value={form.email} onChange={set("email")} />
                    </div>
                    <div>
                        <Label htmlFor="phone">Telefone</Label>
                        <Input id="phone" className="mt-1.5" value={form.phone} onChange={set("phone")} />
                    </div>
                </div>
            </SectionCard>

            <SectionCard title="Endereço">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <Label htmlFor="street">Logradouro</Label>
                        <Input id="street" className="mt-1.5" value={form.street} onChange={set("street")} />
                    </div>
                    <div>
                        <Label htmlFor="number">Número</Label>
                        <Input id="number" className="mt-1.5" value={form.number} onChange={set("number")} />
                    </div>
                    <div>
                        <Label htmlFor="complement">Complemento</Label>
                        <Input id="complement" className="mt-1.5" value={form.complement} onChange={set("complement")} />
                    </div>
                    <div>
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input id="neighborhood" className="mt-1.5" value={form.neighborhood} onChange={set("neighborhood")} />
                    </div>
                    <div>
                        <Label htmlFor="city">Cidade</Label>
                        <Input id="city" className="mt-1.5" value={form.city} onChange={set("city")} />
                    </div>
                    <div>
                        <Label htmlFor="state">Estado (UF)</Label>
                        <Input id="state" maxLength={2} className="mt-1.5" value={form.state} onChange={set("state")} />
                    </div>
                    <div>
                        <Label htmlFor="zipCode">CEP</Label>
                        <Input id="zipCode" className="mt-1.5" value={form.zipCode} onChange={set("zipCode")} />
                    </div>
                </div>
            </SectionCard>

            <div className="flex justify-end">
                <Button onClick={() => update.mutate(form)} disabled={update.isPending}>
                    {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar dados
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba: Logo
// ─────────────────────────────────────────────────────────────────────────────

function LogoTab({ companyId, logoUrl }: { companyId: string; logoUrl?: string | null }) {
    const upload = useUploadCompanyLogo(companyId);
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(logoUrl ?? null);

    function onPick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPreview(URL.createObjectURL(file));
        upload.mutate(file);
    }

    return (
        <SectionCard
            title="Logo da empresa"
            description="Usado automaticamente nos relatórios gerados. PNG, JPG, WEBP ou SVG (máx 2MB)."
        >
            <div className="flex items-center gap-5">
                <div className="h-24 w-24 rounded-lg border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
                    {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                </div>
                <div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={onPick}
                    />
                    <Button
                        variant="outline"
                        onClick={() => inputRef.current?.click()}
                        disabled={upload.isPending}
                    >
                        {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Enviar logo
                    </Button>
                </div>
            </div>
        </SectionCard>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba: Relatórios
// ─────────────────────────────────────────────────────────────────────────────

function ReportsTab({
    companyId,
    initial,
}: {
    companyId: string;
    initial: {
        reportPrimaryColor: string;
        reportSecondaryColor: string;
        reportHeaderTitle: string;
        reportFooterText: string;
    };
}) {
    const update = useUpdateReportSettings(companyId);
    const [form, setForm] = useState(initial);

    useEffect(() => {
        setForm(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    return (
        <div className="space-y-5">
            <SectionCard
                title="Visual dos relatórios"
                description="Cores e textos que aparecem nos PDFs e Excels gerados."
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="primaryColor">Cor primária</Label>
                        <div className="flex items-center gap-2 mt-1.5">
                            <input
                                id="primaryColor"
                                type="color"
                                className="h-9 w-12 rounded border border-input cursor-pointer p-0.5"
                                value={form.reportPrimaryColor}
                                onChange={(e) => setForm((f) => ({ ...f, reportPrimaryColor: e.target.value }))}
                            />
                            <Input
                                className="font-mono text-xs"
                                placeholder="#1E40AF"
                                value={form.reportPrimaryColor}
                                onChange={(e) => setForm((f) => ({ ...f, reportPrimaryColor: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="secondaryColor">Cor secundária</Label>
                        <div className="flex items-center gap-2 mt-1.5">
                            <input
                                id="secondaryColor"
                                type="color"
                                className="h-9 w-12 rounded border border-input cursor-pointer p-0.5"
                                value={form.reportSecondaryColor}
                                onChange={(e) => setForm((f) => ({ ...f, reportSecondaryColor: e.target.value }))}
                            />
                            <Input
                                className="font-mono text-xs"
                                placeholder="#DBEAFE"
                                value={form.reportSecondaryColor}
                                onChange={(e) => setForm((f) => ({ ...f, reportSecondaryColor: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <Label htmlFor="headerTitle">Título do cabeçalho</Label>
                        <Input
                            id="headerTitle"
                            className="mt-1.5"
                            placeholder="Ex: Relatório Técnico"
                            value={form.reportHeaderTitle}
                            onChange={(e) => setForm((f) => ({ ...f, reportHeaderTitle: e.target.value }))}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <Label htmlFor="footerText">Texto do rodapé</Label>
                        <Input
                            id="footerText"
                            className="mt-1.5"
                            placeholder="Ex: Documento confidencial"
                            value={form.reportFooterText}
                            onChange={(e) => setForm((f) => ({ ...f, reportFooterText: e.target.value }))}
                        />
                    </div>
                </div>
            </SectionCard>

            <div className="flex justify-end">
                <Button onClick={() => update.mutate(form)} disabled={update.isPending}>
                    {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar relatórios
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
    const currentUser = useCurrentUser();
    const companyId = currentUser?.companyId ?? "";
    const { data: company, isLoading } = useCompany(companyId);

    if (!companyId) {
        return (
            <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                Sua conta não está vinculada a uma empresa.
            </div>
        );
    }

    if (isLoading || !company) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-10 w-full max-w-md" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    const security = company.securitySettings ?? DEFAULT_SECURITY_SETTINGS;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Parâmetros de segurança, dados e identidade visual de {company.name}.
                </p>
            </div>

            <Tabs defaultValue="security">
                <TabsList>
                    <TabsTrigger value="security">
                        <Shield className="h-4 w-4" /> Segurança
                    </TabsTrigger>
                    <TabsTrigger value="profile">
                        <Building2 className="h-4 w-4" /> Dados da empresa
                    </TabsTrigger>
                    <TabsTrigger value="logo">
                        <ImageIcon className="h-4 w-4" /> Logo
                    </TabsTrigger>
                    <TabsTrigger value="reports">
                        <FileText className="h-4 w-4" /> Relatórios
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="security" className="mt-5">
                    <SecurityTab
                        companyId={companyId}
                        enforce2FAForAll={company.enforce2FAForAll ?? false}
                        settings={security}
                    />
                </TabsContent>

                <TabsContent value="profile" className="mt-5">
                    <ProfileTab
                        companyId={companyId}
                        initial={{
                            name: company.name ?? "",
                            email: company.email ?? "",
                            phone: company.phone ?? "",
                            street: company.street ?? "",
                            number: company.number ?? "",
                            complement: company.complement ?? "",
                            neighborhood: company.neighborhood ?? "",
                            city: company.city ?? "",
                            state: company.state ?? "",
                            zipCode: company.zipCode ?? "",
                        }}
                    />
                </TabsContent>

                <TabsContent value="logo" className="mt-5">
                    <LogoTab companyId={companyId} logoUrl={company.logoUrl} />
                </TabsContent>

                <TabsContent value="reports" className="mt-5">
                    <ReportsTab
                        companyId={companyId}
                        initial={{
                            reportPrimaryColor: company.reportPrimaryColor ?? "#1E40AF",
                            reportSecondaryColor: company.reportSecondaryColor ?? "#DBEAFE",
                            reportHeaderTitle: company.reportHeaderTitle ?? "",
                            reportFooterText: company.reportFooterText ?? "",
                        }}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
