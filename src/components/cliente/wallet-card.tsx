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

const INTER = "var(--font-inter), 'Inter', system-ui, sans-serif";

export function WalletCardView({ d, id, qr, art }: { d: MotoData; id: string; qr: string; art?: boolean }) {
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const end = d.delivery.date || d.date ? warrantyEnd(d) : "";
  const owner = d.client.name.trim().split(/\s+/).slice(0, 2).join(" ");
  const { number } = receiptNumber(id);
  const photo = d.photo || motoPhoto(d);
  const label = { fontSize: "2.05cqw", letterSpacing: "0.22em", color: "#D9E86A", opacity: 0.8, fontWeight: 600 } as const;
  return (
    <div className="w-full [container-type:inline-size]" {...(art ? { "data-art": true } : {})}>
      <div
        className="relative w-full overflow-hidden text-white antialiased"
        style={{
          aspectRatio: "1.586",
          borderRadius: "4.6cqw",
          fontFamily: INTER,
          background: "linear-gradient(135deg, #06100A 0%, #0B1E14 55%, #133525 100%)",
          boxShadow: art ? "none" : "0 40px 70px -34px rgba(6,16,10,0.85), inset 0 0 0 1px rgba(255,255,255,0.07)",
        }}
      >
        {/* luz sobre a scooter, reflexo diagonal e sombra no chão */}
        <div className="absolute" style={{ right: "-12%", top: "-6%", width: "74%", height: "112%", background: "radial-gradient(closest-side, rgba(63,191,127,0.42), rgba(63,191,127,0))" }} />
        <div className="absolute inset-y-0" style={{ left: "34%", width: "22%", transform: "skewX(-24deg)", background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.05), rgba(255,255,255,0))" }} />
        <div className="absolute rounded-[50%]" style={{ right: "6%", top: "54%", width: "46%", height: "6%", background: "radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0))" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} data-fallback="/mob/cmp-scooter.webp" alt="" className="absolute object-contain" style={{ right: "5%", top: "9%", width: "50%", height: "50%", filter: "drop-shadow(0 1.6cqw 2cqw rgba(0,0,0,0.5))" }} />
        <div className="absolute inset-x-0 bottom-0" style={{ height: "0.4cqw", background: "linear-gradient(90deg, rgba(201,168,74,0), #E8D48A 30%, #9FDB7C 70%, rgba(159,219,124,0))" }} />

        <div className="relative flex h-full flex-col" style={{ padding: "6cqw 6.4cqw 5.4cqw" }}>
          <div className="flex items-start justify-between">
            <div>
              <p style={{ fontSize: "2.3cqw", letterSpacing: "0.34em", color: "#D9E86A", fontWeight: 600 }}>QUARK MOBILIDADE</p>
              <div style={{ width: "8cqw", height: "0.18cqw", background: "rgba(217,232,106,0.6)", margin: "1.6cqw 0 1.2cqw" }} />
              <p className="truncate" style={{ fontSize: model.length > 8 ? "7.4cqw" : "9.4cqw", lineHeight: 1, letterSpacing: "-0.035em", fontWeight: 300, maxWidth: "48cqw" }}>
                {model}
              </p>
              <p style={{ marginTop: "1.4cqw", fontSize: "1.9cqw", letterSpacing: "0.26em", opacity: 0.55, fontWeight: 500 }}>SCOOTER ELÉTRICA{d.color ? ` · ${d.color.toUpperCase()}` : ""}</p>
            </div>
            <span className="tabular-nums" style={{ fontSize: "2cqw", letterSpacing: "0.14em", opacity: 0.5, fontWeight: 500 }}>
              {number}
            </span>
          </div>

          <div className="mt-auto flex items-end justify-between" style={{ gap: "4cqw" }}>
            <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: "1.35fr 0.75fr", columnGap: "3.4cqw", rowGap: "2.6cqw" }}>
              {[
                ["PROPRIETÁRIO", owner || "—"],
                ["GARANTIA ATÉ", end ? dateBr(end) : "na entrega"],
                ["CHASSI", d.chassis.trim().toUpperCase() || "—"],
                ["ANO", d.year ? String(d.year) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <p style={label}>{k}</p>
                  <p className="truncate" style={{ marginTop: "0.6cqw", fontSize: k === "CHASSI" ? "3cqw" : "3.3cqw", lineHeight: 1.15, fontWeight: 500, letterSpacing: k === "CHASSI" ? "0.03em" : "-0.01em" }}>
                    {v}
                  </p>
                </div>
              ))}
            </div>
            <div className="shrink-0 bg-white" style={{ padding: "1.3cqw", borderRadius: "2.2cqw", boxShadow: "0 1cqw 3cqw rgba(0,0,0,0.35)" }}>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR code com os dados da compra" style={{ width: "17cqw", height: "17cqw", display: "block" }} />
              ) : (
                <div style={{ width: "17cqw", height: "17cqw" }} />
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
      {busy === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Smartphone className="h-5 w-5" />} Adicionar ao Google Wallet
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
