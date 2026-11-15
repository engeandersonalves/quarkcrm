"use client";

import { UserRound } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PDF_PAGE_H, PDF_PAGE_W } from "@/components/bf/proposal-pdf";
import { dateBr, formatDoc, maskDoc } from "@/lib/br";
import { receiptNumber } from "@/lib/moto-receipt";
import { motoPhoto, vehicleName, warrantyEnd, type MotoData } from "@/lib/moto-sale";

/**
 * Cartão do proprietário (frente e verso), no estilo de documento de identificação:
 * foto 3/4, dados organizados e QR code de conferência no verso. Medidas em cqw
 * (relativas à largura): o cartão fica igual na tela, na imagem e no PDF.
 */

const INTER = "var(--font-inter), 'Inter', system-ui, sans-serif";
const INK = "#0B1A12";
const IVORY = "#FAF9F4";
const GOLD = "#D8C27A";

/** Linhas finas de segurança, como em documentos impressos. */
const GUILLOCHE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='380' viewBox='0 0 600 380'><g fill='none' stroke='#1F9D55' stroke-opacity='0.07' stroke-width='1'>${Array.from({ length: 16 }, (_, i) => `<circle cx='520' cy='300' r='${40 + i * 18}'/>`).join("")}${Array.from({ length: 9 }, (_, i) => `<path d='M0 ${250 + i * 14} C 150 ${210 + i * 14}, 300 ${290 + i * 14}, 600 ${240 + i * 14}'/>`).join("")}</g></svg>`,
)}")`;

