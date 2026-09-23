"use client";

import {
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  Download,
  FileSignature,
  HardHat,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  PartyPopper,
  Phone,
  PiggyBank,
  Ruler,
  Search,
  Send,
  Wallet,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { mergeInputs, mergeSettings, type CompanySettings } from "@/lib/defaults";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import { brl, calcEnergy, calcFinancing, fmtNum, irr, pmt, type ProposalInputs } from "@/lib/pricing";
import { Button, Field, Input, Modal, cx } from "../ui";
import { CashflowChart, GenerationChart } from "./charts";
import { DEFAULT_FAQ, DEFAULT_TIMELINE } from "@/lib/proposal-content";
import {
  BillIllo,
  CarIllo,
  GlobeIllo,
  HeroScene,
  HouseIllo,
  InverterIllo,
  MeterIllo,
  MoonCoinIllo,
  PanelIllo,
  PiggyIllo,
  ShieldIllo,
  StructureIllo,
  SunIllo,
  ToolsIllo,
  TreeIllo,
} from "./illustrations";

export interface PublicProposal {
  proposal: {
    id?: string;
    number: number;
    title: string | null;
    status: string;
    inputs: Partial<ProposalInputs>;
    final_price: number;
    power_kwp: number;
    valid_until: string | null;
    created_at: string;
    accepted_at: string | null;
    accepted_by: string | null;
  };
  lead: { name: string; city: string | null; state: string | null; address: string | null };
  seller: { name: string | null; email: string | null; phone: string | null } | null;
  settings: Partial<CompanySettings>;
}

const MODULE_AREA_M2 = 2.6;
const CAR_KG_CO2_PER_KM = 0.12;

const STEP_STYLES = [
  { icon: FileSignature, color: "bg-amber-400" },
  { icon: Search, color: "bg-sky-400" },
  { icon: Ruler, color: "bg-violet-400" },
  { icon: Send, color: "bg-indigo-400" },
  { icon: Package, color: "bg-orange-400" },
  { icon: HardHat, color: "bg-rose-400" },
  { icon: ClipboardCheck, color: "bg-teal-400" },
];

export function ProposalDocument({ data, token }: { data: PublicProposal; token: string | null }) {
  const s = mergeSettings(data.settings);
  const inputs = mergeInputs(data.proposal.inputs);
  const price = Number(data.proposal.final_price);
  const startYear = new Date(data.proposal.created_at).getFullYear();
  const [accepted, setAccepted] = useState<{ at: string; by: string } | null>(
    data.proposal.accepted_at ? { at: data.proposal.accepted_at, by: data.proposal.accepted_by ?? "" } : null,
  );
  const [acceptOpen, setAcceptOpen] = useState(false);

  const kwp = (inputs.modulePowerW * inputs.moduleQty) / 1000;
  const energy = useMemo(() => calcEnergy(inputs, price, startYear), [inputs, price, startYear]);
  const financing = useMemo(() => calcFinancing(price, inputs.financingRate, inputs.financingTerms), [price, inputs.financingRate, inputs.financingTerms]);
  const tir = useMemo(() => irr(price, energy.cashflow.map((c) => c.savings)), [price, energy]);
  const cardInstallment = inputs.cardInstallments > 0 ? pmt(price, inputs.cardRate, inputs.cardInstallments) : 0;

  const firstName = data.lead.name.split(" ")[0];
  const hasBill = energy.monthlyBillBefore > 0;
  const expired = !!data.proposal.valid_until && new Date(`${data.proposal.valid_until}T23:59:59`) < new Date() && !accepted;
  const location = [data.lead.city, data.lead.state].filter(Boolean).join(" – ");
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  const waText = `Olá! Estou vendo a proposta #${data.proposal.number} de energia solar e gostaria de conversar.`;
  const cheapest = financing.length ? financing[financing.length - 1] : null;
  const cheaperThanBill = !!cheapest && hasBill && cheapest.installment < energy.monthlyBillBefore;
  const totalDays = Math.max(10, Math.round(inputs.installationDays || 40));
  const freeMonths = hasBill ? Math.floor(energy.savings25y / energy.monthlyBillBefore) : 0;
  const carKm = Math.round((energy.co2TonsPerYear * 1000) / CAR_KG_CO2_PER_KM);
  const show = s.proposal.sections;
  const steps = s.proposal.timeline.length
    ? [...s.proposal.timeline].sort((a, b) => a.day - b.day)
    : DEFAULT_TIMELINE.map((st) => ({ ...st, day: Math.round((st.day / 40) * totalDays) }));
  const lastDay = steps.length ? steps[steps.length - 1].day : totalDays;
  const faq = s.proposal.faq.length ? s.proposal.faq : DEFAULT_FAQ;
  const headline = s.proposal.headline.trim();

  useEffect(() => {
    if (!token) return;
    const key = `viewed-${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch(`/api/public/proposal/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view" }) }).catch(() => {});
  }, [token]);

  return (
    <div className="min-h-dvh bg-[#FFF8EC] text-ink-900 print:bg-white">
      {/* Barra superior */}
      <header className="no-print sticky top-0 z-40 border-b border-amber-900/5 bg-[#FFF8EC]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand settings={s} />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()} className="hidden sm:inline-flex">
              <Download className="h-4 w-4" /> PDF
            </Button>
            {!accepted && !expired && token && (
              <Button size="sm" variant="sun" onClick={() => setAcceptOpen(true)}>
                <Check className="h-4 w-4" /> Aceitar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {/* ============================================================ CAPA */}
        <section className="grid items-center gap-8 pt-8 pb-10 sm:pt-12 lg:grid-cols-[1.05fr_1fr] print:min-h-[260mm]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700 shadow-soft ring-1 ring-amber-500/20">
              ☀️ Proposta nº {data.proposal.number} · {formatDate(data.proposal.created_at)}
            </p>
            <h1 className="mt-5 font-display text-[38px] leading-[1.05] font-bold tracking-tight sm:text-[54px]">
              {headline ? (
                <span className="text-sun-gradient">{headline.replaceAll("{nome}", firstName)}</span>
              ) : (
                <>
              Olá, {firstName}! <span className="inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_1]">👋</span>
              <br />
              <span className="text-sun-gradient">Vamos transformar sol em economia</span> na sua casa.
                </>
              )}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
              Preparamos um sistema de energia solar feito sob medida para você.
              {hasBill && (
                <>
                  {" "}
                  Sua conta de luz vai de <b className="text-rose-600">{brl(energy.monthlyBillBefore, 0)}</b> para cerca de{" "}
                  <b className="text-emerald-600">{brl(energy.monthlyBillAfter, 0)}</b> por mês.
                </>
              )}
            </p>
            {location && (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-500">
                <MapPin className="h-4 w-4" /> {data.lead.name} · {location}
              </p>
            )}
          </div>
          <div className="relative">
            <HeroScene className="w-full drop-shadow-xl" />
            {hasBill && (
              <div className="absolute -bottom-5 left-4 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-emerald-600/10 sm:left-8">
                <p className="text-xs font-semibold text-ink-500">Você economiza</p>
                <p className="tnum font-display text-2xl font-bold text-emerald-600">{Math.round(energy.savingsPct * 100)}% na conta</p>
              </div>
            )}
          </div>
        </section>

        {accepted && (
          <Banner tone="green" icon={<CheckCircle2 className="h-6 w-6" />}>
            <b>Proposta aceita</b> por {accepted.by} em {formatDate(accepted.at, { day: "2-digit", month: "long", year: "numeric" })}. Em breve entraremos em contato! 🎉
          </Banner>
        )}
        {expired && (
          <Banner tone="amber" icon={<Clock className="h-6 w-6" />}>
            Esta proposta passou da validade. Fale com a gente — normalmente conseguimos manter as mesmas condições.
          </Banner>
        )}

        {/* ======================================================= RESUMO */}
        <Section emoji="⚡" title="Tudo o que importa, em 10 segundos">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <BigStat illo={<PanelIllo className="h-14 w-14" />} value={`${inputs.moduleQty} placas`} label={`Sistema de ${fmtNum(kwp, 2)} kWp`} tone="blue" />
            <BigStat illo={<SunIllo className="h-14 w-14" />} value={`${fmtNum(energy.monthlyGeneration)} kWh`} label="de energia por mês" tone="amber" />
            <BigStat illo={<PiggyIllo className="h-14 w-16" />} value={brl(energy.monthlySavings, 0)} label="de economia por mês" tone="pink" />
            <BigStat
              illo={<span className="text-5xl">⏳</span>}
              value={energy.paybackYears ? `${fmtNum(energy.paybackYears, 1)} anos` : "—"}
              label="para o investimento se pagar"
              tone="green"
            />
          </div>
        </Section>

        {/* ================================================= COMO FUNCIONA */}
        {show.howItWorks && (
<Section emoji="🤔" title="Como a energia solar funciona?" subtitle="É mais simples do que parece. Olha só:">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HowStep n={1} illo={<SunIllo className="h-20 w-20" />} title="O sol brilha" text="A luz do sol chega todos os dias no seu telhado. De graça!" />
            <HowStep n={2} illo={<PanelIllo className="h-20 w-20" />} title="As placas captam" text="As placas solares transformam a luz do sol em energia elétrica." />
            <HowStep n={3} illo={<InverterIllo className="h-20 w-20" />} title="O inversor prepara" text="O inversor deixa essa energia igualzinha à da tomada." />
            <HowStep n={4} illo={<HouseIllo className="h-20 w-20" />} title="Sua casa usa" text="Geladeira, chuveiro, TV… tudo funciona com energia do sol." />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Explain illo={<MeterIllo className="h-16 w-16" />} title="E a energia que sobra?">
              Vai para a rede da concessionária e vira <b>crédito</b> na sua conta. O relógio de luz passa a contar nos dois sentidos.
            </Explain>
            <Explain illo={<MoonCoinIllo className="h-16 w-16" />} title="E à noite, ou em dias nublados?">
              Você usa a energia da rede normalmente e <b>paga com os créditos</b> que acumulou durante o dia. Nada muda na sua rotina!
            </Explain>
          </div>
        </Section>
        )}

        {/* ======================================================== CONTA */}
        {hasBill && show.bill && (
          <Section emoji="🧾" title="Sua conta de luz: antes e depois" subtitle="Com os valores de hoje, calculados com as regras atuais (Lei 14.300).">
            <div className="grid items-center gap-6 rounded-[28px] bg-white p-5 shadow-soft sm:p-8 lg:grid-cols-[1fr_auto_1fr]">
              <div className="flex flex-col items-center text-center">
                <p className="mb-2 rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600">😟 Hoje</p>
                <BillIllo amount={brl(energy.monthlyBillBefore, 0)} tone="before" className="w-40" />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-4xl">➜</span>
                <span className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white shadow-soft">−{brl(energy.monthlySavings, 0)}/mês</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <p className="mb-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">😄 Com energia solar</p>
                <BillIllo amount={brl(energy.monthlyBillAfter, 0)} tone="after" className="w-40" />
              </div>
            </div>

            <div className="mt-4 rounded-[28px] bg-white p-5 shadow-soft sm:p-7">
              <p className="font-display text-lg font-bold">Por que a conta não fica zerada? 🤓</p>
              <p className="mt-1 text-sm text-ink-500">Algumas cobranças continuam existindo — e já estão incluídas no valor acima:</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <BillItem emoji="🔌" title="Taxa mínima" value={Math.max(energy.bill.minimumTopUp, 0)} always={energy.availabilityKwh * inputs.tariff}>
                  Todo imóvel ligado à rede paga um mínimo de {energy.availabilityKwh} kWh. É como a “assinatura” da energia.
                </BillItem>
                <BillItem emoji="🛣️" title={`Fio B (${fmtNum(energy.fioBPct * 100)}% em ${startYear})`} value={energy.bill.fioBCharge}>
                  Uma pequena taxa pelo uso dos fios da distribuidora quando você usa seus créditos. Criada pela Lei 14.300.
                </BillItem>
                <BillItem emoji="💡" title="Iluminação pública" value={energy.bill.publicLighting}>
                  Taxa da prefeitura para os postes da sua rua. Ela não muda com a energia solar.
                </BillItem>
                {energy.bill.energyCharge > 0.5 && (
                  <BillItem emoji="⚡" title="Energia extra da rede" value={energy.bill.energyCharge}>
                    A parte do seu consumo que o sistema não cobre.
                  </BillItem>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* ======================================================= RETORNO */}
        {energy.monthlySavings > 0 && show.payback && (
          <Section emoji="🐷" title="Seu dinheiro de volta (e muito mais)" subtitle="A economia de todo mês vai enchendo o cofrinho até pagar o sistema. Depois disso, é lucro!">
            <div className="grid gap-4">
              <div className="flex flex-col gap-5 rounded-[28px] bg-gradient-to-br from-pink-50 to-amber-50 p-6 ring-1 ring-pink-200/60 sm:flex-row sm:items-center sm:p-8">
                <PiggyIllo className="h-24 w-28 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink-500">O sistema se paga em</p>
                  <p className="tnum font-display text-5xl font-bold tracking-tight text-ink-950">
                    {fmtNum(energy.paybackYears, 1)} <span className="text-2xl text-ink-500">anos</span>
                  </p>
                  <p className="mt-3 text-sm text-ink-600">
                    Em 25 anos você deixa de pagar <b className="text-emerald-700">{brl(energy.savings25y, 0)}</b>
                    {freeMonths > 0 && (
                      <>
                        {" "}
                        — é como ficar <b>{fmtNum(freeMonths)} meses</b> sem conta de luz!
                      </>
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-64 sm:grid-cols-1">
                  <MiniStat label="Retorno" value={`${fmtNum(energy.roi25y, 1)}× o valor`} />
                  <MiniStat label="Rende por mês" value={tir ? `${fmtNum((Math.pow(1 + tir, 1 / 12) - 1) * 100, 2)}%` : "—"} />
                </div>
              </div>
              <div className="rounded-[28px] bg-white p-5 shadow-soft sm:p-6">
                <p className="font-display font-bold">Seu saldo ao longo dos anos</p>
                <p className="mb-3 text-xs text-ink-500">Cinza: ainda pagando o sistema · Verde: dinheiro no seu bolso</p>
                <CashflowChart data={energy.cashflow} payback={energy.paybackYears} />
              </div>
            </div>
          </Section>
        )}

        {/* ======================================================= GERAÇÃO */}
        {show.generation && (
<Section emoji="🌤️" title="Quanto o seu sistema vai produzir" subtitle="No verão o sol é mais forte e ele produz mais. No inverno, um pouco menos — os créditos equilibram tudo.">
          <div className="rounded-[28px] bg-white p-5 shadow-soft sm:p-6">
            <GenerationChart data={energy.monthly} />
          </div>
        </Section>
        )}

        {/* ======================================================= SISTEMA */}
        {show.equipment && (
<Section emoji="🧩" title="O que vai no seu telhado" subtitle="Só equipamentos de marcas reconhecidas mundialmente.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Equipment
              illo={<PanelIllo className="h-20 w-20" />}
              title={`${inputs.moduleQty} placas solares`}
              lines={[`${inputs.moduleBrand || "Tier 1"}${inputs.moduleModel ? ` · ${inputs.moduleModel}` : ""}`, `${fmtNum(inputs.modulePowerW)} W cada · ${fmtNum(kwp, 2)} kWp no total`]}
              tag={`🛡️ ${s.warranty_modules_years} anos de garantia`}
            />
            <Equipment
              illo={<InverterIllo className="h-20 w-20" />}
              title={`${inputs.inverterQty > 1 ? `${inputs.inverterQty} inversores` : "Inversor"} ${inputs.inverterBrand}`.trim()}
              lines={[inputs.inverterModel || "Inversor com monitoramento pelo celular", `${fmtNum(inputs.inverterPowerKw, 1)} kW${inputs.inverterQty > 1 ? " cada" : ""}`]}
              tag={`🛡️ ${s.warranty_inverter_years} anos de garantia`}
            />
            <Equipment illo={<StructureIllo className="h-20 w-20" />} title="Estrutura de fixação" lines={[inputs.structureType, "Alumínio e inox: não enferruja"]} tag={`🛡️ ${s.warranty_structure_years} anos de garantia`} />
            <Equipment illo={<span className="grid h-20 w-20 place-items-center text-5xl">📱</span>} title="App no celular" lines={["Veja quanto seu sistema produz,", "a qualquer hora, de onde estiver"]} tag="✨ Incluso" />
          </div>
          <p className="mt-3 text-center text-sm text-ink-500">
            📐 Ocupa cerca de <b>{fmtNum(inputs.moduleQty * MODULE_AREA_M2)} m²</b> do telhado e produz <b>{fmtNum(energy.annualGeneration / 1000, 1)} MWh</b> por ano.
          </p>
        </Section>
        )}

        {/* ===================================================== GARANTIAS */}
        {show.warranties && (
<Section emoji="🛡️" title="Garantias: pode ficar tranquilo" subtitle="Se algo der errado, a gente resolve. Está tudo no contrato.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Warranty years={s.warranty_modules_performance_years} title="Eficiência das placas" text="Produzindo pelo menos 80% após esse tempo" illo={<PanelIllo className="h-12 w-12" />} />
            <Warranty years={s.warranty_modules_years} title="Placas" text="Contra defeitos de fabricação" illo={<ShieldIllo className="h-12 w-12" />} />
            <Warranty years={s.warranty_inverter_years} title="Inversor" text="Troca ou conserto pelo fabricante" illo={<InverterIllo className="h-12 w-12" />} />
            <Warranty years={s.warranty_structure_years} title="Estrutura" text="Contra corrosão e defeitos" illo={<StructureIllo className="h-12 w-12" />} />
            <Warranty years={s.warranty_installation_years} title="Instalação" text="Nosso serviço, com suporte da equipe" illo={<ToolsIllo className="h-12 w-12" />} />
          </div>
        </Section>
        )}

        {/* ======================================================== OBRA */}
        {show.timeline && (
<Section emoji="🗓️" title="Passo a passo da sua obra" subtitle={`Do pagamento até o sistema ligado são cerca de ${lastDay} dias. Você acompanha tudo com a gente.`}>
          <div className="rounded-[28px] bg-white p-5 shadow-soft sm:p-8">
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-500/15">
              <Calendar className="h-8 w-8 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-display font-bold">~{lastDay} dias do “sim” à energia do sol</p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-amber-100">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-500" />
                </div>
              </div>
            </div>
            <ol className="relative grid gap-5">
              <span className="absolute top-4 bottom-4 left-[19px] w-1 rounded-full bg-gradient-to-b from-amber-300 via-orange-300 to-emerald-400" />
              {steps.map((step, idx) => {
                const day = step.day;
                const last = idx === steps.length - 1;
                const st = last ? { icon: PartyPopper, color: "bg-emerald-500" } : STEP_STYLES[idx % STEP_STYLES.length];
                return (
                  <li key={`${idx}-${step.title}`} className="avoid-break relative flex gap-4">
                    <span className={cx("relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-soft ring-4 ring-white", st.color)}>
                      <st.icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 pt-0.5">
                      <p className="text-xs font-bold tracking-wide text-ink-400 uppercase">{day === 0 ? "Dia 0" : `Dia ${day}`}</p>
                      <p className="font-display text-base font-bold text-ink-900">{step.title}</p>
                      <p className="text-sm text-ink-600">{step.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </Section>
        )}

        {/* ===================================================== PLANETA */}
        {show.planet && (
<Section emoji="🌎" title="Você ainda ajuda o planeta" subtitle="Energia do sol é limpa: não polui e não acaba.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Planet illo={<TreeIllo className="h-16 w-16" />} value={fmtNum(energy.treesEquivalent)} label="árvores plantadas por ano (equivalente)" />
            <Planet illo={<CarIllo className="h-16 w-16" />} value={`${fmtNum(carKm)} km`} label="de carro que deixam de poluir por ano" />
            <Planet illo={<GlobeIllo className="h-16 w-16" />} value={`${fmtNum(energy.co2TonsPerYear * 25, 1)} t`} label="de CO₂ a menos em 25 anos" />
          </div>
        </Section>
        )}

        {/* ================================================= INVESTIMENTO */}
        <section className="print-break mt-14">
          <div className="relative overflow-hidden rounded-[32px] bg-ink-950 p-6 text-white sm:p-10">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-sun-500/25 blur-3xl" />
            <p className="relative text-sm font-bold text-sun-400">💰 Investimento</p>
            <div className="relative mt-3 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">Tudo incluso, sem surpresas</h2>
                <p className="mt-2 max-w-md text-sm text-ink-400">Equipamentos, projeto, papelada na concessionária, instalação completa e app de monitoramento.</p>
              </div>
              <div className="sm:text-right">
                <p className="tnum font-display text-5xl font-bold tracking-tight text-sun-gradient sm:text-6xl">{brl(price)}</p>
                <p className="mt-1 text-sm text-ink-400">à vista</p>
              </div>
            </div>

            <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
              <PayCard icon={<Wallet />} title="À vista" main={brl(price, 0)} sub="PIX, transferência ou boleto" />
              {cardInstallment > 0 && <PayCard icon={<CreditCard />} title="Cartão de crédito" main={`${inputs.cardInstallments}× de ${brl(cardInstallment, 0)}`} sub={`Total ${brl(cardInstallment * inputs.cardInstallments, 0)}`} />}
              {cheapest && (
                <PayCard
                  icon={<Landmark />}
                  title="Financiamento solar"
                  main={`${cheapest.months}× de ${brl(cheapest.installment, 0)}`}
                  sub={cheaperThanBill ? `🎉 Menor que sua conta de ${brl(energy.monthlyBillBefore, 0)}` : "Sujeito à aprovação"}
                  highlight={cheaperThanBill}
                />
              )}
            </div>

            {financing.length > 1 && (
              <div className="relative mt-4 overflow-hidden rounded-2xl ring-1 ring-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.04] text-left text-xs text-ink-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Parcelas</th>
                      <th className="px-4 py-3 text-right font-medium">Valor da parcela</th>
                      <th className="px-4 py-3 text-right font-medium">Parcela − economia</th>
                    </tr>
                  </thead>
                  <tbody className="tnum divide-y divide-white/[0.06]">
                    {financing.map((f) => {
                      const diff = f.installment - energy.monthlySavings;
                      return (
                        <tr key={f.months}>
                          <td className="px-4 py-3 text-ink-300">{f.months}×</td>
                          <td className="px-4 py-3 text-right font-semibold">{brl(f.installment)}</td>
                          <td className={cx("px-4 py-3 text-right font-semibold", diff <= 0 ? "text-emerald-400" : "text-ink-300")}>
                            {diff <= 0 ? `sobra ${brl(-diff, 0)} 🎉` : `+ ${brl(diff, 0)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="border-t border-white/[0.06] px-4 py-3 text-[11px] text-ink-500">
                  “Parcela − economia”: quanto sai do seu bolso por mês, já descontando o que você economiza na conta. Taxa simulada de {fmtNum(inputs.financingRate, 2)}% a.m.
                </p>
              </div>
            )}
            {inputs.paymentNotes && <p className="relative mt-4 rounded-2xl bg-white/[0.05] px-4 py-3 text-sm whitespace-pre-line text-ink-300 ring-1 ring-white/10">{inputs.paymentNotes}</p>}
            {data.proposal.valid_until && (
              <p className="relative mt-4 text-xs text-ink-500">Condições válidas até {formatDate(data.proposal.valid_until, { day: "2-digit", month: "long", year: "numeric" })}.</p>
            )}
          </div>
        </section>

        {/* ========================================================== FAQ */}
        {show.faq && (
<Section emoji="💬" title="Perguntas que todo mundo faz">
          <div className="grid gap-3 sm:grid-cols-2">
            {faq.map((f) => (
              <Faq key={f.q} q={f.q}>
                {f.a}
              </Faq>
            ))}
          </div>
        </Section>
        )}

        {/* ========================================================= SOBRE */}
        {show.about && (
<Section emoji="🤝" title={`Quem somos: ${s.company_name}`}>
          <div className="grid gap-5 rounded-[28px] bg-white p-6 shadow-soft sm:grid-cols-[1.4fr_1fr] sm:p-8">
            <p className="leading-relaxed text-ink-600">{s.about}</p>
            <div className="grid content-start gap-2.5 text-sm">
              {data.seller?.name && (
                <p className="flex items-center gap-2.5">
                  <BadgeCheck className="h-4 w-4 text-sun-600" /> Seu consultor: <b>{data.seller.name}</b>
                </p>
              )}
              {contactPhone && (
                <p className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-sun-600" /> {formatPhone(contactPhone)}
                </p>
              )}
              {(s.email || data.seller?.email) && (
                <p className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-sun-600" /> {s.email || data.seller?.email}
                </p>
              )}
              {s.address && (
                <p className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-sun-600" /> {s.address}
                </p>
              )}
              {s.cnpj && <p className="text-xs text-ink-400">CNPJ {s.cnpj}</p>}
            </div>
          </div>
        </Section>
        )}

        {/* ========================================================== CTA */}
        <section className="no-print mt-14">
          <div className="relative overflow-hidden rounded-[32px] bg-sun-gradient p-8 text-ink-950 sm:p-12">
            <div className="absolute -top-16 -right-10 opacity-90">
              <SunIllo className="h-48 w-48" />
            </div>
            <h3 className="relative max-w-lg font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {accepted ? "Tudo certo! Obrigado pela confiança ☀️" : "Bora começar a economizar?"}
            </h3>
            <p className="relative mt-3 max-w-md text-ink-900/75">
              {accepted
                ? "Recebemos o seu aceite. Em breve entraremos em contato para agendar a visita técnica."
                : "Aceite a proposta aqui mesmo ou chame a gente no WhatsApp para tirar qualquer dúvida."}
            </p>
            <div className="relative mt-7 flex flex-col gap-3 sm:flex-row">
              {!accepted && !expired && token && (
                <Button size="lg" onClick={() => setAcceptOpen(true)}>
                  <Check className="h-5 w-5" /> Aceitar proposta
                </Button>
              )}
              {contactPhone && (
                <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer">
                  <Button size="lg" variant="secondary" className="w-full">
                    <MessageCircle className="h-5 w-5 text-emerald-600" /> Falar no WhatsApp
                  </Button>
                </a>
              )}
              <Button size="lg" variant="outline" className="ring-ink-950/20 hover:bg-white/30" onClick={() => window.print()}>
                <Download className="h-5 w-5" /> Baixar PDF
              </Button>
            </div>
          </div>
        </section>

        <footer className="mt-10 text-[11px] leading-relaxed text-ink-400">
          <p>
            Como calculamos: irradiação média de {fmtNum(inputs.sunHours, 2)} kWh/m²/dia, eficiência de {fmtNum(inputs.performanceRatio * 100)}%, tarifa de {brl(inputs.tariff, 3)}/kWh,
            fio B de {brl(inputs.fioBTariff, 3)}/kWh conforme a transição da Lei 14.300 ({fmtNum(energy.fioBPct * 100)}% em {startYear}, chegando a 100% em 2029),
            {` ${fmtNum(inputs.selfConsumption)}%`} de consumo simultâneo, iluminação pública de {brl(inputs.publicLighting)}, reajuste de {fmtNum(inputs.tariffIncrease, 1)}% ao ano e
            perda de {fmtNum(inputs.degradation, 1)}% ao ano das placas. A geração real varia com o clima, sombras e orientação do telhado. Proposta nº {data.proposal.number}.
          </p>
        </footer>
      </main>

      {/* Barra fixa no celular */}
      {!accepted && !expired && token && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-amber-900/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <div className="flex gap-2">
            {contactPhone && (
              <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="secondary" className="w-full">
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                </Button>
              </a>
            )}
            <Button variant="sun" className="flex-1" onClick={() => setAcceptOpen(true)}>
              <Check className="h-4 w-4" /> Aceitar
            </Button>
          </div>
        </div>
      )}

      {token && (
        <AcceptModal
          open={acceptOpen}
          onClose={() => setAcceptOpen(false)}
          token={token}
          defaultName={data.lead.name}
          days={lastDay}
          onAccepted={(by) => {
            setAccepted({ at: new Date().toISOString(), by });
            setAcceptOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ subcomponentes */

function Brand({ settings }: { settings: CompanySettings }) {
  if (settings.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={settings.logo_url} alt={settings.company_name} className="h-9 w-auto max-w-[160px] object-contain" />;
  }
  return (
    <div className="flex items-center gap-2.5">
      <SunIllo className="h-9 w-9" />
      <span className="font-display text-[15px] font-bold">{settings.company_name}</span>
    </div>
  );
}

function Section({ emoji, title, subtitle, children }: { emoji: string; title: ReactNode; subtitle?: string; children: ReactNode }) {
  return (
    <section className="avoid-break mt-14">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-2xl shadow-soft">{emoji}</span>
        <div>
          <h2 className="font-display text-2xl leading-tight font-bold tracking-tight sm:text-[28px]">{title}</h2>
          {subtitle && <p className="mt-1 max-w-2xl text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Banner({ tone, icon, children }: { tone: "green" | "amber"; icon: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("mt-6 flex items-center gap-3 rounded-2xl p-4 text-sm", tone === "green" ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900")}>
      {icon}
      <p>{children}</p>
    </div>
  );
}

const TONES = {
  blue: "from-sky-50 to-white ring-sky-200/70",
  amber: "from-amber-50 to-white ring-amber-200/70",
  pink: "from-pink-50 to-white ring-pink-200/70",
  green: "from-emerald-50 to-white ring-emerald-200/70",
};

function BigStat({ illo, value, label, tone }: { illo: ReactNode; value: string; label: string; tone: keyof typeof TONES }) {
  return (
    <div className={cx("flex flex-col gap-3 rounded-[24px] bg-gradient-to-b p-5 ring-1", TONES[tone])}>
      <div className="h-14">{illo}</div>
      <div>
        <p className="tnum font-display text-2xl font-bold tracking-tight sm:text-[28px]">{value}</p>
        <p className="text-sm text-ink-500">{label}</p>
      </div>
    </div>
  );
}

function HowStep({ n, illo, title, text }: { n: number; illo: ReactNode; title: string; text: string }) {
  return (
    <div className="relative rounded-[24px] bg-white p-5 shadow-soft">
      <span className="absolute top-4 right-4 grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">{n}</span>
      <div className="mb-3">{illo}</div>
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
    </div>
  );
}

function Explain({ illo, title, children }: { illo: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-[24px] bg-sky-50 p-5 ring-1 ring-sky-200/70">
      <div className="shrink-0">{illo}</div>
      <div>
        <p className="font-display font-bold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{children}</p>
      </div>
    </div>
  );
}

function BillItem({ emoji, title, value, always, children }: { emoji: string; title: string; value: number; always?: number; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[#FFF8EC] p-4">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold">{title}</p>
          <p className="tnum text-sm font-bold text-ink-700">{value > 0.004 ? brl(value) : always ? `já coberta` : "—"}</p>
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{children}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="tnum font-display font-bold">{value}</p>
    </div>
  );
}

function Equipment({ illo, title, lines, tag }: { illo: ReactNode; title: string; lines: string[]; tag?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[24px] bg-white p-5 shadow-soft">
      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-sky-50">{illo}</div>
      <div className="min-w-0">
        <p className="font-display text-lg font-bold">{title}</p>
        {lines.filter(Boolean).map((l) => (
          <p key={l} className="text-sm text-ink-500">
            {l}
          </p>
        ))}
        {tag && <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{tag}</p>}
      </div>
    </div>
  );
}

function Warranty({ years, title, text, illo }: { years: number; title: string; text: string; illo: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[24px] bg-white p-5 text-center shadow-soft">
      {illo}
      <p className="mt-2 font-display text-4xl font-bold tracking-tight text-emerald-600">
        {years}
        <span className="ml-1 text-base text-ink-400">{years === 1 ? "ano" : "anos"}</span>
      </p>
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-ink-500">{text}</p>
    </div>
  );
}

function Planet({ illo, value, label }: { illo: ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[24px] bg-emerald-50 p-5 ring-1 ring-emerald-200/70">
      {illo}
      <div>
        <p className="tnum font-display text-2xl font-bold text-emerald-800">{value}</p>
        <p className="text-sm text-emerald-900/70">{label}</p>
      </div>
    </div>
  );
}

function PayCard({ icon, title, main, sub, highlight }: { icon: ReactNode; title: string; main: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cx("rounded-2xl p-5 ring-1", highlight ? "bg-emerald-500/15 ring-emerald-400/40" : "bg-white/[0.05] ring-white/10")}>
      <div className="flex items-center gap-2 text-sm text-ink-400 [&>svg]:h-4 [&>svg]:w-4">
        {icon} {title}
      </div>
      <p className="tnum mt-2 font-display text-xl font-bold">{main}</p>
      <p className={cx("mt-0.5 text-xs", highlight ? "font-semibold text-emerald-300" : "text-ink-500")}>{sub}</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-soft">
      <p className="font-display font-bold">❓ {q}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{children}</p>
    </div>
  );
}

function AcceptModal({
  open,
  onClose,
  token,
  defaultName,
  days,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  defaultName: string;
  days: number;
  onAccepted: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/public/proposal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", name }),
    }).catch(() => null);
    setLoading(false);
    const json = res ? await res.json().catch(() => null) : null;
    if (!json?.ok) return toast.error("Não foi possível registrar o aceite. Fale com a gente pelo WhatsApp.");
    toast.success("Proposta aceita! Em breve entraremos em contato. ☀️");
    onAccepted(name);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aceitar proposta 🎉"
      subtitle="Confirme seu nome. Nossa equipe entra em contato para formalizar o contrato."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button form="accept-form" type="submit" loading={loading}>
            <Check className="h-4 w-4" /> Confirmar aceite
          </Button>
        </>
      }
    >
      <form id="accept-form" onSubmit={submit}>
        <Field label="Nome completo">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <p className="mt-3 flex items-start gap-2 text-xs text-ink-500">
          <PiggyBank className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O aceite online não gera cobrança. Ele reserva as condições desta proposta enquanto preparamos o contrato.
        </p>
        <p className="mt-2 flex items-start gap-2 text-xs text-ink-500">
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Depois do contrato, são cerca de {days} dias até o sistema estar ligado.
        </p>
      </form>
    </Modal>
  );
}
