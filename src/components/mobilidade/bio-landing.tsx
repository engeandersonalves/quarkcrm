import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Bike,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  CreditCard,
  FileSignature,
  Gauge,
  IdCard,
  MapPin,
  MessageCircle,
  QrCode,
  Receipt,
  Route,
  ShieldCheck,
  Smartphone,
  Sun,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Scooter } from "@/lib/catalog-mobilidade";

/**
 * Página da bio do Instagram: tudo o que dá segurança para comprar uma scooter
 * elétrica da Quark em uma rolagem só. Fundo branco, leitura fácil e WhatsApp
 * sempre a um toque.
 */

const INK = "#0B1A12";
const GREEN = "#1F9D55";
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const SINCE = 2020;
const WARRANTY_DAYS = 90;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });

function waHref(phone: string | null, text: string) {
  const n = (phone ?? "").replace(/\D/g, "");
  if (n.length < 10) return null;
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(text)}`;
}

export function BioLanding({ models, whatsapp, instagram, city }: { models: Scooter[]; whatsapp: string | null; instagram: string | null; city: string | null }) {
  const place = city || "Maceió/AL";
  const years = new Date().getFullYear() - SINCE;
  const talk = (text: string) => waHref(whatsapp, text) ?? "/catalogo/mobilidade";
  const hello = talk("Olá! Vim pelo Instagram e quero saber mais sobre as scooters elétricas da Quark.");
  const cheapest = models.reduce<Scooter | null>((b, m) => (m.installment > 0 && (!b || m.installment < b.installment) ? m : b), null);

  return (
    <div className="min-h-dvh overflow-x-clip bg-white text-[#0B1A12] antialiased" style={{ fontFamily: "var(--font-jakarta), -apple-system, system-ui, sans-serif" }}>
      <div aria-hidden className="h-[5px] w-full" style={{ background: GRAD }} />

      {/* topo */}
      <header className="sticky top-0 z-30 border-b border-[#0B1A12]/[0.06] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-9 w-auto" />
          <a href={hello} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-bold text-[#06210F]">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto max-w-5xl px-4 pt-8 pb-10 sm:pt-14">
          <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[#EEF7EF] px-3.5 py-1.5 text-[12.5px] font-bold text-[#1F7A45]">
                <BadgeCheck className="h-4 w-4" /> Desde {SINCE} · {years}+ anos em {place}
              </p>
              <h1 className="mt-4 text-[36px] leading-[1.05] font-extrabold tracking-[-0.035em] sm:text-[52px]">
                Scooter elétrica com <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(95deg,#1F9D55,#4FC38A 55%,#9DBF1F)" }}>garantia e documento</span> de verdade.
              </h1>
              <p className="mt-4 max-w-[34ch] text-[17px] leading-relaxed text-[#0B1A12]/65 sm:text-[18px]">
                Sem gasolina, sem CNH e sem placa*. Você leva contrato assinado, comprovante de propriedade e cartão do dono com QR de verificação.
              </p>
              <div className="mt-6 grid gap-2.5 sm:flex">
                <a href={hello} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] px-6 text-[16px] font-bold text-white shadow-[0_18px_40px_-18px_rgba(11,26,18,0.7)]">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" /> Falar no WhatsApp
                </a>
                <a href="#modelos" className="flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-[16px] font-semibold ring-1 ring-[#0B1A12]/12">
                  Ver modelos e preços <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              {cheapest && (
                <p className="mt-4 text-[14px] text-[#0B1A12]/55">
                  A partir de <b className="text-[#0B1A12]">{cheapest.installments}x de {brl(cheapest.installment)}</b> no cartão
                </p>
              )}
            </div>
            <div className="relative">
              <div aria-hidden className="absolute -inset-6 -z-0 rounded-[48px]" style={{ background: "radial-gradient(closest-side, rgba(159,219,124,0.35), rgba(255,255,255,0))" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mob/trio.jpg" alt="Scooters elétricas Quark" className="relative aspect-[4/3] w-full rounded-[32px] object-cover shadow-[0_40px_80px_-40px_rgba(11,26,18,0.55)]" />
            </div>
          </div>

          {/* selos de confiança */}
          <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: CalendarCheck, t: `Desde ${SINCE}`, s: `${years}+ anos no mercado` },
              { icon: ShieldCheck, t: `${WARRANTY_DAYS} dias de garantia`, s: "com certificado" },
              { icon: QrCode, t: "Documento com QR", s: "verificação oficial" },
              { icon: IdCard, t: "Sem CNH e sem placa*", s: "autopropelido" },
            ].map((x) => (
              <li key={x.t} className="rounded-[22px] bg-[#F6F8F4] p-4">
                <x.icon className="h-6 w-6" style={{ color: GREEN }} />
                <p className="mt-2.5 text-[15.5px] leading-tight font-bold">{x.t}</p>
                <p className="mt-0.5 text-[13px] text-[#0B1A12]/55">{x.s}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* modelos */}
        <Section id="modelos" kicker="Modelos" title="Escolha a sua" text="Motor elétrico de até 1.000W, bateria de lítio e entrega montada e revisada.">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => (
              <ModelCard key={m.id} m={m} href={talk(`Olá! Vim pelo Instagram e tenho interesse na scooter ${m.name}. Pode me passar mais informações?`)} />
            ))}
          </div>
        </Section>

        {/* documentos */}
        <Section kicker="Segurança na compra" title="Você recebe tudo em mãos" text="Compra formal, do jeito certo. Cada documento prova que a scooter é sua." tint>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Doc icon={FileSignature} t="Contrato de compra e venda" s="Assinado pelo celular, com validade jurídica, selfie e registro da assinatura." />
            <Doc icon={Receipt} t="Comprovante de compra e propriedade" s="Com chassi, motor e bateria da sua scooter, e um cartão de bolso para andar junto." />
            <Doc icon={IdCard} t="Cartão do proprietário" s="Com a sua foto 3/4, dados da scooter e QR code. Imprima ou salve no celular." highlight />
            <Doc icon={QrCode} t="Verificação oficial pelo QR" s="Qualquer pessoa aponta a câmera e confirma na hora se o documento é original." />
            <Doc icon={BookOpen} t="Manual e certificado de garantia" s="Uso, recarga e cuidados com a bateria, com os números da sua scooter." />
            <Doc icon={Smartphone} t="Área do cliente online" s="Tudo guardado: entre com o CPF e acesse documentos e garantia quando quiser." />
          </div>
        </Section>

        {/* garantia */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="relative overflow-hidden rounded-[32px] px-6 py-9 text-white sm:px-10 sm:py-12" style={{ background: "linear-gradient(150deg,#123A26 0%,#0B1A12 70%)" }}>
            <div aria-hidden className="absolute -top-28 -right-20 h-80 w-80 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(216,232,60,0.22), transparent)" }} />
            <div className="relative grid items-center gap-8 md:grid-cols-[auto_1fr]">
              <div className="grid h-36 w-36 place-items-center rounded-full ring-8 ring-white/[0.06]" style={{ background: GRAD }}>
                <div className="grid h-[118px] w-[118px] place-items-center rounded-full bg-[#0B1A12] text-center">
                  <span>
                    <span className="block text-[44px] leading-none font-extrabold">{WARRANTY_DAYS}</span>
                    <span className="text-[12px] font-semibold tracking-[0.18em] text-white/60 uppercase">dias</span>
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-bold tracking-[0.2em] text-[#D8E83C] uppercase">Garantia Quark</p>
                <h2 className="mt-2 text-[28px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[36px]">Garantia contra defeitos de fabricação, com suporte aqui em {place.split("/")[0]}.</h2>
                <ul className="mt-5 grid gap-2.5 text-[15.5px] text-white/80 sm:grid-cols-2">
                  {["Certificado com os números da sua scooter", "Atendimento direto pelo WhatsApp", "Assistência e peças com a Quark", "Garantia passa junto se você vender a scooter"].map((x) => (
                    <li key={x} className="flex items-start gap-2.5">
                      <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#9FDB7C]" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CNH e placa */}
        <Section kicker="Documentação do veículo" title="Precisa de CNH ou placa?" text="">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[26px] bg-[#F6F8F4] p-6">
              <p className="text-[19px] leading-snug font-bold">Não. Nossas scooters são autopropelidas.</p>
              <p className="mt-2 text-[15.5px] leading-relaxed text-[#0B1A12]/70">
                Pela Resolução CONTRAN nº 996/2023, veículos com motor de até <b>1.000 W</b> e velocidade de até <b>32 km/h</b> são dispensados de registro, emplacamento e habilitação.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-[#0B1A12]/55">
                Mesmo assim, a sua compra fica toda registrada: contrato, comprovante de propriedade e cartão do proprietário com verificação oficial. Recomendamos sempre usar capacete e respeitar as regras de trânsito da sua cidade.
              </p>
            </div>
            <ul className="grid gap-3">
              {[
                { icon: Zap, t: "Motor até 1.000 W", s: "dentro do limite do autopropelido" },
                { icon: Gauge, t: "Até 32 km/h", s: "velocidade máxima de fábrica" },
                { icon: IdCard, t: "Prova de propriedade", s: "comprovante e cartão com QR" },
              ].map((x) => (
                <li key={x.t} className="flex items-center gap-4 rounded-[22px] p-4 ring-1 ring-[#0B1A12]/[0.08]">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF7EF]" style={{ color: GREEN }}>
                    <x.icon className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-[16px] font-bold">{x.t}</span>
                    <span className="block text-[13.5px] text-[#0B1A12]/55">{x.s}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* como comprar */}
        <Section kicker="Como comprar" title="Simples, do começo ao fim" text="Tudo pelo celular. Sem burocracia." tint>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MessageCircle, t: "Chame no WhatsApp", s: "Tire dúvidas e escolha o modelo e a cor." },
              { icon: CreditCard, t: "Escolha o pagamento", s: "PIX à vista ou em até 21x no cartão." },
              { icon: FileSignature, t: "Assine pelo celular", s: "Contrato digital em 1 minuto, com selfie." },
              { icon: Truck, t: "Retire ou receba", s: "Na loja ou em casa, montada e revisada." },
            ].map((x, i) => (
              <li key={x.t} className="relative rounded-[24px] bg-white p-5 ring-1 ring-[#0B1A12]/[0.07]">
                <span className="text-[13px] font-extrabold tracking-[0.14em]" style={{ color: GREEN }}>
                  PASSO {i + 1}
                </span>
                <x.icon className="mt-3 h-7 w-7" />
                <p className="mt-3 text-[17px] font-bold">{x.t}</p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-[#0B1A12]/60">{x.s}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* perguntas */}
        <Section kicker="Dúvidas" title="Perguntas frequentes" text="">
          <div className="mx-auto grid max-w-3xl gap-2.5">
            {[
              ["Quanto tempo leva para carregar?", "Numa tomada comum de casa, com o carregador que vem junto. O tempo de cada modelo está na ficha técnica: dá para carregar à noite e sair com a bateria cheia."],
              ["Qual é a autonomia de verdade?", "Depende do modelo, do peso, do relevo e do jeito de pilotar. A autonomia de cada modelo está na ficha técnica acima, e explicamos tudo no WhatsApp antes da compra."],
              ["O que a garantia cobre?", `Defeitos de fabricação por ${WARRANTY_DAYS} dias, com certificado emitido no seu nome. Desgaste natural e mau uso não entram, e tudo isso está explicado no manual.`],
              ["Como sei que o documento é original?", "O cartão do proprietário e o comprovante têm um QR code. Ao escanear, abre a página oficial da Quark mostrando se o documento é original, com os dados da scooter."],
              ["Posso vender a minha scooter depois?", "Pode. Pela área do cliente você pede a transferência de propriedade para o novo dono, e a garantia restante vai junto."],
              ["Vocês entregam?", `Sim. Você pode retirar na loja ou receber em casa em ${place.split("/")[0]} e região, com a scooter montada e revisada.`],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-[20px] bg-[#F6F8F4] px-5 open:bg-white open:ring-1 open:ring-[#0B1A12]/[0.08]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#0B1A12]/40 transition group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-[#0B1A12]/65">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* chamada final */}
        <section className="mx-auto max-w-5xl px-4 pb-10">
          <div className="rounded-[32px] px-6 py-10 text-center" style={{ background: "linear-gradient(160deg,#F2FAEC 0%,#FBFDE9 100%)" }}>
            <h2 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[38px]">Bora rodar sem gasolina?</h2>
            <p className="mx-auto mt-2 max-w-md text-[16px] text-[#0B1A12]/60">Fale com a gente agora. Respondemos rápido e sem compromisso.</p>
            <a href={hello} target="_blank" rel="noopener noreferrer" className="mx-auto mt-6 flex h-14 max-w-sm items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[17px] font-bold text-[#06210F] shadow-[0_18px_40px_-18px_rgba(37,211,102,0.9)]">
              <MessageCircle className="h-5 w-5" /> Chamar no WhatsApp
            </a>
          </div>

          {/* energia solar */}
          <a href="/captura" className="mt-4 flex items-center gap-4 rounded-[26px] p-5 ring-1 ring-[#0B1A12]/[0.08] transition hover:ring-[#0B1A12]/20">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#FFF7D6] text-[#B58500]">
              <Sun className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16.5px] font-bold">A Quark também faz energia solar</span>
              <span className="block text-[14px] text-[#0B1A12]/60">Simule quanto você economiza na conta de luz.</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#0B1A12]/40" />
          </a>
        </section>
      </main>

      <footer className="border-t border-[#0B1A12]/[0.06] pb-28 sm:pb-10">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 pt-8 text-[14px] text-[#0B1A12]/60 sm:grid-cols-[1fr_auto]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-8 w-auto" />
            <p className="mt-3 flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {place} · desde {SINCE}
            </p>
            {instagram && <p className="mt-1">Instagram @{instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "")}</p>}
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-[#0B1A12]/75 sm:justify-end">
            <a href="/cliente">Área do cliente</a>
            <a href="/verificar">Verificar documento</a>
            <a href="/catalogo/mobilidade">Catálogo</a>
          </nav>
        </div>
        <p className="mx-auto mt-6 max-w-5xl px-4 text-[12px] leading-relaxed text-[#0B1A12]/40">
          *Veículo autopropelido conforme a Resolução CONTRAN nº 996/2023 (até 1.000 W e 32 km/h). Fotos ilustrativas. Preços e condições sujeitos a alteração e à disponibilidade de estoque.
        </p>
      </footer>

      {/* WhatsApp fixo no celular */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#0B1A12]/[0.06] bg-white/90 p-3 backdrop-blur-md sm:hidden" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <a href={hello} target="_blank" rel="noopener noreferrer" className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[16px] font-bold text-[#06210F]">
          <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}

function Section({ id, kicker, title, text, tint, children }: { id?: string; kicker: string; title: string; text: string; tint?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={tint ? "scroll-mt-20 bg-[#F8FAF6]" : "scroll-mt-20"}>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <p className="text-[12.5px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          {kicker}
        </p>
        <h2 className="mt-2 text-[30px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[38px]">{title}</h2>
        {text && <p className="mt-2 max-w-xl text-[16.5px] leading-relaxed text-[#0B1A12]/60">{text}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </section>
  );
}

function Doc({ icon: I, t, s, highlight }: { icon: typeof Zap; t: string; s: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-[24px] p-5 text-white" : "rounded-[24px] bg-white p-5 ring-1 ring-[#0B1A12]/[0.07]"} style={highlight ? { background: `linear-gradient(150deg,#123A26,${INK})` } : undefined}>
      <span className={highlight ? "grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#D8E83C]" : "grid h-11 w-11 place-items-center rounded-2xl bg-[#EEF7EF]"} style={highlight ? undefined : { color: GREEN }}>
        <I className="h-5 w-5" />
      </span>
      <p className="mt-3.5 text-[16.5px] leading-snug font-bold">{t}</p>
      <p className={highlight ? "mt-1 text-[14.5px] leading-relaxed text-white/70" : "mt-1 text-[14.5px] leading-relaxed text-[#0B1A12]/60"}>{s}</p>
    </div>
  );
}

