"use client";

import type { CSSProperties, ReactNode } from "react";
import { brlPlain } from "@/lib/br";
import { BF_END_SHORT, bfPhase } from "@/lib/black-friday";
import { formatPhone } from "@/lib/format";
import { WEAKER, firstNumber, installmentValue, type MotoProduct } from "@/lib/moto-products";

/**
 * Artes de venda das scooters em 1080 × 1350 (feed do Instagram), no mesmo design do
 * catálogo branco da Quark Mobilidade: fundo claro com luz verde e amarela, título preto
 * com ponto verde, cartões brancos com ícones 3D e o cartão de preço com borda degradê.
 */
export const ART_W = 1080;
export const ART_H = 1350;

export interface ArtBrand {
  whatsapp: string;
  instagram: string;
  city: string;
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const INK = "#0B1A12";
const GREEN = "#1F9D55";
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const brl0 = (v: number) => brlPlain(v).replace(/,00$/, "");

/** Ícone 3D (recortado do catálogo). */
function Ic({ n, size = 56, className }: { n: string; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/mob/ic/${n}.png`} alt="" className={cx("shrink-0 object-contain", className)} style={{ width: size, height: size }} />;
}

/** Cartão branco do catálogo: vidro claro com borda de luz e sombra macia. */
const CARD: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.82))",
  border: "1.5px solid rgba(255,255,255,0.95)",
  boxShadow: "0 1px 0 rgba(255,255,255,1) inset, 0 18px 40px -18px rgba(16,52,32,0.28), 0 2px 6px rgba(16,52,32,0.06)",
};
function Card({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={className} style={{ ...CARD, ...style }}>
      {children}
    </div>
  );
}

/** Fundo claro com luzes suaves, grade pontilhada e faixa degradê no topo. */
function Paper() {
  return (
    <>
      <div className="absolute inset-0 bg-[#F6F8F2]" />
      <div className="absolute -top-[200px] -left-[260px] h-[900px] w-[900px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.45), rgba(126,214,150,0))" }} />
      <div className="absolute top-[180px] -right-[300px] h-[900px] w-[900px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(236,240,120,0.45), rgba(236,240,120,0))" }} />
      <div className="absolute -bottom-[260px] left-[120px] h-[760px] w-[900px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(150,224,170,0.35), rgba(150,224,170,0))" }} />
      <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "radial-gradient(rgba(11,26,18,0.18) 1px, transparent 1.2px)", backgroundSize: "36px 36px", maskImage: "linear-gradient(180deg, #000 0%, transparent 70%)" }} />
      <div className="absolute inset-x-0 top-0 h-[10px]" style={{ background: GRAD }} />
    </>
  );
}

function Header() {
  const bf = bfPhase().phase !== "encerrada";
  return (
    <div className="flex items-center justify-between">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-[64px] w-auto" />
      <span className="flex items-center gap-3 rounded-full bg-[#0B1A12] px-7 py-3.5 text-[24px] font-bold tracking-[0.06em] text-white uppercase shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)]">
        <span className="h-3.5 w-3.5 rounded-full bg-[#E4F04A]" />
        {bf ? `Black Friday · até ${BF_END_SHORT}` : "Scooters elétricas"}
      </span>
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[26px] font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
      <span className="h-[5px] w-10 rounded-full" style={{ background: GREEN }} />
      {children}
    </p>
  );
}

function Name({ name, size }: { name: string; size: number }) {
  return (
    <h1 className="leading-[0.9] font-extrabold tracking-[-0.055em]" style={{ color: INK, fontSize: size }}>
      {name}
      <span style={{ color: "#3FBF6A" }}>.</span>
    </h1>
  );
}

function Photo({ p, className }: { p: MotoProduct; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo || p.gallery[0]?.src || "/mob/cmp-scooter.webp"} data-fallback="/mob/cmp-scooter.webp" alt="" className={cx("object-contain drop-shadow-[0_40px_40px_rgba(16,52,32,0.28)]", className)} />
  );
}

function Perks() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        ["package", "Entrega", "montada"],
        ["medal", "Certificado", "de garantia"],
        ["truck", "Entrega grátis", "em Maceió"],
        ["scooter", "Agende seu", "test drive"],
      ].map(([i, a, b]) => (
        <Card key={i} className="flex flex-col items-center rounded-[24px] px-3 pt-2.5 pb-2.5 text-center">
          <Ic n={i} size={50} />
          <p className="mt-1 text-[19px] leading-[1.1] font-bold" style={{ color: INK }}>
            {a}
            <br />
            {b}
          </p>
        </Card>
      ))}
    </div>
  );
}

function Footer({ brand, note }: { brand: ArtBrand; note: string }) {
  return (
    <div className="mt-auto pt-2">
      <p className="text-[14px] leading-snug text-[#0B1A12]/45">{note}</p>
      <div className="mt-2 flex items-center justify-between text-[18px] font-bold text-[#0B1A12]/55">
        <span>Quark Mobilidade{brand.instagram ? ` · @${brand.instagram.replace(/^@/, "")}` : ""}</span>
        {brand.whatsapp && <span style={{ color: GREEN }}>WhatsApp {formatPhone(brand.whatsapp)}</span>}
      </div>
    </div>
  );
}

/* ================================================================ arte de venda */

export function SaleArt({ p, brand }: { p: MotoProduct; brand: ArtBrand }) {
  const each = installmentValue(p.price, p.installments, p.rate);
  const total = Math.round(each * p.installments * 100) / 100;
  const [reais, cents] = brlPlain(each).replace("R$", "").trim().split(",");
  const s = p.specs;
  const bf = bfPhase().phase !== "encerrada";
  const specs = [
    { i: "battery", v: s.battery.replace(/\s*\d+\s*Ah.*/i, "") || s.battery, l: s.battery.match(/\d+\s*Ah/i)?.[0] ? `${s.battery.match(/\d+\s*Ah/i)![0]} · leve e durável` : "bateria" },
    { i: "pin", v: s.range, l: "de autonomia" },
    { i: "weight", v: s.load, l: "carga suportada" },
    { i: "brake", v: s.brakes.split(/[+,]/)[0].trim(), l: "freios" },
    { i: "lock", v: s.security || "Alarme", l: s.security ? "segurança" : "proteção" },
    { i: "plug", v: s.recharge, l: "de recarga" },
  ].filter((x) => x.v && x.v.trim());
  const nameSize = p.name.length > 10 ? 108 : p.name.length > 7 ? 124 : 144;

  return (
    <div data-art className="relative overflow-hidden font-[family-name:var(--font-outfit)] antialiased" style={{ width: ART_W, height: ART_H, color: INK }}>
      <Paper />
      <div className="relative flex h-full flex-col px-[56px] pt-[40px] pb-[30px] [&>*]:shrink-0">
        <Header />
        <div className="mt-4">
          <Kicker>{p.kicker || "Scooter elétrica"}</Kicker>
          <Name name={p.name} size={nameSize} />
          {p.pitch && <p className="mt-1.5 line-clamp-2 max-w-[940px] text-[25px] leading-[1.25] text-[#0B1A12]/72">{p.pitch}</p>}
        </div>

        {/* foto com cartões flutuantes */}
        <div className="relative mt-2 h-[330px]">
          <p className="absolute inset-x-[-56px] top-[40px] text-center text-[210px] leading-none font-extrabold tracking-[-0.06em] whitespace-nowrap text-[#0B1A12]/[0.045] uppercase">{p.name}</p>
          <div className="absolute top-[6px] left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full border-[2px] border-dashed border-[#1F9D55]/20" />
          <div className="absolute bottom-[6px] left-1/2 h-[34px] w-[520px] -translate-x-1/2 rounded-[50%] bg-[#0B1A12]/20 blur-[18px]" />
          <Photo p={p} className="absolute top-0 left-1/2 h-[330px] w-[560px] -translate-x-1/2" />
          <Card className="absolute top-[56px] left-0 flex items-center gap-3 rounded-[26px] py-3 pr-6 pl-4">
            <Ic n="bolt" size={52} />
            <span>
              <span className="block text-[34px] leading-none font-extrabold">{s.power || "1.000W"}</span>
              <span className="text-[18px] text-[#0B1A12]/55">motor forte</span>
            </span>
          </Card>
          <span className="absolute top-[0px] right-0 flex items-center gap-2 rounded-full border-[3px] border-[#F0533A] bg-white/90 px-5 py-2 text-[22px] font-extrabold tracking-[0.04em] text-[#E8432A] uppercase shadow-[0_10px_24px_-12px_rgba(232,67,42,0.6)]">
            <Ic n="fire" size={30} /> Poucas unidades
          </span>
          <Card className="absolute top-[150px] right-0 flex items-center gap-3 rounded-[26px] py-3 pr-6 pl-4">
            <Ic n="gauge" size={50} />
            <span>
              <span className="block text-[34px] leading-none font-extrabold">{s.speed || "32 km/h"}</span>
              <span className="text-[18px] text-[#0B1A12]/55">velocidade máx.</span>
            </span>
          </Card>
        </div>

        {/* especificações */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          {specs.slice(0, 6).map((x) => (
            <Card key={x.i} className="flex items-center gap-3 rounded-[22px] px-4 py-2.5">
              <Ic n={x.i} size={46} />
              <span className="min-w-0">
                <span className="block truncate text-[24px] leading-[1.05] font-extrabold">{x.v}</span>
                <span className="block truncate text-[16px] text-[#0B1A12]/55">{x.l}</span>
              </span>
            </Card>
          ))}
        </div>

        {/* preço */}
        <div className="mt-3 rounded-[34px] p-[3px]" style={{ background: "linear-gradient(120deg,#1FA06A,#7ED696 50%,#E4F04A)" }}>
          <div className="rounded-[31px] bg-[#FBFDF8] px-7 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-[10px] bg-[#0B1A12] px-3.5 py-1.5 text-[20px] font-extrabold tracking-[0.08em] text-[#E4F04A] uppercase">Sem entrada</span>
              <span className="rounded-[10px] bg-[#E6F6EA] px-3.5 py-1.5 text-[20px] font-extrabold tracking-[0.08em] uppercase" style={{ color: GREEN }}>
                {bf ? "Black Friday · no cartão" : "Parcelado no cartão"}
              </span>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <div className="flex items-end gap-3">
                <span className="pb-4 text-[24px] leading-tight font-extrabold">
                  <span className="text-[46px]">{p.installments}x</span>
                  <br />
                  de
                </span>
                <span className="pb-5 text-[40px] font-extrabold" style={{ color: GREEN }}>
                  R$
                </span>
                <span className="text-[128px] leading-[0.95] font-extrabold tracking-[-0.06em] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(180deg,#36B26A 0%,#1F9D55 60%,#168247 100%)" }}>
                  {reais}
                </span>
                {cents && cents !== "00" && <span className="self-start pt-5 text-[44px] font-extrabold" style={{ color: GREEN }}>,{cents}</span>}
              </div>
              <div className="pb-4 text-right">
                <p className="text-[24px] text-[#0B1A12]/55">ou à vista</p>
                <p className="text-[54px] leading-none font-extrabold tracking-[-0.04em]">{brl0(p.price)}</p>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between border-t-2 border-dashed border-[#0B1A12]/10 pt-3 text-[20px]">
              <span className="flex items-center gap-2 text-[#0B1A12]/70">
                <Ic n="card" size={28} /> pode usar <b className="text-[#0B1A12]">mais de um cartão</b>
              </span>
              <span className="text-[#0B1A12]/55">total a prazo {brl0(total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Perks />
        </div>

        <Footer
          brand={brand}
          note={`${p.installments}x de ${brlPlain(each)} no cartão (total ${brlPlain(total)}, juros de ${p.rate.toLocaleString("pt-BR")}% a.m.), sujeito à aprovação. À vista ${brlPlain(p.price)}. Autonomia varia com peso, relevo e modo de condução. Imagens ilustrativas.`}
        />
      </div>
    </div>
  );
}

/* ======================================================= arte de comparação */

export function SpecsArt({ p, brand }: { p: MotoProduct; brand: ArtBrand }) {
  const s = p.specs;
  const comum = WEAKER[0];
  const power = firstNumber(s.power) || 1000;
  const ratio = power / comum.power;
  const bars = [
    { t: "Potência do motor", ours: s.power || `${power.toLocaleString("pt-BR")}W`, v: power, them: `${comum.power}W`, tv: comum.power },
    { t: "Autonomia por carga", ours: s.range, v: firstNumber(s.range), them: `~${comum.rangeKm} km`, tv: comum.rangeKm },
    { t: "Carga suportada", ours: s.load, v: firstNumber(s.load), them: `${comum.loadKg} kg`, tv: comum.loadKg },
  ].filter((b) => b.v > 0);
  const lithium = /l[ií]tio|grafeno/i.test(s.battery);
  const rows = [
    { k: "Bateria", ours: lithium ? (s.battery.match(/l[ií]tio|grafeno/i)?.[0] ?? "Lítio").replace(/^./, (c) => c.toUpperCase()) : s.battery || "Lítio", them: "Chumbo" },
    { k: "Freios", ours: (s.brakes || "Disco").split(/[+,]/)[0].trim(), them: "Tambor" },
    { k: "Entrega", ours: "Montada + grátis", them: "Na caixa" },
    { k: "Garantia", ours: "Com certificado", them: "Varia" },
  ];
  const headline = ratio >= 2.5 ? `Quase ${Math.round(ratio)}x` : ratio >= 1.5 ? `${ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "Muito";

  return (
    <div data-art className="relative overflow-hidden font-[family-name:var(--font-outfit)] antialiased" style={{ width: ART_W, height: ART_H, color: INK }}>
      <Paper />
      <div className="relative flex h-full flex-col px-[56px] pt-[40px] pb-[30px] [&>*]:shrink-0">
        <Header />

        <div className="mt-4 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <Kicker>Por que a {p.name}?</Kicker>
            <h1 className="mt-1 text-[84px] leading-[0.92] font-extrabold tracking-[-0.055em]">
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(95deg,#1F9D55,#4FC38A 60%,#B6D93A)" }}>
                {headline}
              </span>{" "}
              mais
              <br />
              força<span style={{ color: "#3FBF6A" }}>.</span>
            </h1>
            <p className="mt-2 max-w-[580px] text-[22px] leading-snug text-[#0B1A12]/70">
              Muita scooter por aí tem só {comum.power}W e bateria de chumbo. Perde força na ladeira e para no meio do caminho.
            </p>
          </div>
          <div className="relative h-[280px] w-[380px] shrink-0">
            <div className="absolute inset-[10%] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.55), rgba(126,214,150,0))" }} />
            <Photo p={p} className="relative h-full w-full" />
          </div>
        </div>

        {/* barras */}
        <div className="mt-3 grid gap-2.5">
          {bars.map((b) => {
            const max = Math.max(b.v, b.tv, 1);
            return (
              <Card key={b.t} className="rounded-[26px] px-6 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[24px] font-extrabold">{b.t}</p>
                  <Ic n={b.t.startsWith("Pot") ? "bolt" : b.t.startsWith("Auto") ? "pin" : "weight"} size={34} />
                </div>
                <p className="mt-1 text-[16px] font-bold" style={{ color: GREEN }}>
                  Scooter {p.name}
                </p>
                <div className="mt-1 flex h-[40px] items-center justify-end rounded-[13px] pr-5 text-[24px] font-extrabold" style={{ width: "100%", background: "linear-gradient(90deg,#1FA06A,#7ED696 55%,#E4F04A)", color: INK }}>
                  {b.ours}
                </div>
                <p className="mt-1.5 text-[15px] font-semibold text-[#0B1A12]/45">Scooter comum*</p>
                <div className="mt-1 h-[34px] rounded-[13px] bg-[#0B1A12]/[0.06]">
                  <div className="flex h-full items-center justify-center rounded-[13px] bg-[#C9CFC9] text-[20px] font-bold text-white" style={{ width: `${Math.max(18, (b.tv / max) * 100)}%` }}>
                    {b.them}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* quadro */}
        <Card className="mt-2.5 rounded-[26px] px-6 py-1">
          {rows.map((r, i) => (
            <div key={r.k} className={cx("grid grid-cols-[200px_1fr_1fr] items-center py-2 text-[21px]", i > 0 && "border-t border-[#0B1A12]/[0.07]")}>
              <span className="text-[#0B1A12]/60">{r.k}</span>
              <span className="flex items-center gap-2 font-extrabold">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2FB061] text-[16px] text-white">✓</span>
                {r.ours}
              </span>
              <span className="flex items-center gap-2 text-[#0B1A12]/40">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0B1A12]/[0.07] text-[14px]">✕</span>
                {r.them}
              </span>
            </div>
          ))}
        </Card>

        <Footer brand={brand} note={`*Comparativo ilustrativo com valores típicos de scooters elétricas de entrada (${comum.power}W, bateria de chumbo); podem variar por modelo.`} />
      </div>
    </div>
  );
}

/** Baixa a arte escolhida em PNG 1080 × 1350. */
export async function downloadMotoArt(kind: "venda" | "ficha", p: MotoProduct, brand: ArtBrand) {
  const { downloadArtPng, pdfFileSlug } = await import("@/components/bf/download-pdf");
  const node = kind === "venda" ? <SaleArt p={p} brand={brand} /> : <SpecsArt p={p} brand={brand} />;
  await downloadArtPng(node, `${kind === "venda" ? "Arte" : "Comparativo"}-${pdfFileSlug(p.name)}.png`, { width: ART_W, height: ART_H });
}
