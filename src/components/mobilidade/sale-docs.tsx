"use client";

import type { ReactNode } from "react";
import { PDF_PAGE_H, PDF_PAGE_W } from "@/components/bf/proposal-pdf";
import { brlPlain, dateBr, maskDoc } from "@/lib/br";
import { SCOOTERS, commuteCosts } from "@/lib/catalog-mobilidade";
import { formatPhone } from "@/lib/format";
import {
  CARE_TIPS,
  WARRANTY_COVERS,
  WARRANTY_EXCLUDES,
  accessoriesTotal,
  cardTotal,
  motoTotal,
  revisionPlan,
  shortNo,
  vehicleName,
  warrantyEnd,
  motoPhoto,
  type MotoData,
} from "@/lib/moto-sale";

/**
 * Orçamento e certificado de garantia da venda de scooter, em páginas A4
 * (794 × 1123 px) prontas para virar PDF.
 */

export interface SaleCompany {
  name: string;
  legalName: string;
  cnpj: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  instagram: string;
  logo: string;
  seller: string;
  sellerPhone: string;
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";
const GT = `${GRAD} bg-clip-text text-transparent`;
const brl0 = (v: number) => brlPlain(v).replace(/,00$/, "");

export const MOTO_PHOTO: Record<string, string> = {
  t1: "/mob/t1-perfil.webp",
  cappuccino: "/mob/cappuccino-estudio.png",
  mz: "/mob/mz-perfil.webp",
  outro: "/mob/cmp-scooter.webp",
};

/* ---------------------------------------------------------------- ícones */

const PATHS: Record<string, ReactNode> = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  battery: (
    <>
      <rect x="2.5" y="7" width="17" height="10" rx="2.5" />
      <path d="M22 11v2M6 10.5v3M9.5 10.5v3M13 10.5v3" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </>
  ),
  speed: (
    <>
      <path d="M4 16a8 8 0 1 1 16 0" />
      <path d="m12 16 4-5" />
    </>
  ),
  plug: (
    <>
      <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5" />
    </>
  ),
  weight: (
    <>
      <path d="M6 8h12l2 12H4z" />
      <circle cx="12" cy="5" r="2" />
    </>
  ),
  brake: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" />
      <path d="m8.8 12 2.2 2.2 4.3-4.4" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z" />
      <circle cx="6" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  id: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M7 15c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M15.5 10h3M15.5 13.5h3" />
      <circle cx="10" cy="10" r="1.8" />
    </>
  ),
  wrench: <path d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  pen: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  camera: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8 6l1.5-2h5L16 6" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  chat: <path d="M4 19.5 5.3 15A8 8 0 1 1 9 18.7z" />,
  leaf: <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7" />,
};
function Ico({ n, className, w = 2 }: { n: keyof typeof PATHS; className?: string; w?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[n]}
    </svg>
  );
}

function specTiles(d: MotoData) {
  const s = d.specs;
  return [
    { n: "bolt" as const, k: "Motor", v: s.power },
    { n: "battery" as const, k: "Bateria", v: s.battery },
    { n: "route" as const, k: "Autonomia", v: s.range },
    { n: "speed" as const, k: "Velocidade", v: s.speed },
    { n: "plug" as const, k: "Recarga", v: s.recharge },
    { n: "weight" as const, k: "Carga máx.", v: s.load },
    { n: "brake" as const, k: "Freios", v: s.brakes },
    { n: "scale" as const, k: "Peso", v: s.weight },
  ].filter((t) => t.v && t.v.trim());
}

/* ================================================================= ORÇAMENTO */

