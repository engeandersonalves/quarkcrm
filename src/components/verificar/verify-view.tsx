import { BadgeCheck, CircleAlert, Clock3, Lock, MessageCircle, ScanLine, ShieldCheck, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { dateBr, formatDoc } from "@/lib/br";
import { warrantyOf } from "@/lib/moto-board";
import { receiptNumber } from "@/lib/moto-receipt";
import { motoPhoto, vehicleName, type MotoData } from "@/lib/moto-sale";

/**
 * Página pública de conferência do cartão do proprietário e do comprovante.
 * Só mostra o que serve para conferir (nada de telefone, endereço ou valores).
 */

export type VerifyResult =
  | { found: false }
  | {
      found: true;
      state: "original" | "cancelado" | "pendente";
      id: string;
      signed_at: string | null;
      photo: string | null;
      data: Partial<MotoData> & { client?: { name?: string; doc?: string; kind?: string } };
      company: { company_name?: string | null; legal_name?: string | null; cnpj?: string | null; city?: string | null; phone?: string | null; whatsapp?: string | null } | null;
    };

const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const INK = "#0B1A12";

export function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <div translate="no" className="notranslate relative min-h-dvh overflow-x-hidden bg-[#F7F9F4] text-[#0B1A12]" style={{ fontFamily: "var(--font-jakarta), -apple-system, system-ui, sans-serif" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-56 -left-48 h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.30), rgba(126,214,150,0))" }} />
        <div className="absolute top-[45%] -right-56 h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(236,240,120,0.22), rgba(236,240,120,0))" }} />
        <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: GRAD }} />
      </div>
      <main className="relative mx-auto w-full max-w-[560px] px-4 pt-6 pb-14 sm:pt-10">
        <header className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-9 w-auto" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0B1A12]/70 ring-1 ring-[#0B1A12]/[0.07]">
            <Lock className="h-3.5 w-3.5 text-[#1F9D55]" /> Verificação oficial
          </span>
        </header>
        {children}
      </main>
    </div>
  );
}

