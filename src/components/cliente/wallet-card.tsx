"use client";

import { Camera, FileDown, ImageDown, Loader2, Printer, Smartphone } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { receiptQrText } from "@/lib/moto-receipt";
import { vehicleName, type MotoData } from "@/lib/moto-sale";
import { BOTH_SIZE, OwnerCardBack, OwnerCardBoth, OwnerCardFront, OwnerCardPdfPage } from "./owner-card";

/**
 * Cartão do proprietário na área do cliente: frente e verso, foto 3/4, PDF,
 * imagem e Google Wallet.
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

type Busy = "google" | "image" | "pdf" | null;

/** Recorta a foto em 3:4 (centralizada no rosto) e reduz para caber leve no cartão. */
async function toPortrait(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const W = 600, H = 800;
    const scale = Math.max(W / img.width, H / img.height);
    const w = img.width * scale, h = img.height * scale;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d")!.drawImage(img, (W - w) / 2, Math.min(0, (H - h) * 0.35), w, h);
    return c.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Seção "Cartão do proprietário" da área do cliente. */
export function WalletSection({
  d,
  id,
  signed,
  company,
  creds,
  wallet,
  selfie,
  contact,
}: {
  d: MotoData;
  id: string;
  signed: boolean;
  company: { name: string; cnpj: string };
  creds: { cpf: string; check: string } | null;
  wallet: { google: boolean };
  selfie: string | null;
  contact: string;
}) {
  const qr = useCardQr(d, id, company);
  const [busy, setBusy] = useState<Busy>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(selfie);
  const [photoState, setPhotoState] = useState<"idle" | "saving" | "saved" | "local">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const model = (vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter").replace(/\W+/g, "");

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
      await downloadArtPng(<OwnerCardBoth d={d} id={id} photo={photo} qr={qr} contact={contact} />, `Cartao-proprietario-${model}.png`, BOTH_SIZE);
    } catch {
      setErr("Não foi possível salvar a imagem agora.");
    } finally {
      setBusy(null);
    }
  };

  const pdf = async () => {
    setBusy("pdf");
    setErr(null);
    try {
      const { downloadPagesPdf } = await import("@/components/bf/download-pdf");
      await downloadPagesPdf(<OwnerCardPdfPage d={d} id={id} photo={photo} qr={qr} contact={contact} />, `Cartao-proprietario-${model}.pdf`, { background: "#F5F6F1" });
    } catch {
      setErr("Não foi possível gerar o PDF agora.");
    } finally {
      setBusy(null);
    }
  };

  /** Troca a foto e salva na ficha (fica guardada para os próximos acessos). */
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    let p: string;
    try {
      p = await toPortrait(f);
    } catch {
      return setErr("Não consegui abrir essa foto. Tente outra.");
    }
    setPhoto(p);
    if (!creds) return setPhotoState("local");
    setPhotoState("saving");
    try {
      const r = await fetch("/api/public/cliente/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...creds, photo: p }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean };
      setPhotoState(j.ok ? "saved" : "local");
      if (!j.ok) setErr("A foto aparece no cartão agora, mas não foi possível guardá-la. Tente de novo em instantes.");
    } catch {
      setPhotoState("local");
      setErr("Sem conexão: a foto aparece no cartão agora, mas não foi guardada.");
    }
  };

  const btn = "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60";
  const spin = (k: Busy, icon: ReactNode) => (busy === k ? <Loader2 className="h-5 w-5 animate-spin" /> : icon);

  return (
    <section className="qp-up rounded-[26px] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(16,52,32,0.45),0_1px_2px_rgba(16,52,32,0.05)] ring-1 ring-[#0B1A12]/[0.06] [animation-delay:.12s] sm:p-6">
      <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Cartão do proprietário</p>
      <h2 className="text-[22px] font-bold tracking-[-0.03em]">Sua identificação da scooter</h2>
      <p className="mt-1 text-[13.5px] leading-snug text-[#0B1A12]/60">Com a sua foto, os dados da scooter e um QR code que confirma a compra. Salve em PDF ou imagem e tenha sempre à mão.</p>

      <div className="mx-auto mt-5 grid max-w-[440px] gap-3">
        <OwnerCardFront d={d} id={id} photo={photo} />
        <OwnerCardBack d={d} id={id} qr={qr} contact={contact} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[13px]">
        <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold text-[#1F9D55] hover:bg-[#EAF6EC]">
          <Camera className="h-4 w-4" /> {photo ? "Trocar a foto" : "Adicionar foto"}
        </button>
        {photoState === "saving" && (
          <span className="inline-flex items-center gap-1.5 text-[#0B1A12]/55">
            <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
          </span>
        )}
        {photoState === "saved" && <span className="font-semibold text-[#1F9D55]">✓ Foto salva</span>}
      </div>
      <p className="text-center text-[11.5px] text-[#0B1A12]/45">{photo ? "A foto fica guardada no seu cadastro." : "Tire uma foto de rosto, de frente, com fundo claro."}</p>

      <div className="mt-4 grid gap-2.5">
        {wallet.google && signed && (
          <button type="button" onClick={google} disabled={!!busy} className={`${btn} bg-[#1F1F1F] text-white hover:bg-black`}>
            {spin("google", <Smartphone className="h-5 w-5" />)} Adicionar ao Google Wallet
          </button>
        )}
        <div className="grid grid-cols-3 gap-2.5">
          <button type="button" onClick={() => window.print()} disabled={!!busy} className={`${btn} bg-[#F4F7F1] text-[#0B1A12] ring-1 ring-[#0B1A12]/[0.08] hover:bg-[#EAF6EC]`}>
            <Printer className="h-5 w-5 text-[#1F9D55]" /> Imprimir
          </button>
          <button type="button" onClick={pdf} disabled={!!busy} className={`${btn} bg-[#0B1A12] text-white hover:bg-[#13291c]`}>
            {spin("pdf", <FileDown className="h-5 w-5" />)} PDF
          </button>
          <button type="button" onClick={image} disabled={!!busy} className={`${btn} bg-[#F4F7F1] text-[#0B1A12] ring-1 ring-[#0B1A12]/[0.08] hover:bg-[#EAF6EC]`}>
            {spin("image", <ImageDown className="h-5 w-5 text-[#1F9D55]" />)} Imagem
          </button>
        </div>
      </div>
      <div aria-live="polite">{err && <p className="mt-3 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#A12A17]">{err}</p>}</div>

      {/* Impressão: frente e verso no tamanho real de cartão (85,6 × 54 mm), para recortar. */}
      <div data-print-card aria-hidden className="hidden">
        <p className="qp-print-title">Cartão do proprietário · recorte na linha e plastifique</p>
        <div className="qp-print-row">
          <div className="qp-print-card">
            <OwnerCardFront d={d} id={id} photo={photo} flat />
          </div>
          <div className="qp-print-card">
            <OwnerCardBack d={d} id={id} qr={qr} contact={contact} flat />
          </div>
        </div>
      </div>
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

/** Regras de impressão do cartão (só o cartão sai no papel). */
export const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm; }
  body * { visibility: hidden !important; }
  [data-print-card], [data-print-card] * { visibility: visible !important; }
  [data-print-card] { display: block !important; position: absolute; left: 0; top: 0; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .qp-print-title { font: 600 10pt system-ui, sans-serif; color: #444; margin: 0 0 6mm; }
  .qp-print-row { display: flex; gap: 8mm; flex-wrap: wrap; }
  .qp-print-card { width: 85.6mm; outline: 0.2mm dashed #888; outline-offset: 1.5mm; border-radius: 3mm; }
}
`;
