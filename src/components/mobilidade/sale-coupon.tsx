"use client";

import { Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dateBr, formatCep, formatDoc } from "@/lib/br";
import { formatPhone } from "@/lib/format";
import { couponData, cv, type CouponPayment } from "@/lib/moto-coupon";
import { receiptQrText } from "@/lib/moto-receipt";
import type { MotoData } from "@/lib/moto-sale";
import type { SaleCompany } from "./sale-docs";

/**
 * Cupom de venda no estilo bobina térmica de 80 mm: tudo da compra em uma tira,
 * para ver na tela, baixar em PDF ou enviar. Não é documento fiscal.
 */

const INK = "#111512";
const MONO = "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', 'Roboto Mono', Menlo, Consolas, 'Liberation Mono', monospace";
/** Largura da bobina na tela e no PDF (80 mm). */
export const COUPON_W = 360;
const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const nowMaceio = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};

function Rule({ double }: { double?: boolean }) {
  return <div className={double ? "my-2.5 h-[5px] border-y border-dashed border-[#111512]/55" : "my-2.5 border-t border-dashed border-[#111512]/45"} />;
}

function Row({ k, v, strong, big }: { k: ReactNode; v: ReactNode; strong?: boolean; big?: boolean }) {
  return (
    <div className={big ? "flex items-baseline justify-between gap-3 text-[17px] font-extrabold" : cxs("flex items-baseline justify-between gap-3", strong && "font-bold")}>
      <span className="min-w-0">{k}</span>
      <span className="shrink-0 text-right tabular-nums">{v}</span>
    </div>
  );
}
const cxs = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-bold tracking-[0.08em]">{title}</p>
      {children}
    </div>
  );
}

