"use client";

import { useState, useEffect } from "react";
import { Search, X, Monitor, ShieldCheck, MapPin, Tag, ArrowRight, Loader2, Command } from "lucide-react";
import { useEquipment } from "@/hooks/equipment/use-equipment";
import type { Equipment } from "@/services/equipment/equipment.service";

interface EquipmentSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectEquipment: (equipment: Equipment) => void;
}

export function EquipmentSearchModal({
  open,
  onClose,
  onSelectEquipment,
}: EquipmentSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const trimmed = searchTerm.trim();
  const isPatrimonyNumber = /^\d+$/.test(trimmed);

  const { data, isLoading } = useEquipment({
    search: trimmed && !isPatrimonyNumber ? trimmed : undefined,
    patrimonyNumber: trimmed && isPatrimonyNumber ? trimmed : undefined,
    limit: 20,
  });

  const equipments: Equipment[] = data?.data ?? [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh] z-10 animate-in zoom-in-95 duration-150">
        {/* Header / Input */}
        <div className="p-4 border-b border-border flex items-center gap-3 bg-muted/30">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            autoFocus
            className="flex-1 bg-transparent text-base font-medium placeholder:text-muted-foreground focus:outline-none text-foreground"
            placeholder="Buscar por nome do equipamento ou patrimônio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold text-muted-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-md flex items-center gap-1"
          >
            ESC
          </button>
        </div>

        {/* Hints */}
        <div className="px-4 py-2 bg-muted/20 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Digite o <strong>nome</strong> do equipamento ou o <strong>número de patrimônio</strong>.</span>
          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground/70">
            <Command className="w-3 h-3" /> + K para fechar
          </span>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Buscando equipamentos...</p>
            </div>
          ) : equipments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Monitor className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium text-foreground">Nenhum equipamento encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tente digitar um termo diferente ou verificar o número do patrimônio.
              </p>
            </div>
          ) : (
            equipments.map((eq) => (
              <div
                key={eq.id}
                onClick={() => {
                  onSelectEquipment(eq);
                  onClose();
                }}
                className="group flex items-center justify-between p-3.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {eq.name}
                      </p>
                      {eq.patrimonyNumber && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          Pat. {eq.patrimonyNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      {(eq.brand || eq.model) && (
                        <span>
                          {[eq.brand, eq.model].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {eq.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {eq.location.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {eq._count?.maintenances ? (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-3 h-3" />
                      {eq._count.maintenances} prev.
                    </span>
                  ) : null}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
