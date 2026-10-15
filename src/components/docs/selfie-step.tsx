"use client";

import { Camera, CheckCircle2, Fingerprint, ImagePlus, Loader2, Lock, RefreshCw, ShieldCheck, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Step = "intro" | "camera" | "preview" | "sending" | "done";

const MAX_W = 640;

/** Reduz a imagem e exporta JPEG (selfie leve: ~60–120 KB). */
function toJpeg(source: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, MAX_W / w);
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.78);
}

/**
 * Selfie de segurança logo depois da assinatura: confirma que foi o próprio
 * cliente que assinou. Câmera frontal com guia do rosto; se a câmera não abrir,
 * o cliente envia uma foto pelo seletor do celular.
 */
export function SelfieStep({ token, first, onClose, onSent }: { token: string; first: string; onClose: () => void; onSent: () => void }) {
  const [step, setStep] = useState<Step>("intro");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [noCamera, setNoCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      stop();
    };
  }, [stop]);

  const openCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setNoCamera(true);
      fileRef.current?.click();
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      setStep("camera");
      requestAnimationFrame(() => {
        if (video.current && stream.current) {
          video.current.srcObject = stream.current;
          video.current.play().catch(() => {});
        }
      });
    } catch {
      setNoCamera(true);
      setError("Não conseguimos abrir a câmera. Libere o acesso nas permissões do navegador ou envie uma foto do seu rosto.");
    }
  };

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setPhoto(toJpeg(v, v.videoWidth, v.videoHeight));
    stop();
    setStep("preview");
  };

  const fromFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto(toJpeg(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(url);
      setStep("preview");
    };
    img.onerror = () => setError("Não foi possível ler essa imagem. Tente outra foto.");
    img.src = url;
  };

  const send = async () => {
    if (!photo) return;
    setStep("sending");
    setError("");
    const res = await fetch(`/api/public/document/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "selfie", selfie: photo }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && json.ok) {
      setStep("done");
      onSent();
      return;
    }
    if (json.error === "ja_enviada") {
      setStep("done");
      onSent();
      return;
    }
    setError("Não foi possível enviar a selfie. Verifique sua internet e tente de novo.");
    setStep("preview");
  };

  const retake = () => {
    setPhoto(null);
    if (noCamera) fileRef.current?.click();
    else openCamera();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 print:hidden" role="dialog" aria-modal="true" aria-label="Selfie de segurança">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
      <div className="animate-sheet-up relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-white shadow-lift sm:rounded-[30px]">
        <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />

        {/* topo da marca */}
        <div className="relative overflow-hidden bg-[#1C1234] px-6 pt-6 pb-5 text-white">
          <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-[#F3EA3B]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-[#6CC690]/25 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em] text-[#C9E97A] uppercase">
                <ShieldCheck className="h-3.5 w-3.5" /> Etapa de segurança
              </p>
              <h2 className="mt-1.5 font-display text-[22px] leading-tight font-semibold">{step === "done" ? "Selfie registrada!" : "Agora, uma selfie rápida"}</h2>
            </div>
            {step !== "sending" && (
              <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 hover:text-white" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] transition-all duration-500"
              style={{ width: step === "intro" ? "25%" : step === "camera" ? "50%" : step === "done" ? "100%" : "80%" }}
            />
          </div>
        </div>

        <div className="px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {step === "intro" && (
            <>
              <p className="text-[15px] leading-relaxed text-ink-700">
                {first}, sua assinatura já foi registrada. <b className="text-ink-900">Para a sua própria segurança</b>, tire uma selfie: ela comprova que foi você mesmo quem assinou e
                protege seus dados contra fraudes e uso indevido.
              </p>
              <ul className="mt-4 grid gap-2.5">
                {[
                  { icon: <UserCheck className="h-4 w-4" />, t: "Confirma que a assinatura é sua", s: "Ninguém consegue assinar em seu nome" },
                  { icon: <Fingerprint className="h-4 w-4" />, t: "Protege você contra fraudes", s: "Fica junto ao registro de data, hora e IP" },
                  { icon: <Lock className="h-4 w-4" />, t: "Guardada com sigilo", s: "Usada só para comprovar a autoria, nunca divulgada" },
                ].map((x) => (
                  <li key={x.t} className="flex items-start gap-3 rounded-2xl bg-[#F6F5FA] p-3 ring-1 ring-ink-200/60">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1C1234] text-[#F3EA3B]">{x.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-900">{x.t}</span>
                      <span className="block text-xs text-ink-500">{x.s}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {error && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 ring-1 ring-amber-200">{error}</p>}
              <button
                onClick={noCamera ? () => fileRef.current?.click() : openCamera}
                className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#1C1234] py-3.5 text-[15px] font-semibold text-white shadow-lift transition active:scale-[0.98]"
              >
                {noCamera ? <ImagePlus className="h-5 w-5 text-[#F3EA3B]" /> : <Camera className="h-5 w-5 text-[#F3EA3B]" />}
                {noCamera ? "Enviar foto do rosto" : "Tirar selfie"}
              </button>
              {!noCamera && (
                <button onClick={() => fileRef.current?.click()} className="mt-2 w-full py-2 text-center text-[13px] font-semibold text-ink-500 hover:text-ink-800">
                  Prefiro escolher uma foto
                </button>
              )}
              <p className="mt-2 text-center text-[11px] text-ink-400">Leva 5 segundos · rosto visível, sem óculos escuros ou boné</p>
            </>
          )}

          {step === "camera" && (
            <>
              <div className="relative mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-[28px] bg-ink-950">
                <video ref={video} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" />
                {/* guia do rosto */}
                <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <mask id="selfie-hole">
                      <rect width="300" height="400" fill="white" />
                      <ellipse cx="150" cy="180" rx="98" ry="128" fill="black" />
                    </mask>
                  </defs>
                  <rect width="300" height="400" fill="rgba(12,8,24,0.55)" mask="url(#selfie-hole)" />
                  <ellipse cx="150" cy="180" rx="98" ry="128" fill="none" stroke="#F3EA3B" strokeWidth="3" strokeDasharray="10 8" className="lp-flow" />
                </svg>
                <p className="absolute inset-x-0 bottom-4 text-center text-[13px] font-semibold text-white drop-shadow">Encaixe o rosto no contorno</p>
              </div>
              <div className="mt-5 flex items-center justify-center">
                <button onClick={shoot} aria-label="Tirar foto" className="grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#6CC690] p-1 shadow-lift transition active:scale-95">
                  <span className="grid h-full w-full place-items-center rounded-full border-4 border-white bg-[#1C1234]">
                    <Camera className="h-6 w-6 text-white" />
                  </span>
                </button>
              </div>
            </>
          )}

          {(step === "preview" || step === "sending") && photo && (
            <>
              <div className="relative mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-[28px] ring-4 ring-[#9BD373]/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Sua selfie" className="h-full w-full object-cover" />
              </div>
              <p className="mt-3 text-center text-sm text-ink-600">O rosto está nítido e bem iluminado?</p>
              {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <button onClick={retake} disabled={step === "sending"} className="flex h-12 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold text-ink-600 ring-1 ring-ink-200 disabled:opacity-40">
                  <RefreshCw className="h-4 w-4" /> Outra
                </button>
                <button
                  onClick={send}
                  disabled={step === "sending"}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1C1234] text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {step === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5 text-[#F3EA3B]" />}
                  {step === "sending" ? "Enviando com segurança…" : "Usar esta foto"}
                </button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="py-4 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-700">Pronto, {first}! Sua assinatura está protegida e vinculada a você.</p>
              <button onClick={onClose} className="mt-5 h-12 w-full rounded-2xl bg-[#1C1234] text-[15px] font-semibold text-white">
                Ver meu documento
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
