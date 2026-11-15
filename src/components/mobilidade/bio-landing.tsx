import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Bike,
  BookOpen,
  CalendarCheck,
  Camera,
  ChevronDown,
  CreditCard,
  FileSignature,
  Gauge,
  IdCard,
  MapPin,
  MessageCircle,
  PiggyBank,
  Plug,
  QrCode,
  Receipt,
  Route,
  ShieldCheck,
  Smartphone,
  Store,
  Sun,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { OwnerCardBack, OwnerCardFront } from "@/components/cliente/owner-card";
import { commuteCosts, type GalleryPhoto, type Scooter } from "@/lib/catalog-mobilidade";
import type { MotoData } from "@/lib/moto-sale";

/**
 * Página da bio do Instagram, feita para converter: prova de confiança logo no
 * topo, modelos com fotos e preço, economia, documentos de verdade e WhatsApp
 * sempre a um toque. Fundo branco e leitura fácil.
 */

const GREEN = "#1F9D55";
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const DARK = "linear-gradient(150deg,#123A26 0%,#0B1A12 70%)";
const SINCE = 2020;
const WARRANTY_DAYS = 90;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function waHref(phone: string | null, text: string) {
  const n = (phone ?? "").replace(/\D/g, "");
  if (n.length < 10) return null;
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(text)}`;
}

export type ExtraPhotos = Record<string, { url: string; caption: string | null }[]>;

export function BioLanding({
  models,
  photos,
  whatsapp,
  instagram,
  city,
  sample,
}: {
  models: Scooter[];
  photos: ExtraPhotos;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  /** Cartão de exemplo (dados fictícios) para mostrar o documento que o cliente recebe. */
  sample: { d: MotoData; qr: string; contact: string } | null;
}) {
  const place = city || "Maceió/AL";
  const town = place.split("/")[0];
  const years = new Date().getFullYear() - SINCE;
  const talk = (text: string) => waHref(whatsapp, text) ?? "/catalogo/mobilidade";
  const hello = talk("Olá! Vim pelo Instagram e quero saber mais sobre as scooters elétricas da Quark.");
  const resale = talk("Olá! Tenho uma loja e quero saber as condições para revenda das scooters elétricas Quark.");
  const cheapest = models.reduce<Scooter | null>((b, m) => (m.installment > 0 && (!b || m.installment < b.installment) ? m : b), null);
  const costs = commuteCosts({ kmDay: 30 });
  const cost = (id: string) => costs.find((c) => c.id === id)?.month ?? 0;
  const save = Math.max(0, cost("moto") - cost("scooter"));

  return (
    <div className="min-h-dvh overflow-x-clip bg-white text-[#0B1A12] antialiased" style={{ fontFamily: "var(--font-jakarta), -apple-system, system-ui, sans-serif" }}>
      {/* revenda */}
      <a href={resale} target="_blank" rel="noopener noreferrer" className="block bg-[#0B1A12] px-4 py-2.5 text-center text-[13px] font-semibold text-white">
        <Store className="mr-1.5 inline h-4 w-4 -translate-y-px text-[#D8E83C]" />
        Tem loja? <span className="text-[#D8E83C]">Vendemos para revenda</span> · fale com a gente <ArrowRight className="inline h-3.5 w-3.5 -translate-y-px" />
      </a>

      {/* topo */}
      <header className="sticky top-0 z-30 border-b border-[#0B1A12]/[0.06] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-9 w-auto" />
          <nav className="hidden items-center gap-6 text-[14px] font-semibold text-[#0B1A12]/65 md:flex">
            <a href="#modelos">Modelos</a>
            <a href="#documentos">Documentos</a>
            <a href="#garantia">Garantia</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <a href={hello} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-bold text-[#06210F]">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto max-w-5xl px-4 pt-6 pb-10 sm:pt-12">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
            <div className="order-2 lg:order-1">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#EEF7EF] px-3.5 py-1.5 text-[12.5px] font-bold text-[#1F7A45]">
                <BadgeCheck className="h-4 w-4" /> Desde {SINCE} · {years}+ anos em {place}
              </p>
              <h1 className="mt-4 text-[36px] leading-[1.04] font-extrabold tracking-[-0.035em] sm:text-[52px]">
                Chega de gasolina. Vá de <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(95deg,#1F9D55,#4FC38A 55%,#9DBF1F)" }}>scooter elétrica</span>.
              </h1>
              <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-[#0B1A12]/65 sm:text-[18px]">
                Sem CNH e sem placa*, com garantia e documento de propriedade com QR de verificação. Economize até <b className="text-[#0B1A12]">{brl0(save)} por mês</b> trocando a moto a gasolina.
              </p>
              {cheapest && (
                <p className="mt-5 flex flex-wrap items-baseline gap-x-2 text-[15px] text-[#0B1A12]/60">
                  a partir de <span className="text-[30px] leading-none font-extrabold tracking-[-0.02em] text-[#0B1A12]">{cheapest.installments}x de {brl(cheapest.installment)}</span>
                </p>
              )}
              <div className="mt-6 grid gap-2.5 sm:flex">
                <a href={hello} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 text-[16.5px] font-bold text-[#06210F] shadow-[0_18px_40px_-18px_rgba(37,211,102,0.9)]">
                  <MessageCircle className="h-5 w-5" /> Quero a minha
                </a>
                <a href="#modelos" className="flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-[16px] font-semibold ring-1 ring-[#0B1A12]/12">
                  Ver modelos e fotos <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-3 text-[13px] text-[#0B1A12]/45">Resposta rápida · sem compromisso</p>
            </div>

            <div className="relative order-1 lg:order-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mob/vida-1.jpg" alt="Mulher sorrindo em uma scooter elétrica" className="aspect-[4/3] w-full rounded-[30px] object-cover shadow-[0_40px_80px_-40px_rgba(11,26,18,0.55)]" />
              <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12.5px] font-bold shadow-lg">
                <ShieldCheck className="h-4 w-4" style={{ color: GREEN }} /> {WARRANTY_DAYS} dias de garantia
              </span>
              <span className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-[#0B1A12]/90 px-3 py-1.5 text-[12.5px] font-bold text-white shadow-lg">
                <QrCode className="h-4 w-4 text-[#D8E83C]" /> Documento com QR
              </span>
            </div>
          </div>

          {/* selos */}
          <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: CalendarCheck, t: `Desde ${SINCE}`, s: `${years}+ anos no mercado` },
              { icon: ShieldCheck, t: `Garantia de ${WARRANTY_DAYS} dias`, s: "com certificado no seu nome" },
              { icon: Receipt, t: "Comprovante de propriedade", s: "e cartão do dono com QR" },
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
        <Section id="modelos" kicker="Modelos" title="Escolha a sua" text="Deslize as fotos de cada modelo. Motor de até 1.000W, bateria de lítio e entrega montada e revisada." tint>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => (
              <ModelCard key={m.id} m={m} extra={photos[m.id] ?? []} href={talk(`Olá! Vim pelo Instagram e tenho interesse na scooter ${m.name}. Pode me passar mais informações?`)} />
            ))}
          </div>
        </Section>

        {/* estilo de vida */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <p className="text-[12.5px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
            No seu dia a dia
          </p>
          <h2 className="mt-2 text-[30px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[38px]">Trabalho, faculdade, passeio. Sem trânsito parado e sem posto.</h2>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { src: "/mob/vida-2.jpg", t: "Pela cidade", cls: "col-span-2 sm:col-span-1" },
              { src: "/mob/vida-3.jpg", t: "No dia a dia", cls: "" },
              { src: "/mob/estilo.jpg", t: "Com estilo", cls: "" },
            ].map((p) => (
              <figure key={p.src} className={`relative overflow-hidden rounded-[24px] ${p.cls}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.t} loading="lazy" className="aspect-[4/3] h-full w-full object-cover sm:aspect-square" />
                <figcaption className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[12.5px] font-bold">{p.t}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* economia */}
        <Section kicker="Economia" title={`Até ${brl0(save * 12)} por ano no seu bolso`} text="Custo estimado por mês para rodar 30 km por dia, 22 dias no mês." tint>
          <div className="grid items-center gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="grid gap-3 rounded-[26px] bg-white p-5 ring-1 ring-[#0B1A12]/[0.07] sm:p-6">
              {(["carro", "moto", "onibus", "scooter"] as const).map((id) => {
                const c = costs.find((x) => x.id === id)!;
                const max = Math.max(...costs.map((x) => x.month));
                const me = id === "scooter";
                return (
                  <div key={id}>
                    <div className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span className={me ? "font-bold" : "font-medium text-[#0B1A12]/70"}>{c.label}</span>
                      <span className={me ? "font-extrabold" : "font-semibold text-[#0B1A12]/70"}>{brl0(c.month)}/mês</span>
                    </div>
                    <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[#F1F3EF]">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.month / max) * 100)}%`, background: me ? GREEN : "#C9CFC8" }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-[12px] text-[#0B1A12]/45">Estimativa: gasolina a R$ 6,30, passagem a R$ 4,00 e energia a R$ 1,10/kWh.</p>
            </div>
            <div className="rounded-[26px] p-6 text-white" style={{ background: DARK }}>
              <PiggyBank className="h-8 w-8 text-[#D8E83C]" />
              <p className="mt-3 text-[15px] text-white/70">Trocando a moto a gasolina, você economiza</p>
              <p className="mt-1 text-[40px] leading-none font-extrabold tracking-[-0.03em]">{brl0(save)}</p>
              <p className="text-[15px] text-white/70">por mês</p>
              <p className="mt-4 flex items-center gap-2 text-[14px] text-white/80">
                <Plug className="h-4 w-4 text-[#9FDB7C]" /> Carrega em qualquer tomada de casa
              </p>
            </div>
          </div>
        </Section>

        {/* documentos */}
        <Section id="documentos" kicker="Segurança na compra" title="A scooter é sua, e você tem como provar" text="Toda venda sai com documentos no seu nome. O cartão do proprietário tem a sua foto e um QR que confirma na hora que o documento é original.">
          <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr]">
            {sample ? (
              <div className="rounded-[28px] bg-[#F6F8F4] p-4 sm:p-6">
                <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-bold ring-1 ring-[#0B1A12]/[0.08]">
                  <IdCard className="h-3.5 w-3.5" style={{ color: GREEN }} /> Exemplo do cartão do proprietário
                </p>
                <div className="grid gap-3">
                  <OwnerCardFront d={sample.d} id="00000000-0000-0000-0000-00000000a1b2" photo={null} />
                  <OwnerCardBack d={sample.d} id="00000000-0000-0000-0000-00000000a1b2" qr={sample.qr} contact={sample.contact} />
                </div>
                <p className="mt-3 text-center text-[12px] text-[#0B1A12]/45">Dados fictícios. O seu sai com a sua foto e os números da sua scooter.</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Doc icon={Receipt} t="Comprovante de compra e propriedade" s="Com chassi, motor e bateria da sua scooter, além de um cartão de bolso para andar junto." highlight />
              <Doc icon={FileSignature} t="Contrato de compra e venda" s="Assinado pelo celular, com validade jurídica, selfie e registro da assinatura." />
              <Doc icon={QrCode} t="Verificação oficial pelo QR" s="Qualquer pessoa aponta a câmera e vê se o documento é original, com os dados da scooter." />
              <Doc icon={BookOpen} t="Manual e certificado de garantia" s="Uso, recarga e cuidados com a bateria, com os números da sua scooter." />
              <Doc icon={Smartphone} t="Área do cliente online" s="Entre com o CPF e acesse documentos, garantia e cartão quando quiser. Dá para salvar no celular." />
            </div>
          </div>
        </Section>

        {/* garantia */}
        <section id="garantia" className="mx-auto max-w-5xl scroll-mt-20 px-4 pb-12 sm:pb-16">
          <div className="relative overflow-hidden rounded-[32px] px-6 py-9 text-white sm:px-10 sm:py-12" style={{ background: DARK }}>
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
                <h2 className="mt-2 text-[28px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[36px]">Garantia contra defeitos de fabricação, com suporte aqui em {town}.</h2>
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
        <Section kicker="Documentação do veículo" title="Precisa de CNH ou placa?" text="" tint>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[26px] bg-white p-6 ring-1 ring-[#0B1A12]/[0.07]">
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
                <li key={x.t} className="flex items-center gap-4 rounded-[22px] bg-white p-4 ring-1 ring-[#0B1A12]/[0.07]">
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
        <Section kicker="Como comprar" title="Simples, do começo ao fim" text="Tudo pelo celular. Sem burocracia.">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MessageCircle, t: "Chame no WhatsApp", s: "Tire dúvidas e escolha o modelo e a cor." },
              { icon: CreditCard, t: "Escolha o pagamento", s: "PIX à vista ou em até 21x no cartão." },
              { icon: FileSignature, t: "Assine pelo celular", s: "Contrato digital em 1 minuto, com selfie." },
              { icon: Truck, t: "Retire ou receba", s: "Na loja ou em casa, montada e revisada." },
            ].map((x, i) => (
              <li key={x.t} className="rounded-[24px] bg-[#F6F8F4] p-5">
                <span className="text-[13px] font-extrabold tracking-[0.14em]" style={{ color: GREEN }}>
                  PASSO {i + 1}
                </span>
                <x.icon className="mt-3 h-7 w-7" />
                <p className="mt-3 text-[17px] font-bold">{x.t}</p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-[#0B1A12]/60">{x.s}</p>
              </li>
            ))}
          </ol>
          <a href={hello} target="_blank" rel="noopener noreferrer" className="mt-6 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] text-[16px] font-bold text-white sm:mx-auto sm:max-w-sm">
            <MessageCircle className="h-5 w-5 text-[#25D366]" /> Começar pelo WhatsApp
          </a>
        </Section>

        {/* perguntas */}
        <Section id="duvidas" kicker="Dúvidas" title="Perguntas frequentes" text="" tint>
          <div className="mx-auto grid max-w-3xl gap-2.5">
            {[
              ["Quanto tempo leva para carregar?", "Numa tomada comum de casa, com o carregador que vem junto. O tempo de cada modelo está na ficha técnica: dá para carregar à noite e sair com a bateria cheia."],
              ["Qual é a autonomia de verdade?", "Depende do modelo, do peso, do relevo e do jeito de pilotar. A autonomia de cada modelo está na ficha técnica acima, e explicamos tudo no WhatsApp antes da compra."],
              ["O que a garantia cobre?", `Defeitos de fabricação por ${WARRANTY_DAYS} dias, com certificado emitido no seu nome. Desgaste natural e mau uso não entram, e tudo isso está explicado no manual.`],
              ["Como provo que a scooter é minha?", "Você recebe o contrato assinado, o comprovante de compra e propriedade e o cartão do proprietário com a sua foto. O QR do cartão abre a página oficial da Quark confirmando que o documento é original."],
              ["Posso vender a minha scooter depois?", "Pode. Pela área do cliente você pede a transferência de propriedade para o novo dono, e a garantia restante vai junto."],
              ["Vocês entregam?", `Sim. Você pode retirar na loja ou receber em casa em ${town} e região, com a scooter montada e revisada.`],
              ["Vendem para lojistas?", "Sim, vendemos para revenda. Chame no WhatsApp e fale que tem loja para receber as condições."],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-[20px] bg-white px-5 ring-1 ring-[#0B1A12]/[0.06]">
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
        <section className="mx-auto max-w-5xl px-4 py-12">
          <div className="relative overflow-hidden rounded-[32px] text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mob/vida-2.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(11,26,18,0.55) 0%, rgba(11,26,18,0.92) 100%)" }} />
            <div className="relative px-6 py-14 text-center">
              <h2 className="text-[32px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[42px]">Bora rodar sem gasolina?</h2>
              <p className="mx-auto mt-2 max-w-md text-[16px] text-white/75">Fale com a gente agora. Respondemos rápido e sem compromisso.</p>
              <a href={hello} target="_blank" rel="noopener noreferrer" className="mx-auto mt-6 flex h-14 max-w-sm items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[17px] font-bold text-[#06210F]">
                <MessageCircle className="h-5 w-5" /> Chamar no WhatsApp
              </a>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <a href={resale} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-[26px] p-5 ring-1 ring-[#0B1A12]/[0.08] transition hover:ring-[#0B1A12]/20">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#EEF7EF]" style={{ color: GREEN }}>
                <Store className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16.5px] font-bold">Vendemos para revenda</span>
                <span className="block text-[14px] text-[#0B1A12]/60">Tem loja? Fale com a gente sobre as condições.</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#0B1A12]/40" />
            </a>
            <a href="/captura" className="flex items-center gap-4 rounded-[26px] p-5 ring-1 ring-[#0B1A12]/[0.08] transition hover:ring-[#0B1A12]/20">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#FFF7D6] text-[#B58500]">
                <Sun className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16.5px] font-bold">Também fazemos energia solar</span>
                <span className="block text-[14px] text-[#0B1A12]/60">Simule quanto você economiza na conta de luz.</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#0B1A12]/40" />
            </a>
          </div>
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
          *Veículo autopropelido conforme a Resolução CONTRAN nº 996/2023 (até 1.000 W e 32 km/h). Fotos ilustrativas. Economia estimada, varia conforme o uso. Preços e condições sujeitos a alteração e à disponibilidade de estoque.
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
        {text && <p className="mt-2 max-w-2xl text-[16.5px] leading-relaxed text-[#0B1A12]/60">{text}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </section>
  );
}

function Doc({ icon: I, t, s, highlight }: { icon: typeof Zap; t: string; s: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "flex gap-4 rounded-[22px] p-5 text-white" : "flex gap-4 rounded-[22px] bg-white p-5 ring-1 ring-[#0B1A12]/[0.07]"} style={highlight ? { background: DARK } : undefined}>
      <span className={highlight ? "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#D8E83C]" : "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EEF7EF]"} style={highlight ? undefined : { color: GREEN }}>
        <I className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-[16px] leading-snug font-bold">{t}</span>
        <span className={highlight ? "mt-1 block text-[14px] leading-relaxed text-white/70" : "mt-1 block text-[14px] leading-relaxed text-[#0B1A12]/60"}>{s}</span>
      </span>
    </div>
  );
}

const SPEC_ICON = { Motor: Zap, Bateria: BatteryCharging, Autonomia: Route, Velocidade: Gauge } as const;

function ModelCard({ m, extra, href }: { m: Scooter; extra: { url: string; caption: string | null }[]; href: string }) {
  const rows = Object.entries(m.table).filter(([, v]) => v && String(v).trim());
  const key = (["Motor", "Bateria", "Autonomia", "Velocidade"] as const).map((k) => [k, m.table[k]] as const).filter(([, v]) => v);
  // Fotos do modelo (cadastro + fotos extras enviadas pelo CRM), sem repetir.
  const seen = new Set<string>();
  const shots: GalleryPhoto[] = [...m.gallery, ...extra.map((x) => ({ src: x.url, caption: x.caption ?? "", fit: "cover" as const }))].filter((g) => {
    if (!g.src || seen.has(g.src)) return false;
    seen.add(g.src);
    return true;
  });
  if (!shots.length) shots.push({ src: m.image, caption: m.name, fit: "contain" });

  return (
    <article className="flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-[#0B1A12]/[0.08] shadow-[0_24px_50px_-36px_rgba(11,26,18,0.45)]">
      <div className="relative">
        <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shots.map((g, i) => (
            <div key={g.src} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-[#F4F6F2]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.src} alt={`${m.name}${g.caption ? ` · ${g.caption}` : ""}`} loading={i ? "lazy" : undefined} className={g.fit === "contain" ? "h-full w-full object-contain p-5" : "h-full w-full object-cover"} />
              {shots.length > 1 && (
                <span className="absolute right-3 bottom-3 rounded-full bg-[#0B1A12]/75 px-2.5 py-1 text-[11.5px] font-semibold text-white">
                  {i + 1}/{shots.length}
                  {g.caption ? ` · ${g.caption}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
        <span className="absolute top-4 left-4 rounded-full bg-white px-3 py-1 text-[12px] font-bold shadow-sm">{m.kicker}</span>
        {shots.length > 1 && (
          <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11.5px] font-bold shadow-sm">
            <Camera className="h-3.5 w-3.5" /> {shots.length} fotos · deslize
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">{m.name}</h3>
        {m.pitch && <p className="mt-1 text-[14.5px] leading-relaxed text-[#0B1A12]/60">{m.pitch}</p>}
        {m.forWho && <p className="mt-2 text-[13.5px] text-[#0B1A12]/50">Ideal para quem {m.forWho}</p>}

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

        <ul className="mt-4 grid gap-1.5 text-[13.5px] text-[#0B1A12]/70">
          {[`Garantia de ${WARRANTY_DAYS} dias`, "Comprovante de propriedade e cartão com QR", "Entrega montada e revisada"].map((x) => (
            <li key={x} className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: GREEN }} /> {x}
            </li>
          ))}
        </ul>

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
          <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[15.5px] font-bold text-[#06210F]">
            <Bike className="h-5 w-5" /> Quero a {m.name}
          </a>
        </div>
      </div>
    </article>
  );
}