const SPEC_ICON = { Motor: Zap, Bateria: BatteryCharging, Autonomia: Route, Velocidade: Gauge } as const;

function ModelCard({ m, href }: { m: Scooter; href: string }) {
  const rows = Object.entries(m.table).filter(([, v]) => v && String(v).trim());
  const key = (["Motor", "Bateria", "Autonomia", "Velocidade"] as const).map((k) => [k, m.table[k]] as const).filter(([, v]) => v);
  return (
    <article className="flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-[#0B1A12]/[0.08] shadow-[0_24px_50px_-36px_rgba(11,26,18,0.45)]">
      <div className="relative grid aspect-[4/3] place-items-center bg-[#F4F6F2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.gallery.find((g) => g.fit === "contain")?.src ?? m.image} alt={`Scooter elétrica ${m.name}`} className="h-full w-full object-contain p-5" loading="lazy" />
        <span className="absolute top-4 left-4 rounded-full bg-white px-3 py-1 text-[12px] font-bold shadow-sm">{m.kicker}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">{m.name}</h3>
        {m.pitch && <p className="mt-1 text-[14.5px] leading-relaxed text-[#0B1A12]/60">{m.pitch}</p>}

        {key.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {key.map(([k, v]) => {
              const I = SPEC_ICON[k];
              return (
                <li key={k} className="rounded-2xl bg-[#F6F8F4] px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.06em] text-[#0B1A12]/50 uppercase">
                    <I className="h-3.5 w-3.5" style={{ color: GREEN }} /> {k}
                  </span>
                  <span className="mt-0.5 block text-[14.5px] leading-tight font-bold">{v}</span>
                </li>
              );
            })}
          </ul>
        )}

        {rows.length > 4 && (
          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 text-[14px] font-semibold text-[#1F7A45] [&::-webkit-details-marker]:hidden">
              <Wrench className="h-4 w-4" /> Ficha técnica completa
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <dl className="mt-1 divide-y divide-[#0B1A12]/[0.06] rounded-2xl bg-[#F6F8F4] px-4">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-2.5 text-[14px]">
                  <dt className="text-[#0B1A12]/55">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        <div className="mt-auto pt-5">
          {m.installment > 0 ? (
            <p className="text-[14px] text-[#0B1A12]/55">
              <span className="block text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-[#0B1A12]">
                {m.installments}x de {brl(m.installment)}
              </span>
              {m.cash > 0 && <>ou {brl(m.cash)} à vista no PIX</>}
            </p>
          ) : (
            <p className="text-[15px] font-semibold text-[#0B1A12]/60">Consulte o preço no WhatsApp</p>
          )}
          <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] text-[15.5px] font-bold text-white">
            <Bike className="h-5 w-5 text-[#9FDB7C]" /> Quero a {m.name}
          </a>
        </div>
      </div>
    </article>
  );
}