export function CodeForm({ initial = "", compact }: { initial?: string; compact?: boolean }) {
  return (
    <form action="/verificar" method="get" className={compact ? "mt-4" : "mt-6"}>
      <label htmlFor="v-code" className="text-[13px] font-semibold text-[#0B1A12]/70">
        Código impresso no verso do cartão
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="v-code"
          name="c"
          defaultValue={initial}
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Ex.: 3F9A0C21B7"
          className="h-13 min-w-0 flex-1 rounded-2xl bg-white px-4 text-[17px] font-semibold tracking-[0.12em] uppercase ring-1 ring-[#0B1A12]/10 outline-none placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-[#0B1A12]/35 focus:ring-2 focus:ring-[#1F9D55]"
        />
        <button type="submit" className="h-13 shrink-0 rounded-2xl bg-[#0B1A12] px-5 text-[15px] font-bold text-white">
          Verificar
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-[#0B1A12]/55">São 10 letras e números, logo abaixo do número CPV-…</p>
    </form>
  );
}

function Seal({ tone, icon, title, text }: { tone: "ok" | "warn" | "bad"; icon: ReactNode; title: string; text: string }) {
  const bg = tone === "ok" ? "linear-gradient(150deg,#0F3B24 0%,#0B1A12 70%)" : tone === "warn" ? "linear-gradient(150deg,#5A4310 0%,#2A1F08 75%)" : "linear-gradient(150deg,#5B1717 0%,#2A0B0B 75%)";
  const chip = tone === "ok" ? "#A9DE86" : tone === "warn" ? "#F3D27A" : "#FFA7A0";
  return (
    <section className="relative mt-6 overflow-hidden rounded-[30px] px-6 py-7 text-white shadow-[0_30px_70px_-35px_rgba(11,26,18,0.8)]" style={{ background: bg }}>
      <div aria-hidden className="absolute -top-24 -right-20 h-64 w-64 rounded-full" style={{ background: `radial-gradient(closest-side, ${chip}40, transparent)` }} />
      <div className="relative flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15" style={{ color: chip }}>
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">{text}</p>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#0B1A12]/[0.06] py-3 last:border-0">
      <span className="shrink-0 text-[13.5px] text-[#0B1A12]/55">{k}</span>
      <span className={`min-w-0 text-right text-[15px] font-semibold break-words ${mono ? "tracking-[0.06em] tabular-nums" : ""}`}>{v}</span>
    </div>
  );
}

const CARD = "mt-4 rounded-[26px] bg-white p-5 ring-1 ring-[#0B1A12]/[0.06] shadow-[0_20px_50px_-35px_rgba(16,52,32,0.45)] sm:p-6";
const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" }).format(new Date(iso));

export function VerifyResultView({ r, host, checkedAt }: { r: VerifyResult; host: string; checkedAt: string }) {
  if (!r.found) {
    return (
      <>
        <Seal tone="bad" icon={<ShieldX className="h-7 w-7" />} title="Não encontrado" text="Este código não corresponde a nenhum cartão emitido pela Quark Mobilidade. O documento pode ter sido digitado errado ou ser falso." />
        <section className={CARD}>
          <h2 className="text-[17px] font-bold">Confira de novo</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-[#0B1A12]/65">Digite o código do verso do cartão. Se continuar sem resultado, não aceite o documento e fale com a Quark.</p>
          <CodeForm compact />
        </section>
        <Footer host={host} checkedAt={checkedAt} />
      </>
    );
  }

  const d = r.data;
  const c = r.company ?? {};
  const { number, code } = receiptNumber(r.id);
  const name = d.client?.name?.trim() || "—";
  const doc = d.client?.doc ?? "";
  const docLabel = doc.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";
  const model = vehicleName({ modelName: d.modelName ?? "", model: d.model ?? "outro" }).replace(/^Scooter elétrica\s*/, "") || "Scooter elétrica";
  const w = d.date || d.delivery?.date ? warrantyOf({ warrantyDays: d.warrantyDays ?? 90, delivery: { mode: d.delivery?.mode ?? "retirada", address: "", date: d.delivery?.date ?? "" }, date: d.date ?? "" } as MotoData) : null;
  const seller = d.contractor?.name?.trim() || c.legal_name || c.company_name || "Quark Mobilidade";
  const sellerDoc = d.contractor?.doc || c.cnpj || "";
  const wa = (c.whatsapp || c.phone || "").replace(/\D/g, "");
  const up = (v?: string) => (v ?? "").trim().toUpperCase();

  return (
    <>
      {r.state === "original" ? (
        <Seal tone="ok" icon={<BadgeCheck className="h-7 w-7" />} title="Documento original" text={`Cartão emitido pela ${seller}. Os dados abaixo vêm direto do sistema da Quark, agora.`} />
      ) : r.state === "cancelado" ? (
        <Seal tone="bad" icon={<ShieldX className="h-7 w-7" />} title="Documento cancelado" text="Esta venda foi cancelada. O cartão e o comprovante não valem como prova de propriedade." />
      ) : (
        <Seal tone="warn" icon={<Clock3 className="h-7 w-7" />} title="Venda não concluída" text="O contrato desta venda ainda não foi assinado pelo comprador. O cartão só vale depois da assinatura." />
      )}

      <section className={CARD}>
        <div className="flex items-center gap-4">
          <div className="relative h-[120px] w-[90px] shrink-0 overflow-hidden rounded-2xl bg-[#EEF2EC] ring-1 ring-[#0B1A12]/[0.08]">
            {r.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photo} alt={`Foto de ${name}`} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center px-2 text-center text-[11px] text-[#0B1A12]/45">sem foto</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Proprietário</p>
            <p className="mt-1 text-[21px] leading-tight font-extrabold tracking-tight break-words">{name}</p>
            {doc && (
              <p className="mt-1 text-[14px] text-[#0B1A12]/65 tabular-nums">
                {docLabel} {doc}
              </p>
            )}
          </div>
        </div>
        {r.state === "original" && <p className="mt-4 rounded-2xl bg-[#F1F7EE] px-4 py-3 text-[13.5px] leading-relaxed text-[#0B1A12]/75">Confira se a foto e o nome batem com o cartão e com quem está com a scooter.</p>}
      </section>

      <section className={CARD}>
        <div className="flex items-center gap-4">
          <div className="grid h-[72px] w-[96px] shrink-0 place-items-center rounded-2xl bg-[#050706]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={motoPhoto({ photo: d.photo, model: d.model ?? "outro" })} alt="" className="max-h-[60px] w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Scooter elétrica</p>
            <p className="mt-0.5 text-[20px] leading-tight font-extrabold">{model}</p>
            <p className="text-[14px] text-[#0B1A12]/60">{[d.color?.trim(), d.year].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="mt-4">
          <Row k="Chassi" v={up(d.chassis) || "não informado"} mono />
          {up(d.motorNo) && <Row k="Motor" v={up(d.motorNo)} mono />}
          {up(d.batteryNo) && <Row k="Bateria" v={up(d.batteryNo)} mono />}
          {up(d.chargerNo) && <Row k="Carregador" v={up(d.chargerNo)} mono />}
          {d.date && <Row k="Data da compra" v={dateBr(d.date)} />}
          {w && r.state === "original" && (
            <Row
              k="Garantia"
              v={
                w.state === "ativa" ? (
                  <span className="text-[#1F7A45]">Ativa até {dateBr(w.end)}</span>
                ) : w.state === "encerrada" ? (
                  <span className="text-[#0B1A12]/60">Encerrada em {dateBr(w.end)}</span>
                ) : (
                  "Começa na entrega"
                )
              }
            />
          )}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-[#0B1A12]/60">
          <ScanLine className="mt-0.5 h-4 w-4 shrink-0" /> O chassi fica gravado no quadro da scooter. Compare com o número acima.
        </p>
      </section>

      <section className={CARD}>
        <Row k="Documento" v={number} mono />
        <Row k="Código" v={code} mono />
        {r.signed_at && r.state !== "pendente" && <Row k="Contrato assinado em" v={fmtWhen(r.signed_at)} />}
        <Row k="Emitido por" v={seller} />
        {sellerDoc && <Row k="CNPJ" v={formatDoc(sellerDoc)} mono />}
      </section>

      {wa.length >= 10 && (
        <a
          href={`https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent(`Olá! Estou conferindo o cartão do proprietário ${number} (código ${code}).`)}`}
          className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[16px] font-bold text-[#06210F]"
        >
          <MessageCircle className="h-5 w-5" /> Confirmar com a Quark
        </a>
      )}
      <Footer host={host} checkedAt={checkedAt} />
    </>
  );
}

function Footer({ host, checkedAt }: { host: string; checkedAt: string }) {
  return (
    <footer className="mt-8 grid gap-3 text-center text-[12.5px] leading-relaxed text-[#0B1A12]/55">
      <p className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-[#0B1A12]/70 ring-1 ring-[#0B1A12]/[0.07]">
        <ShieldCheck className="h-4 w-4 text-[#1F9D55]" /> Consulta feita em {fmtWhen(checkedAt)}
      </p>
      {host && (
        <p className="flex items-start justify-center gap-1.5">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Só vale a consulta feita no endereço <b className="text-[#0B1A12]/80">{host}</b>. Desconfie de páginas parecidas em outros endereços.
          </span>
        </p>
      )}
      <p style={{ color: INK, opacity: 0.45 }}>Quark Mobilidade · verificação de cartão do proprietário</p>
    </footer>
  );
}
