"use client";

import React from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LaudoSignatureConfig, LaudoSignerType, SignatureSignerConfig } from "@/services/laudo-templates/laudo-templates.types";
import { SIGNER_TYPE_LABELS } from "@/services/laudo-templates/laudo-templates.types";
import { cn } from "@/lib/utils";

const SIGNER_TYPES: LaudoSignerType[] = [
  "ASSUMED_TECHNICIAN",
  "CREATED_BY",
  "CLIENT_ADMIN",
  "COMPANY_ADMIN",
  "SPECIFIC_USER",
];

interface SignatureConfigSectionProps {
  value: LaudoSignatureConfig | null | undefined;
  onChange: (config: LaudoSignatureConfig | null) => void;
  disabled?: boolean;
}

const defaultConfig = (): LaudoSignatureConfig => ({
  requireSignature: true,
  requireSigningOrder: false,
  signers: [{ type: "ASSUMED_TECHNICIAN", signerRole: "Técnico Responsável", signingOrder: 0 }],
});

export function SignatureConfigSection({ value, onChange, disabled }: SignatureConfigSectionProps) {
  const enabled = !!value?.requireSignature;

  function toggle(checked: boolean) {
    onChange(checked ? (value ?? defaultConfig()) : null);
  }

  function updateConfig(partial: Partial<LaudoSignatureConfig>) {
    if (!value) return;
    onChange({ ...value, ...partial });
  }

  function addSigner() {
    if (!value) return;
    const next: SignatureSignerConfig = {
      type: "ASSUMED_TECHNICIAN",
      signerRole: "",
      signingOrder: value.signers.length,
    };
    updateConfig({ signers: [...value.signers, next] });
  }

  function removeSigner(i: number) {
    if (!value) return;
    updateConfig({ signers: value.signers.filter((_, idx) => idx !== i) });
  }

  function updateSigner(i: number, patch: Partial<SignatureSignerConfig>) {
    if (!value) return;
    const signers = value.signers.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    updateConfig({ signers });
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-violet-500 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Assinatura eletrônica
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          disabled={disabled}
          id="require-signature"
        />
      </div>

      {enabled && value && (
        <div className="p-4 space-y-4">
          {/* Global options */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="require-signing-order"
                checked={value.requireSigningOrder}
                onCheckedChange={(v) => updateConfig({ requireSigningOrder: v })}
                disabled={disabled}
              />
              <Label htmlFor="require-signing-order" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                Ordem de assinatura obrigatória
              </Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Validade (dias)</Label>
              <Input
                type="number"
                min={1}
                placeholder="Ex: 30"
                className="h-8 text-xs"
                disabled={disabled}
                value={value.expiresInDays ?? ""}
                onChange={(e) =>
                  updateConfig({ expiresInDays: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Mensagem personalizada (opcional)</Label>
            <Textarea
              placeholder="Mensagem enviada aos signatários no e-mail de convite..."
              className="resize-none text-xs h-16"
              disabled={disabled}
              value={value.customMessage ?? ""}
              onChange={(e) => updateConfig({ customMessage: e.target.value || undefined })}
            />
          </div>

          {/* Signatários */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-500">
                Signatários{" "}
                <span className="text-slate-400 font-normal">({value.signers.length})</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addSigner}
                disabled={disabled}
              >
                <Plus className="w-3 h-3" />
                Adicionar
              </Button>
            </div>

            {value.signers.length === 0 && (
              <p className="text-xs text-slate-400 italic py-2 text-center">
                Nenhum signatário configurado
              </p>
            )}

            <div className="space-y-2">
              {value.signers.map((signer, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50"
                >
                  {/* Type */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Quem assina</Label>
                    <Select
                      value={signer.type}
                      onValueChange={(v) => updateSigner(i, { type: v as LaudoSignerType })}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIGNER_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {SIGNER_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role label */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Papel no certificado</Label>
                    <Input
                      placeholder="Ex: Técnico Responsável"
                      className="h-8 text-xs"
                      disabled={disabled}
                      value={signer.signerRole}
                      onChange={(e) => updateSigner(i, { signerRole: e.target.value })}
                    />
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeSigner(i)}
                    disabled={disabled}
                    className={cn(
                      "p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors mb-0.5",
                      disabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