function QuotePage({ c, n, total, children, no }: { c: SaleCompany; n: number; total: number; children: ReactNode; no: string }) {
  return (
    <div data-pdf-page className="relative flex flex-col overflow-hidden bg-[#050706] font-[family-name:var(--font-outfit)] text-white antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H }}>
      <div className="pointer-events-none absolute -top-60 -right-52 h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(111,191,142,0.22),rgba(111,191,142,0))]" />
      <div className={cx("h-1.5 w-full", GRAD)} />
      <header className="relative flex items-center justify-between px-12 pt-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bf/logo.png" alt="" className="h-9 w-auto" />
        <div className="text-right">
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#A9DE86] uppercase">Orçamento · Quark Mobilidade</p>
          <p className="text-[13px] font-semibold text-white/70">nº {no}</p>
        </div>
      </header>
      <div className="relative flex-1 px-12 pt-6">{children}</div>
      <footer className="relative flex items-center justify-between border-t border-white/[0.07] px-12 py-4 text-[10px] text-white/40">
        <span>
          {c.legalName || c.name}
          {c.cnpj ? ` · CNPJ ${maskDoc(c.cnpj)}` : ""}
          {c.phone ? ` · ${formatPhone(c.phone)}` : ""}
          {c.instagram ? ` · @${c.instagram.replace(/^@/, "")}` : ""}
        </span>
        <span className="tabular-nums">
          {n} / {total}
        </span>
      </footer>
    </div>
  );
}