export function SaleCoupon({ d, c, id, payments = [], qr, origin, sheet }: { d: MotoData; c: SaleCompany; id: string | null; payments?: CouponPayment[]; qr: string; origin: string; sheet?: boolean }) {
  const x = useMemo(() => couponData(d, id, payments), [d, id, payments]);
  const ct = d.contractor;
  const name = clean(c.name) || "Quark Mobilidade";
  const legal = clean(ct?.name) || clean(c.legalName);
  const cnpj = ct?.doc || c.cnpj;
  const addr = clean(ct?.address) || clean(c.address);
  const city = [clean(ct?.city) || clean(c.city), ct?.state].filter(Boolean).join("/");
  const cl = d.client;
  const clientAddr = [clean(cl.address), [clean(cl.city), cl.state].filter(Boolean).join("/"), cl.cep && `CEP ${formatCep(cl.cep)}`].filter(Boolean).join(" · ");
  const host = origin.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const [issued] = useState(nowMaceio);

  const paper = (
    <div data-pdf-sheet={sheet ? "" : undefined} className="relative bg-white px-5 pt-5 pb-6 text-[12.5px] leading-[1.45]" style={{ color: INK, fontFamily: MONO, width: sheet ? COUPON_W : undefined }}>
      {/* emitente */}
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mob/ic/logo.png" alt="" className="mx-auto h-9 w-auto" style={{ filter: "grayscale(1) contrast(1.4)" }} />
        <p className="mt-2 text-[14px] font-extrabold tracking-[0.06em] uppercase">{name}</p>
        {legal && legal.toLowerCase() !== name.toLowerCase() && <p className="uppercase">{legal}</p>}
        {cnpj && <p>CNPJ {formatDoc(cnpj)}</p>}
        {addr && <p>{addr}</p>}
        {city && <p>{city}</p>}
        {(c.phone || c.instagram) && <p>{[c.phone && `Tel ${formatPhone(c.phone)}`, c.instagram && `@${c.instagram.replace(/^@/, "")}`].filter(Boolean).join(" · ")}</p>}
      </div>

      <Rule double />
      <div className="text-center">
        <p className="text-[15px] font-extrabold tracking-[0.14em]">CUPOM DE VENDA</p>
        <p className="font-bold tracking-[0.06em]">NÃO É DOCUMENTO FISCAL</p>
      </div>
      <Rule />
      <Row k={<b>Nº {x.number}</b>} v={`Venda ${dateBr(d.date)}`} />
      <Row k="Emissão" v={issued} />

      <Rule />
      <Section title={x.company ? "CLIENTE · EMPRESA" : "CONSUMIDOR"}>
        <p className="font-bold uppercase">{clean(cl.name) || "Consumidor"}</p>
        {cl.doc && <p>{x.company ? "CNPJ" : "CPF"} {formatDoc(cl.doc)}</p>}
        {cl.phone && <p>Tel {formatPhone(cl.phone)}</p>}
        {clientAddr && <p>{clientAddr}</p>}
      </Section>

      <Rule />
      <div className="grid grid-cols-[34px_1fr] font-bold">
        <span>#</span>
        <span>DESCRIÇÃO</span>
      </div>
      <div className="grid grid-cols-[34px_1fr_auto] text-[11.5px] opacity-70">
        <span />
        <span>QTD UN x VL UNIT</span>
        <span>VL ITEM R$</span>
      </div>
      <div className="mt-1.5 grid gap-2">
        {x.items.map((it) => (
          <div key={it.n} className="grid grid-cols-[34px_1fr]">
            <span className="tabular-nums">{it.n}</span>
            <div className="min-w-0">
              <p className="font-bold">{it.label}</p>
              {it.details.map((t) => (
                <p key={t} className="break-words">
                  {t}
                </p>
              ))}
              <Row k={`${it.qty} UN x ${cv(it.unit)}`} v={it.courtesy ? "CORTESIA" : cv(it.total)} />
            </div>
          </div>
        ))}
      </div>

      <Rule />
      <Row k="QTD. TOTAL DE ITENS" v={x.qtyItems} />
      <Row k="SUBTOTAL R$" v={cv(x.subtotal)} />
      {x.discount > 0 && <Row k="DESCONTO R$" v={`-${cv(x.discount)}`} />}
      <Row k="TOTAL À VISTA R$" v={cv(x.cash)} strong />

      <Rule />
      <Row k={<b>FORMA DE PAGAMENTO</b>} v={<b>VALOR R$</b>} />
      <div className="mt-1 grid gap-1.5">
        {x.pay.map((p, i) => (
          <div key={i}>
            <Row k={p.label} v={cv(p.amount)} />
            {(p.detail || p.status) && (
              <div className="flex items-baseline justify-between gap-3 pl-3 text-[11.5px]">
                <span className="min-w-0 opacity-75">{p.detail}</span>
                {p.status && <span className={cxs("shrink-0 font-bold", p.status === "pago" ? "" : "opacity-75")}>{p.status === "pago" ? "[ PAGO ]" : p.status === "a vencer" ? "[ A VENCER ]" : "[ PENDENTE ]"}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      {x.charges > 0 && (
        <div className="mt-1.5">
          <Row k={x.pay.some((p) => /cart/i.test(p.label)) ? "ENCARGOS DO PARCELAMENTO R$" : "ACRÉSCIMOS R$"} v={cv(x.charges)} />
        </div>
      )}
      <Rule double />
      <Row big k="TOTAL R$" v={cv(x.total)} />
      {x.paidSoFar != null && (
        <>
          <Row k="VALOR PAGO R$" v={cv(x.paidSoFar)} />
          {(x.open ?? 0) > 0 && <Row k="EM ABERTO R$" v={cv(x.open ?? 0)} />}
        </>
      )}

      <Rule />
      <p>
        <b>GARANTIA</b> {x.warranty}
      </p>
      <p>
        <b>ENTREGA</b> {x.delivery}
      </p>
      {c.seller && (
        <p>
          <b>ATENDENTE</b> {c.seller}
        </p>
      )}

      <Rule />
      <div className="text-center">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code de autenticidade" className="mx-auto h-[118px] w-[118px]" />
        ) : (
          <div className="mx-auto h-[118px] w-[118px]" />
        )}
        <p className="mt-1.5">Consulte a autenticidade em</p>
        <p className="font-bold break-all">{id ? `${host}/verificar/${id}` : host}</p>
        {x.code && (
          <p className="mt-1">
            CÓD. VERIFICAÇÃO <b className="tracking-[0.12em]">{x.code.replace(/(.{4})(?=.)/g, "$1 ")}</b>
          </p>
        )}
      </div>

      <Rule />
      <div className="text-center text-[11px] leading-snug">
        <p>Documento sem valor fiscal. Comprovante da compra e da propriedade do veículo{x.company ? ". Para empresas, a nota fiscal é emitida à parte" : ", emitido por MEI dispensado de nota fiscal na venda a consumidor"}.</p>
        <p className="mt-1">Veículo autopropelido · dispensado de placa e CNH · Res. CONTRAN 996/2023</p>
        <p className="mt-2.5 text-[12.5px] font-extrabold tracking-[0.1em]">OBRIGADO PELA PREFERÊNCIA!</p>
      </div>
    </div>
  );

  if (sheet) return paper;
  return (
    <div className="mx-auto w-full" style={{ maxWidth: COUPON_W }}>
      <div className="h-[7px]" style={{ background: "radial-gradient(circle at 6px 0, transparent 4.5px, #FFFFFF 5px) 0 0 / 12px 7px repeat-x" }} />
      <div className="shadow-[0_18px_40px_-26px_rgba(16,26,18,0.55)]">{paper}</div>
      <div className="h-[7px]" style={{ background: "radial-gradient(circle at 6px 7px, transparent 4.5px, #FFFFFF 5px) 0 0 / 12px 7px repeat-x" }} />
    </div>
  );
}

async function qrFor(d: MotoData, c: SaleCompany, id: string | null) {
  try {
    const QR = await import("qrcode");
    const company = { name: clean(d.contractor?.name) || c.legalName || c.name, cnpj: d.contractor?.doc || c.cnpj };
    return await QR.toDataURL(receiptQrText(d, id, company, window.location.origin), { margin: 0, width: 360, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });
  } catch {
    return "";
  }
}

const fileName = (d: MotoData) => {
  const slug = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";
  return `Cupom-${slug(d.modelName || "Scooter")}-${slug(d.client.name.split(" ")[0] ?? "")}.pdf`;
};

/** Gera o PDF do cupom (bobina de 80 mm). */
export async function couponPdf(d: MotoData, c: SaleCompany, id: string | null, payments: CouponPayment[] = []) {
  const [{ sheetPdf }, qr] = await Promise.all([import("@/components/bf/download-pdf"), qrFor(d, c, id)]);
  return sheetPdf(<SaleCoupon d={d} c={c} id={id} payments={payments} qr={qr} origin={window.location.origin} sheet />, { widthPx: COUPON_W, widthMm: 80 });
}

export async function downloadCoupon(d: MotoData, c: SaleCompany, id: string | null, payments: CouponPayment[] = []) {
  const [{ saveBlob }, blob] = await Promise.all([import("@/components/bf/download-pdf"), couponPdf(d, c, id, payments)]);
  saveBlob(blob, fileName(d));
}

/** Cupom na tela com os botões de baixar e enviar. */
export function CouponView({ d, c, id, payments, tone = "light" }: { d: MotoData; c: SaleCompany; id: string | null; payments?: CouponPayment[]; tone?: "light" | "crm" }) {
  const [qr, setQr] = useState("");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  useEffect(() => {
    setOrigin(window.location.origin);
    let live = true;
    void qrFor(d, c, id).then((u) => live && setQr(u));
    return () => {
      live = false;
    };
  }, [d, c, id]);

  const run = async (kind: "pdf" | "share") => {
    setBusy(kind);
    setErr(null);
    try {
      if (kind === "pdf") await downloadCoupon(d, c, id, payments);
      else {
        const blob = await couponPdf(d, c, id, payments);
        const file = new File([blob], fileName(d), { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Cupom de venda" });
        else (await import("@/components/bf/download-pdf")).saveBlob(blob, fileName(d));
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErr("Não foi possível gerar o PDF agora. Tente de novo em instantes.");
    } finally {
      setBusy(null);
    }
  };

  const btn = tone === "crm" ? "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-semibold ring-1 ring-ink-200 dark:ring-white/15" : "flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[14.5px] font-bold text-[#0B1A12] ring-1 ring-[#0B1A12]/10";
  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] bg-[#E9ECE6] px-3 py-5 sm:px-6 dark:bg-white/[0.06]">
        <SaleCoupon d={d} c={c} id={id} payments={payments} qr={qr} origin={origin || "quark"} />
      </div>
      <div className="mx-auto flex w-full gap-2" style={{ maxWidth: COUPON_W + 48 }}>
        <button type="button" disabled={!!busy} onClick={() => run("pdf")} className={cxs(btn, "disabled:opacity-60")}>
          {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
        </button>
        {canShare && (
          <button type="button" disabled={!!busy} onClick={() => run("share")} className={cxs(btn, "bg-[#0B1A12] text-white ring-[#0B1A12] disabled:opacity-60 dark:bg-white dark:text-[#0B1A12]")}>
            {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Enviar
          </button>
        )}
      </div>
      <div aria-live="polite">{err && <p className="mx-auto max-w-sm rounded-2xl bg-[#FDECEA] px-4 py-3 text-center text-[13px] text-[#A12A17]">{err}</p>}</div>
    </div>
  );
}

