"use client";

import { Download, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { dateBr } from "@/lib/br";
import { receiptNumber, receiptQrText } from "@/lib/moto-receipt";
import { motoPhoto, vehicleName, warrantyEnd, type MotoData } from "@/lib/moto-sale";

/**
 * Cartão digital da scooter: o mesmo visual do cartão do Google Wallet.
 * Todas as medidas em cqw (relativas à largura), para o cartão ficar igual em
 * qualquer tamanho: na tela e na imagem salva (1012 px).
 */

export function useCardQr(d: MotoData, id: string, company: { name: string; cnpj: string }) {
  const [qr, setQr] = useState("");
  const text = receiptQrText(d, id, company);
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((Q) => Q.toDataURL(text, { margin: 0, width: 360, errorCorrectionLevel: "M", color: { dark: "#0B1A12", light: "#FFFFFF" } }))
      .then((u) => alive && setQr(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text]);
  return qr;
}

export function WalletCardView({ d, id, qr, art }: { d: MotoData; id: string; qr: string; art?: boolean }) {
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const end = d.delivery.date || d.date ? warrantyEnd(d) : "";
  const owner = d.client.name.trim().split(/\s+/).slice(0, 2).join(" ");
  const { number } = receiptNumber(id);
  const photo = d.photo || motoPhoto(d);
  return (
    <div className="w-full [container-type:inline-size]" {...(art ? { "data-art": true } : {})}>
      <div
        className="relative w-full overflow-hidden font-[family-name:var(--font-outfit)] text-white antialiased"
        style={{ aspectRatio: "1.586", borderRadius: "5.5cqw", background: "#0B1A12", boxShadow: art ? "none" : "0 30px 60px -30px rgba(11,26,18,0.75)" }}
      >
        {/* brilho + scooter */}
        <div className="absolute rounded-full" style={{ right: "-14%", top: "-8%", width: "78%", height: "120%", background: "radial-gradient(closest-side, rgba(79,195,138,0.45), rgba(79,195,138,0))" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} data-fallback="/mob/cmp-scooter.webp" alt="" className="absolute object-contain" style={{ right: "4%", top: "13%", width: "50%", height: "46%", filter: "drop-shadow(0 2cqw 2.4cqw rgba(0,0,0,0.55))" }} />
        <div className="absolute inset-x-0 top-0" style={{ height: "1.2cqw", background: "linear-gradient(95deg,#1FA06A,#9FDB7C 60%,#D8E83C)" }} />

        <div className="relative flex h-full flex-col" style={{ padding: "5.5cqw 6cqw" }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center" style={{ gap: "2cqw" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-h-white.png" alt="Quark" style={{ height: "6.2cqw", width: "auto" }} />
              <span className="font-semibold" style={{ fontSize: "4.2cqw", color: "#E4F04A" }}>
                Mobilidade
              </span>
            </span>
            <span className="font-bold tabular-nums" style={{ fontSize: "3cqw", letterSpacing: "0.08em", opacity: 0.65 }}>
              {number}
            </span>
          </div>

          <div style={{ marginTop: "2.6cqw" }}>
            <p className="font-bold uppercase" style={{ fontSize: "2.7cqw", letterSpacing: "0.18em", color: "#E4F04A" }}>
              Scooter elétrica
            </p>
            <p className="truncate font-bold" style={{ fontSize: "7.6cqw", lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: "52%" }}>
              {model}
            </p>
          </div>

          <div className="mt-auto flex items-end justify-between" style={{ gap: "4cqw" }}>
            <div className="grid min-w-0 flex-1 grid-cols-2" style={{ columnGap: "4cqw", rowGap: "1.5cqw" }}>
              {[
                ["Proprietário", owner || "—", true],
                ["Chassi", d.chassis.trim().toUpperCase() || "—", true],
                ["Garantia até", end ? dateBr(end) : "na entrega", false],
                ["Cor · ano", [d.color, d.year].filter(Boolean).join(" · ") || "—", false],
              ].map(([k, v, wide]) => (
                <div key={k as string} className="min-w-0" style={wide ? { gridColumn: "span 2" } : undefined}>
                  <p className="font-bold uppercase" style={{ fontSize: "2.3cqw", letterSpacing: "0.14em", color: "#E4F04A", opacity: 0.85 }}>
                    {k}
                  </p>
                  <p className="truncate font-semibold" style={{ fontSize: "3.6cqw", lineHeight: 1.2 }}>
                    {v}
                  </p>
                </div>
              ))}
            </div>
            <div className="shrink-0 bg-white" style={{ padding: "1.4cqw", borderRadius: "2.4cqw" }}>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR code com os dados da compra" style={{ width: "19cqw", height: "19cqw", display: "block" }} />
              ) : (
                <div style={{ width: "19cqw", height: "19cqw" }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Busy = "google" | "image" | null;

/** Seção "Cartão digital" da área do cliente. */
export function WalletSection({
  d,
  id,
  signed,
  company,
  creds,
  wallet,
}: {
  d: MotoData;
  id: string;
  signed: boolean;
  company: { name: string; cnpj: string };
  creds: { cpf: string; check: string } | null;
  wallet: { google: boolean };
}) {
  const qr = useCardQr(d, id, company);
  const [busy, setBusy] = useState<Busy>(null);
  const [err, setErr] = useState<string | null>(null);
  const google = async () => {
    if (!creds) return;
    setBusy("google");
    setErr(null);
    try {
      const r = await fetch("/api/public/cliente/wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...creds, sale: id, kind: "google" }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!j.url) throw new Error(j.error || "erro");
      window.location.href = j.url;
    } catch (e) {
      setErr(e instanceof Error && e.message !== "erro" ? e.message : "Não foi possível abrir o Google Wallet agora.");
    } finally {
      setBusy(null);
    }
  };

  const image = async () => {
    setBusy("image");
    setErr(null);
    try {
      const { downloadArtPng } = await import("@/components/bf/download-pdf");
      await downloadArtPng(<WalletCardView d={d} id={id} qr={qr} art />, `Cartao-Quark-${(vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter").replace(/\W+/g, "")}.png`, { width: 1012, height: 638 });
    } catch {
      setErr("Não foi possível salvar a imagem agora.");
    } finally {
      setBusy(null);
    }
  };

  const btn = "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60";
  const googleBtn = wallet.google && signed && (
    <button key="g" type="button" onClick={google} disabled={!!busy} className={`${btn} bg-[#1F1F1F] text-white hover:bg-black`}>
      {busy === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Smartphone className="h-5 w-5" />} Salvar no Google Wallet
    </button>
  );

  return (
    <section className="qp-up rounded-[26px] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(16,52,32,0.45),0_1px_2px_rgba(16,52,32,0.05)] ring-1 ring-[#0B1A12]/[0.06] [animation-delay:.12s] sm:p-6">
      <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Cartão digital</p>
      <h2 className="text-[22px] font-bold tracking-[-0.03em]">Sua scooter na carteira do celular</h2>
      <p className="mt-1 text-[13.5px] leading-snug text-[#0B1A12]/60">Modelo, chassi, garantia e um QR code que confirma a compra. Sempre à mão, mesmo sem internet.</p>
      <div className="mx-auto mt-5 max-w-[420px] transition-transform duration-500 hover:-rotate-1">
        <WalletCardView d={d} id={id} qr={qr} />
      </div>
      <div className="mt-5 grid gap-2.5">
        {googleBtn}
        <button type="button" onClick={image} disabled={!!busy} className={`${btn} bg-[#F4F7F1] text-[#0B1A12] ring-1 ring-[#0B1A12]/[0.08] hover:bg-[#EAF6EC]`}>
          {busy === "image" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-[#1F9D55]" />} Salvar o cartão como imagem
        </button>
      </div>
      <div aria-live="polite">{err && <p className="mt-3 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#A12A17]">{err}</p>}</div>
    </section>
  );
}

/** Antes da assinatura: mostra que o cartão existe e o que falta para liberar. */
export function WalletLocked({ token }: { token: string | null }) {
  return (
    <section className="qp-up flex items-center gap-4 rounded-[26px] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(16,52,32,0.45),0_1px_2px_rgba(16,52,32,0.05)] ring-1 ring-[#0B1A12]/[0.06] [animation-delay:.12s]">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0B1A12] text-[#E4F04A]">
        <Smartphone className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold">Cartão digital da scooter</p>
        <p className="text-[13.5px] leading-snug text-[#0B1A12]/60">Para o Google Wallet. Libera assim que você assinar o contrato.</p>
      </div>
      {token && (
        <a href={`/assinar/${token}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-[#0B1A12] px-4 py-2.5 text-[13.5px] font-bold text-white">
          Assinar
        </a>
      )}
    </section>
  );
}
