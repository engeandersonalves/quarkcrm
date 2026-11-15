"use client";

import { BadgeCheck, CreditCard, Scissors, ShieldCheck } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PDF_PAGE_H, PDF_PAGE_W } from "@/components/bf/proposal-pdf";
import { brlPlain, dateBr, formatCep, formatDoc, maskDoc } from "@/lib/br";
import { formatPhone } from "@/lib/format";
import { buyerIsCompany, paymentSummary, receiptLines, receiptNumber, receiptQrText, receiptTotals } from "@/lib/moto-receipt";
import { moneyToWords } from "@/lib/receipt";
import { motoPhoto, vehicleName, warrantyEnd, type MotoData } from "@/lib/moto-sale";
import type { SaleCompany } from "./sale-docs";

/**
 * Comprovante de compra e propriedade (documento não fiscal), em duas páginas A4:
 * a compra completa na página 1 e, na página 2, um cartão de bolso no tamanho de um cartão
 * de crédito (frente e verso) para recortar, dobrar e levar junto com a scooter.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const INK = "#0B1A12";
const GREEN = "#1F9D55";
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const money = (v: number) => brlPlain(v);
const clean = (v: string | undefined | null) => (v ?? "").replace(/\s+/g, " ").trim();
/** Cartão de bolso: 85,6 × 54 mm (padrão ID-1) a 96 dpi. */
const CARD_W = 323;
const CARD_H = 204;
const MAX_LINES = 4;

const CARD: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(11,26,18,0.07)",
  boxShadow: "0 12px 28px -18px rgba(16,52,32,0.35), 0 1px 2px rgba(16,52,32,0.05)",
};

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[13px] font-bold tracking-[0.18em] text-[#0B1A12]/45 uppercase", className)}>{children}</p>;
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex h-[28px] items-center justify-between gap-3 text-[14.5px]">
      <span className="shrink-0 text-[#0B1A12]/50">{k}</span>
      <span className={cx("min-w-0 truncate text-right font-semibold", mono && "tracking-[0.05em] uppercase")}>{v || <span className="inline-block w-[110px] border-b border-[#0B1A12]/30 align-middle" />}</span>
    </div>
  );
}

