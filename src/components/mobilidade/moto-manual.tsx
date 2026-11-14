"use client";

import {
  Archive,
  Award,
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
import { dateBr, formatDoc, maskDoc } from "@/lib/br";
import { formatPhone } from "@/lib/format";
import { MANUAL_SPEC_FIELDS, type MotoProduct } from "@/lib/moto-products";
import { revisionPlan, shortNo, warrantyEnd, type MotoData } from "@/lib/moto-sale";

/**
 * Manual do proprietário + certificado de garantia da scooter, no design branco da
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
  repName: string;
  repRole: string;
  signature: string;
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
const TOTAL = 7;
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

function Page({ n, model, children, plain }: { n: number; model: string; children: ReactNode; plain?: boolean }) {
  return (
    <div data-pdf-page className="relative overflow-hidden font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      <div className="absolute inset-0 bg-[#F7F9F4]" />
      <div className="absolute -top-[220px] -left-[240px] h-[620px] w-[620px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.34), rgba(126,214,150,0))" }} />
      <div className="absolute top-[360px] -right-[280px] h-[620px] w-[620px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(236,240,120,0.28), rgba(236,240,120,0))" }} />
      <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: GRAD }} />
      <div className="relative flex h-full flex-col px-[54px] pt-[34px] pb-[24px] [&>*]:shrink-0">
        {!plain && (
          <div className="flex h-[40px] items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mob/ic/logo.png" alt="" className="h-[36px] w-auto" />
            <span className="text-[10.5px] font-bold tracking-[0.18em] text-[#0B1A12]/50 uppercase">Manual do proprietário · {model}</span>
          </div>
        )}
        {children}
        <div className="mt-auto flex h-[28px] items-end justify-between border-t border-[#0B1A12]/10 text-[10px] font-semibold text-[#0B1A12]/45">
          <span>Quark Mobilidade · leia antes do primeiro uso</span>
          <span className="tabular-nums">
            {String(n).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ no, kicker, title, className }: { no: string; kicker: string; title: string; className?: string }) {
  return (
    <div className={cx("flex items-end gap-4", className)}>
      <span className="text-[56px] leading-[0.8] font-extrabold tracking-[-0.06em] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(180deg,#36B26A,#B6D93A)" }}>
        {no}
      </span>
      <div className="min-w-0 pb-0.5">
        <p className="text-[11.5px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          {kicker}
        </p>
        <h2 className="text-[30px] leading-[1.02] font-extrabold tracking-[-0.035em]">
          {title}
          <span style={{ color: "#3FBF6A" }}>.</span>
        </h2>
      </div>
    </div>
  );
}

function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[12px] font-bold tracking-[0.16em] text-[#0B1A12]/50 uppercase", className)}>{children}</p>;
}

/** Valor da ficha ou linha para preencher à mão. */
function Fill({ v, w = 120, mono }: { v: string; w?: number; mono?: boolean }) {
  return v ? <span className={cx(mono && "tracking-[0.06em] tabular-nums uppercase")}>{v}</span> : <span className="inline-block border-b border-[#0B1A12]/30" style={{ width: w, height: 14 }} />;
}

/** Linha "rótulo ........ valor" (ou linha em branco para preencher). */
function Row({ k, v, w = 140, mono, wide, h = 34 }: { k: string; v: string; w?: number; mono?: boolean; wide?: boolean; h?: number }) {
  return (
    <div style={{ height: h }} className={cx("flex items-center justify-between gap-3 border-b border-dashed border-[#0B1A12]/12 text-[12px]", wide && "col-span-2")}>
      <span className="shrink-0 text-[#0B1A12]/55">{k}</span>
      <span className="min-w-0 truncate text-right font-semibold">
        <Fill v={clean(v)} w={w} mono={mono} />
      </span>
    </div>
  );
}

const COVERS_SHORT = ["Motor elétrico e rolamentos", "Controlador e chicote elétrico", "Bateria (células e BMS)", "Carregador original", "Painel, faróis e setas", "Quadro, garfo e soldas"];
const EXCLUDES_SHORT = ["Desgaste natural (pneus, pastilhas, lâmpadas)", "Quedas, colisões e mau uso", "Água em excesso ou jato de alta pressão", "Carregador não original", "Excesso de carga", "Reparos fora da assistência Quark"];

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
  const end = owner.deliveryDate ? warrantyEnd({ delivery: { date: owner.deliveryDate, mode: "entrega", address: "" }, warrantyDays: days, date: owner.purchaseDate }) : "";
  const contact = [brand.whatsapp && formatPhone(brand.whatsapp), brand.instagram && `@${brand.instagram.replace(/^@/, "")}`].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      {/* ================================================================ 1 · capa */}
      <Page n={1} model={name} plain>
        <div className="flex h-[54px] items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="" className="h-[50px] w-auto" />
          <span className="flex items-center gap-2 rounded-full bg-[#0B1A12] px-5 py-2.5 text-[12px] font-bold tracking-[0.14em] text-white uppercase">
            <span className="h-2 w-2 rounded-full bg-[#E4F04A]" /> Manual do proprietário
          </span>
        </div>

        <div className="mt-14 text-center">
          <p className="text-[13px] font-bold tracking-[0.3em] uppercase" style={{ color: GREEN }}>
            {clean(p.kicker) || "Scooter elétrica"}
          </p>
          <h1 className="mx-auto mt-2 max-w-[680px] text-[96px] leading-[0.88] font-extrabold tracking-[-0.055em] break-words">
            {name}
            <span style={{ color: "#3FBF6A" }}>.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[500px] text-[17px] leading-snug text-[#0B1A12]/65">Uso seguro, cuidados com a bateria, manutenção e o seu certificado de garantia, tudo em um só lugar.</p>
        </div>

        <div className="relative mt-10 h-[470px]">
          <div className="absolute top-[18px] left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.35), rgba(126,214,150,0))" }} />
          <div className="absolute top-[14px] left-1/2 h-[388px] w-[388px] -translate-x-1/2 rounded-full border border-dashed border-[#1F9D55]/25" />
          <div className="absolute bottom-[10px] left-1/2 h-[26px] w-[420px] -translate-x-1/2 rounded-[50%] bg-[#0B1A12]/20 blur-[14px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.photo || "/mob/cmp-scooter.webp"} data-fallback="/mob/cmp-scooter.webp" alt="" className="absolute top-0 left-1/2 h-[470px] w-[660px] -translate-x-1/2 object-contain drop-shadow-[0_26px_26px_rgba(16,52,32,0.25)]" />
        </div>

        <div className="grow" />
        <div className="grid grid-cols-3 divide-x divide-[#0B1A12]/10 rounded-[22px] bg-white py-4" style={{ boxShadow: CARD.boxShadow, border: CARD.border }}>
          {main.slice(0, 3).map((m) => ({ ...m, v: m.v.replace(/\s*\([^)]*\)\s*$/, "") })).map((x) => (
            <div key={x.k} className="flex items-center justify-center gap-3 px-3">
              <Ic n={x.i} size={34} />
              <span className="min-w-0">
                <span className={cx("line-clamp-2 block leading-tight font-extrabold", x.v.length > 14 ? "text-[14px]" : "text-[17px]")}>{x.v}</span>
                <span className="block text-[11px] text-[#0B1A12]/55">{x.k}</span>
              </span>
            </div>
          ))}
        </div>
        {owner.name ? (
          <p className="mt-4 mb-3 h-[18px] truncate text-center text-[13px] text-[#0B1A12]/60">
            Exemplar de <b className="text-[#0B1A12]">{clean(owner.name)}</b>
            {owner.chassis ? ` · chassi ${clean(owner.chassis).toUpperCase()}` : ""}
          </p>
        ) : (
          <div className="mt-4 mb-3 h-[18px]" />
        )}
      </Page>

      {/* =================================================== 2 · boas-vindas */}
      <Page n={2} model={name}>
        <div className="mt-8 grid grid-cols-[1.15fr_1fr] gap-8">
          <div>
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
              Bem-vindo(a)
            </p>
            <h2 className="mt-1 text-[34px] leading-[1.02] font-extrabold tracking-[-0.04em]">
              {owner.name ? `${clean(owner.name).split(" ")[0]}, a sua ${name} chegou` : `A sua ${name} chegou`}
              <span style={{ color: "#3FBF6A" }}>.</span>
            </h2>
            <div className="mt-4 grid gap-3 text-[13.5px] leading-relaxed text-[#0B1A12]/75">
              <p>Obrigado pela confiança. A sua scooter foi montada, testada e revisada pela nossa equipe antes da entrega.</p>
              <p>Reserve alguns minutos para ler este manual: ele mostra como rodar com segurança, como cuidar da bateria para ela durar muitos anos e o que fazer se precisar de ajuda.</p>
              <p>Guarde junto com a nota fiscal: a última página é o seu certificado de garantia.</p>
            </div>
            <p className="mt-5 text-[13px] font-bold">Equipe {clean(brand.company) || "Quark"}</p>
          </div>
          <Card className="self-start rounded-[22px] px-5 py-4">
            <Sub>Neste manual</Sub>
            <ol className="mt-3 grid gap-2.5">
              {[
                ["01", "Ficha técnica", "03"],
                ["02", "Antes de rodar e segurança", "04"],
                ["03", "Bateria e recarga", "05"],
                ["04", "Manutenção e problemas", "06"],
                ["05", "Certificado de garantia", "07"],
              ].map(([no, t, pg]) => (
                <li key={no} className="flex items-baseline gap-3 text-[13.5px]">
                  <span className="w-6 font-extrabold" style={{ color: GREEN }}>
                    {no}
                  </span>
                  <span className="flex-1 font-semibold">{t}</span>
                  <span className="text-[#0B1A12]/40 tabular-nums">{pg}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="mt-8 rounded-[24px] px-6 py-5">
          <div className="flex items-center justify-between">
            <Sub>Identificação do veículo</Sub>
            <span className="text-[11px] text-[#0B1A12]/45">{owner.name ? "preenchido pela Quark" : "preencha na entrega"}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-8">
            <Row k="Proprietário" v={owner.name} w={360} wide />
            {[
              ["CPF / CNPJ", owner.doc ? maskDoc(owner.doc) : "", 150],
              ["Telefone", owner.phone ? formatPhone(owner.phone) : "", 140],
              ["Modelo", name, 0],
              ["Cor", owner.color, 120],
              ["Ano", owner.year, 80],
              ["Data de entrega", owner.deliveryDate ? dateBr(owner.deliveryDate) : "", 110],
              ["Nº do chassi", owner.chassis, 170],
              ["Nº do motor", owner.motorNo, 150],
              ["Nº da bateria", owner.batteryNo, 150],
              ["Nº do carregador", owner.chargerNo, 150],
            ].map(([k, v, w]) => (
              <Row key={k as string} k={k as string} v={v as string} w={w as number} mono={(k as string).startsWith("Nº")} />
            ))}
          </div>
        </Card>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            [ShieldCheck, `${days} dias de garantia`, "defeitos de fabricação"],
            [Package, "Entregue montada", "testada e revisada"],
            [Phone, "Assistência local", contact || clean(brand.city) || "fale com a Quark"],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="flex items-center gap-3 rounded-[18px] px-4 py-3.5">
              <Tile icon={I as LucideIcon} />
              <span className="min-w-0">
                <span className="block text-[14px] leading-tight font-extrabold">{t as string}</span>
                <span className="line-clamp-2 block text-[11.5px] leading-snug text-[#0B1A12]/55">{d as string}</span>
              </span>
            </Card>
          ))}
        </div>

        <div className="grow" />
        <div className="rounded-[24px] bg-[#0B1A12] px-7 py-6 text-white">
          <p className="text-[12px] font-bold tracking-[0.2em] text-[#E4F04A] uppercase">Seus primeiros dias</p>
          <div className="mt-4 grid grid-cols-3 gap-5">
            {[
              ["1", "Carga completa", "Antes do primeiro passeio, carregue a bateria até 100%."],
              ["2", "Comece devagar", "Nos primeiros 50 km, use o modo mais lento para se acostumar."],
              ["3", "Revisão de 30 dias", "Agende com a assistência Quark o reaperto geral (por conta do proprietário)."],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold text-[#0B1A12]" style={{ background: GRAD }}>
                  {n}
                </span>
                <p className="mt-2.5 text-[14px] font-extrabold">{t}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/65">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Page>

      {/* ===================================================== 3 · ficha técnica */}
      <Page n={3} model={name}>
        <Section no="01" kicker="Conheça a sua scooter" title="Ficha técnica" className="mt-6" />
        <div className="mt-5 grid grid-cols-4 gap-2.5">
          {main.map((x) => (
            <Card key={x.k} className="rounded-[18px] px-3.5 py-3">
              <Ic n={x.i} size={32} />
              <p className="mt-2 line-clamp-2 text-[14.5px] leading-tight font-extrabold">{x.v}</p>
              <p className="mt-0.5 text-[10.5px] text-[#0B1A12]/55">{x.k}</p>
            </Card>
          ))}
        </div>
        {extra.length > 0 && (
          <Card className="mt-4 rounded-[22px] px-6 py-3">
            <Sub className="mb-1">Especificações do fabricante</Sub>
            <div className="grid grid-cols-2 gap-x-8">
              {extra.map((x) => (
                <div key={x.k} className="grid grid-cols-[110px_1fr] gap-3 border-b border-[#0B1A12]/[0.06] py-2 text-[12px]">
                  <span className="text-[#0B1A12]/55">{x.k}</span>
                  <span className="line-clamp-2 font-semibold">{x.v}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        <div className="grow" />
        <div className="mt-4 rounded-[18px] bg-[#0B1A12] px-6 py-4 text-[12px] leading-relaxed text-white/80">
          <b className="text-[#E4F04A]">Sobre a autonomia:</b> o alcance informado é medido em condições ideais. Na prática, varia com o peso transportado, subidas, temperatura, calibragem dos pneus, paradas e o modo de condução.
        </div>
        <p className="mt-3 mb-2 text-[11px] text-[#0B1A12]/45">Veículo autopropelido conforme a Resolução CONTRAN nº 996/2023 (até 1.000 W e 32 km/h). Especificações sujeitas a alteração pelo fabricante.</p>
      </Page>

      {/* ====================================================== 4 · antes de rodar */}
      <Page n={4} model={name}>
        <Section no="02" kicker="Antes de rodar" title="Checklist e segurança" className="mt-6" />
        <div className="mt-5 grid grid-cols-[1fr_1.15fr] gap-3">
          <Card className="rounded-[22px] px-5 py-4">
            <div className="flex items-center gap-3">
              <Tile icon={Package} />
              <p className="text-[15px] font-extrabold">O que você recebe</p>
            </div>
            <ul className="mt-3 grid gap-1.5 text-[12.5px] text-[#0B1A12]/75">
              {["Scooter montada, com guidão e retrovisores", "Bateria instalada e carregada", "Carregador original bivolt", "Chaves, controle do alarme e cartão NFC", "Este manual com o certificado de garantia"].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2FB061]" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="rounded-[22px] px-5 py-4">
            <div className="flex items-center gap-3">
              <Tile icon={ClipboardCheck} dark />
              <p className="text-[15px] font-extrabold">Checklist de 1 minuto, antes de sair</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                [BatteryCharging, "Carga da bateria", "confira no painel"],
                [CircleDot, "Freios", "aperte os dois manetes"],
                [Gauge, "Pneus", "calibragem e desgaste"],
                [Lightbulb, "Luzes e buzina", "farol, setas e lanterna"],
                [Wrench, "Parafusos", "guidão, rodas e banco"],
                [MoveHorizontal, "Alinhamento", "guidão e rodas retos"],
              ].map(([I, t, d]) => (
                <div key={t as string} className="flex items-center gap-2.5">
                  <Tile icon={I as LucideIcon} size={32} />
                  <span>
                    <span className="block text-[12.5px] leading-tight font-bold">{t as string}</span>
                    <span className="block text-[10.5px] text-[#0B1A12]/55">{d as string}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Sub className="mt-7">Regras de segurança</Sub>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {[
            [HardHat, "Use sempre capacete", "e acenda o farol à noite e na chuva"],
            [Weight, "Respeite a carga máxima", s.load ? `até ${clean(s.load).replace(/^at[ée]\s*/i, "")}, incluindo o garupa` : "indicada na ficha técnica"],
            [ZapOff, "Não altere a parte elétrica", "nem tente aumentar a potência"],
            [Plug, "Só o carregador original", "ou um aprovado pela Quark"],
            [Droplets, "Proteja da água", "sem jato de alta pressão e sem alagamentos"],
            [Baby, "Longe de crianças", "chaves, carregador e bateria"],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="flex items-center gap-3 rounded-[18px] px-4 py-3.5">
              <Tile icon={I as LucideIcon} />
              <span className="min-w-0">
                <span className="block text-[13px] leading-tight font-extrabold">{t as string}</span>
                <span className="block text-[10.5px] leading-snug text-[#0B1A12]/55">{d as string}</span>
              </span>
            </Card>
          ))}
        </div>

        <Card className="mt-6 rounded-[22px] px-6 py-4">
          <div className="flex items-center gap-3">
            <Tile icon={Route} dark />
            <p className="text-[15px] font-extrabold">Onde e como rodar</p>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] text-[#0B1A12]/75">
            {["Siga as regras de trânsito e as normas da sua cidade.", "Comece no modo mais lento até se acostumar.", "Freie com os dois manetes, com antecedência.", "Em piso molhado, reduza a velocidade.", "Não transporte objetos que tirem o equilíbrio.", "Desligue e retire a chave ao estacionar."].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2FB061]" />
                {t}
              </li>
            ))}
          </ul>
        </Card>

        <div className="grow" />
        <div className="mb-2 flex items-center gap-5 rounded-[24px] bg-[#0B1A12] px-7 py-5 text-white">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-white/10 text-[#E4F04A]">
            <Phone className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold tracking-[0.2em] text-[#E4F04A] uppercase">Precisa de ajuda?</p>
            <p className="mt-1 text-[17px] font-extrabold">Fale com a assistência {clean(brand.company) || "Quark"}</p>
            <p className="mt-0.5 truncate text-[12px] text-white/65">{[contact, clean(brand.city)].filter(Boolean).join(" · ") || "Use os contatos da sua nota fiscal"}</p>
          </div>
          <Ic n="scooter" size={64} />
        </div>
      </Page>

      {/* ========================================================== 5 · bateria */}
      <Page n={5} model={name}>
        <Section no="03" kicker="Bateria e recarga" title="Cuide bem e ela dura anos" className="mt-6" />
        <Card className="mt-5 rounded-[24px] px-6 py-5">
          <div className="flex items-center gap-3">
            <Ic n="plug" size={36} />
            <p className="text-[16px] font-extrabold">Como carregar, passo a passo</p>
            <span className="ml-auto rounded-full bg-[#EAF6EC] px-3 py-1 text-[11.5px] font-bold whitespace-nowrap" style={{ color: GREEN }}>
              Recarga completa: {clean(s.recharge) || "cerca de 6 h"}
            </span>
          </div>
          <ol className="mt-4 grid gap-3">
            {[
              "Desligue a scooter e retire a chave.",
              "Conecte primeiro o carregador na scooter (ou na bateria).",
              "Depois, ligue o carregador numa tomada de 3 pinos, de 100 a 240 V.",
              "Quando a luz indicar carga completa, tire da tomada e depois desconecte da scooter.",
            ].map((t, i) => (
              <li key={t} className="flex items-center gap-3 text-[13px]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold" style={{ background: GRAD }}>
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            [BatteryCharging, "No dia a dia", "Recarregue ao chegar perto de 20%. Não espere zerar e não deixe descarregada por vários dias."],
            [Thermometer, "Temperatura ideal", "Guarde e carregue em local fresco e ventilado, por volta de 25 °C, longe do sol forte e da chuva."],
            [Archive, "Se for guardar", "Desconectada, pode ficar armazenada de 5 a 6 meses. Ligada ao carregador, recarregue de 2 a 3 vezes por mês."],
            [Recycle, "Descarte correto", "Nunca no lixo comum: leve a um ponto de coleta autorizado ou à Quark. Não desmonte nem abra a bateria."],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="rounded-[20px] px-5 py-4">
              <div className="flex items-center gap-3">
                <Tile icon={I as LucideIcon} size={36} />
                <p className="text-[14px] font-extrabold">{t as string}</p>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#0B1A12]/70">{d as string}</p>
            </Card>
          ))}
        </div>
        <div className="grow" />
        <div className="mt-4 mb-2 rounded-[20px] bg-[#0B1A12] px-6 py-5 text-[12.5px] leading-relaxed text-white/80">
          <p className="mb-1 text-[13px] font-extrabold text-[#E4F04A]">Para carregar com segurança</p>
          Carregue em local ventilado e à vista, de preferência durante o dia ou no início da noite. Não use extensões nem adaptadores: ligue direto na tomada de 3 pinos. Se notar cheiro de queimado, calor excessivo ou inchaço na bateria, desligue e fale com a assistência.
        </div>
      </Page>

      {/* ===================================================== 6 · manutenção */}
      <Page n={6} model={name}>
        <Section no="04" kicker="Manutenção" title="Plano de cuidados e problemas" className="mt-6" />
        <Card className="mt-5 overflow-hidden rounded-[20px]">
          <div className="grid grid-cols-[150px_1fr] bg-[#0B1A12] px-5 py-2.5 text-[10.5px] font-bold tracking-[0.12em] text-white uppercase">
            <span>Quando</span>
            <span>O que fazer</span>
          </div>
          {[
            ["Toda semana", "Calibrar os pneus e conferir o desgaste."],
            ["Todo mês", "Conferir freios (pastilhas e lonas), conectores elétricos e parafusos."],
            ...revisionPlan({ warrantyDays: days }).map((r) => [r.when, `${r.what}.`]),
          ].map(([w, t], i) => (
            <div key={w} className={cx("grid grid-cols-[150px_1fr] px-5 py-2 text-[12px]", i > 0 && "border-t border-[#0B1A12]/[0.07]")}>
              <span className="font-extrabold">{w}</span>
              <span className="text-[#0B1A12]/75">{t}</span>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[10.5px] text-[#0B1A12]/45">As revisões a partir de 30 dias são feitas na assistência técnica Quark, com agendamento, e pagas pelo proprietário. Revisões e peças de desgaste natural não fazem parte da garantia.</p>

        <Sub className="mt-5">Se algo não funcionar</Sub>
        <div className="mt-2.5 grid gap-2">
          {[
            [Power, "A scooter não liga", "Conector da bateria solto, chave da bateria desligada, fusível queimado ou bateria descarregada."],
            [PlugZap, "A bateria não carrega", "Carregador com defeito, mau contato na porta de carga ou célula interna da bateria danificada."],
            [Cog, "O motor não funciona", "Acelerador com defeito, fiação rompida, controlador danificado ou corte dos freios acionado."],
            [Route, "A autonomia diminuiu", "Pneus murchos, bateria envelhecida, excesso de peso, frio ou freio arrastando."],
            [TriangleAlert, "Código de erro no painel", "Fiação solta, sensor Hall do motor danificado ou falha de contato no controlador."],
          ].map(([I, t, d]) => (
            <Card key={t as string} className="grid grid-cols-[34px_170px_1fr] items-center gap-3 rounded-[16px] px-4 py-2.5">
              <Tile icon={I as LucideIcon} size={32} />
              <span className="text-[12.5px] font-extrabold">{t as string}</span>
              <span className="text-[11.5px] leading-snug text-[#0B1A12]/65">{d as string}</span>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-[#0B1A12]/45">Não abra a bateria nem o controlador: o diagnóstico e o reparo são feitos pela assistência técnica, caso a caso.</p>

        <div className="grow" />
        <Card className="mt-4 mb-2 rounded-[18px] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <TriangleAlert className="h-4 w-4 text-[#E8432A]" />
            <p className="text-[13px] font-extrabold">Advertências</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#0B1A12]/65">
            Montagem ou reparo por pessoas não autorizadas pode causar danos ou lesões e anula a garantia · Use apenas peças originais · Não use a scooter com componentes danificados · Faça a manutenção periódica descrita
            neste manual.
          </p>
        </Card>
      </Page>

      {/* ============================================= 7 · certificado de garantia */}
      <Page n={7} model={name}>
        <div className="relative mt-3 rounded-[28px] p-[2px]" style={{ background: "linear-gradient(135deg,#C9A84A,#E4F04A 30%,#4FC38A 65%,#C9A84A)" }}>
          <div className="rounded-[26px] bg-[#FDFDF9] px-8 pt-5 pb-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[11px] font-bold tracking-[0.3em] uppercase" style={{ color: GREEN }}>
                  Quark Mobilidade
                </p>
                <h2 className="mt-1 text-[38px] leading-none font-extrabold tracking-[-0.04em]">Certificado de garantia</h2>
                <p className="mt-2 max-w-[440px] text-[12.5px] leading-relaxed text-[#0B1A12]/65">
                  Garantia de <b className="text-[#0B1A12]">{days} dias</b> contra defeitos de fabricação, contados da entrega, para o veículo e o proprietário abaixo.
                </p>
              </div>
              <div className="relative grid h-[104px] w-[104px] shrink-0 place-items-center">
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#C9A84A,#E4F04A,#9FDB7C,#4FC38A,#C9A84A)]" />
                <div className="absolute inset-[4px] rounded-full bg-[#0B1A12]" />
                <div className="absolute inset-[9px] rounded-full border border-dashed border-[#E4F04A]/50" />
                <div className="relative text-center text-white">
                  <p className="text-[8px] font-bold tracking-[0.26em] text-[#E4F04A] uppercase">Garantia</p>
                  <p className="text-[34px] leading-[0.9] font-extrabold tracking-[-0.05em]">{days}</p>
                  <p className="text-[9px] font-bold tracking-[0.22em] uppercase">dias</p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-8">
              <Row k="Proprietário" v={owner.name} w={380} wide h={31} />
              {[
                ["CPF / CNPJ", owner.doc ? (owner.doc.replace(/\D/g, "").length > 11 ? formatDoc(owner.doc) : maskDoc(owner.doc)) : "", 150, false],
                ["Telefone", owner.phone ? formatPhone(owner.phone) : "", 140, false],
                ["Cidade", owner.city, 140, false],
                ["Modelo", [name, clean(owner.color), clean(owner.year)].filter(Boolean).join(" · "), 0, false],
                ["Nº do chassi", owner.chassis, 170, true],
                ["Nº do motor", owner.motorNo, 150, true],
                ["Nº da bateria", owner.batteryNo, 150, true],
                ["Nº do carregador", owner.chargerNo, 150, true],
              ].map(([k, v, w, mono]) => (
                <Row key={k as string} k={k as string} v={v as string} w={w as number} mono={mono as boolean} h={31} />
              ))}
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2.5">
              {[
                ["Compra", owner.purchaseDate ? dateBr(owner.purchaseDate) : ""],
                ["Entrega · início", owner.deliveryDate ? dateBr(owner.deliveryDate) : ""],
                ["Válida até", end ? dateBr(end) : ""],
              ].map(([k, v], i) => (
                <div key={k} className={cx("rounded-[16px] px-4 py-2.5", i === 2 ? "bg-[#0B1A12] text-white" : "bg-[#F1F6EE]")}>
                  <p className={cx("text-[10px] font-bold tracking-[0.16em] uppercase", i === 2 ? "text-[#E4F04A]" : "text-[#0B1A12]/50")}>{k}</p>
                  <p className="mt-1 text-[17px] font-extrabold">{v || <span className={cx("inline-block w-[110px] border-b", i === 2 ? "border-white/40" : "border-[#0B1A12]/30")} style={{ height: 16 }} />}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            [ShieldCheck, "Está coberto", COVERS_SHORT, "#1F9D55"],
            [TriangleAlert, "Não está coberto", EXCLUDES_SHORT, "#E8432A"],
          ].map(([I, t, list, color]) => {
            const Icon = I as LucideIcon;
            return (
              <Card key={t as string} className="rounded-[18px] px-5 py-3.5">
                <p className="flex items-center gap-2 text-[12.5px] font-extrabold">
                  <Icon className="h-4 w-4" style={{ color: color as string }} /> {t as string}
                </p>
                <ul className="mt-1.5 grid gap-0.5 text-[11px] text-[#0B1A12]/70">
                  {(list as string[]).map((x) => (
                    <li key={x} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color as string }} />
                      {x}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-[#0B1A12]/45">Constatado o defeito, o reparo ou a troca da peça é feito sem custo em até 30 dias (CDC, art. 18, § 1º). Revisões periódicas não fazem parte da garantia.</p>

        <Card className="mt-2.5 flex items-center gap-4 rounded-[18px] px-5 py-3">
          <Tile icon={Award} dark />
          <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-[#0B1A12]/70">
            <b className="text-[#0B1A12]">Como acionar:</b> fale com a assistência {contact ? `(${contact})` : "Quark"}, apresente este certificado e a nota fiscal e leve a scooter à assistência
            {brand.city ? ` em ${clean(brand.city)}` : ""}. Esta garantia compreende a garantia legal de 90 dias para bens duráveis (CDC, art. 26, II).
          </p>
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-10">
          <div className="min-w-0 text-center">
            <div className="flex h-[50px] items-end justify-center overflow-hidden">
              {brand.signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.signature} alt="" className="max-h-[50px] max-w-[220px] object-contain" />
              )}
            </div>
            <div className="border-t border-[#0B1A12]/40 pt-1.5">
              <p className="truncate text-[11.5px] font-bold">{clean(brand.legalName) || clean(brand.company)}</p>
              <p className="truncate text-[10px] text-[#0B1A12]/55">
                {[clean(brand.repName), clean(brand.repRole)].filter(Boolean).join(" · ") || "Vendedora"}
                {brand.cnpj ? ` · CNPJ ${formatDoc(brand.cnpj)}` : ""}
              </p>
            </div>
          </div>
          <div className="min-w-0 text-center">
            <div className="flex h-[50px] items-end justify-center pb-1 text-[10px] text-[#0B1A12]/50">{owner.signedAt ? `Contrato assinado eletronicamente em ${dateBr(owner.signedAt.slice(0, 10))}` : ""}</div>
            <div className="border-t border-[#0B1A12]/40 pt-1.5">
              <p className="h-[17px] truncate text-[11.5px] font-bold">{clean(owner.name)}</p>
              <p className="truncate text-[10px] text-[#0B1A12]/55">Proprietário(a)</p>
            </div>
          </div>
        </div>
        {(owner.number || owner.code) && (
          <p className="mt-2 text-center text-[10px] tracking-[0.1em] text-[#0B1A12]/40 uppercase">
            {[owner.number && `Certificado ${owner.number}`, owner.code && `código ${owner.code}`].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="grow" />
        <div className="mt-3 mb-2">
          <Sub>Registro de revisões · carimbo da assistência</Sub>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {revisionPlan({ warrantyDays: days }).map((r) => (
              <div key={r.when} className="h-[62px] rounded-[14px] border border-dashed border-[#0B1A12]/20 px-3 py-2">
                <p className="text-[11px] font-extrabold">{r.when}</p>
                <p className="mt-1 text-[9.5px] text-[#0B1A12]/45">Data ____/____/______ · km ________</p>
              </div>
            ))}
          </div>
        </div>
      </Page>
    </div>
  );
}

/** Baixa o manual do proprietário com o certificado de garantia. */
export async function downloadMotoManual(p: MotoProduct, brand: ManualBrand, owner?: ManualOwner | null) {
  const { downloadPagesPdf, pdfFileSlug } = await import("@/components/bf/download-pdf");
  await downloadPagesPdf(<MotoManualPages p={p} brand={brand} owner={owner} />, `Manual-e-garantia-${pdfFileSlug(p.name)}${owner?.name ? `-${pdfFileSlug(owner.name)}` : ""}.pdf`, { background: "#F7F9F4" });
}

/** Dados da empresa para o manual (a partir das configurações e da vendedora do contrato). */
export function manualBrand(
  s: { company_name: string; legal_name: string; cnpj: string; whatsapp: string; phone: string; instagram: string; city: string; signature_url?: string; contract_defaults?: { contractor?: { repName?: string; repRole?: string; name?: string } } },
  fallbackSignature = "",
): ManualBrand {
  const c = s.contract_defaults?.contractor ?? {};
  return {
    company: s.company_name || "Quark",
    legalName: c.name || s.legal_name || s.company_name || "",
    cnpj: s.cnpj || "",
    whatsapp: s.whatsapp || s.phone || "",
    instagram: s.instagram || "",
    city: s.city || "",
    repName: c.repName || "",
    repRole: c.repRole || "",
    signature: s.signature_url || fallbackSignature,
  };
}

type BrandSettings = Parameters<typeof manualBrand>[0];

/**
 * Manual + garantia de uma venda: busca o modelo cadastrado (ou monta com os dados da
 * venda) e preenche o certificado com o cliente, os números de série e a vendedora do contrato.
 */
export async function downloadSaleManual(d: MotoData, id: string | null, settings: BrandSettings, signedAt?: string | null) {
  const [{ fetchProduct }, { newProduct }, { motoPhoto }] = await Promise.all([import("@/lib/moto-products-db"), import("@/lib/moto-products"), import("@/lib/moto-sale")]);
  const base = d.model ? await fetchProduct(d.model) : null;
  const photo = motoPhoto(d);
  const p = base ?? newProduct({ slug: d.model || "scooter", name: d.modelName || "Scooter", photo, specs: { ...newProduct().specs, ...d.specs } });
  const brand = manualBrand(settings, d.contractorSignature);
  const c = d.contractor;
  await downloadMotoManual(
    { ...p, name: d.modelName || p.name, photo: photo || p.photo },
    {
      ...brand,
      legalName: c?.name || brand.legalName,
      cnpj: c?.doc || brand.cnpj,
      repName: c?.repName || brand.repName,
      repRole: c?.repRole || brand.repRole,
      signature: d.contractorSignature || brand.signature,
    },
    ownerFromSale(d, id, signedAt),
  );
}
