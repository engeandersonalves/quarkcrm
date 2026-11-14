"use client";

import type { CSSProperties, ReactNode } from "react";
import { Battery3D, Bolt3D, Coin3D, Gauge3D, Plug3D, Route3D, Shield3D, Weight3D, Card3D } from "@/components/icons3d";
import { brlPlain } from "@/lib/br";
import { formatPhone } from "@/lib/format";
import { WEAKER, firstNumber, installmentValue, type MotoProduct } from "@/lib/moto-products";

/**
 * Artes de venda das scooters em 1080 × 1350 (feed do Instagram / status),
 * no estilo liquid glass: vidro translúcido sobre luz verde, ícones 3D e a foto em destaque.
 */
export const ART_W = 1080;
export const ART_H = 1350;

export interface ArtBrand {
  whatsapp: string;
  instagram: string;
  city: string;
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";
const GT = `${GRAD} bg-clip-text text-transparent`;
const brl0 = (v: number) => brlPlain(v).replace(/,00$/, "");

/** Vidro líquido: degradê translúcido, borda de luz e reflexo no topo. */
const GLASS: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.07) 45%, rgba(255,255,255,0.03) 100%)",
  border: "1.5px solid rgba(255,255,255,0.26)",
  boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(255,255,255,0.08), inset 0 0 40px rgba(255,255,255,0.04), 0 40px 90px -30px rgba(0,0,0,0.8)",
  backdropFilter: "blur(22px) saturate(1.6)",
  WebkitBackdropFilter: "blur(22px) saturate(1.6)",
};

function Glass({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cx(/\babsolute\b/.test(className ?? "") ? "" : "relative", "overflow-hidden", className)} style={{ ...GLASS, ...style }}>
      <div className="pointer-events-none absolute -top-1/2 left-0 h-full w-full rotate-[-8deg] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Fundo comum: preto profundo com luzes verdes e amarelas, grade sutil e brilho diagonal. */
function Backdrop({ accent }: { accent: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-[#040605]" />
      <div className="absolute -top-[260px] -right-[220px] h-[900px] w-[900px] rounded-full opacity-80 blur-[40px]" style={{ background: "radial-gradient(closest-side, rgba(111,191,142,0.55), rgba(111,191,142,0))" }} />
      <div className="absolute -bottom-[300px] -left-[260px] h-[900px] w-[900px] rounded-full opacity-70 blur-[40px]" style={{ background: "radial-gradient(closest-side, rgba(243,233,59,0.30), rgba(243,233,59,0))" }} />
      <div className="absolute top-[420px] left-[200px] h-[620px] w-[680px] rounded-full opacity-60 blur-[30px]" style={{ background: `radial-gradient(closest-side, ${accent}55, transparent)` }} />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "60px 60px", maskImage: "radial-gradient(closest-side, #000, transparent)" }}
      />
      <div className="absolute -top-40 left-[38%] h-[1700px] w-[160px] rotate-[24deg] bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.07),rgba(255,255,255,0))]" />
    </>
  );
}

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/bf/logo.png" alt="" className="h-[58px] w-auto" />;
}

function Photo({ p, className }: { p: MotoProduct; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo || p.gallery[0]?.src || "/mob/cmp-scooter.webp"} data-fallback="/mob/cmp-scooter.webp" alt="" className={cx("object-contain drop-shadow-[0_50px_60px_rgba(0,0,0,0.85)]", className)} />
  );
}

/* ================================================================ arte de venda */