export function PurchaseReceiptPage({ d, c, id, qr }: { d: MotoData; c: SaleCompany; id: string | null; qr: string }) {
  const { number, code } = receiptNumber(id);
  const ct = d.contractor;
  const company = { name: clean(ct.name) || clean(c.legalName) || clean(c.name), cnpj: ct.doc || c.cnpj };
  const companyAddr = [clean(ct.address) || clean(c.address), (clean(ct.city) || clean(c.city)) && [clean(ct.city) || clean(c.city), ct.state].filter(Boolean).join("/"), ct.cep && `CEP ${formatCep(ct.cep)}`].filter(Boolean).join(" · ");
  const cl = d.client;
  const pj = buyerIsCompany(d);
  const buyerAddr = [clean(cl.address), clean(cl.city) && [clean(cl.city), cl.state].filter(Boolean).join("/"), cl.cep && `CEP ${formatCep(cl.cep)}`].filter(Boolean).join(" · ");
  const all = receiptLines(d);
  const lines =
    all.length > MAX_LINES
      ? [...all.slice(0, MAX_LINES - 1), { label: `Outros acessórios (${all.length - MAX_LINES + 1} itens)`, qty: 1, unit: 0, total: all.slice(MAX_LINES - 1).reduce((t, l) => t + l.total, 0) }]
      : all;
  const t = receiptTotals(d);
  const pay = paymentSummary(d);
  const owned = d.delivery.date || d.date;
  const end = d.delivery.date ? warrantyEnd(d) : "";
  const vehicle = vehicleName(d);
  const contact = [c.phone && formatPhone(c.phone), c.instagram && `@${c.instagram.replace(/^@/, "")}`].filter(Boolean).join(" · ");

  return (
    <>
    <div data-pdf-page className="relative overflow-hidden font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      <div className="absolute inset-0 bg-[#F7F9F4]" />
      <div className="absolute -top-[240px] -right-[200px] h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.30), rgba(126,214,150,0))" }} />
      <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: GRAD }} />

      <div className="relative flex h-full flex-col px-[46px] pt-[28px] pb-[22px] [&>*]:shrink-0">
        {/* cabeçalho */}
        <div className="flex h-[44px] items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="" className="h-[40px] w-auto" />
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#0B1A12]/15 px-3 py-1 text-[13px] font-bold tracking-[0.14em] text-[#0B1A12]/55 uppercase">Documento não fiscal</span>
            <span className="rounded-full bg-[#0B1A12] px-3.5 py-1 text-[14px] font-bold tracking-[0.08em] text-white tabular-nums">{number}</span>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[14px] font-bold tracking-[0.24em] uppercase" style={{ color: GREEN }}>
              Comprovante de compra e propriedade
            </p>
            <h1 className="mt-1 truncate text-[34px] leading-[1.02] font-extrabold tracking-[-0.04em]">
              {vehicle}
              <span style={{ color: "#3FBF6A" }}>.</span>
            </h1>
          </div>
          <div className="shrink-0 text-right">
            <Label>Data da compra</Label>
            <p className="text-[20px] font-extrabold tabular-nums">{dateBr(d.date)}</p>
          </div>
        </div>

        {/* partes */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[18px] px-4 py-3" style={CARD}>
            <Label>Vendedora</Label>
            <p className="mt-1 truncate text-[16.5px] font-extrabold">{company.name || "—"}</p>
            <Kv k="CNPJ" v={company.cnpj ? formatDoc(company.cnpj) : ""} />
            <p className="line-clamp-2 h-[38px] text-[13.5px] leading-snug text-[#0B1A12]/60">{companyAddr}</p>
            <p className="truncate text-[13.5px] text-[#0B1A12]/60">{contact}</p>
          </div>
          <div className="rounded-[18px] px-4 py-3" style={CARD}>
            <Label>{pj ? "Comprador · empresa" : "Comprador · proprietário"}</Label>
            <p className="mt-1 truncate text-[16.5px] font-extrabold">{clean(cl.name) || "—"}</p>
            <Kv k={pj ? "CNPJ" : "CPF"} v={cl.doc ? formatDoc(cl.doc) : ""} />
            <p className="line-clamp-2 h-[38px] text-[13.5px] leading-snug text-[#0B1A12]/60">{buyerAddr}</p>
            <p className="truncate text-[13.5px] text-[#0B1A12]/60">{[cl.phone && formatPhone(cl.phone), clean(cl.email)].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        {/* veículo */}
        <div className="mt-3 grid grid-cols-[150px_1fr] items-center gap-4 rounded-[20px] px-4 py-3" style={CARD}>
          <div className="relative h-[118px] rounded-[14px]" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.35), rgba(126,214,150,0))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={motoPhoto(d)} data-fallback="/mob/cmp-scooter.webp" alt="" className="absolute inset-0 h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Identificação do veículo</Label>
              <span className="text-[13px] font-semibold text-[#0B1A12]/45">autopropelido · até 1.000 W e 32 km/h</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-6">
              <Kv k="Cor" v={clean(d.color)} />
              <Kv k="Ano" v={d.year ? String(d.year) : ""} />
              <Kv k="Nº do chassi" v={clean(d.chassis)} mono />
              <Kv k="Nº do motor" v={clean(d.motorNo)} mono />
              <Kv k="Nº da bateria" v={clean(d.batteryNo)} mono />
              <Kv k="Nº do carregador" v={clean(d.chargerNo)} mono />
            </div>
          </div>
        </div>

        {/* itens e pagamento */}
        <div className="mt-3 grid grid-cols-[1fr_250px] gap-3">
          <div className="flex flex-col overflow-hidden rounded-[18px]" style={CARD}>
            <div className="grid grid-cols-[1fr_44px_108px_112px] bg-[#0B1A12] px-4 py-2 text-[12.5px] font-bold tracking-[0.12em] text-white uppercase">
              <span>Descrição</span>
              <span className="text-center">Qtd</span>
              <span className="text-right">Unitário</span>
              <span className="text-right">Total</span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className={cx("grid min-h-[52px] grid-cols-[1fr_44px_108px_112px] items-center gap-2 px-4 py-1.5 text-[14.5px]", i > 0 && "border-t border-[#0B1A12]/[0.07]")}>
                <span className="min-w-0">
                  <span className="line-clamp-2 block leading-tight font-semibold">{l.label}</span>
                  {l.detail && <span className="block truncate text-[12.5px] text-[#0B1A12]/50 uppercase">{l.detail}</span>}
                </span>
                <span className="text-center tabular-nums">{l.qty}</span>
                <span className="text-right tabular-nums text-[#0B1A12]/65">{l.unit > 0 ? money(l.unit) : "—"}</span>
                <span className="text-right font-semibold tabular-nums">{l.total > 0 ? money(l.total) : "cortesia"}</span>
              </div>
            ))}
            <div className="mt-auto border-t border-[#0B1A12]/10 bg-[#F4F8F1] px-4 py-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-[#0B1A12]/55">Subtotal</span>
                <span className="tabular-nums">{money(t.subtotal)}</span>
              </div>
              {t.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#0B1A12]/55">Desconto</span>
                  <span className="text-[#1F9D55] tabular-nums">− {money(t.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total à vista</span>
                <span className="tabular-nums">{money(t.cash)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-[18px] bg-[#0B1A12] px-4 py-3.5 text-white">
            <div>
              <p className="text-[13px] font-bold tracking-[0.18em] text-[#E4F04A] uppercase">Valor pago</p>
              <p className="mt-1 text-[32px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{money(t.paid)}</p>
              <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-white/55">{moneyToWords(t.paid)}</p>
            </div>
            <div className="mt-3 flex items-start gap-2.5 rounded-[12px] bg-white/[0.07] px-3 py-2.5">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#9FDB7C]" />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold">{pay.title}</span>
                <span className="line-clamp-2 block text-[13px] leading-snug text-white/60">{pay.detail}</span>
              </span>
            </div>
          </div>
        </div>

        {/* declaração */}
        <div className="mt-3 flex items-start gap-3 rounded-[18px] px-4 py-3" style={CARD}>
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: GREEN }} />
          <p className="line-clamp-5 text-[14.5px] leading-relaxed text-[#0B1A12]/75">
            A VENDEDORA declara que recebeu o valor acima e que vendeu ao COMPRADOR, <b className="text-[#0B1A12]">{clean(cl.name) || "identificado acima"}</b>, o veículo descrito neste comprovante, novo, livre de dívidas e ônus, que passa a ser de sua propriedade
            {owned ? ` a partir de ${dateBr(owned)}` : ""}. Veículo autopropelido, dispensado de registro, emplacamento e habilitação conforme a Resolução CONTRAN nº 996/2023.
            {end ? ` Garantia de ${d.warrantyDays} dias contra defeitos de fabricação, válida até ${dateBr(end)}.` : ""}
          </p>
        </div>

        {/* assinaturas */}
        <div className="mt-6 grid grid-cols-2 gap-10">
          {[
            [company.name || "Vendedora", company.cnpj ? `Vendedora · CNPJ ${formatDoc(company.cnpj)}` : "Vendedora"],
            [clean(cl.name) || "Comprador(a)", "Comprador(a) · proprietário(a)"],
          ].map(([n, s]) => (
            <div key={s} className="min-w-0 border-t border-[#0B1A12]/40 pt-1.5 text-center">
              <p className="truncate text-[14px] font-bold">{n}</p>
              <p className="truncate text-[12.5px] text-[#0B1A12]/55">{s}</p>
            </div>
          ))}
        </div>

        <div className="grow" />
        <p className="mt-4 text-center text-[12.5px] leading-snug text-[#0B1A12]/50">
          Documento não fiscal emitido por Microempreendedor Individual (MEI), dispensado da emissão de nota fiscal nas vendas a consumidor pessoa física. Guarde este comprovante: ele atesta a compra e a propriedade do veículo.
        </p>
      </div>
    </div>

    {/* ------------------------------------------------ página 2: cartão de bolso */}
    <div data-pdf-page className="relative overflow-hidden font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      <div className="absolute inset-0 bg-[#F7F9F4]" />
      <div className="absolute -bottom-[240px] -left-[200px] h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.30), rgba(126,214,150,0))" }} />
      <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: GRAD }} />
      <div className="relative flex h-full flex-col px-[46px] pt-[28px] pb-[22px] [&>*]:shrink-0">
        <div className="flex h-[48px] items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="" className="h-[44px] w-auto" />
          <span className="rounded-full bg-[#0B1A12] px-4 py-1.5 text-[14px] font-bold tracking-[0.06em] text-white tabular-nums">{number}</span>
        </div>
        <p className="mt-10 text-[15px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Para levar com você
        </p>
        <h2 className="mt-1 text-[44px] leading-[1.02] font-extrabold tracking-[-0.04em]">
          Cartão de propriedade<span style={{ color: "#3FBF6A" }}>.</span>
        </h2>
        <p className="mt-3 max-w-[600px] text-[18px] leading-relaxed text-[#0B1A12]/75">Ele cabe na carteira e prova que a scooter é sua. O QR code do verso mostra os dados da compra em qualquer celular, mesmo sem internet.</p>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            ["1", "Recorte", "na linha tracejada, por fora do cartão"],
            ["2", "Dobre ao meio", "na linha do centro, frente para fora"],
            ["3", "Plastifique", "e guarde junto com o documento"],
          ].map(([n, t, x]) => (
            <div key={n} className="rounded-[22px] bg-white px-5 py-5" style={CARD}>
              <span className="grid h-10 w-10 place-items-center rounded-full text-[17px] font-extrabold" style={{ background: GRAD }}>
                {n}
              </span>
              <p className="mt-3 text-[19px] font-extrabold">{t}</p>
              <p className="mt-1 text-[15px] leading-snug text-[#0B1A12]/65">{x}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-12 border-t-[1.5px] border-dashed border-[#0B1A12]/25 pt-6">
          <span className="absolute -top-[12px] left-0 grid h-6 w-6 place-items-center bg-[#F7F9F4] text-[#0B1A12]/50">
            <Scissors className="h-4 w-4" />
          </span>
          <div className="flex justify-center">
            <div className="flex rounded-[16px] outline outline-[1.5px] outline-offset-[4px] outline-[#0B1A12]/25 outline-dashed">
              <WalletFront d={d} number={number} />
              <div className="w-0 border-l border-dashed border-[#0B1A12]/30" />
              <WalletBack d={d} number={number} code={code} qr={qr} company={company.name} contact={c.phone ? formatPhone(c.phone) : ""} end={end} />
            </div>
          </div>
          <div className="mt-3 flex justify-between px-[38px] text-[13px] font-semibold text-[#0B1A12]/45">
            <span>frente</span>
            <span>dobre aqui</span>
            <span>verso</span>
          </div>
        </div>

        <div className="grow" />
        <div className="rounded-[22px] bg-[#0B1A12] px-7 py-5 text-white">
          <p className="text-[14px] font-bold tracking-[0.16em] text-[#E4F04A] uppercase">Precisa de uma segunda via?</p>
          <p className="mt-1 text-[17px] leading-snug text-white/85">Baixe de novo na sua área do cliente, com o seu CPF e os 4 últimos dígitos do celular{contact ? `, ou fale com a gente: ${contact}` : ""}.</p>
        </div>
      </div>
    </div>
    </>
  );
}

function WalletFront({ d, number }: { d: MotoData; number: string }) {
  return (
    <div className="relative overflow-hidden rounded-l-[14px] bg-white" style={{ width: CARD_W, height: CARD_H }}>
      <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: GRAD }} />
      <div className="absolute -right-[60px] -bottom-[70px] h-[200px] w-[200px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.40), rgba(126,214,150,0))" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={motoPhoto(d)} data-fallback="/mob/cmp-scooter.webp" alt="" className="absolute right-[8px] bottom-[8px] h-[92px] w-[130px] object-contain" />
      <div className="relative flex h-full flex-col px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="" className="h-[24px] w-auto" />
          <span className="text-[8px] font-bold tracking-[0.12em] text-[#0B1A12]/45 tabular-nums">{number}</span>
        </div>
        <p className="mt-2 text-[8px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Cartão de propriedade
        </p>
        <p className="mt-0.5 line-clamp-2 max-w-[290px] text-[14px] leading-[1.1] font-extrabold">{clean(d.client.name) || "Proprietário(a)"}</p>
        <p className="text-[9px] text-[#0B1A12]/55">{d.client.doc ? `${d.client.doc.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"} ${d.client.doc.replace(/\D/g, "").length > 11 ? formatDoc(d.client.doc) : maskDoc(d.client.doc)}` : ""}</p>
        <div className="mt-auto max-w-[170px]">
          <p className="truncate text-[11px] font-extrabold">{vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter elétrica"}</p>
          <p className="truncate text-[8.5px] text-[#0B1A12]/55">{[clean(d.color), d.year].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-[7px] font-bold tracking-[0.14em] text-[#0B1A12]/40 uppercase">Chassi</p>
          <p className="truncate text-[10px] font-bold tracking-[0.05em] uppercase">{clean(d.chassis) || "—"}</p>
        </div>
      </div>
    </div>
  );
}

function WalletBack({ d, number, code, qr, company, contact, end }: { d: MotoData; number: string; code: string; qr: string; company: string; contact: string; end: string }) {
  return (
    <div className="relative overflow-hidden rounded-r-[14px] bg-[#0B1A12] text-white" style={{ width: CARD_W, height: CARD_H }}>
      <div className="absolute -top-[80px] -left-[60px] h-[200px] w-[200px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(79,195,138,0.35), rgba(79,195,138,0))" }} />
      <div className="relative flex h-full gap-3 p-3.5">
        <div className="flex shrink-0 flex-col items-center">
          <div className="rounded-[10px] bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt="" className="h-[104px] w-[104px]" /> : <div className="h-[104px] w-[104px]" />}
          </div>
          <p className="mt-1.5 text-center text-[7px] leading-tight text-white/50">Aponte a câmera para<br />conferir os dados</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[8px] font-bold tracking-[0.2em] text-[#E4F04A] uppercase">Comprovante</p>
          <p className="text-[13px] font-extrabold tabular-nums">{number}</p>
          <div className="mt-1.5 grid gap-1 text-[8.5px]">
            <p className="flex justify-between gap-2">
              <span className="text-white/50">Compra</span>
              <span className="font-bold tabular-nums">{dateBr(d.date)}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="flex items-center gap-1 text-white/50">
                <ShieldCheck className="h-2.5 w-2.5" /> Garantia
              </span>
              <span className="font-bold tabular-nums">{end ? `até ${dateBr(end)}` : `${d.warrantyDays} dias`}</span>
            </p>
            {code && (
              <p className="flex justify-between gap-2">
                <span className="text-white/50">Código</span>
                <span className="font-bold tracking-[0.04em]">{code}</span>
              </p>
            )}
          </div>
          <div className="mt-auto">
            <p className="truncate text-[9px] font-bold">{company}</p>
            {contact && <p className="truncate text-[8.5px] text-white/60">{contact}</p>}
            <p className="mt-1 text-[6.5px] leading-tight text-white/40">Autopropelido até 32 km/h · Res. CONTRAN 996/2023</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Gera o QR code e baixa o comprovante em PDF. */
export async function downloadPurchaseReceipt(d: MotoData, c: SaleCompany, id: string | null) {
  const [{ downloadPagesPdf, pdfFileSlug }, QR] = await Promise.all([import("@/components/bf/download-pdf"), import("qrcode")]);
  const company = { name: clean(d.contractor.name) || c.legalName || c.name, cnpj: d.contractor.doc || c.cnpj };
  let qr = "";
  try {
    qr = await QR.toDataURL(receiptQrText(d, id, company), { margin: 0, width: 320, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });
  } catch {
    /* sem QR: o cartão sai com o espaço em branco */
  }
  await downloadPagesPdf(<PurchaseReceiptPage d={d} c={c} id={id} qr={qr} />, `Comprovante-${pdfFileSlug(d.modelName || "Scooter")}-${pdfFileSlug(d.client.name)}.pdf`, { background: "#F7F9F4" });
}
