"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, PenLine, Type, MousePointerClick, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

type SignMode = "DRAWN" | "TYPED" | "CLICK";

interface SigningRequest {
  id: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  status: string;
  document: {
    id: string;
    title: string;
    originalFileUrl: string;
    requireSigningOrder: boolean;
    company: { id: string; name: string; logoUrl?: string | null };
  };
}

// ─── Canvas signature pad ─────────────────────────────────────────────────────

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const { x, y } = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!drawing.current) return;
      const { x, y } = getPos(e, canvas);
      ctx.lineTo(x, y);
      ctx.stroke();
      hasStrokes.current = true;
    };
    const end = () => {
      drawing.current = false;
      if (hasStrokes.current) onChange(canvas.toDataURL());
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, [onChange]);

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={560}
          height={180}
          className="w-full touch-none cursor-crosshair"
          style={{ maxHeight: 180 }}
        />
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-300 pointer-events-none select-none">
          Assine aqui
        </p>
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Trash2 className="w-3 h-3" /> Limpar
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssinarPage() {
  const { token } = useParams<{ token: string }>();

  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [declined, setDeclined] = useState(false);

  const [mode, setMode] = useState<SignMode>("DRAWN");
  const [drawnData, setDrawnData] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API}/sign/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Link inválido ou expirado");
        }
        return r.json();
      })
      .then((res) => setRequest(res.data ?? res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const signatureData = mode === "DRAWN"
    ? drawnData
    : mode === "TYPED"
    ? typedName.trim() || null
    : "CLICK_TO_SIGN";

  const canSign = !!signatureData;

  async function handleSign() {
    if (!canSign) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/sign/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData, signatureType: mode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Erro ao assinar");
      }
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason || "Recusado pelo signatário" }),
      });
      if (!res.ok) throw new Error("Erro ao recusar");
      setDeclined(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Link inválido</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  // ── Signed ──
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Documento assinado!</h1>
          <p className="text-sm text-slate-500">
            Sua assinatura foi registrada com sucesso. Você pode fechar esta janela.
          </p>
        </div>
      </div>
    );
  }

  // ── Declined ──
  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Assinatura recusada</h1>
          <p className="text-sm text-slate-500">Você recusou assinar este documento.</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const doc = request.document;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Assinatura eletrônica solicitada por</p>
            <p className="text-sm font-semibold text-slate-800 truncate">{doc.company.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Document info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 leading-snug">{doc.title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Você foi convidado como <strong className="text-slate-600">{request.signerRole}</strong>
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-400">Signatário</p>
              <p className="font-medium text-slate-700 mt-0.5">{request.signerName}</p>
            </div>
            <div>
              <p className="text-slate-400">E-mail</p>
              <p className="font-medium text-slate-700 mt-0.5 truncate">{request.signerEmail}</p>
            </div>
          </div>
        </div>

        {/* PDF preview */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <p className="text-xs font-medium text-slate-500 px-4 py-2 border-b border-slate-100">
            Documento para assinar
          </p>
          <iframe
            src={`${API}/sign/${token}/document`}
            className="w-full"
            style={{ height: 480 }}
            title="Documento"
          />
        </div>

        {/* Signature section */}
        {!showDecline ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Sua assinatura</h2>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {([
                { id: "DRAWN", icon: PenLine, label: "Desenhar" },
                { id: "TYPED", icon: Type, label: "Digitar" },
                { id: "CLICK", icon: MousePointerClick, label: "Confirmar" },
              ] as { id: SignMode; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    mode === id
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Mode content */}
            {mode === "DRAWN" && (
              <SignaturePad onChange={setDrawnData} />
            )}

            {mode === "TYPED" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Digite seu nome completo</Label>
                <Input
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={request.signerName}
                  className="text-lg font-serif h-14 text-center tracking-wide"
                />
                {typedName && (
                  <p
                    className="text-center text-2xl text-slate-700 py-2"
                    style={{ fontFamily: "cursive" }}
                  >
                    {typedName}
                  </p>
                )}
              </div>
            )}

            {mode === "CLICK" && (
              <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 text-center space-y-2">
                <MousePointerClick className="w-8 h-8 text-blue-400 mx-auto" />
                <p className="text-sm text-slate-600">
                  Ao clicar em <strong>Assinar documento</strong>, você confirma que leu e concorda com o conteúdo deste documento.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleSign}
                disabled={!canSign || submitting}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white h-11"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Assinar documento
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDecline(true)}
                disabled={submitting}
                className="h-11 text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
              >
                Recusar
              </Button>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Sua assinatura tem validade jurídica conforme a MP 2.200-2/2001.
            </p>
          </div>
        ) : (
          /* Decline form */
          <div className="bg-white rounded-2xl border border-rose-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-rose-700">Recusar assinatura</h2>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Motivo (opcional)</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Informe o motivo da recusa..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDecline(false)}
                disabled={submitting}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handleDecline}
                disabled={submitting}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmar recusa
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
