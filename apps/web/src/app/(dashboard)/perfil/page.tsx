"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Camera,
    Loader2,
    User,
    Phone,
    MessageCircle,
    Lock,
    Eye,
    EyeOff,
    Shield,
} from "lucide-react";

import { useCurrentUser } from "@/store/auth.store";
import { useUpdateProfile, useUploadAvatar, useChangePassword } from "@/hooks/users/use-users";
import { displayRole } from "@/types/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const profileSchema = z.object({
    name: z.string().min(1, "Nome obrigatório"),
    phone: z.string().optional(),
    telegramChatId: z.string().optional(),
});

const passwordSchema = z
    .object({
        currentPassword: z.string().min(1, "Informe a senha atual"),
        newPassword: z.string().min(6, "Mínimo 6 caracteres"),
        confirm: z.string().min(1, "Confirme a nova senha"),
    })
    .refine((d) => d.newPassword === d.confirm, {
        message: "As senhas não coincidem",
        path: ["confirm"],
    });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500",
    "bg-orange-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
];

function getAvatarColor(name: string) {
    const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    ACTIVE:     { label: "Ativo",          className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    INACTIVE:   { label: "Inativo",        className: "bg-slate-100 text-slate-600 border-slate-200" },
    SUSPENDED:  { label: "Suspenso",       className: "bg-orange-50 text-orange-700 border-orange-200" },
    UNVERIFIED: { label: "Não verificado", className: "bg-amber-50 text-amber-700 border-amber-200" },
    BLOCKED:    { label: "Bloqueado",      className: "bg-red-50 text-red-700 border-red-200" },
};

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function PerfilPage() {
    const user = useCurrentUser();
    const updateProfile = useUpdateProfile();
    const uploadAvatar = useUploadAvatar();
    const changePassword = useChangePassword();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const profileForm = useForm<ProfileForm>({
        resolver: zodResolver(profileSchema),
        values: {
            name: user?.name ?? "",
            phone: user?.phone ?? "",
            telegramChatId: user?.telegramChatId ?? "",
        },
    });

    const passwordForm = useForm<PasswordForm>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
    });

    function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Preview local imediato
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
        reader.readAsDataURL(file);

        // Upload
        uploadAvatar.mutate(file, {
            onError: () => setAvatarPreview(null),
        });
    }

    function handleProfileSubmit(data: ProfileForm) {
        updateProfile.mutate({
            name: data.name,
            phone: data.phone || undefined,
            telegramChatId: data.telegramChatId || undefined,
        });
    }

    function handlePasswordSubmit(data: PasswordForm) {
        changePassword.mutate(
            { currentPassword: data.currentPassword, newPassword: data.newPassword },
            { onSuccess: () => passwordForm.reset() },
        );
    }

    if (!user) return null;

    const avatarSrc = avatarPreview ?? user.avatarUrl ?? null;
    const statusConfig = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.ACTIVE;

    return (
        <div className="max-w-2xl mx-auto space-y-8">

            {/* ── Header ── */}
            <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Meu perfil
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                    Gerencie suas informações pessoais e segurança da conta.
                </p>
            </div>

            {/* ── Card: Avatar + identidade ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-5">
                    {/* Avatar */}
                    <div className="relative group flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadAvatar.isPending}
                            className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            title="Alterar foto"
                        >
                            <div className="relative w-20 h-20 rounded-full overflow-hidden">
                                {avatarSrc ? (
                                    <img
                                        src={avatarSrc}
                                        alt={user.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div
                                        className={cn(
                                            "w-full h-full flex items-center justify-center text-white text-2xl font-bold",
                                            getAvatarColor(user.name)
                                        )}
                                    >
                                        {getInitials(user.name)}
                                    </div>
                                )}

                                {/* Overlay hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                    {uploadAvatar.isPending ? (
                                        <Loader2 className="w-5 h-5 text-white animate-spin opacity-0 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </div>
                            </div>
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleAvatarChange}
                        />
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {user.name}
                        </h2>
                        <p className="text-sm text-slate-500 truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                                {displayRole(user)}
                            </Badge>
                            <Badge variant="outline" className={cn("text-xs", statusConfig.className)}>
                                {statusConfig.label}
                            </Badge>
                        </div>
                    </div>
                </div>

                <p className="mt-4 text-xs text-slate-400">
                    Clique na foto para alterar. PNG, JPG ou WEBP • máx. 5 MB
                </p>
            </div>

            {/* ── Card: Informações pessoais ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-2 mb-5">
                    <User className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Informações pessoais
                    </h3>
                </div>

                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="name">Nome completo</Label>
                        <Input
                            id="name"
                            className="mt-1.5"
                            {...profileForm.register("name")}
                        />
                        {profileForm.formState.errors.name && (
                            <p className="mt-1 text-xs text-red-500">
                                {profileForm.formState.errors.name.message}
                            </p>
                        )}
                    </div>

                    {/* E-mail — somente leitura */}
                    <div>
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                            id="email"
                            value={user.email}
                            readOnly
                            disabled
                            className="mt-1.5 bg-slate-50 dark:bg-slate-800 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-slate-400">
                            O e-mail não pode ser alterado por aqui.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="phone">
                                <span className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" />
                                    Telefone
                                </span>
                            </Label>
                            <Input
                                id="phone"
                                placeholder="(00) 90000-0000"
                                className="mt-1.5"
                                {...profileForm.register("phone")}
                            />
                        </div>
                        <div>
                            <Label htmlFor="telegramChatId">
                                <span className="flex items-center gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Telegram Chat ID
                                </span>
                            </Label>
                            <Input
                                id="telegramChatId"
                                placeholder="123456789"
                                className="mt-1.5"
                                {...profileForm.register("telegramChatId")}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={updateProfile.isPending}>
                            {updateProfile.isPending && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Salvar alterações
                        </Button>
                    </div>
                </form>
            </div>

            {/* ── Card: Segurança / senha ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Shield className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Segurança
                    </h3>
                </div>

                <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="currentPassword">
                            <span className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                Senha atual
                            </span>
                        </Label>
                        <div className="relative mt-1.5">
                            <Input
                                id="currentPassword"
                                type={showCurrent ? "text" : "password"}
                                placeholder="Sua senha atual"
                                className="pr-10"
                                {...passwordForm.register("currentPassword")}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                tabIndex={-1}
                            >
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {passwordForm.formState.errors.currentPassword && (
                            <p className="mt-1 text-xs text-red-500">
                                {passwordForm.formState.errors.currentPassword.message}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="newPassword">Nova senha</Label>
                        <div className="relative mt-1.5">
                            <Input
                                id="newPassword"
                                type={showPassword ? "text" : "password"}
                                placeholder="Mínimo 6 caracteres"
                                className="pr-10"
                                {...passwordForm.register("newPassword")}
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
                        {passwordForm.formState.errors.newPassword && (
                            <p className="mt-1 text-xs text-red-500">
                                {passwordForm.formState.errors.newPassword.message}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="confirm">Confirmar nova senha</Label>
                        <div className="relative mt-1.5">
                            <Input
                                id="confirm"
                                type={showConfirm ? "text" : "password"}
                                placeholder="Repita a senha"
                                className="pr-10"
                                {...passwordForm.register("confirm")}
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
                        {passwordForm.formState.errors.confirm && (
                            <p className="mt-1 text-xs text-red-500">
                                {passwordForm.formState.errors.confirm.message}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" variant="outline" disabled={changePassword.isPending}>
                            {changePassword.isPending && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Alterar senha
                        </Button>
                    </div>
                </form>
            </div>

        </div>
    );
}
