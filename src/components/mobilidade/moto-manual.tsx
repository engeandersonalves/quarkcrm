"use client";

import { Baby, Droplets, HardHat, Phone, ShieldCheck, Wrench } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PDF_PAGE_H, PDF_PAGE_W } from "@/components/bf/proposal-pdf";
import { dateBr, maskDoc } from "@/lib/br";
import { formatPhone } from "@/lib/format";
import { MANUAL_SPEC_FIELDS, type MotoProduct } from "@/lib/moto-products";

/**
 * Manual do cliente da scooter, no design branco da Quark Mobilidade (A4).
 * Conteúdo baseado no manual do fabricante, reescrito e organizado para o cliente final.
 */

export interface ManualOwner {
  name: string;
  doc?: string;
  color?: string;
  chassis?: string;
  motorNo?: string;
  batteryNo?: string;
  delivery?: string;
  warrantyDays?: number;
}

export interface ManualBrand {
  company: string;
  whatsapp: string;
  instagram: string;
  city: string;
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const INK = "#0B1A12";
const GREEN = "#1F9D55";
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";

const CARD: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(255,255,255,0.86))",
  border: "1.5px solid rgba(255,255,255,0.95)",
  boxShadow: "0 1px 0 #fff inset, 0 14px 32px -16px rgba(16,52,32,0.25), 0 2px 5px rgba(16,52,32,0.05)",
};
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={className} style={CARD}>
      {children}
    </div>
  );
}