function Face({ children, art, flat }: { children: ReactNode; art?: boolean; flat?: boolean }) {
  return (
    <div className="w-full [container-type:inline-size]" {...(art ? { "data-art": true } : {})}>
      <div
        className="relative w-full overflow-hidden antialiased"
        style={{
          aspectRatio: "1.586",
          borderRadius: "3.6cqw",
          fontFamily: INTER,
          color: INK,
          background: `${GUILLOCHE} center / cover no-repeat, linear-gradient(160deg, #FFFFFF 0%, ${IVORY} 60%, #F1F4EC 100%)`,
          boxShadow: art || flat ? "inset 0 0 0 1px rgba(11,26,18,0.08)" : "0 30px 60px -32px rgba(11,26,18,0.45), inset 0 0 0 1px rgba(11,26,18,0.08)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Band({ right }: { right: string }) {
  return (
    <>
      <div className="flex items-center justify-between" style={{ height: "13cqw", padding: "0 5.2cqw", background: "linear-gradient(110deg, #06100A 0%, #0B1E14 55%, #143726 100%)" }}>
        <div className="flex items-center" style={{ gap: "2cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/symbol.png" alt="" style={{ height: "6.4cqw", width: "auto" }} />
          <div>
            <p style={{ fontSize: "2.5cqw", fontWeight: 600, letterSpacing: "0.3em", color: GOLD, lineHeight: 1.1 }}>QUARK</p>
            <p style={{ fontSize: "1.7cqw", fontWeight: 500, letterSpacing: "0.34em", color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>MOBILIDADE</p>
          </div>
        </div>
        <p style={{ fontSize: "1.8cqw", fontWeight: 500, letterSpacing: "0.24em", color: "rgba(255,255,255,0.72)" }}>{right}</p>
      </div>
      <div style={{ height: "0.35cqw", background: `linear-gradient(90deg, rgba(216,194,122,0) 0%, ${GOLD} 25%, #9FDB7C 75%, rgba(159,219,124,0) 100%)` }} />
    </>
  );
}

const LABEL: CSSProperties = { fontSize: "1.65cqw", fontWeight: 600, letterSpacing: "0.16em", color: "#6B7A70", textTransform: "uppercase" };
const VALUE: CSSProperties = { fontSize: "2.85cqw", fontWeight: 500, lineHeight: 1.2, marginTop: "0.5cqw", letterSpacing: "-0.005em" };

function Item({ k, v, wide, mono }: { k: string; v: string; wide?: boolean; mono?: boolean }) {
  return (
    <div className="min-w-0" style={wide ? { gridColumn: "span 2" } : undefined}>
      <p style={LABEL}>{k}</p>
      <p className="truncate" style={{ ...VALUE, ...(mono ? { letterSpacing: "0.04em", fontSize: "2.7cqw" } : {}) }}>
        {v || "—"}
      </p>
    </div>
  );
}

export function OwnerCardFront({ d, id, photo, art, flat }: { d: MotoData; id: string; photo: string | null; art?: boolean; flat?: boolean }) {
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const end = d.delivery.date || d.date ? warrantyEnd(d) : "";
  const doc = d.client.doc.replace(/\D/g, "");
  const { number } = receiptNumber(id);
  return (
    <Face art={art} flat={flat}>
      <Band right="CARTÃO DO PROPRIETÁRIO" />
      <div className="flex" style={{ padding: "4.4cqw 5.2cqw 0", gap: "4.4cqw" }}>
        {/* foto 3/4 */}
        <div className="shrink-0" style={{ width: "21cqw" }}>
          <div className="overflow-hidden" style={{ width: "21cqw", height: "28cqw", borderRadius: "1.6cqw", background: "#E7ECE4", boxShadow: "0 0.8cqw 2cqw -0.6cqw rgba(11,26,18,0.35), 0 0 0 0.45cqw #FFFFFF" }}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Foto do proprietário" className="h-full w-full object-cover" style={{ objectPosition: "50% 30%" }} />
            ) : (
              <div className="grid h-full w-full place-items-center" style={{ color: "#A6B2AA" }}>
                <UserRound style={{ width: "11cqw", height: "11cqw" }} strokeWidth={1.2} />
              </div>
            )}
          </div>
          <p className="tabular-nums" style={{ marginTop: "2.2cqw", textAlign: "center", fontSize: "1.65cqw", fontWeight: 600, letterSpacing: "0.14em", color: "#6B7A70" }}>
            {number}
          </p>
        </div>

        {/* dados */}
        <div className="min-w-0 flex-1">
          <p style={LABEL}>Proprietário</p>
          <p className="line-clamp-2" style={{ fontSize: "4.1cqw", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.02em", marginTop: "0.5cqw" }}>
            {d.client.name.trim() || "—"}
          </p>
          <div className="grid" style={{ gridTemplateColumns: "1.15fr 0.85fr", columnGap: "3cqw", rowGap: "2.4cqw", marginTop: "3cqw" }}>
            <Item k={doc.length > 11 ? "CNPJ" : "CPF"} v={doc.length > 11 ? formatDoc(doc) : maskDoc(doc)} />
            <Item k="Modelo" v={model} />
            <Item k="Chassi" v={d.chassis.trim().toUpperCase()} mono />
            <Item k="Cor · Ano" v={[d.color, d.year].filter(Boolean).join(" · ")} />
            <Item k="Compra" v={d.date ? dateBr(d.date) : ""} />
            <Item k="Garantia até" v={end ? dateBr(end) : "na entrega"} />
          </div>
        </div>
      </div>
    </Face>
  );
}

export function OwnerCardBack({ d, id, qr, contact, flat }: { d: MotoData; id: string; qr: string; contact: string; flat?: boolean }) {
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const { number, code } = receiptNumber(id);
  const specs = [d.specs.power, d.specs.battery, d.specs.range && `${d.specs.range} de autonomia`, d.specs.speed].filter(Boolean).join(" · ");
  return (
    <Face flat={flat}>
      <Band right="VERIFICAÇÃO" />
      <div className="flex" style={{ padding: "4.2cqw 5.2cqw 0", gap: "4.4cqw" }}>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: "19cqw" }}>
            <div className="absolute" style={{ inset: "-2cqw -4cqw", background: "radial-gradient(closest-side, rgba(63,191,127,0.22), rgba(63,191,127,0))" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.photo || motoPhoto(d)} data-fallback="/mob/cmp-scooter.webp" alt="" className="relative h-full w-auto object-contain" style={{ filter: "drop-shadow(0 1cqw 1.4cqw rgba(11,26,18,0.25))" }} />
          </div>
          <p style={{ fontSize: "3.6cqw", fontWeight: 600, letterSpacing: "-0.02em", marginTop: "1.8cqw" }}>
            {model}
            {d.color ? <span style={{ fontWeight: 400, color: "#6B7A70" }}> · {d.color}</span> : null}
          </p>
          {specs && (
            <p className="line-clamp-2" style={{ fontSize: "2.05cqw", lineHeight: 1.35, color: "#4B5A50", marginTop: "0.6cqw" }}>
              {specs}
            </p>
          )}
          <p style={{ fontSize: "1.75cqw", lineHeight: 1.4, color: "#6B7A70", marginTop: "1.6cqw" }}>
            Autopropelido · até 1.000 W e 32 km/h · sem placa e sem CNH (CONTRAN 996/2023).
            {contact ? ` Assistência: ${contact}.` : ""}
          </p>
        </div>
        <div className="shrink-0 text-center" style={{ width: "22cqw" }}>
          <div className="bg-white" style={{ padding: "1.4cqw", borderRadius: "1.8cqw", boxShadow: "0 0 0 0.2cqw rgba(11,26,18,0.08)" }}>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code de conferência" style={{ width: "100%", height: "auto", display: "block" }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "1" }} />
            )}
          </div>
          <p style={{ fontSize: "1.6cqw", lineHeight: 1.35, color: "#6B7A70", marginTop: "1.4cqw" }}>Aponte a câmera para conferir se é original</p>
          <p className="tabular-nums" style={{ fontSize: "1.7cqw", fontWeight: 600, letterSpacing: "0.1em", marginTop: "0.8cqw" }}>
            {number}
            {code ? <span style={{ display: "block", fontWeight: 500, color: "#6B7A70", letterSpacing: "0.06em" }}>{code}</span> : null}
          </p>
        </div>
      </div>
    </Face>
  );
}

/** Página A4 do PDF: frente e verso grandes, para guardar, imprimir ou mostrar no celular. */
export function OwnerCardPdfPage({ d, id, photo, qr, contact }: { d: MotoData; id: string; photo: string | null; qr: string; contact: string }) {
  const { number } = receiptNumber(id);
  return (
    <div data-pdf-page className="relative overflow-hidden antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, background: "#F5F6F1", fontFamily: INTER, color: INK }}>
      <div className="absolute inset-x-0 top-0" style={{ height: 6, background: "linear-gradient(90deg,#1FA06A,#9FDB7C 60%,#D8E83C)" }} />
      <div className="flex h-full flex-col items-center" style={{ padding: "56px 64px 40px" }}>
        <div className="flex w-full items-end justify-between">
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.3em", color: "#1F9D55" }}>QUARK MOBILIDADE</p>
            <p style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.03em", marginTop: 4 }}>Cartão do proprietário</p>
          </div>
          <p className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", color: "#6B7A70" }}>
            {number}
          </p>
        </div>
        <div style={{ width: 600, marginTop: 34 }}>
          <p style={{ ...LABEL, fontSize: 11, marginBottom: 10 }}>Frente</p>
          <OwnerCardFront d={d} id={id} photo={photo} flat />
        </div>
        <div style={{ width: 600, marginTop: 26 }}>
          <p style={{ ...LABEL, fontSize: 11, marginBottom: 10 }}>Verso</p>
          <OwnerCardBack d={d} id={id} qr={qr} contact={contact} flat />
        </div>
        <p style={{ marginTop: "auto", fontSize: 12, lineHeight: 1.5, color: "#6B7A70", textAlign: "center", maxWidth: 560 }}>
          Este cartão identifica o proprietário da scooter e acompanha o comprovante de compra {number}. Guarde no celular ou imprima e plastifique.
        </p>
      </div>
    </div>
  );
}

/** Tamanho da imagem com frente e verso juntos. */
export const BOTH_SIZE = { width: 1076, height: 1364 };

/** Imagem única com frente e verso, um embaixo do outro. */
export function OwnerCardBoth({ d, id, photo, qr, contact }: { d: MotoData; id: string; photo: string | null; qr: string; contact: string }) {
  return (
    <div data-art style={{ width: BOTH_SIZE.width, height: BOTH_SIZE.height, padding: 32, background: "#F5F6F1", display: "flex", flexDirection: "column", gap: 24, boxSizing: "border-box" }}>
      <OwnerCardFront d={d} id={id} photo={photo} flat />
      <OwnerCardBack d={d} id={id} qr={qr} contact={contact} flat />
    </div>
  );
}
