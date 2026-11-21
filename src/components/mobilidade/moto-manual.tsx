"use client";

import {
  Archive,
  Baby,
  BatteryCharging,
  CircleDot,
  ClipboardCheck,
  Cog,
  Droplets,
  Gauge,
  HardHat,
  Lightbulb,
  MoveHorizontal,
  Package,
  Phone,
  Plug,
  PlugZap,
  Power,
  Recycle,
  Route,
  ShieldCheck,
  Thermometer,
  TriangleAlert,
  Weight,
  Wrench,
  ZapOff,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PDF_PAGE_H, PDF_PAGE_W } from "@/components/bf/proposal-pdf";
import { dateBr, maskDoc } from "@/lib/br";
import { formatPhone } from "@/lib/format";
import { MANUAL_SPEC_FIELDS, type MotoProduct } from "@/lib/moto-products";
import { revisionPlan, shortNo, type MotoData } from "@/lib/moto-sale";

/**
 * Manual do proprietário da scooter, no design branco da
 * Quark Mobilidade (A4). Cada bloco tem altura previsível e textos com limite de linhas,
 * para nenhuma página estourar, com ou sem os dados do cliente.
 */

export interface ManualOwner {
  name: string;
  doc: string;
  phone: string;
  city: string;
  color: string;
  year: string;
  chassis: string;
  motorNo: string;
  batteryNo: string;
  chargerNo: string;
  purchaseDate: string;
  deliveryDate: string;
  warrantyDays: number;
  /** Número do certificado e código de verificação (vendas). */
  number?: string;
  code?: string;
  signedAt?: string | null;
}

export interface ManualBrand {
  company: string;
  legalName: string;
  cnpj: string;
  whatsapp: string;
  instagram: string;
  city: string;
}

export const emptyOwner = (p: Partial<ManualOwner> = {}): ManualOwner => ({
  name: "",
  doc: "",
  phone: "",
  city: "",
  color: "",
  year: String(new Date().getFullYear()),
  chassis: "",
  motorNo: "",
  batteryNo: "",
  chargerNo: "",
  purchaseDate: "",
  deliveryDate: "",
  warrantyDays: 90,
  ...p,
});

/** Dados do certificado a partir de uma venda. */
export function ownerFromSale(d: MotoData, id: string | null, signedAt?: string | null): ManualOwner {
  return emptyOwner({
    name: d.client.name,
    doc: d.client.doc,
    phone: d.client.phone,
    city: [d.client.city, d.client.state].filter(Boolean).join("/"),
    color: d.color,
    year: String(d.year || ""),
    chassis: d.chassis,
    motorNo: d.motorNo,
    batteryNo: d.batteryNo,
    chargerNo: d.chargerNo,
    purchaseDate: d.date,
    deliveryDate: d.delivery.date,
    warrantyDays: d.warrantyDays || 90,
    number: shortNo(id, "GAR"),
    code: (id ?? "").replace(/-/g, "").slice(-10).toUpperCase() || undefined,
    signedAt: signedAt ?? null,
  });
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const INK = "#0B1A12";
const GREEN = "#1F9D55";
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const clean = (v: string | undefined | null) => (v ?? "").replace(/\s+/g, " ").trim();

const CARD: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(11,26,18,0.07)",
  boxShadow: "0 12px 28px -18px rgba(16,52,32,0.35), 0 1px 2px rgba(16,52,32,0.05)",
};
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={className} style={CARD}>
      {children}
    </div>
  );
}