export function SaleArt({ p, brand }: { p: MotoProduct; brand: ArtBrand }) {
  const each = installmentValue(p.price, p.installments, p.rate);
  const s = p.specs;
  const chips = [
    { icon: <Bolt3D size={64} />, v: s.power || "1.000W", l: "motor elétrico", pos: "left-[52px] top-[520px]" },
    { icon: <Route3D size={64} />, v: s.range || "—", l: "de autonomia", pos: "right-[52px] top-[470px]" },
    { icon: <Battery3D size={64} />, v: (s.battery || "—").replace(/^l[ií]tio\s*/i, "Lítio "), l: "bateria", pos: "right-[70px] top-[760px]" },
  ];
  return (
    <div data-art className="relative overflow-hidden font-[family-name:var(--font-outfit)] text-white antialiased" style={{ width: ART_W, height: ART_H }}>
      <Backdrop accent={p.accent} />

      {/* topo */}
      <div className="absolute inset-x-[64px] top-[60px] flex items-center justify-between">
        <Logo />
        <Glass className="rounded-full px-7 py-3.5">
          <p className="text-[22px] font-semibold tracking-[0.18em] text-white/90 uppercase">Quark Mobilidade</p>
        </Glass>
      </div>

      {/* título */}
      <div className="absolute inset-x-[64px] top-[170px]">
        <p className="text-[26px] font-bold tracking-[0.24em] text-[#A9DE86] uppercase">{p.kicker || "Scooter elétrica"}</p>
        <h1 className={cx("mt-1 text-[168px] leading-[0.86] font-bold tracking-[-0.06em]", GT)}>{p.name}</h1>
        {p.pitch && <p className="mt-4 max-w-[780px] text-[32px] leading-[1.2] text-white/75">{p.pitch}</p>}
      </div>

      {/* nome gigante ao fundo + foto */}
      <p className="absolute inset-x-0 top-[600px] text-center text-[300px] leading-none font-bold tracking-[-0.07em] text-white/[0.035]">{p.name}</p>
      <div className="absolute top-[930px] left-1/2 h-[60px] w-[640px] -translate-x-1/2 rounded-[50%] bg-black/70 blur-[24px]" />
      <div className="absolute top-[455px] left-1/2 h-[520px] w-[760px] -translate-x-1/2">
        <Photo p={p} className="h-full w-full" />
      </div>

      {/* chips de vidro com ícones 3D */}
      {chips.map((c) => (
        <Glass key={c.l} className={cx("absolute flex items-center gap-4 rounded-[30px] py-4 pr-7 pl-4", c.pos)}>
          <div className="flex items-center gap-4">
            <span className="grid h-[76px] w-[76px] place-items-center rounded-[22px] bg-white/[0.08] ring-1 ring-white/15">{c.icon}</span>
            <span>
              <span className="block text-[36px] leading-none font-bold tracking-[-0.02em]">{c.v}</span>
              <span className="mt-1 block text-[20px] text-white/60">{c.l}</span>
            </span>
          </div>
        </Glass>
      ))}

      {/* preço */}
      <Glass className="absolute inset-x-[64px] top-[1012px] rounded-[44px] px-10 py-8">
        <div className="flex items-center gap-8">
          <div className="min-w-0">
            <p className="text-[22px] font-semibold tracking-[0.14em] text-white/60 uppercase">À vista</p>
            <p className="text-[76px] leading-none font-bold tracking-[-0.05em]">{brl0(p.price)}</p>
          </div>
          <div className="h-[110px] w-px bg-white/20" />
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <Card3D size={88} />
            <div>
              <p className="text-[22px] font-semibold tracking-[0.14em] text-white/60 uppercase">ou no cartão</p>
              <p className="leading-none">
                <span className="text-[44px] font-bold">{p.installments}x </span>
                <span className={cx("text-[76px] font-bold tracking-[-0.05em]", GT)}>{brlPlain(each)}</span>
              </p>
            </div>
          </div>
        </div>
      </Glass>

      {/* rodapé */}
      <div className="absolute inset-x-[64px] bottom-[56px] flex items-center gap-4">
        {[
          { icon: <Shield3D size={44} />, t: "Garantia 90 dias" },
          { icon: <Plug3D size={44} />, t: "Carrega na tomada" },
          { icon: <Coin3D size={44} />, t: "Sem gasolina" },
        ].map((x) => (
          <Glass key={x.t} className="rounded-full py-2.5 pr-6 pl-3">
            <span className="flex items-center gap-2.5 text-[22px] font-semibold whitespace-nowrap">
              {x.icon}
              {x.t}
            </span>
          </Glass>
        ))}
        {brand.whatsapp && (
          <span className={cx("ml-auto rounded-full px-7 py-4 text-[26px] font-bold whitespace-nowrap text-[#0A0D0B]", GRAD)}>{formatPhone(brand.whatsapp)}</span>
        )}
      </div>
    </div>
  );
}

/* ======================================================= arte de especificações */

