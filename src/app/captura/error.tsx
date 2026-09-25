"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect } from "react";

/** Se algo falhar na página de captura, o cliente vê uma tela amigável em vez da tela branca de erro. */
export default function CaptureError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[captura]", error);
    fetch("/api/public/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "captura", message: error.message, stack: error.stack?.slice(0, 1500), ua: navigator.userAgent }),
    }).catch(() => {});
  }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center bg-[#F4F3F8] p-6 text-center text-[#1C1234]">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_30px_80px_-30px_rgba(28,18,52,0.35)]">
        <img src="/brand/logo-h-color.png" alt="Quark Energia" className="mx-auto h-10 w-auto" />
        <p className="mt-6 font-display text-xl font-semibold">Ops, algo não carregou direito.</p>
        <p className="mt-2 text-sm text-[#6D6985]">Toque em tentar de novo. Se continuar, fale com a gente pelo WhatsApp.</p>
        <button onClick={() => reset()} className="mt-6 h-12 w-full rounded-2xl bg-[#1C1234] font-semibold text-white">
          Tentar de novo
        </button>
        <button onClick={() => window.location.reload()} className="mt-2 h-11 w-full rounded-2xl text-sm font-semibold text-[#4B4766]">
          Recarregar a página
        </button>
        <p className="mt-4 text-[10px] break-all text-[#B7B4C7]">Código: {error.digest || error.message?.slice(0, 120)}</p>
      </div>
    </div>
  );
}