function Ic({ n, size = 34 }: { n: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/mob/ic/${n}.png`} alt="" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

function Page({ n, total, model, children }: { n: number; total: number; model: string; children: ReactNode }) {
  return (
    <div data-pdf-page className="relative overflow-hidden font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      <div className="absolute inset-0 bg-[#F6F8F2]" />
      <div className="absolute -top-[180px] -left-[220px] h-[640px] w-[640px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.40), rgba(126,214,150,0))" }} />
      <div className="absolute top-[260px] -right-[260px] h-[640px] w-[640px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(236,240,120,0.35), rgba(236,240,120,0))" }} />
      <div className="absolute inset-x-0 top-0 h-[8px]" style={{ background: GRAD }} />
      <div className="relative flex h-full flex-col px-[52px] pt-[34px] pb-[26px] [&>*]:shrink-0">
        {n > 1 && (
          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mob/ic/logo.png" alt="" className="h-[40px] w-auto" />
            <span className="rounded-full bg-[#0B1A12] px-4 py-1.5 text-[11px] font-bold tracking-[0.14em] text-white uppercase">Manual do cliente · {model}</span>
          </div>
        )}
        {children}
        <div className="mt-auto flex items-center justify-between border-t border-[#0B1A12]/10 pt-3 text-[11px] font-semibold text-[#0B1A12]/45">
          <span>Leia este manual antes do primeiro uso · Quark Mobilidade</span>
          <span className="tabular-nums">
            {n} / {total}
          </span>
        </div>
      </div>
    </div>
  );
}

function Title({ kicker, children, className }: { kicker: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("mt-6", className)}>
      <p className="flex items-center gap-2.5 text-[13px] font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
        <span className="h-[3px] w-7 rounded-full" style={{ background: GREEN }} />
        {kicker}
      </p>
      <h2 className="mt-1 text-[34px] leading-[1.02] font-extrabold tracking-[-0.04em]">{children}</h2>
    </div>
  );
}

const Dot = () => <span style={{ color: "#3FBF6A" }}>.</span>;

function Num({ n }: { n: number }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-extrabold text-[#0B1A12]" style={{ background: GRAD }}>
      {n}
    </span>
  );
}

export function MotoManualPages({ p, brand, owner }: { p: MotoProduct; brand: ManualBrand; owner?: ManualOwner | null }) {
  const s = p.specs;
  const total = 5;
  const warranty = owner?.warrantyDays ?? 90;
  const main = [
    { i: "bolt", k: "Potência do motor", v: s.power },
    { i: "battery", k: "Bateria", v: s.battery },
    { i: "pin", k: "Autonomia estimada", v: s.range },
    { i: "gauge", k: "Velocidade máxima", v: s.speed },
    { i: "plug", k: "Tempo de recarga", v: s.recharge },
    { i: "weight", k: "Carga máxima", v: s.load },
    { i: "brake", k: "Freios", v: s.brakes },
    { i: "lock", k: "Segurança", v: s.security },
    { i: "gear", k: "Peso", v: s.weight },
  ].filter((x) => x.v && x.v.trim());
  const extra = MANUAL_SPEC_FIELDS.map((f) => ({ k: f.label, v: (s[f.k] as string | undefined) ?? "" })).filter((x) => x.v.trim());

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------ 1. capa */}
      <Page n={1} total={total} model={p.name}>
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="" className="h-[54px] w-auto" />
          <span className="flex items-center gap-2 rounded-full bg-[#0B1A12] px-5 py-2.5 text-[13px] font-bold tracking-[0.12em] text-white uppercase">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E4F04A]" /> Manual do cliente
          </span>
        </div>
        <div className="mt-12">
          <p className="flex items-center gap-2.5 text-[15px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
            <span className="h-[3px] w-8 rounded-full" style={{ background: GREEN }} />
            {p.kicker || "Scooter elétrica"}
          </p>
          <h1 className="mt-1 text-[104px] leading-[0.9] font-extrabold tracking-[-0.055em]">
            {p.name}
            <Dot />
          </h1>
          <p className="mt-3 max-w-[560px] text-[20px] leading-snug text-[#0B1A12]/70">Tudo o que você precisa saber para rodar com segurança, cuidar da bateria e aproveitar a sua scooter por muitos anos.</p>
        </div>
        <div className="relative mt-4 h-[430px]">
          <div className="absolute top-[10px] left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full border-2 border-dashed border-[#1F9D55]/20" />
          <div className="absolute bottom-[8px] left-1/2 h-[30px] w-[460px] -translate-x-1/2 rounded-[50%] bg-[#0B1A12]/20 blur-[16px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.photo || "/mob/cmp-scooter.webp"} data-fallback="/mob/cmp-scooter.webp" alt="" className="absolute top-0 left-1/2 h-[430px] w-[620px] -translate-x-1/2 object-contain drop-shadow-[0_30px_30px_rgba(16,52,32,0.25)]" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {main.slice(0, 3).map((x) => (
            <Card key={x.k} className="flex items-center gap-3 rounded-[20px] px-4 py-3">
              <Ic n={x.i} size={38} />
              <span>
                <span className="block text-[18px] leading-tight font-extrabold">{x.v}</span>
                <span className="block text-[12px] text-[#0B1A12]/55">{x.k}</span>
              </span>
            </Card>
          ))}
        </div>
        {owner?.name && (
          <Card className="mt-4 rounded-[22px] px-5 py-4">
            <p className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: GREEN }}>
              Esta scooter pertence a
            </p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[22px] font-extrabold">{owner.name}</p>
              <p className="text-[13px] text-[#0B1A12]/60">
                {[owner.color && `Cor ${owner.color}`, owner.chassis && `Chassi ${owner.chassis}`, owner.delivery && `Entregue em ${dateBr(owner.delivery)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </Card>
        )}
      </Page>

      {/* ---------------------------------------------- 2. ficha técnica */}
      <Page n={2} total={total} model={p.name}>
        <Title kicker="Conheça a sua scooter">
          Ficha técnica completa<Dot />
        </Title>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {main.map((x) => (
            <Card key={x.k} className="flex items-center gap-3 rounded-[18px] px-3.5 py-2.5">
              <Ic n={x.i} size={34} />
              <span className="min-w-0">
                <span className="block text-[15px] leading-tight font-extrabold">{x.v}</span>
                <span className="block text-[11px] text-[#0B1A12]/55">{x.k}</span>
              </span>
            </Card>
          ))}
        </div>
        {extra.length > 0 && (
          <Card className="mt-3 rounded-[22px] px-5 py-1">
            {extra.map((x, i) => (
              <div key={x.k} className={cx("grid grid-cols-[190px_1fr] gap-4 py-[7px] text-[13px]", i > 0 && "border-t border-[#0B1A12]/[0.07]")}>
                <span className="text-[#0B1A12]/55">{x.k}</span>
                <span className="font-semibold">{x.v}</span>
              </div>
            ))}
          </Card>
        )}
        <Card className="mt-3 rounded-[22px] px-5 py-3">
          <p className="text-[15px] font-extrabold">Identificação</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            {[
              ["Modelo", p.name],
              ["Cor", owner?.color || p.colors.join(", ") || "—"],
              ["Nº do chassi", owner?.chassis || "________________"],
              ["Nº do motor", owner?.motorNo || "________________"],
              ["Nº da bateria", owner?.batteryNo || "________________"],
              ["Proprietário", owner?.name ? `${owner.name}${owner.doc ? ` · ${maskDoc(owner.doc)}` : ""}` : "________________"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed border-[#0B1A12]/10 py-1">
                <span className="text-[#0B1A12]/55">{k}</span>
                <span className="text-right font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <p className="mt-3 text-[11px] text-[#0B1A12]/45">Autonomia estimada em condições ideais: varia com o peso transportado, relevo, temperatura, calibragem dos pneus e modo de condução.</p>
      </Page>

      {/* ---------------------------------- 3. recebimento, inspeção e segurança */}
      <Page n={3} total={total} model={p.name}>
        <Title kicker="Na entrega">
          O que você recebe<Dot />
        </Title>
        <div className="mt-4 grid grid-cols-[1.1fr_1fr] gap-3">
          <Card className="rounded-[22px] px-5 py-4">
            <div className="flex items-center gap-3">
              <Ic n="package" size={44} />
              <p className="text-[16px] font-extrabold">Entregue montada, testada e revisada</p>
            </div>
            <ul className="mt-3 grid gap-1.5 text-[13px] text-[#0B1A12]/75">
              {["Scooter montada, com guidão e retrovisores", "Bateria de lítio instalada", "Carregador original bivolt", "Chaves e controle do alarme / cartão NFC", "Este manual e o certificado de garantia"].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2FB061]" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="rounded-[22px] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#0B1A12] text-[#E4F04A]">
                <Wrench className="h-5 w-5" />
              </span>
              <p className="text-[16px] font-extrabold">Para o dia a dia</p>
            </div>
            <ul className="mt-3 grid gap-1.5 text-[13px] text-[#0B1A12]/75">
              {["Bomba ou calibrador de ar", "Chaves Allen e chave fixa (ajustes simples)", "Pano macio e limpador neutro", "Torquímetro: só para a assistência técnica"].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2FB061]" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Title kicker="Antes de cada saída" className="mt-6">
          Checklist de 1 minuto<Dot />
        </Title>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ["battery", "Carga da bateria", "confira no painel"],
            ["brake", "Freios", "aperte os dois manetes"],
            ["pin", "Pneus", "calibragem e desgaste"],
            ["bolt", "Luzes e buzina", "farol, setas e lanterna"],
            ["gear", "Parafusos", "guidão, rodas e banco firmes"],
            ["lock", "Alinhamento", "rodas e guidão retos"],
          ].map(([i, t, d]) => (
            <Card key={t} className="flex items-center gap-3 rounded-[18px] px-3.5 py-3">
              <Ic n={i} size={32} />
              <span>
                <span className="block text-[14px] leading-tight font-extrabold">{t}</span>
                <span className="block text-[11px] text-[#0B1A12]/55">{d}</span>
              </span>
            </Card>
          ))}
        </div>

        <Title kicker="Segurança" className="mt-6">
          Regras que não podem faltar<Dot />
        </Title>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            [<HardHat key="h" className="h-6 w-6" />, "Use sempre capacete", "e acenda o farol à noite"],
            [<Ic key="w" n="weight" size={30} />, "Respeite a carga máxima", s.load ? `até ${s.load.replace(/^at[ée]\s*/i, "")}` : "indicada na ficha técnica"],
            [<Ic key="b" n="bolt" size={30} />, "Não modifique a parte elétrica", "nem aumente a potência"],
            [<Ic key="p" n="plug" size={30} />, "Só carregador original", "ou aprovado pela Quark"],
            [<Droplets key="d" className="h-6 w-6" />, "Bateria longe de calor e água", "não lave com jato de alta pressão"],
            [<Baby key="c" className="h-6 w-6" />, "Fora do alcance de crianças", "chaves, carregador e bateria"],
          ].map(([icon, t, d], k) => (
            <Card key={k} className="flex items-center gap-3 rounded-[18px] px-3.5 py-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#EAF6EC] text-[#1F9D55]">{icon}</span>
              <span>
                <span className="block text-[13.5px] leading-tight font-extrabold">{t}</span>
                <span className="block text-[11px] text-[#0B1A12]/55">{d}</span>
              </span>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[#0B1A12]/45">Veículo autopropelido conforme a Resolução CONTRAN nº 996/2023 (até 1.000 W e 32 km/h). Siga as regras de circulação da sua cidade.</p>
      </Page>

      {/* ---------------------------------------------------- 4. bateria */}
      <Page n={4} total={total} model={p.name}>
        <Title kicker="Bateria e recarga">
          A bateria dura mais quando você cuida<Dot />
        </Title>
        <Card className="mt-5 rounded-[24px] px-6 py-5">
          <div className="flex items-center gap-3">
            <Ic n="plug" size={40} />
            <p className="text-[18px] font-extrabold">Como carregar, passo a passo</p>
            <span className="ml-auto rounded-full bg-[#EAF6EC] px-3 py-1 text-[12px] font-bold" style={{ color: GREEN }}>
              Recarga completa: {s.recharge || "cerca de 6 h"}
            </span>
          </div>
          <ol className="mt-4 grid gap-3">
            {[
              "Desligue a scooter e retire a chave.",
              "Conecte primeiro o carregador na scooter (ou na bateria).",
              "Depois, ligue o carregador na tomada aterrada (100–240 V).",
              "Aguarde a luz do carregador indicar carga completa e desconecte da tomada antes de tirar da scooter.",
            ].map((t, i) => (
              <li key={t} className="flex items-start gap-3 text-[14px]">
                <Num n={i + 1} />
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            ["battery", "Uso no dia a dia", "Recarregue ao chegar perto de 20%. Não precisa esperar zerar e não deixe descarregada por muitos dias."],
            ["gauge", "Temperatura ideal", "Guarde e carregue em local fresco e ventilado, por volta de 25 °C, longe do sol forte e da chuva."],
            ["lock", "Se for guardar", "Sem uso, a bateria desconectada pode ficar armazenada de 5 a 6 meses. Se ficar conectada, recarregue de 2 a 3 vezes por mês."],
            ["weight", "Descarte correto", "Nunca no lixo comum. Leve a um ponto de coleta autorizado ou à Quark. Não desmonte nem abra a bateria."],
          ].map(([i, t, d]) => (
            <Card key={t} className="rounded-[20px] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Ic n={i} size={32} />
                <p className="text-[15px] font-extrabold">{t}</p>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#0B1A12]/70">{d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-4 rounded-[22px] px-6 py-4 text-[13px] leading-relaxed text-white" style={{ background: "#0B1A12" }}>
          <p className="text-[15px] font-extrabold text-[#E4F04A]">Dica de quem entende</p>
          Carregar à noite e usar de dia é o ideal. Evite deixar a scooter carregando dentro de quartos fechados e nunca use extensões ou adaptadores simples: ligue direto em tomada de 3 pinos.
        </div>
      </Page>

      {/* ------------------------------- 5. manutenção, problemas, garantia */}
      <Page n={5} total={total} model={p.name}>
        <Title kicker="Manutenção">
          Plano de cuidados<Dot />
        </Title>
        <Card className="mt-4 overflow-hidden rounded-[20px]">
          <div className="grid grid-cols-[150px_1fr] bg-[#0B1A12] px-5 py-2.5 text-[11px] font-bold tracking-[0.12em] text-white uppercase">
            <span>Quando</span>
            <span>O que fazer</span>
          </div>
          {[
            ["Toda semana", "Calibrar os pneus e conferir o desgaste."],
            ["Todo mês", "Inspecionar freios (pastilhas e lonas), conectores elétricos e parafusos."],
            ["30 dias / 300 km", "Revisão na Quark: reaperto geral, freios, folgas e saúde da bateria."],
            ["A cada 6 meses", "Revisão completa do sistema elétrico, rolamentos e suspensão."],
          ].map(([w, t], i) => (
            <div key={w} className={cx("grid grid-cols-[150px_1fr] px-5 py-2.5 text-[13px]", i > 0 && "border-t border-[#0B1A12]/[0.07]")}>
              <span className="font-extrabold">{w}</span>
              <span className="text-[#0B1A12]/75">{t}</span>
            </div>
          ))}
        </Card>

        <Title kicker="Solução de problemas" className="mt-5">
          Se algo não funcionar<Dot />
        </Title>
        <div className="mt-3 grid gap-2">
          {[
            ["bolt", "A scooter não liga", "Conector da bateria solto, chave da bateria desligada, fusível queimado ou bateria descarregada."],
            ["plug", "A bateria não carrega", "Carregador com defeito, mau contato na porta de carga ou célula interna da bateria danificada."],
            ["gear", "O motor não funciona", "Acelerador com defeito, fiação rompida, controlador danificado ou corte dos freios acionado."],
            ["pin", "A autonomia diminuiu", "Pneus murchos, bateria envelhecida, excesso de peso, frio ou freio arrastando."],
            ["gauge", "Código de erro no painel", "Fiação solta, sensor Hall do motor danificado ou falha de contato no controlador."],
          ].map(([i, t, d]) => (
            <Card key={t} className="grid grid-cols-[34px_190px_1fr] items-center gap-3 rounded-[16px] px-4 py-2.5">
              <Ic n={i} size={28} />
              <span className="text-[13.5px] font-extrabold">{t}</span>
              <span className="text-[12px] leading-snug text-[#0B1A12]/65">{d}</span>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#0B1A12]/45">Não abra a bateria nem o controlador: o diagnóstico e o reparo são feitos pela assistência técnica, caso a caso.</p>

        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-3">
          <div className="rounded-[22px] p-[2px]" style={{ background: "linear-gradient(120deg,#1FA06A,#7ED696 50%,#E4F04A)" }}>
            <div className="h-full rounded-[20px] bg-[#FBFDF8] px-5 py-4">
              <p className="flex items-center gap-2 text-[16px] font-extrabold">
                <ShieldCheck className="h-5 w-5 text-[#1F9D55]" /> Garantia de {warranty} dias
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0B1A12]/70">
                Contra defeitos de fabricação no motor, controlador, bateria, carregador e parte elétrica, a partir da entrega. Guarde o certificado de garantia e a nota fiscal. Peças de desgaste natural (pneus, freios, lâmpadas) não entram.
              </p>
            </div>
          </div>
          <div className="rounded-[22px] bg-[#0B1A12] px-5 py-4 text-white">
            <p className="text-[12px] font-bold tracking-[0.14em] text-[#E4F04A] uppercase">Assistência Quark</p>
            <p className="mt-1 text-[14px] leading-snug text-white/80">Dúvida, revisão ou problema? Fale com a gente:</p>
            {brand.whatsapp && (
              <p className="mt-2 flex items-center gap-2 text-[20px] font-extrabold">
                <Phone className="h-4 w-4 text-[#9FDB7C]" /> {formatPhone(brand.whatsapp)}
              </p>
            )}
            <p className="mt-1 text-[12px] text-white/55">{[brand.instagram && `@${brand.instagram.replace(/^@/, "")}`, brand.city].filter(Boolean).join(" · ") || brand.company}</p>
          </div>
        </div>

        <Card className="mt-3 rounded-[18px] px-5 py-3">
          <p className="text-[13px] font-extrabold">Advertências obrigatórias</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#0B1A12]/65">
            Leia este manual antes do uso · Montagem ou reparo feitos por pessoas não autorizadas podem causar danos ou lesões e anulam a garantia · Use apenas peças de reposição originais · Não use a scooter com
            componentes danificados · Faça a manutenção periódica descrita neste manual.
          </p>
        </Card>
      </Page>
    </div>
  );
}

/** Baixa o manual do cliente em PDF (personalizado quando há um dono). */
export async function downloadMotoManual(p: MotoProduct, brand: ManualBrand, owner?: ManualOwner | null) {
  const { downloadPagesPdf, pdfFileSlug } = await import("@/components/bf/download-pdf");
  await downloadPagesPdf(<MotoManualPages p={p} brand={brand} owner={owner} />, `Manual-${pdfFileSlug(p.name)}${owner?.name ? `-${pdfFileSlug(owner.name)}` : ""}.pdf`, { background: "#F6F8F2" });
}