export function SpecsArt({ p, brand }: { p: MotoProduct; brand: ArtBrand }) {
  const s = p.specs;
  const tiles = [
    { icon: <Bolt3D size={52} />, v: s.power, l: "Motor" },
    { icon: <Battery3D size={52} />, v: s.battery, l: "Bateria" },
    { icon: <Route3D size={52} />, v: s.range, l: "Autonomia" },
    { icon: <Gauge3D size={52} />, v: s.speed, l: "Velocidade máx." },
    { icon: <Plug3D size={52} />, v: s.recharge, l: "Recarga completa" },
    { icon: <Weight3D size={52} />, v: s.load, l: "Carga máxima" },
    { icon: <Shield3D size={52} />, v: s.brakes, l: "Freios" },
    { icon: <Coin3D size={52} />, v: s.security || s.highlight || s.weight, l: s.security ? "Segurança" : s.highlight ? "Destaque" : "Peso" },
  ].filter((t) => t.v && t.v.trim());

  const ours = { power: firstNumber(s.power) || 1000, rangeKm: firstNumber(s.range), speedKmh: firstNumber(s.speed), loadKg: firstNumber(s.load) };
  const metrics: { k: keyof typeof ours; label: string; unit: string }[] = [
    { k: "power", label: "Potência do motor", unit: "W" },
    { k: "rangeKm", label: "Autonomia por carga", unit: "km" },
    { k: "loadKg", label: "Carga suportada", unit: "kg" },
  ];
  const rows = metrics.filter((m) => ours[m.k] > 0);
  const nameSize = p.name.length > 9 ? 84 : p.name.length > 6 ? 100 : 120;

  return (
    <div data-art className="relative overflow-hidden font-[family-name:var(--font-outfit)] text-white antialiased" style={{ width: ART_W, height: ART_H }}>
      <Backdrop accent={p.accent} />
      <div className="relative flex h-full flex-col px-[64px] pt-[60px] pb-[48px]">
        <div className="flex items-center justify-between">
          <Logo />
          <Glass className="rounded-full px-7 py-3.5">
            <p className="text-[22px] font-semibold tracking-[0.18em] text-white/90 uppercase">Ficha técnica</p>
          </Glass>
        </div>

        {/* cabeçalho com foto */}
        <div className="mt-6 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-bold tracking-[0.24em] text-[#A9DE86] uppercase">{p.kicker || "Scooter elétrica"}</p>
            <h1 className={cx("leading-[0.9] font-bold tracking-[-0.06em] break-words", GT)} style={{ fontSize: nameSize }}>
              {p.name}
            </h1>
            <p className="mt-3 text-[28px] font-semibold text-white/80">
              vs. modelos <span className="text-white/45 line-through decoration-[#FF453A] decoration-[3px]">comuns</span> do mercado
            </p>
          </div>
          <div className="relative h-[260px] w-[360px] shrink-0">
            <div className="absolute inset-0 rounded-full blur-[30px]" style={{ background: `radial-gradient(closest-side, ${p.accent}66, transparent)` }} />
            <Photo p={p} className="relative h-full w-full" />
          </div>
        </div>

        {/* especificações */}
        <div className="mt-6 grid grid-cols-4 gap-3.5">
          {tiles.slice(0, 8).map((t) => (
            <Glass key={t.l} className="rounded-[28px] p-4">
              <span className="grid h-[62px] w-[62px] place-items-center rounded-[18px] bg-white/[0.08] ring-1 ring-white/15">{t.icon}</span>
              <p className="mt-3 truncate text-[26px] leading-[1.1] font-bold tracking-[-0.02em]">{t.v}</p>
              <p className="mt-0.5 text-[17px] text-white/55">{t.l}</p>
            </Glass>
          ))}
        </div>

        {/* comparação */}
        <Glass className="mt-6 rounded-[36px] px-8 py-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-[28px] font-bold">Mais força, mais longe</p>
            <div className="flex gap-4 text-[16px] text-white/65">
              <span className="flex items-center gap-2">
                <span className={cx("h-3 w-3 rounded-full", GRAD)} /> {p.name}
              </span>
              {WEAKER.map((w, i) => (
                <span key={w.name} className="flex items-center gap-2">
                  <span className={cx("h-3 w-3 rounded-full", i === 0 ? "bg-white/45" : "bg-white/20")} /> {w.name}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            {rows.map((m) => {
              const vals = [ours[m.k], ...WEAKER.map((w) => w[m.k])];
              const max = Math.max(...vals, 1);
              return (
                <div key={m.k} className="grid grid-cols-[210px_1fr] items-center gap-5">
                  <p className="text-[21px] font-semibold text-white/80">{m.label}</p>
                  <div className="grid gap-1.5">
                    {vals.map((v, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-[14px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className={cx("h-full rounded-full", i === 0 ? "bg-[linear-gradient(90deg,#1FA06A,#9FDB7C,#F3E93B)]" : i === 1 ? "bg-white/45" : "bg-white/20")} style={{ width: `${Math.max(6, (v / max) * 100)}%` }} />
                        </div>
                        <span className={cx("w-[100px] text-right text-[18px] tabular-nums", i === 0 ? "font-bold text-white" : "text-white/55")}>
                          {v.toLocaleString("pt-BR")} {m.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>

        <div className="mt-auto flex items-center justify-between gap-4 pt-4 text-[17px] text-white/45">
          <span>*Referência: modelos de entrada vendidos no mercado. Valores podem variar.</span>
          <span className="shrink-0 font-semibold text-white/75">{[brand.whatsapp && formatPhone(brand.whatsapp), brand.instagram && `@${brand.instagram.replace(/^@/, "")}`].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
    </div>
  );
}

/** Baixa a arte escolhida em PNG 1080 × 1350. */
export async function downloadMotoArt(kind: "venda" | "ficha", p: MotoProduct, brand: ArtBrand) {
  const { downloadArtPng, pdfFileSlug } = await import("@/components/bf/download-pdf");
  const node = kind === "venda" ? <SaleArt p={p} brand={brand} /> : <SpecsArt p={p} brand={brand} />;
  await downloadArtPng(node, `${kind === "venda" ? "Arte" : "Ficha"}-${pdfFileSlug(p.name)}.png`, { width: ART_W, height: ART_H });
}