/** Ícone 3D do catálogo (só onde o símbolo corresponde ao assunto). */
function Ic({ n, size = 34 }: { n: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/mob/ic/${n}.png`} alt="" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

/** Ícone de linha num quadradinho verde: consistente em todas as listas. */
function Tile({ icon: I, size = 40, dark }: { icon: LucideIcon; size?: number; dark?: boolean }) {
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-[12px]", dark ? "bg-[#0B1A12] text-[#E4F04A]" : "bg-[#EAF6EC] text-[#1F9D55]")} style={{ width: size, height: size }}>
      <I style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  );
}

function Page({ n, total, model, children, plain }: { n: number; total: number; model: string; children: ReactNode; plain?: boolean }) {
  return (
    <div data-pdf-page className="relative overflow-hidden font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      <div className="absolute inset-0 bg-[#F7F9F4]" />
      <div className="absolute -top-[220px] -left-[240px] h-[620px] w-[620px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.34), rgba(126,214,150,0))" }} />
      <div className="absolute top-[360px] -right-[280px] h-[620px] w-[620px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(236,240,120,0.28), rgba(236,240,120,0))" }} />
      <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: GRAD }} />
      <div className="relative flex h-full flex-col px-[54px] pt-[34px] pb-[24px] [&>*]:shrink-0">
        {!plain && (
          <div className="flex h-[44px] items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mob/ic/logo.png" alt="" className="h-[40px] w-auto" />
            <span className="text-[13px] font-bold tracking-[0.14em] text-[#0B1A12]/55 uppercase">Manual · {model}</span>
          </div>
        )}
        {children}
        <div className="mt-auto flex h-[32px] items-end justify-between border-t border-[#0B1A12]/10 text-[13px] font-semibold text-[#0B1A12]/50">
          <span>Quark Mobilidade · leia antes do primeiro uso</span>
          <span className="tabular-nums">
            {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ no, kicker, title, className }: { no: string; kicker: string; title: string; className?: string }) {
  return (
    <div className={cx("flex items-end gap-4", className)}>
      <span className="text-[64px] leading-[0.8] font-extrabold tracking-[-0.06em] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(180deg,#36B26A,#B6D93A)" }}>
        {no}
      </span>
      <div className="min-w-0 pb-0.5">
        <p className="text-[15px] font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
          {kicker}
        </p>
        <h2 className="text-[36px] leading-[1.02] font-extrabold tracking-[-0.035em]">
          {title}
          <span style={{ color: "#3FBF6A" }}>.</span>
        </h2>
      </div>
    </div>
  );
}

function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[14px] font-bold tracking-[0.14em] text-[#0B1A12]/55 uppercase", className)}>{children}</p>;
}

/** Valor da ficha ou linha para preencher à mão. */
function Fill({ v, w = 120, mono }: { v: string; w?: number; mono?: boolean }) {
  return v ? <span className={cx(mono && "tracking-[0.06em] tabular-nums uppercase")}>{v}</span> : <span className="inline-block border-b border-[#0B1A12]/30" style={{ width: w, height: 18 }} />;
}

/** Linha "rótulo ........ valor" (ou linha em branco para preencher). */
function Row({ k, v, w = 140, mono, wide, h = 34 }: { k: string; v: string; w?: number; mono?: boolean; wide?: boolean; h?: number }) {
  return (
    <div style={{ height: h }} className={cx("flex items-center justify-between gap-3 border-b border-dashed border-[#0B1A12]/12 text-[16px]", wide && "col-span-2")}>
      <span className="shrink-0 text-[#0B1A12]/60">{k}</span>
      <span className="min-w-0 truncate text-right font-semibold">
        <Fill v={clean(v)} w={w} mono={mono} />
      </span>
    </div>
  );
}


/* ======================================================================= */

export function MotoManualPages({ p, brand, owner: o }: { p: MotoProduct; brand: ManualBrand; owner?: ManualOwner | null }) {
  const owner = o ?? emptyOwner();
  const s = p.specs;
  const days = owner.warrantyDays || 90;
  const name = clean(p.name) || "Scooter";
  const main = [
    { i: "bolt", k: "Potência do motor", v: clean(s.power) },
    { i: "battery", k: "Bateria", v: clean(s.battery) },
    { i: "pin", k: "Autonomia estimada", v: clean(s.range) },
    { i: "gauge", k: "Velocidade máxima", v: clean(s.speed) },
    { i: "plug", k: "Tempo de recarga", v: clean(s.recharge) },
    { i: "weight", k: "Carga máxima", v: clean(s.load) },
    { i: "brake", k: "Freios", v: clean(s.brakes) },
    { i: "lock", k: "Segurança", v: clean(s.security) },
  ].filter((x) => x.v);
  const extra = [...MANUAL_SPEC_FIELDS.map((f) => ({ k: f.label, v: clean(s[f.k] as string | undefined) })), { k: "Peso", v: clean(s.weight) }].filter((x) => x.v).slice(0, 14);
  const contact = [brand.whatsapp && formatPhone(brand.whatsapp), brand.instagram && `@${brand.instagram.replace(/^@/, "")}`].filter(Boolean).join(" · ");

  /* As páginas são uma lista: a numeração e o sumário saem dela, mesmo quando uma página some. */
  const pages: { id: string; toc?: string; plain?: boolean; body: ReactNode }[] = [];

  pages.push({
    id: "capa",
    plain: true,
    body: (
      <>
        <div className="flex h-[54px] items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="" className="h-[52px] w-auto" />
          <span className="flex items-center gap-2 rounded-full bg-[#0B1A12] px-5 py-2.5 text-[14px] font-bold tracking-[0.12em] text-white uppercase">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E4F04A]" /> Manual do proprietário
          </span>
        </div>
        <div className="mt-12 text-center">
          <p className="text-[16px] font-bold tracking-[0.26em] uppercase" style={{ color: GREEN }}>
            {clean(p.kicker) || "Scooter elétrica"}
          </p>
          <h1 className="mx-auto mt-2 max-w-[680px] text-[100px] leading-[0.88] font-extrabold tracking-[-0.055em] break-words">
            {name}
            <span style={{ color: "#3FBF6A" }}>.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[21px] leading-snug text-[#0B1A12]/70">Uso seguro, cuidados com a bateria, manutenção e garantia, tudo em um só lugar.</p>
        </div>
        <div className="relative mt-8 h-[440px]">
          <div className="absolute top-[18px] left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.35), rgba(126,214,150,0))" }} />
          <div className="absolute top-[14px] left-1/2 h-[388px] w-[388px] -translate-x-1/2 rounded-full border border-dashed border-[#1F9D55]/25" />
          <div className="absolute bottom-[10px] left-1/2 h-[26px] w-[420px] -translate-x-1/2 rounded-[50%] bg-[#0B1A12]/20 blur-[14px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.photo || "/mob/cmp-scooter.webp"} data-fallback="/mob/cmp-scooter.webp" alt="" className="absolute top-0 left-1/2 h-[440px] w-[640px] -translate-x-1/2 object-contain drop-shadow-[0_26px_26px_rgba(16,52,32,0.25)]" />
        </div>
        <div className="grow" />
        <div className="grid grid-cols-3 divide-x divide-[#0B1A12]/10 rounded-[24px] bg-white py-5" style={{ boxShadow: CARD.boxShadow, border: CARD.border }}>
          {main.slice(0, 3).map((m) => ({ ...m, v: m.v.replace(/\s*\([^)]*\)\s*$/, "") })).map((x) => (
            <div key={x.k} className="flex items-center justify-center gap-3 px-3">
              <Ic n={x.i} size={40} />
              <span className="min-w-0">
                <span className={cx("line-clamp-2 block leading-tight font-extrabold", x.v.length > 14 ? "text-[17px]" : "text-[21px]")}>{x.v}</span>
                <span className="block text-[14px] text-[#0B1A12]/60">{x.k}</span>
              </span>
            </div>
          ))}
        </div>
        {owner.name ? (
          <p className="mt-4 mb-3 h-[22px] truncate text-center text-[16px] text-[#0B1A12]/65">
            Exemplar de <b className="text-[#0B1A12]">{clean(owner.name)}</b>
            {owner.chassis ? ` · chassi ${clean(owner.chassis).toUpperCase()}` : ""}
          </p>
        ) : (
          <div className="mt-4 mb-3 h-[22px]" />
        )}
      </>
    ),
  });

  // Sumário: preenchido depois que todas as páginas existem.
  const tocAt = pages.length;
  pages.push({ id: "boas-vindas", body: null });

  pages.push({
    id: "identificacao",
    body: (
      <>
        <Section no="✓" kicker="Seus dados" title="Identificação do veículo" className="mt-7" />
        <Card className="mt-6 rounded-[26px] px-7 py-5">
          <div className="flex items-center justify-between">
            <Sub>Ficha do veículo</Sub>
            <span className="text-[14px] text-[#0B1A12]/50">{owner.name ? "preenchido pela Quark" : "preencha na entrega"}</span>
          </div>
          <div className="mt-2 grid grid-cols-1">
            {[
              ["Proprietário", owner.name, 380, false],
              ["CPF / CNPJ", owner.doc ? maskDoc(owner.doc) : "", 200, false],
              ["Telefone", owner.phone ? formatPhone(owner.phone) : "", 200, false],
              ["Modelo", [name, clean(owner.color), clean(owner.year)].filter(Boolean).join(" · "), 0, false],
              ["Data de entrega", owner.deliveryDate ? dateBr(owner.deliveryDate) : "", 160, false],
              ["Nº do chassi", owner.chassis, 260, true],
              ["Nº do motor", owner.motorNo, 260, true],
              ["Nº da bateria", owner.batteryNo, 260, true],
              ["Nº do carregador", owner.chargerNo, 260, true],
            ].map(([k, v, w, mono]) => (
              <Row key={k as string} k={k as string} v={v as string} w={w as number} mono={mono as boolean} h={50} />
            ))}
          </div>
        </Card>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            [ShieldCheck, `${days} dias`, "de garantia contra defeitos de fabricação"],
            [Package, "Entregue montada", "testada e revisada pela nossa equipe"],
            [Phone, "Assistência", contact || clean(brand.city) || "fale com a Quark"],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="rounded-[22px] px-5 py-5">
              <Tile icon={I as LucideIcon} size={48} />
              <p className="mt-3 text-[19px] leading-tight font-extrabold">{t as string}</p>
              <p className="mt-1 line-clamp-2 text-[15px] leading-snug text-[#0B1A12]/60">{d as string}</p>
            </Card>
          ))}
        </div>
        <div className="grow" />
        <p className="mb-2 text-center text-[15px] text-[#0B1A12]/55">Guarde este manual junto com o comprovante de compra.</p>
      </>
    ),
  });

  pages.push({
    id: "ficha",
    toc: "Ficha técnica",
    body: (
      <>
        <Section no="01" kicker="Conheça a sua scooter" title="Ficha técnica" className="mt-7" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {main.map((x) => (
            <Card key={x.k} className="flex items-center gap-4 rounded-[22px] px-5 py-4">
              <Ic n={x.i} size={46} />
              <span className="min-w-0">
                <span className="line-clamp-2 block text-[20px] leading-tight font-extrabold">{x.v}</span>
                <span className="mt-0.5 block text-[15px] text-[#0B1A12]/60">{x.k}</span>
              </span>
            </Card>
          ))}
        </div>
        <div className="grow" />
        <div className="mt-5 rounded-[22px] bg-[#0B1A12] px-7 py-6 text-[16px] leading-relaxed text-white/85">
          <p className="mb-1 text-[17px] font-extrabold text-[#E4F04A]">Sobre a autonomia</p>O alcance informado é medido em condições ideais. Na prática, varia com o peso transportado, subidas, temperatura, calibragem dos pneus, paradas e o modo de condução.
        </div>
        <p className="mt-4 mb-2 text-[14px] leading-snug text-[#0B1A12]/55">Veículo autopropelido conforme a Resolução CONTRAN nº 996/2023 (até 1.000 W e 32 km/h). Especificações sujeitas a alteração pelo fabricante.</p>
      </>
    ),
  });

  if (extra.length)
    pages.push({
      id: "fabricante",
      body: (
        <>
          <Section no="01" kicker="Ficha técnica" title="Especificações do fabricante" className="mt-7" />
          <Card className="mt-6 rounded-[26px] px-7 py-3">
            {extra.map((x, i) => (
              <div key={x.k} className={cx("grid grid-cols-[200px_1fr] gap-5 py-3.5 text-[16px]", i > 0 && "border-t border-[#0B1A12]/[0.07]")}>
                <span className="text-[#0B1A12]/60">{x.k}</span>
                <span className="line-clamp-2 font-semibold">{x.v}</span>
              </div>
            ))}
          </Card>
        </>
      ),
    });

  pages.push({
    id: "antes",
    toc: "Antes de rodar",
    body: (
      <>
        <Section no="02" kicker="Antes de rodar" title="O que você recebe e o checklist" className="mt-7" />
        <Card className="mt-6 rounded-[26px] px-7 py-6">
          <div className="flex items-center gap-4">
            <Tile icon={Package} size={48} />
            <p className="text-[21px] font-extrabold">O que você recebe</p>
          </div>
          <ul className="mt-4 grid gap-2.5 text-[17px] text-[#0B1A12]/80">
            {["Scooter montada, com guidão e retrovisores", "Bateria instalada e carregada", "Carregador original bivolt", "Chaves, controle do alarme e cartão NFC", "Este manual do proprietário"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2FB061]" />
                {t}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="mt-4 rounded-[26px] px-7 py-6">
          <div className="flex items-center gap-4">
            <Tile icon={ClipboardCheck} size={48} dark />
            <div>
              <p className="text-[21px] font-extrabold">Checklist de 1 minuto</p>
              <p className="text-[15px] text-[#0B1A12]/60">Antes de cada saída</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
            {[
              [BatteryCharging, "Carga da bateria", "confira no painel"],
              [CircleDot, "Freios", "aperte os dois manetes"],
              [Gauge, "Pneus", "calibragem e desgaste"],
              [Lightbulb, "Luzes e buzina", "farol, setas e lanterna"],
              [Wrench, "Parafusos", "guidão, rodas e banco"],
              [MoveHorizontal, "Alinhamento", "guidão e rodas retos"],
            ].map(([I, t, d]) => (
              <div key={t as string} className="flex items-center gap-3.5">
                <Tile icon={I as LucideIcon} size={46} />
                <span>
                  <span className="block text-[17px] leading-tight font-bold">{t as string}</span>
                  <span className="block text-[15px] text-[#0B1A12]/60">{d as string}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </>
    ),
  });

  pages.push({
    id: "seguranca",
    toc: "Segurança",
    body: (
      <>
        <Section no="03" kicker="Segurança" title="Regras para rodar tranquilo" className="mt-7" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            [HardHat, "Use sempre capacete", "e acenda o farol à noite e na chuva"],
            [Weight, "Respeite a carga máxima", s.load ? `até ${clean(s.load).replace(/^at[ée]\s*/i, "")}, incluindo o garupa` : "indicada na ficha técnica"],
            [ZapOff, "Não altere a parte elétrica", "nem tente aumentar a potência"],
            [Plug, "Só o carregador original", "ou um aprovado pela Quark"],
            [Droplets, "Proteja da água", "sem jato de alta pressão e sem alagamentos"],
            [Baby, "Longe de crianças", "chaves, carregador e bateria"],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="flex items-center gap-4 rounded-[22px] px-5 py-4">
              <Tile icon={I as LucideIcon} size={48} />
              <span className="min-w-0">
                <span className="block text-[18px] leading-tight font-extrabold">{t as string}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-[#0B1A12]/60">{d as string}</span>
              </span>
            </Card>
          ))}
        </div>
        <Card className="mt-4 rounded-[26px] px-7 py-6">
          <div className="flex items-center gap-4">
            <Tile icon={Route} size={48} dark />
            <p className="text-[21px] font-extrabold">Onde e como rodar</p>
          </div>
          <ul className="mt-4 grid gap-2.5 text-[16.5px] text-[#0B1A12]/80">
            {["Siga as regras de trânsito e as normas da sua cidade.", "Comece no modo mais lento até se acostumar.", "Freie com os dois manetes, com antecedência.", "Em piso molhado, reduza a velocidade.", "Não leve objetos que tirem o equilíbrio.", "Desligue e retire a chave ao estacionar."].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2FB061]" />
                {t}
              </li>
            ))}
          </ul>
        </Card>
        <div className="grow" />
        <div className="mt-4 mb-2 flex items-center gap-5 rounded-[24px] bg-[#0B1A12] px-7 py-5 text-white">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] bg-white/10 text-[#E4F04A]">
            <Phone className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold tracking-[0.18em] text-[#E4F04A] uppercase">Precisa de ajuda?</p>
            <p className="mt-0.5 text-[20px] font-extrabold">Fale com a {clean(brand.company) || "Quark"}</p>
            <p className="mt-0.5 truncate text-[15px] text-white/70">{[contact, clean(brand.city)].filter(Boolean).join(" · ") || "Use os contatos do seu comprovante"}</p>
          </div>
        </div>
      </>
    ),
  });

  pages.push({
    id: "bateria",
    toc: "Bateria e recarga",
    body: (
      <>
        <Section no="04" kicker="Bateria e recarga" title="Cuide bem e ela dura anos" className="mt-7" />
        <Card className="mt-6 rounded-[26px] px-7 py-6">
          <div className="flex items-center gap-4">
            <Ic n="plug" size={44} />
            <p className="text-[21px] font-extrabold">Como carregar</p>
            <span className="ml-auto rounded-full bg-[#EAF6EC] px-4 py-1.5 text-[15px] font-bold whitespace-nowrap" style={{ color: GREEN }}>
              Recarga completa: {clean(s.recharge) || "cerca de 6 h"}
            </span>
          </div>
          <ol className="mt-5 grid gap-3.5">
            {[
              "Desligue a scooter e retire a chave.",
              "Conecte primeiro o carregador na scooter (ou na bateria).",
              "Depois, ligue o carregador numa tomada de 3 pinos, de 100 a 240 V.",
              "Com a carga completa, tire da tomada e depois desconecte da scooter.",
            ].map((t, i) => (
              <li key={t} className="flex items-center gap-4 text-[17px]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] font-extrabold" style={{ background: GRAD }}>
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </Card>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            [BatteryCharging, "No dia a dia", "Recarregue perto de 20%. Não espere zerar nem deixe descarregada por dias."],
            [Thermometer, "Temperatura", "Guarde e carregue em local fresco e ventilado, perto de 25 °C, longe do sol forte."],
            [Archive, "Se for guardar", "Desconectada, aguenta de 5 a 6 meses. Ligada ao carregador, recarregue 2 a 3 vezes por mês."],
            [Recycle, "Descarte correto", "Nunca no lixo comum: leve a um ponto de coleta ou à Quark. Não abra a bateria."],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="rounded-[22px] px-6 py-5">
              <div className="flex items-center gap-3.5">
                <Tile icon={I as LucideIcon} size={44} />
                <p className="text-[19px] font-extrabold">{t as string}</p>
              </div>
              <p className="mt-2.5 text-[15.5px] leading-relaxed text-[#0B1A12]/75">{d as string}</p>
            </Card>
          ))}
        </div>
        <div className="grow" />
        <div className="mt-4 mb-2 rounded-[22px] bg-[#0B1A12] px-7 py-5 text-[15.5px] leading-relaxed text-white/85">
          <p className="mb-1 text-[17px] font-extrabold text-[#E4F04A]">Para carregar com segurança</p>
          Carregue em local ventilado e à vista. Ligue direto na tomada, sem extensões. Se notar cheiro de queimado, calor excessivo ou a bateria estufada, desligue e fale com a assistência.
        </div>
      </>
    ),
  });

  pages.push({
    id: "manutencao",
    toc: "Manutenção",
    body: (
      <>
        <Section no="05" kicker="Manutenção" title="Plano de cuidados" className="mt-7" />
        <Card className="mt-6 overflow-hidden rounded-[24px]">
          <div className="grid grid-cols-[200px_1fr] bg-[#0B1A12] px-7 py-3.5 text-[14px] font-bold tracking-[0.12em] text-white uppercase">
            <span>Quando</span>
            <span>O que fazer</span>
          </div>
          {[
            ["Toda semana", "Calibrar os pneus e conferir o desgaste."],
            ["Todo mês", "Conferir freios, conectores elétricos e parafusos."],
            ...revisionPlan().map((r) => [r.when, `Revisão recomendada: ${r.what.charAt(0).toLowerCase()}${r.what.slice(1)}.`]),
          ].map(([w, t], i) => (
            <div key={w} className={cx("grid grid-cols-[200px_1fr] px-7 py-4 text-[16.5px]", i > 0 && "border-t border-[#0B1A12]/[0.07]")}>
              <span className="font-extrabold">{w}</span>
              <span className="text-[#0B1A12]/80">{t}</span>
            </div>
          ))}
        </Card>
        <p className="mt-3 text-[15px] leading-relaxed text-[#0B1A12]/60">A Quark não oferece serviço de revisão: recomendamos que você revise a scooter onde preferir, quando achar necessário. Revisões e peças de desgaste natural não fazem parte da garantia.</p>
        <Card className="mt-6 rounded-[24px] px-7 py-6">
          <div className="flex items-center gap-3">
            <TriangleAlert className="h-6 w-6 text-[#E8432A]" />
            <p className="text-[20px] font-extrabold">Advertências</p>
          </div>
          <ul className="mt-3 grid gap-2.5 text-[16px] leading-snug text-[#0B1A12]/80">
            {["Alterar a parte elétrica, aumentar a potência ou violar lacres pode causar acidentes e anula a garantia.", "Use apenas peças originais.", "Não use a scooter com componentes danificados.", "Faça a manutenção descrita neste manual."].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-[8px] h-2 w-2 shrink-0 rounded-full bg-[#E8432A]" />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </>
    ),
  });

  pages.push({
    id: "problemas",
    toc: "Se algo não funcionar",
    body: (
      <>
        <Section no="06" kicker="Ajuda rápida" title="Se algo não funcionar" className="mt-7" />
        <div className="mt-6 grid gap-3">
          {[
            [Power, "A scooter não liga", "Conector da bateria solto, chave da bateria desligada, fusível queimado ou bateria descarregada."],
            [PlugZap, "A bateria não carrega", "Carregador com defeito, mau contato na porta de carga ou célula da bateria danificada."],
            [Cog, "O motor não funciona", "Acelerador com defeito, fiação rompida, controlador danificado ou corte dos freios acionado."],
            [Route, "A autonomia diminuiu", "Pneus murchos, bateria envelhecida, excesso de peso, frio ou freio arrastando."],
            [TriangleAlert, "Erro no painel", "Fiação solta, sensor do motor danificado ou falha de contato no controlador."],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="flex items-start gap-4 rounded-[22px] px-6 py-4">
              <Tile icon={I as LucideIcon} size={46} />
              <span className="min-w-0">
                <span className="block text-[18px] font-extrabold">{t as string}</span>
                <span className="mt-0.5 block text-[15.5px] leading-snug text-[#0B1A12]/70">{d as string}</span>
              </span>
            </Card>
          ))}
        </div>
        <div className="grow" />
        <p className="mt-4 mb-2 rounded-[20px] bg-[#EAF6EC] px-6 py-4 text-[15.5px] leading-relaxed text-[#0B1A12]/80">
          <b>Não abra a bateria nem o controlador.</b> O diagnóstico e o reparo são feitos pela assistência técnica, caso a caso{contact ? ` (${contact})` : ""}.
        </p>
      </>
    ),
  });

  const toc = pages.map((pg, i) => ({ t: pg.toc, n: i + 1 })).filter((x): x is { t: string; n: number } => !!x.t);
  pages[tocAt].body = (
    <>
      <div className="mt-9">
        <p className="text-[15px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Bem-vindo(a)
        </p>
        <h2 className="mt-1 text-[44px] leading-[1.02] font-extrabold tracking-[-0.04em]">
          {owner.name ? `${clean(owner.name).split(" ")[0]}, a sua ${name} chegou` : `A sua ${name} chegou`}
          <span style={{ color: "#3FBF6A" }}>.</span>
        </h2>
        <div className="mt-5 grid gap-3.5 text-[18px] leading-relaxed text-[#0B1A12]/80">
          <p>Obrigado pela confiança. A sua scooter foi montada, testada e revisada pela nossa equipe antes da entrega.</p>
          <p>Reserve alguns minutos para ler este manual: ele mostra como rodar com segurança, como cuidar da bateria e o que fazer se precisar de ajuda.</p>
        </div>
        <p className="mt-4 text-[17px] font-bold">Equipe {clean(brand.company) || "Quark"}</p>
      </div>
      <Card className="mt-7 rounded-[26px] px-7 py-5">
        <Sub>Neste manual</Sub>
        <ol className="mt-2">
          {toc.map((x, i) => (
            <li key={x.t} className={cx("flex items-baseline gap-4 py-2.5 text-[18px]", i > 0 && "border-t border-[#0B1A12]/[0.06]")}>
              <span className="w-8 font-extrabold" style={{ color: GREEN }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-semibold">{x.t}</span>
              <span className="text-[#0B1A12]/45 tabular-nums">pág. {x.n}</span>
            </li>
          ))}
        </ol>
      </Card>
      <div className="grow" />
      <div className="mt-5 mb-2 rounded-[26px] bg-[#0B1A12] px-7 py-6 text-white">
        <p className="text-[14px] font-bold tracking-[0.2em] text-[#E4F04A] uppercase">Seus primeiros dias</p>
        <div className="mt-4 grid grid-cols-3 gap-5">
          {[
            ["1", "Carga completa", "Carregue até 100% antes do primeiro passeio."],
            ["2", "Comece devagar", "Use o modo mais lento nos primeiros 50 km."],
            ["3", "Reaperto aos 300 km", "Na oficina de sua preferência."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span className="grid h-10 w-10 place-items-center rounded-full text-[17px] font-extrabold text-[#0B1A12]" style={{ background: GRAD }}>
                {n}
              </span>
              <p className="mt-3 text-[18px] font-extrabold">{t}</p>
              <p className="mt-1 text-[15px] leading-snug text-white/70">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {pages.map((pg, i) => (
        <Page key={pg.id} n={i + 1} total={pages.length} model={name} plain={pg.plain}>
          {pg.body}
        </Page>
      ))}
    </div>
  );
}

/** Baixa o manual do proprietário completo. */
export async function downloadMotoManual(p: MotoProduct, brand: ManualBrand, owner?: ManualOwner | null) {
  const { downloadPagesPdf, pdfFileSlug } = await import("@/components/bf/download-pdf");
  await downloadPagesPdf(<MotoManualPages p={p} brand={brand} owner={owner} />, `Manual-e-garantia-${pdfFileSlug(p.name)}${owner?.name ? `-${pdfFileSlug(owner.name)}` : ""}.pdf`, { background: "#F7F9F4" });
}

/** Dados da empresa para o manual (só a empresa: sem dados de vendedor ou representante). */
export function manualBrand(s: { company_name: string; legal_name: string; cnpj: string; whatsapp: string; phone: string; instagram: string; city: string; contract_defaults?: { contractor?: { name?: string; doc?: string } } }): ManualBrand {
  const c = s.contract_defaults?.contractor ?? {};
  return {
    company: s.company_name || "Quark",
    legalName: c.name || s.legal_name || s.company_name || "",
    cnpj: s.cnpj || c.doc || "",
    whatsapp: s.whatsapp || s.phone || "",
    instagram: s.instagram || "",
    city: s.city || "",
  };
}

type BrandSettings = Parameters<typeof manualBrand>[0];

/**
 * Manual + garantia de uma venda: busca o modelo cadastrado (ou monta com os dados da
 * venda) e preenche o certificado com o cliente, os números de série e os dados da empresa no contrato.
 */
export async function downloadSaleManual(d: MotoData, id: string | null, settings: BrandSettings, signedAt?: string | null) {
  const [{ fetchProduct }, { newProduct }, { motoPhoto }] = await Promise.all([import("@/lib/moto-products-db"), import("@/lib/moto-products"), import("@/lib/moto-sale")]);
  const base = d.model ? await fetchProduct(d.model) : null;
  const photo = motoPhoto(d);
  const p = base ?? newProduct({ slug: d.model || "scooter", name: d.modelName || "Scooter", photo, specs: { ...newProduct().specs, ...d.specs } });
  const brand = manualBrand(settings);
  const c = d.contractor;
  await downloadMotoManual(
    { ...p, name: d.modelName || p.name, photo: photo || p.photo },
    {
      ...brand,
      legalName: c?.name || brand.legalName,
      cnpj: c?.doc || brand.cnpj,
    },
    ownerFromSale(d, id, signedAt),
  );
}