export function MotoQuotePages({ d, c, id }: { d: MotoData; c: SaleCompany; id: string | null }) {
  const no = shortNo(id, "ORC");
  const scooter = d.model !== "outro" ? SCOOTERS.find((s) => s.id === d.model) : undefined;
  const qty = Math.max(1, Number(d.qty) || 1);
  const total = motoTotal(d);
  const card = cardTotal(d);
  const valid = (() => {
    const dt = new Date(`${d.date}T12:00:00`);
    dt.setDate(dt.getDate() + (Number(d.quoteValidityDays) || 7));
    return dt.toISOString().slice(0, 10);
  })();
  const costs = commuteCosts({ kmDay: 30 });
  const moto = costs.find((x) => x.id === "moto")!.month;
  const mine = costs.find((x) => x.id === "scooter")!.month;
  const bus = costs.find((x) => x.id === "onibus")!.month;
  const acc = d.accessories.filter((a) => a.name.trim() && a.qty > 0);
  const perks = [
    { n: "shield" as const, t: `Garantia de ${d.warrantyDays} dias`, s: "motor, bateria e parte elétrica" },
    { n: "truck" as const, t: "Entrega montada", s: "testada e com vistoria" },
    { n: "id" as const, t: "Sem CNH e sem placa*", s: "autopropelido até 32 km/h" },
    d.freeRevision ? { n: "wrench" as const, t: "Revisão de 30 dias", s: "mão de obra gratuita" } : { n: "plug" as const, t: "Carrega na tomada", s: "carregador original incluso" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------------- 1 */}
      <QuotePage c={c} n={1} total={2} no={no}>
        <div className="grid grid-cols-[1fr_1.1fr] items-center gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-white/80 ring-1 ring-white/10">
              <span className={cx("h-2 w-2 rounded-full", GRAD)} /> Preparado para {d.client.name.trim() || "você"}
            </p>
            <p className="mt-5 text-[12px] font-bold tracking-[0.2em] text-white/50 uppercase">{scooter?.kicker ?? "Scooter elétrica"}</p>
            <h1 className={cx("mt-1 text-[84px] leading-[0.85] font-bold tracking-[-0.06em]", GT)}>{d.modelName || "Scooter"}</h1>
            <p className="mt-4 text-[16px] leading-snug text-white/70">{scooter?.pitch ?? "Mobilidade elétrica com economia, silêncio e praticidade no seu dia a dia."}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-semibold">
              {[d.color && `Cor ${d.color}`, `Ano ${d.year}`, qty > 1 && `${qty} unidades`, "Nova, com nota fiscal"].filter(Boolean).map((t) => (
                <span key={String(t)} className="rounded-full bg-white/[0.06] px-3 py-1 ring-1 ring-white/10">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="relative h-[360px]">
            <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(159,219,124,0.32),rgba(159,219,124,0))]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={motoPhoto(d)} data-fallback="/mob/cmp-scooter.webp" alt="" className="relative h-full w-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.7)]" />
          </div>
        </div>

        <p className="mt-6 text-[12px] font-bold tracking-[0.2em] text-[#8FD9A8] uppercase">Ficha técnica</p>
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          {specTiles(d).map((t) => (
            <div key={t.k} className="flex items-center gap-3 rounded-[18px] bg-[#111513] p-3.5 ring-1 ring-white/[0.07]">
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[#0A0D0B]", GRAD)}>
                <Ico n={t.n} className="h-5 w-5" w={2.1} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] leading-tight font-bold">{t.v}</p>
                <p className="text-[11px] text-white/50">{t.k}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2.5">
          {perks.map((p) => (
            <div key={p.t} className="rounded-[18px] bg-[#0d1a13] p-4 ring-1 ring-[#6FBF8E]/25">
              <Ico n={p.n} className="h-6 w-6 text-[#A9DE86]" />
              <p className="mt-2.5 text-[14px] leading-tight font-bold">{p.t}</p>
              <p className="mt-0.5 text-[11px] text-white/55">{p.s}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1.2fr_1fr] gap-3">
          <div className="rounded-[22px] bg-[#111513] p-5 ring-1 ring-white/[0.07]">
            <p className="text-[12px] font-bold tracking-[0.14em] text-white/50 uppercase">Quanto você gasta por mês (30 km/dia)</p>
            <div className="mt-3 grid gap-2">
              {[
                ["Moto a gasolina", moto, false],
                ["Ônibus", bus, false],
                [`Scooter ${d.modelName || ""}`.trim(), mine, true],
              ].map(([l, v, me]) => (
                <div key={String(l)} className="grid grid-cols-[130px_1fr_70px] items-center gap-3 text-[12px]">
                  <span className={cx("font-semibold", me ? "text-[#A9DE86]" : "text-white/70")}>{l}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={cx("h-full rounded-full", me ? "bg-[linear-gradient(90deg,#1FA06A,#9FDB7C,#F3E93B)]" : "bg-white/35")} style={{ width: `${Math.max(4, (Number(v) / Math.max(moto, bus)) * 100)}%` }} />
                  </div>
                  <span className="text-right font-bold tabular-nums">{brl0(Number(v))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] p-5 text-[#0A0D0B]">
            <p className="text-[12px] font-bold tracking-[0.14em] uppercase opacity-70">Fica no seu bolso</p>
            <p className="mt-1 text-[42px] leading-none font-bold tracking-[-0.05em]">{brl0(Math.max(0, moto - mine))}</p>
            <p className="mt-1 text-[13px] font-semibold opacity-75">por mês trocando a moto a gasolina · {brl0(Math.max(0, moto - mine) * 12)} por ano</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/35">
          *Autopropelido conforme a Resolução CONTRAN nº 996/2023 (até 1.000 W e 32 km/h). Custos estimados: gasolina a R$ 6,30 (35 km/l), passagem de R$ 4,00 e energia a R$ 1,10/kWh. Imagem ilustrativa.
        </p>
      </QuotePage>

      {/* ---------------------------------------------------------------- 2 */}
      <QuotePage c={c} n={2} total={2} no={no}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[12px] font-bold tracking-[0.2em] text-[#8FD9A8] uppercase">Seu pedido</p>
            <h2 className="mt-1 text-[36px] leading-none font-bold tracking-[-0.045em]">
              {d.client.name.trim().split(" ")[0] || "Cliente"}, <span className={GT}>esta é a sua {d.modelName || "scooter"}.</span>
            </h2>
          </div>
          <div className="shrink-0 rounded-[16px] bg-white/[0.05] px-4 py-3 text-right text-[11px] leading-snug text-white/60 ring-1 ring-white/10">
            <p>
              Emitido em <b className="text-white">{dateBr(d.date)}</b>
            </p>
            <p>
              Válido até <b className="text-[#F3E93B]">{dateBr(valid)}</b>
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[22px] ring-1 ring-white/[0.08]">
          <div className="grid grid-cols-[1fr_60px_120px_120px] bg-white/[0.05] px-5 py-3 text-[11px] font-bold tracking-[0.1em] text-white/50 uppercase">
            <span>Item</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Unitário</span>
            <span className="text-right">Total</span>
          </div>
          {[
            { name: `${vehicleName(d)}${d.color ? ` · ${d.color}` : ""}`, sub: `Ano ${d.year} · ${d.specs.power} · ${d.specs.battery}`, qty, price: d.price },
            ...acc.map((a) => ({ name: a.name, sub: a.price > 0 ? "Acessório" : "Acessório de brinde", qty: a.qty, price: a.price })),
          ].map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_60px_120px_120px] items-center border-t border-white/[0.06] px-5 py-3.5 text-[14px]">
              <div>
                <p className="font-semibold">{it.name}</p>
                <p className="text-[11px] text-white/45">{it.sub}</p>
              </div>
              <span className="text-center tabular-nums">{it.qty}</span>
              <span className="text-right tabular-nums text-white/70">{it.price > 0 ? brlPlain(it.price) : "—"}</span>
              <span className={cx("text-right font-semibold tabular-nums", !(it.price > 0) && "text-[#A9DE86]")}>{it.price > 0 ? brlPlain(it.qty * it.price) : "Brinde"}</span>
            </div>
          ))}
          <div className="grid gap-1.5 border-t border-white/[0.08] bg-white/[0.02] px-5 py-4 text-[13px]">
            <div className="flex justify-between text-white/60">
              <span>Subtotal</span>
              <span className="tabular-nums">{brlPlain((Number(d.price) || 0) * qty + accessoriesTotal(d))}</span>
            </div>
            {d.freight > 0 && (
              <div className="flex justify-between text-white/60">
                <span>Frete e entrega</span>
                <span className="tabular-nums">{brlPlain(d.freight)}</span>
              </div>
            )}
            {d.discount > 0 && (
              <div className="flex justify-between text-[#A9DE86]">
                <span>Desconto</span>
                <span className="tabular-nums">− {brlPlain(d.discount)}</span>
              </div>
            )}
            <div className="mt-1 flex items-end justify-between">
              <span className="text-[15px] font-bold">Total à vista</span>
              <span className={cx("text-[34px] leading-none font-bold tracking-[-0.04em] tabular-nums", GT)}>{brlPlain(total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[12px] font-bold tracking-[0.2em] text-[#8FD9A8] uppercase">Formas de pagamento</p>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <div className={cx("rounded-[20px] p-5", d.payment.method === "pix" ? "bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B]" : "bg-[#111513] ring-1 ring-white/[0.07]")}>
            <p className="text-[12px] font-bold opacity-70">À vista no PIX</p>
            <p className="mt-1 text-[26px] leading-none font-bold tracking-[-0.03em]">{brl0(total)}</p>
            <p className="mt-1 text-[11px] opacity-70">pagamento na confirmação do pedido</p>
          </div>
          <div className={cx("rounded-[20px] p-5", d.payment.method === "cartao" ? "bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B]" : "bg-[#111513] ring-1 ring-white/[0.07]")}>
            <p className="text-[12px] font-bold opacity-70">No cartão de crédito</p>
            <p className="mt-1 text-[26px] leading-none font-bold tracking-[-0.03em]">
              {d.payment.installmentValue > 0 ? `${d.payment.installments}x de ${brl0(d.payment.installmentValue)}` : "Consulte"}
            </p>
            <p className="mt-1 text-[11px] opacity-70">{card > 0 ? `total ${brlPlain(card)} · aceita mais de um cartão` : "parcelamento com os encargos da operadora"}</p>
          </div>
          <div className={cx("rounded-[20px] p-5", d.payment.method === "entrada" || d.payment.method === "personalizado" ? "bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] text-[#0A0D0B]" : "bg-[#111513] ring-1 ring-white/[0.07]")}>
            <p className="text-[12px] font-bold opacity-70">{d.payment.method === "personalizado" ? "Condição combinada" : "Entrada + saldo"}</p>
            <p className="mt-1 text-[20px] leading-tight font-bold tracking-[-0.02em]">
              {d.payment.method === "personalizado" ? d.payment.custom.trim().slice(0, 60) || "A combinar" : d.payment.entry > 0 ? `${brl0(d.payment.entry)} + ${brl0(Math.max(0, total - d.payment.entry))}` : "Entrada a combinar"}
            </p>
            <p className="mt-1 text-[11px] opacity-70">{d.payment.method === "entrada" ? `saldo ${d.payment.balanceWhen}` : "fale com o consultor"}</p>
          </div>
        </div>

        <p className="mt-6 text-[12px] font-bold tracking-[0.2em] text-[#8FD9A8] uppercase">Do sim até a sua scooter</p>
        <ol className="mt-3 grid grid-cols-5 gap-2">
          {[
            ["check", "Aprovar", "este orçamento"],
            ["pen", "Assinar", "o contrato pelo celular"],
            ["camera", "Selfie", "de segurança na assinatura"],
            ["truck", "Receber", d.delivery.mode === "entrega" ? "montada em casa" : "montada na loja"],
            ["shield", "Garantia", `${d.warrantyDays} dias com certificado`],
          ].map(([n, t, s], i) => (
            <li key={t} className="rounded-[16px] bg-[#111513] p-3.5 ring-1 ring-white/[0.07]">
              <div className="flex items-center justify-between">
                <Ico n={n as keyof typeof PATHS} className="h-5 w-5 text-[#A9DE86]" />
                <span className="text-[11px] font-bold text-white/35">{i + 1}</span>
              </div>
              <p className="mt-2 text-[14px] font-bold">{t}</p>
              <p className="text-[11px] leading-tight text-white/50">{s}</p>
            </li>
          ))}
        </ol>

        {d.quoteNotes.trim() && <p className="mt-4 rounded-[16px] bg-white/[0.05] px-5 py-3.5 text-[12px] whitespace-pre-line text-white/75 ring-1 ring-white/10">{d.quoteNotes.trim()}</p>}

        <div className="mt-5 flex items-center gap-4 rounded-[22px] bg-[#111513] p-5 ring-1 ring-white/[0.07]">
          <span className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-[20px] font-bold text-[#0A0D0B]", GRAD)}>
            {(c.seller || c.name)
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[#8FD9A8] uppercase">Seu consultor</p>
            <p className="text-[20px] leading-tight font-bold">{c.seller || c.name}</p>
            <p className="text-[12px] text-white/55">Respondo rápido no WhatsApp e agendo um test ride sem compromisso.</p>
          </div>
          {(c.sellerPhone || c.phone) && (
            <div className="text-right">
              <p className="flex items-center justify-end gap-1.5 text-[11px] text-white/45">
                <Ico n="chat" className="h-3.5 w-3.5" /> WhatsApp
              </p>
              <p className="text-[17px] font-bold">{formatPhone(c.sellerPhone || c.phone)}</p>
            </div>
          )}
        </div>
      </QuotePage>
    </div>
  );
}

/* =============================================================== CERTIFICADO */

const INK = "#0F2A1C";

function CertPage({ children, n, total }: { children: ReactNode; n: number; total: number }) {
  return (
    <div data-pdf-page className="relative overflow-hidden bg-[#FBFAF4] font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      {/* moldura */}
      <div className="absolute inset-[18px] rounded-[26px] p-[2px] bg-[linear-gradient(135deg,#C9A84A,#F3E93B_30%,#4FC38A_60%,#C9A84A)]">
        <div className="h-full w-full rounded-[24px] bg-[#FBFAF4]" />
      </div>
      <div className="absolute inset-[28px] rounded-[20px] border border-[#0F2A1C]/15" />
      <div
        className="pointer-events-none absolute inset-[28px] rounded-[20px] opacity-[0.05]"
        style={{ backgroundImage: "repeating-radial-gradient(circle at 50% 42%, #0F2A1C 0 1px, transparent 1px 9px)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/symbol.png" alt="" className="pointer-events-none absolute top-1/2 left-1/2 w-[440px] -translate-x-1/2 -translate-y-1/2 opacity-[0.045]" />
      <div className="relative flex h-full flex-col px-[64px] pt-[54px] pb-[46px] [&>*]:shrink-0">
        {children}
        <p className="mt-auto pt-3 text-center text-[9px] tracking-[0.18em] text-[#0F2A1C]/40 uppercase">
          Página {n} de {total}
        </p>
      </div>
    </div>
  );
}

function Seal({ days }: { days: number }) {
  return (
    <div className="relative grid h-[132px] w-[132px] place-items-center">
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#C9A84A,#F3E93B,#9FDB7C,#4FC38A,#C9A84A)]" />
      <div className="absolute inset-[5px] rounded-full bg-[#0F2A1C]" />
      <div className="absolute inset-[11px] rounded-full border border-dashed border-[#F3E93B]/55" />
      <div className="relative text-center text-white">
        <p className="text-[9px] font-bold tracking-[0.28em] text-[#F3E93B] uppercase">Garantia</p>
        <p className="text-[44px] leading-[0.9] font-bold tracking-[-0.05em]">{days}</p>
        <p className="text-[11px] font-bold tracking-[0.24em] uppercase">dias</p>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#0F2A1C]/15 py-[7px]">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-[#0F2A1C]/55 uppercase">{k}</span>
      <span className={cx("text-right text-[14px] font-semibold", mono && "font-mono tracking-wide")}>{v || "—"}</span>
    </div>
  );
}

export function MotoCertificatePages({ d, c, id, signedAt }: { d: MotoData; c: SaleCompany; id: string | null; signedAt?: string | null }) {
  const no = shortNo(id, "GAR");
  const end = warrantyEnd(d);
  const start = d.delivery.date || d.date;
  const plan = revisionPlan(d);
  const code = (id ?? "rascunho").replace(/-/g, "").slice(-10).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------------- 1 */}
      <CertPage n={1} total={2}>
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-color.png" data-fallback="/brand/logo-color.png" alt="" className="h-11 w-auto" />
          <div className="text-right text-[10px] leading-relaxed text-[#0F2A1C]/60">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#0F2A1C] uppercase">Certificado nº {no}</p>
            <p>Código de verificação {code}</p>
          </div>
        </div>

        <div className="mt-9 text-center">
          <p className="text-[12px] font-bold tracking-[0.42em] text-[#3E8E62] uppercase">Quark Mobilidade</p>
          <h1 className="mt-2 text-[56px] leading-[0.95] font-bold tracking-[-0.045em]">Certificado de Garantia</h1>
          <div className="mx-auto mt-4 flex w-[420px] items-center gap-3">
            <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,#C9A84A)]" />
            <span className="h-2 w-2 rotate-45 bg-[#C9A84A]" />
            <span className="h-px flex-1 bg-[linear-gradient(90deg,#C9A84A,transparent)]" />
          </div>
          <p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-relaxed text-[#0F2A1C]/80">
            Certificamos que o veículo elétrico descrito abaixo foi vendido novo, entregue montado e testado, e conta com garantia de{" "}
            <b className="text-[#0F2A1C]">{d.warrantyDays} dias</b> contra defeitos de fabricação, a partir da data de entrega.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-[1fr_auto] items-center gap-8">
          <div className="rounded-[22px] bg-white/80 p-6 ring-1 ring-[#0F2A1C]/10">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#3E8E62] uppercase">Proprietário</p>
            <p className="mt-1 text-[24px] leading-tight font-bold tracking-[-0.02em]">{d.client.name || "—"}</p>
            <p className="text-[12px] text-[#0F2A1C]/60">
              {d.client.doc ? `${d.client.kind === "pj" ? "CNPJ" : "CPF"} ${maskDoc(d.client.doc)}` : ""}
              {d.client.city ? ` · ${d.client.city}/${d.client.state || "AL"}` : ""}
              {d.client.phone ? ` · ${formatPhone(d.client.phone)}` : ""}
            </p>
          </div>
          <Seal days={d.warrantyDays} />
        </div>

        <div className="mt-6 grid grid-cols-[1fr_210px] gap-6">
          <div>
            <Row k="Veículo" v={`${vehicleName(d)}${d.color ? ` · ${d.color}` : ""}`} />
            <Row k="Ano" v={String(d.year)} />
            <Row k="Chassi / quadro" v={d.chassis} mono />
            <Row k="Nº do motor" v={d.motorNo} mono />
            <Row k="Nº da bateria" v={d.batteryNo} mono />
            <Row k="Nº do carregador" v={d.chargerNo} mono />
            <Row k="Motor e bateria" v={[d.specs.power, d.specs.battery].filter(Boolean).join(" · ")} />
          </div>
          <div className="relative flex flex-col justify-center rounded-[22px] bg-[#0F2A1C] p-5 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={motoPhoto(d)} data-fallback="/mob/cmp-scooter.webp" alt="" className="mx-auto h-[120px] w-auto object-contain" />
            <div className="mt-3 grid gap-2 text-[12px]">
              <div>
                <p className="text-[10px] font-bold tracking-[0.16em] text-[#A9DE86] uppercase">Compra</p>
                <p className="font-semibold">{dateBr(d.date)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.16em] text-[#A9DE86] uppercase">Início · entrega</p>
                <p className="font-semibold">{dateBr(start)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.16em] text-[#F3E93B] uppercase">Válida até</p>
                <p className="text-[18px] font-bold">{end ? dateBr(end) : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[18px] bg-[#EAF4EC] px-5 py-4 text-[12px] leading-relaxed text-[#0F2A1C]/80 ring-1 ring-[#3E8E62]/20">
          <b className="text-[#0F2A1C]">Cobertura:</b> {WARRANTY_COVERS.join(" · ")}. Reparo ou troca da peça sem custo em até 30 dias (CDC, art. 18, § 1º).
        </div>

        <div className="mt-7 grid grid-cols-2 items-end gap-10">
          <div className="text-center">
            <div className="flex h-[64px] items-end justify-center">
              {d.contractorSignature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.contractorSignature} alt="" className="max-h-[60px] w-auto object-contain" />
              )}
            </div>
            <div className="border-t border-[#0F2A1C]/40 pt-1.5">
              <p className="text-[12px] font-bold">{d.contractor.name || c.legalName || c.name}</p>
              <p className="text-[10px] text-[#0F2A1C]/55">
                {[d.contractor.repName, d.contractor.repRole].filter(Boolean).join(" · ") || "Vendedora"}
                {d.contractor.doc ? ` · CNPJ ${maskDoc(d.contractor.doc)}` : ""}
              </p>
            </div>
          </div>
          <div className="text-center">
            <div className="flex h-[64px] items-end justify-center text-[11px] text-[#0F2A1C]/50">{signedAt ? `Contrato assinado eletronicamente em ${dateBr(signedAt.slice(0, 10))}` : ""}</div>
            <div className="border-t border-[#0F2A1C]/40 pt-1.5">
              <p className="text-[12px] font-bold">{d.client.name || "Proprietário"}</p>
              <p className="text-[10px] text-[#0F2A1C]/55">Proprietário(a)</p>
            </div>
          </div>
        </div>
      </CertPage>

      {/* ---------------------------------------------------------------- 2 */}
      <CertPage n={2} total={2}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[0.3em] text-[#3E8E62] uppercase">Termos da garantia</p>
            <h2 className="mt-1 text-[30px] leading-none font-bold tracking-[-0.04em]">Tudo o que você precisa saber</h2>
          </div>
          <p className="rounded-full bg-[#0F2A1C] px-3.5 py-1.5 text-[11px] font-bold text-[#F3E93B]">
            {no} · até {end ? dateBr(end) : "—"}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 items-start gap-4">
          <div className="rounded-[20px] bg-white/85 p-4 ring-1 ring-[#0F2A1C]/10">
            <p className="flex items-center gap-2 text-[13px] font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#3E8E62] text-white">
                <Ico n="check" className="h-4 w-4" w={3} />
              </span>
              O que está coberto
            </p>
            <ul className="mt-2.5 grid gap-1 text-[11.5px] leading-snug text-[#0F2A1C]/80">
              {WARRANTY_COVERS.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#3E8E62]" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[20px] bg-white/85 p-4 ring-1 ring-[#0F2A1C]/10">
            <p className="flex items-center gap-2 text-[13px] font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#B4433A] text-white">
                <Ico n="x" className="h-4 w-4" w={3} />
              </span>
              O que não está coberto
            </p>
            <ul className="mt-2.5 grid gap-1 text-[11px] leading-snug text-[#0F2A1C]/75">
              {WARRANTY_EXCLUDES.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#B4433A]" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-5 text-[13px] font-bold">Plano de revisões</p>
        <div className="mt-2 overflow-hidden rounded-[18px] ring-1 ring-[#0F2A1C]/12">
          <div className="grid grid-cols-[130px_1fr_90px_150px] bg-[#0F2A1C] px-4 py-2.5 text-[10px] font-bold tracking-[0.12em] text-white uppercase">
            <span>Quando</span>
            <span>O que é feito</span>
            <span className="text-center">Mão de obra</span>
            <span className="text-center">Data · km · carimbo</span>
          </div>
          {plan.map((r) => (
            <div key={r.when} className="grid grid-cols-[130px_1fr_90px_150px] items-center border-t border-[#0F2A1C]/10 bg-white/80 px-4 py-2.5 text-[11.5px]">
              <span className="font-bold">{r.when}</span>
              <span className="pr-3 text-[#0F2A1C]/75">{r.what}</span>
              <span className={cx("text-center font-bold", r.free ? "text-[#3E8E62]" : "text-[#0F2A1C]/50")}>{r.free ? "Gratuita" : "Cobrada"}</span>
              <span className="mx-auto h-[34px] w-[130px] rounded-[10px] border border-dashed border-[#0F2A1C]/25" />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_1fr] gap-4">
          <div>
            <p className="text-[13px] font-bold">Como acionar a garantia</p>
            <ol className="mt-2 grid gap-2 text-[11.5px] leading-snug text-[#0F2A1C]/80">
              {[
                `Fale com a ${c.name} pelo WhatsApp${c.phone ? ` ${formatPhone(c.phone)}` : ""} e descreva o problema (fotos e vídeos ajudam).`,
                "Apresente este certificado ou o contrato de compra e a nota fiscal.",
                `Leve a scooter à assistência técnica em ${d.contractor.city || "Maceió"}/${d.contractor.state || "AL"} ou combine a retirada.`,
                "Defeito coberto: reparo ou troca da peça sem custo em até 30 dias.",
              ].map((t, i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0F2A1C] text-[10px] font-bold text-[#F3E93B]">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-[13px] font-bold">Cuidados que fazem a bateria durar</p>
            <ul className="mt-2 grid gap-2 text-[11px] leading-snug text-[#0F2A1C]/75">
              {CARE_TIPS.map((t) => (
                <li key={t} className="flex gap-2">
                  <Ico n="leaf" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3E8E62]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-[18px] bg-[#0F2A1C] px-6 py-3.5 text-[10.5px] leading-relaxed text-white/80">
          Esta garantia compreende a garantia legal de 90 dias para bens duráveis (Código de Defesa do Consumidor, art. 26, II) e vale para o proprietário indicado, mediante apresentação deste certificado. Veículo
          autopropelido conforme a Resolução CONTRAN nº 996/2023. {c.legalName || c.name}
          {c.cnpj ? ` · CNPJ ${maskDoc(c.cnpj)}` : ""}
          {c.address ? ` · ${c.address}` : ""}
          {c.city ? ` · ${c.city}` : ""}.
        </div>
      </CertPage>
    </div>
  );
}

/** Dados da empresa e do vendedor para os documentos da venda. */
export function saleCompany(
  s: { company_name: string; legal_name: string; cnpj: string; address: string; city: string; phone: string; whatsapp: string; email: string; instagram: string; logo_url: string },
  seller?: { full_name?: string | null; phone?: string | null } | null,
): SaleCompany {
  return {
    name: s.company_name || "Quark Energia",
    legalName: s.legal_name || s.company_name || "",
    cnpj: s.cnpj || "",
    address: s.address || "",
    city: s.city || "",
    phone: s.whatsapp || s.phone || "",
    email: s.email || "",
    instagram: s.instagram || "",
    logo: s.logo_url || "",
    seller: seller?.full_name || "",
    sellerPhone: seller?.phone || "",
  };
}
