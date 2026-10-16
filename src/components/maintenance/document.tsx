"use client";

import { AtSign, BadgeCheck, CalendarCheck, Check, Clock, CreditCard, Download, Droplets, FileText, Info, Mail, MapPin, MessageCircle, Phone, Power, ShieldCheck, TrendingDown, Wallet, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_SIGNATURE, mergeSettings } from "@/lib/defaults";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import { MAINT_PARTS, MAINT_SERVICES, SEVERITY, kwpOf, mergeMaint, soilingLoss, type MaintInputs } from "@/lib/maintenance";
import { brl, fmtNum } from "@/lib/pricing";
import { Button } from "../ui";
import { AcceptModal, Brand, BrandFooter, BrandRule, CTA_STYLE, CoverKpi, LeafMark, Photo, SectionTitle, type PublicProposal } from "../proposal/document";
import { useProposalTracking } from "../proposal/tracking";
import { MAINT_ICONS } from "./icons";

/** Capa padrão (módulos fotovoltaicos). */
const DEFAULT_MAINT_COVER = "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2000&q=75";
const NAVY = "#1C1234";
const GREEN = "#2C7A52";

export function MaintenanceDocument({ data, token }: { data: PublicProposal; token: string | null }) {
  const s = mergeSettings(data.settings);
  const i = mergeMaint(data.proposal.inputs as Partial<MaintInputs>);
  const price = Number(data.proposal.final_price);
  const [accepted, setAccepted] = useState<{ at: string; by: string } | null>(
    data.proposal.accepted_at ? { at: data.proposal.accepted_at, by: data.proposal.accepted_by ?? "" } : null,
  );
  const [acceptOpen, setAcceptOpen] = useState(false);
  const { click } = useProposalTracking(token);

  const kwp = kwpOf(i);
  const loss = soilingLoss(i);
  const perModule = i.moduleQty > 0 ? price / i.moduleQty : i.pricePerModule;
  const services = MAINT_SERVICES.filter((x) => i.services.includes(x.key));
  const parts = MAINT_PARTS.filter((x) => i.parts.includes(x.key));
  const keys = new Set([...i.services, ...i.parts]);
  const findings = i.findings.filter((f) => f.title.trim());
  const conditions = i.conditions.filter((c) => c.trim());

  const expired = !!data.proposal.valid_until && new Date(`${data.proposal.valid_until}T23:59:59`) < new Date() && !accepted;
  const location = [data.lead.address, [data.lead.city, data.lead.state].filter(Boolean).join(" – ")].filter(Boolean).join(" · ");
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  const waText = `Olá! Estou vendo a proposta nº ${data.proposal.number} de manutenção das placas solares e gostaria de conversar.`;

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  useEffect(() => {
    if (!token) return;
    const key = `viewed-${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch(`/api/public/proposal/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view" }) }).catch(() => {});
  }, [token]);

  const openAccept = () => {
    click("aceitar");
    setAcceptOpen(true);
  };
  const printPdf = () => {
    click("pdf");
    window.print();
  };

  const trust = [
    { icon: Power, t: "Desligamento seguro" },
    { icon: Droplets, t: "Sem produtos abrasivos" },
    { icon: FileText, t: "Relatório com fotos" },
    { icon: ShieldCheck, t: `Garantia de ${fmtNum(i.serviceWarrantyDays)} dias` },
  ];

  return (
    <div className="min-h-dvh bg-[#F6F5FA] text-ink-900 print:bg-white">
      <div className="no-print fixed top-4 right-4 z-40 hidden gap-2 sm:flex">
        <Button variant="secondary" size="sm" onClick={printPdf}>
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
        {!accepted && !expired && token && (
          <Button size="sm" onClick={openAccept} style={CTA_STYLE}>
            <Check className="h-4 w-4" /> Aceitar proposta
          </Button>
        )}
      </div>

      <div className="mx-auto max-w-[1040px] sm:px-6 sm:py-10 print:max-w-none print:p-0">
        <article className="overflow-hidden bg-white shadow-[0_30px_80px_-30px_rgba(14,42,71,0.35)] sm:rounded-2xl print:rounded-none print:shadow-none">
          {/* ============================================================ CAPA */}
          <header data-track="capa" className="relative flex min-h-[540px] flex-col overflow-hidden text-white">
            <Photo src={i.coverImage || DEFAULT_MAINT_COVER} className="absolute inset-0 h-full w-full" fallback={<CoverFallback />} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#120B24]/95 via-[#120B24]/75 to-[#120B24]/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#120B24] via-transparent to-transparent" />
            <LeafMark className="right-[-6%] bottom-[18%] w-[46%] max-w-[420px] opacity-[0.12]" />

            <div className="relative flex items-start justify-between gap-6 px-6 pt-8 sm:px-14 sm:pt-12">
              <Brand settings={s} />
              <div className="text-right text-xs leading-relaxed text-white/70">
                <p className="font-semibold tracking-[0.18em] text-white uppercase">Proposta nº {data.proposal.number}</p>
                <p>{formatDate(data.proposal.created_at, { day: "2-digit", month: "long", year: "numeric" })}</p>
                {data.proposal.valid_until && <p>Válida até {formatDate(data.proposal.valid_until)}</p>}
              </div>
            </div>

            <div className="relative mt-auto px-6 pb-10 sm:px-14 sm:pb-12">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[#F3EA3B] uppercase ring-1 ring-white/15">
                <Wrench className="h-3.5 w-3.5" /> Manutenção solar
              </p>
              <h1 className="mt-4 max-w-2xl font-display text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-[48px]">
                Limpeza e revisão completa para <span className="text-[#F3EA3B]">{data.lead.name}</span>
              </h1>
              {location && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70">
                  <MapPin className="h-4 w-4" /> {location}
                </p>
              )}
              <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/15 backdrop-blur-sm sm:grid-cols-4">
                <CoverKpi label="Placas" value={fmtNum(i.moduleQty)} />
                <CoverKpi label="Sistema" value={`${fmtNum(kwp, 2)} kWp`} />
                <CoverKpi label="Por placa" value={brl(perModule)} />
                <CoverKpi label="Total" value={brl(price, 0)} />
              </dl>
            </div>
          </header>
          <BrandRule />

          {/* faixa de confiança */}
          <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
            {trust.map((x) => (
              <div key={x.t} className="flex items-center gap-2.5 bg-white px-5 py-4 text-[13px] font-medium text-ink-700 sm:px-6">
                <x.icon className="h-4 w-4 shrink-0" style={{ color: GREEN }} /> {x.t}
              </div>
            ))}
          </div>

          {accepted && (
            <div className="flex items-center gap-3 bg-emerald-700 px-6 py-4 text-sm text-white sm:px-14">
              <Check className="h-4 w-4 shrink-0" />
              <p>
                Proposta aceita por <b>{accepted.by}</b> em {formatDate(accepted.at, { day: "2-digit", month: "long", year: "numeric" })}. Vamos entrar em contato para agendar a visita.
              </p>
            </div>
          )}
          {expired && (
            <div className="flex items-center gap-3 bg-amber-50 px-6 py-4 text-sm text-amber-900 sm:px-14">
              <Clock className="h-4 w-4 shrink-0" />
              <p>Esta proposta passou da validade. Fale com a nossa equipe para atualizar o valor.</p>
            </div>
          )}

          {/* perda por sujeira */}
          {i.showLoss && loss.lostMonth > 0 && (
            <div className="px-6 pt-10 sm:px-14">
              <div className="flex flex-col gap-4 rounded-2xl bg-[#FFF5F4] p-5 ring-1 ring-rose-200 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-600 text-white">
                  <TrendingDown className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">Placas sujas geram menos.</p>
                  <p className="mt-0.5 text-sm text-ink-600">
                    Com {fmtNum(i.soilingPct)}% de perda, seu sistema deixa de gerar cerca de {fmtNum(loss.lostKwh)} kWh por mês.
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="tnum font-display text-3xl font-semibold text-rose-700">
                    {brl(loss.lostMonth, 0)}
                    <span className="text-base font-medium text-rose-700/70">/mês</span>
                  </p>
                  <p className="text-xs text-rose-900/60">≈ {brl(loss.lostYear, 0)} por ano</p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================= INCLUSO */}
          <section data-track="servicos" className="px-6 py-12 sm:px-14 sm:py-14">
            <SectionTitle num={num()} kicker="Tudo incluso" title="O que fazemos na visita" />
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((x) => {
                const Icon = MAINT_ICONS[x.icon];
                return (
                  <div key={x.key} className="avoid-break flex items-start gap-3.5 rounded-xl border border-ink-200 p-4">
                    <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "#F2F8EC", color: GREEN }}>
                      <Icon className="h-5 w-5" />
                      <span className="absolute -right-1 -bottom-1 grid place-items-center rounded-full bg-white">
                        <BadgeCheck className="h-4 w-4" style={{ color: GREEN }} />
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{x.label}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-ink-500">{x.short}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {parts.length > 0 && (
              <div className="mt-6 rounded-2xl bg-amber-50/70 p-5 ring-1 ring-amber-600/20 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink-900">Troca se necessário</p>
                  <p className="text-xs text-amber-900/70">Só trocamos se a vistoria indicar, com a sua aprovação.</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {parts.map((x) => {
                    const Icon = MAINT_ICONS[x.icon];
                    return (
                      <div key={x.key} className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 ring-1 ring-amber-600/15">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-ink-900">{x.label}</p>
                          <p className="truncate text-[11px] text-amber-800">se necessário</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ================================================= INVESTIMENTO */}
          <section data-track="investimento" className="relative overflow-hidden px-6 py-12 text-white sm:px-14 sm:py-14" style={{ background: NAVY }}>
            <LeafMark className="right-[-8%] bottom-[-12%] w-[380px] opacity-[0.07]" />
            <BrandRule className="absolute inset-x-0 top-0" />
            <SectionTitle num={num()} kicker="Investimento" title="Valor da manutenção" dark />
            <div className="relative mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-white/70">
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold text-white">{brl(perModule)}</span>
                  <span>por placa</span>
                  <span className="text-white/40">×</span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold text-white">{fmtNum(i.moduleQty)}</span>
                  <span>placas</span>
                </div>
                <p className="tnum mt-3 bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#9BD373] bg-clip-text font-display text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">{brl(price)}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-white/75">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-[#9BD373]" /> Tudo incluso: serviços, materiais, deslocamento e relatório.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Pay icon={Wallet} title="À vista" main={brl(price, 0)} sub="Pix ou espécie" />
                {i.cardInstallments > 1 ? <Pay icon={CreditCard} title="Cartão" main={`até ${i.cardInstallments}×`} sub="no crédito" /> : <Pay icon={CreditCard} title="Cartão" main="Crédito" sub="consulte" />}
                <Pay icon={CalendarCheck} title="Agendamento" main={`até ${fmtNum(i.scheduleDays)} dias`} sub="após o aceite" />
                <Pay icon={Clock} title="Validade" main={`${fmtNum(i.validityDays)} dias`} sub={data.proposal.valid_until ? `até ${formatDate(data.proposal.valid_until)}` : ""} />
              </div>
            </div>
            {i.paymentNotes && <p className="relative mt-5 rounded-xl bg-white/[0.06] px-4 py-3 text-sm text-white/80 ring-1 ring-white/10">{i.paymentNotes}</p>}
          </section>

          {/* ================================================== DIAGNÓSTICO */}
          {findings.length > 0 && (
            <section data-track="diagnostico" className="px-6 py-12 sm:px-14 sm:py-14">
              <SectionTitle num={num()} kicker="O que encontramos" title="Diagnóstico da vistoria" />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {findings.map((f) => (
                  <figure key={f.id} className="avoid-break flex overflow-hidden rounded-xl border border-ink-200 bg-white">
                    {f.photo && (
                      <div className="relative w-32 shrink-0 bg-ink-100 sm:w-40">
                        <Photo src={f.photo} className="absolute inset-0 h-full w-full" />
                      </div>
                    )}
                    <figcaption className="min-w-0 p-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase" style={{ background: SEVERITY[f.severity].bg, color: SEVERITY[f.severity].color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY[f.severity].color }} />
                        {SEVERITY[f.severity].label}
                      </span>
                      <p className="mt-1.5 font-semibold text-ink-900">{f.title}</p>
                      {f.text && <p className="mt-0.5 text-sm leading-snug text-ink-600">{f.text}</p>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* ========================================================= MAPA */}
          <section data-track="mapa" className="bg-[#F6F5FA]/70 px-6 py-12 sm:px-14 sm:py-14">
            <SectionTitle num={num()} kicker="Do telhado até a rede" title="Onde vamos atuar" />
            <div className="mt-8 overflow-x-auto rounded-xl border border-ink-200 bg-white p-4 sm:p-6">
              <SystemMap keys={keys} inverterBrand={i.inverterBrand} moduleQty={i.moduleQty} />
            </div>
            <p className="no-print mt-2 text-center text-xs text-ink-400 sm:hidden">Arraste o mapa para o lado →</p>
          </section>

          {/* ======================================================= VISITA */}
          <section data-track="visita" className="px-6 py-12 sm:px-14 sm:py-14">
            <SectionTitle num={num()} kicker="Simples assim" title="Como funciona" />
            <ol className="mt-8 grid gap-5 sm:grid-cols-4">
              {[
                { icon: CalendarCheck, t: "Agendamos", d: `Em até ${fmtNum(i.scheduleDays)} dias` },
                { icon: Power, t: "Desligamos", d: "Com segurança" },
                { icon: Wrench, t: "Limpamos e revisamos", d: "Placas e parte elétrica" },
                { icon: FileText, t: "Entregamos", d: "Testes, app e relatório" },
              ].map((st, idx, arr) => (
                <li key={st.t} className="relative flex items-center gap-3 sm:flex-col sm:text-center">
                  {idx < arr.length - 1 && <span className="absolute top-6 left-[calc(50%+34px)] hidden h-px w-[calc(100%-68px)] bg-ink-200 sm:block" aria-hidden />}
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: NAVY }}>
                    <st.icon className="h-5 w-5" />
                    <span className="tnum absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold" style={CTA_STYLE}>
                      {idx + 1}
                    </span>
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">{st.t}</p>
                    <p className="text-sm text-ink-500">{st.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ===================================================== CONDIÇÕES */}
          <section data-track="condicoes" className="border-t border-ink-100 px-6 py-12 sm:px-14">
            <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
              <div className="flex items-center gap-3 rounded-2xl p-5" style={{ background: "#F2F8EC" }}>
                <ShieldCheck className="h-8 w-8 shrink-0" style={{ color: GREEN }} />
                <div>
                  <p className="tnum font-display text-2xl font-semibold" style={{ color: NAVY }}>
                    {fmtNum(i.serviceWarrantyDays)} dias
                  </p>
                  <p className="text-xs text-ink-600">de garantia do serviço</p>
                </div>
              </div>
              {conditions.length > 0 && (
                <ul className="grid gap-2.5">
                  {conditions.map((c) => (
                    <li key={c} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GREEN }} />
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ===================================================== ASSINATURA */}
          <section className="avoid-break border-t border-ink-100 px-6 py-12 sm:px-14">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase" style={{ color: GREEN }}>
              De acordo
            </p>
            <div className="mt-10 grid gap-12 sm:grid-cols-2">
              <Signature name={s.company_name} role={s.cnpj ? `Contratada · CNPJ ${s.cnpj}` : "Contratada"} image={s.signature_url || DEFAULT_SIGNATURE} />
              <Signature name={accepted?.by || data.lead.name} role="Contratante" />
            </div>
          </section>

          {/* ========================================================= CTA */}
          <section className="no-print border-t border-ink-100 px-6 py-10 sm:px-14">
            <div className="flex flex-col gap-6 rounded-2xl border border-ink-200 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="font-display text-2xl font-semibold tracking-tight" style={{ color: NAVY }}>
                  {accepted ? "Proposta aceita. Obrigado!" : "Vamos agendar?"}
                </p>
                <p className="mt-1 max-w-md text-sm text-ink-500">{accepted ? "Entraremos em contato para combinar a data." : "Aceite online em um clique ou fale com a gente."}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!accepted && !expired && token && (
                  <Button size="lg" onClick={openAccept} style={CTA_STYLE}>
                    <Check className="h-5 w-5" /> Aceitar proposta
                  </Button>
                )}
                {contactPhone && (
                  <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer" onClick={() => click("whatsapp")}>
                    <Button size="lg" variant="secondary" className="w-full">
                      <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp
                    </Button>
                  </a>
                )}
                <Button size="lg" variant="secondary" onClick={printPdf} className="sm:hidden">
                  <Download className="h-5 w-5" /> PDF
                </Button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-500">
              {data.seller?.name && (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-ink-400" /> {data.seller.name}
                </span>
              )}
              {contactPhone && (
                <span className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-ink-400" /> {formatPhone(contactPhone)}
                </span>
              )}
              {(s.email || data.seller?.email) && (
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-ink-400" /> {s.email || data.seller?.email}
                </span>
              )}
              {s.instagram && (
                <span className="flex items-center gap-2">
                  <AtSign className="h-4 w-4 text-ink-400" /> {s.instagram.replace(/^@/, "")}
                </span>
              )}
            </div>
          </section>

          <BrandFooter settings={s} number={data.proposal.number} phone={contactPhone} />
        </article>
      </div>

      {!accepted && !expired && token && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <div className="flex gap-2">
            {contactPhone && (
              <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer" className="flex-1" onClick={() => click("whatsapp")}>
                <Button variant="secondary" className="w-full">
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                </Button>
              </a>
            )}
            <Button className="flex-1" style={CTA_STYLE} onClick={openAccept}>
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
          days={i.scheduleDays}
          note={`O aceite online não gera cobrança: ele reserva o valor desta proposta. Vamos agendar a visita em até ${fmtNum(i.scheduleDays)} dias.`}
          onAccepted={(by) => {
            click("aceite");
            setAccepted({ at: new Date().toISOString(), by });
            setAcceptOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ subcomponentes */

function CoverFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#120B24] via-[#2A2046] to-[#120B24]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(155,211,115,0.25),transparent_45%)]" />
    </div>
  );
}

function Pay({ icon: Icon, title, main, sub }: { icon: typeof Wallet; title: string; main: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">
        <Icon className="h-3.5 w-3.5 text-[#9BD373]" /> {title}
      </p>
      <p className="tnum mt-1 font-display text-lg font-semibold">{main}</p>
      {sub && <p className="text-[11px] text-white/50">{sub}</p>}
    </div>
  );
}

/** Mapa do sistema: cada bloco acende quando há serviço nele. */
function SystemMap({ keys, inverterBrand, moduleQty }: { keys: Set<string>; inverterBrand: string; moduleQty: number }) {
  const has = (...k: string[]) => k.some((x) => keys.has(x));
  const nodes = [
    { x: 20, t: "Placas", sub: `${moduleQty} módulos`, on: has("limpeza", "inspecao", "termografia", "estrutura"), lines: [has("limpeza") && "Limpeza", has("inspecao") && "Inspeção", has("estrutura") && "Estrutura"] },
    { x: 215, t: "Cabos CC", sub: "conectores MC4", on: has("conectores", "mc4", "medicoes"), lines: [has("conectores") && "Reaperto", has("medicoes") && "Medições", has("mc4") && "Troca*"] },
    { x: 410, t: "String box", sub: "proteções CC", on: has("quadro", "dps"), lines: [has("quadro") && "Reaperto", has("dps") && "DPS*"] },
    { x: 605, t: "Inversor", sub: inverterBrand || "conversão CC/CA", on: has("inversor", "app"), lines: [has("inversor") && "Revisão", has("app") && "App"] },
    { x: 800, t: "Quadro CA", sub: "para a rede", on: has("quadro", "disjuntores", "terminais"), lines: [has("quadro") && "Reaperto", has("disjuntores") && "Disjuntores*", has("terminais") && "Terminais*"] },
  ];
  const ground = has("aterramento");
  const W = 175;
  return (
    <svg viewBox="0 0 1000 330" className="h-auto w-full min-w-[680px]" role="img" aria-label="Mapa do sistema solar com os pontos de manutenção">
      <defs>
        <marker id="m-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#9C97B0" />
        </marker>
        <linearGradient id="m-on" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2F8EC" />
          <stop offset="1" stopColor="#E3F2D6" />
        </linearGradient>
      </defs>
      {has("app") && (
        <g>
          <rect x={605 + W / 2 - 22} y={4} width={44} height={62} rx={9} fill={NAVY} />
          <rect x={605 + W / 2 - 17} y={12} width={34} height={42} rx={4} fill="#9BD373" />
          <path d={`M${605 + W / 2 - 9} 40 l6 -8 l5 5 l7 -11`} stroke={NAVY} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${605 + W / 2} 72 v14`} stroke="#9BD373" strokeWidth={2} strokeDasharray="3 4" />
          <text x={605 + W / 2 + 32} y={38} fontSize={14} fill={GREEN} fontWeight={700}>
            App
          </text>
        </g>
      )}
      {nodes.map((nd, idx) => (
        <g key={nd.t}>
          {idx < nodes.length - 1 && <line x1={nd.x + W} y1={150} x2={nodes[idx + 1].x - 4} y2={150} stroke="#9C97B0" strokeWidth={2} markerEnd="url(#m-arrow)" />}
          <rect x={nd.x} y={92} width={W} height={116} rx={14} fill={nd.on ? "url(#m-on)" : "#FFFFFF"} stroke={nd.on ? "#6CC690" : "#DAD7E4"} strokeWidth={nd.on ? 2 : 1.5} />
          <text x={nd.x + 16} y={122} fontSize={17} fontWeight={700} fill={NAVY}>
            {nd.t}
          </text>
          <text x={nd.x + 16} y={142} fontSize={13} fill="#6E6987">
            {nd.sub.length > 20 ? `${nd.sub.slice(0, 19)}…` : nd.sub}
          </text>
          {nd.lines
            .filter(Boolean)
            .slice(0, 3)
            .map((l, j) => (
              <g key={String(l)}>
                <circle cx={nd.x + 21} cy={162 + j * 17} r={3} fill={GREEN} />
                <text x={nd.x + 31} y={167 + j * 17} fontSize={13.5} fill="#2F2A44">
                  {l}
                </text>
              </g>
            ))}
          {nd.on && (
            <g>
              <circle cx={nd.x + W - 16} cy={108} r={10} fill={GREEN} />
              <path d={`M${nd.x + W - 21} 108 l3.5 3.5 l6.5 -7`} stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
          <line x1={nd.x + W / 2} y1={208} x2={nd.x + W / 2} y2={268} stroke={ground ? "#6CC690" : "#DAD7E4"} strokeWidth={1.5} strokeDasharray="4 4" />
        </g>
      ))}
      <line x1={20 + W / 2} y1={268} x2={800 + W / 2} y2={268} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
      <g transform={`translate(${20 + W / 2 - 60} 268)`}>
        <line x1={60} y1={0} x2={60} y2={16} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
        <line x1={44} y1={16} x2={76} y2={16} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
        <line x1={50} y1={23} x2={70} y2={23} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
        <line x1={56} y1={30} x2={64} y2={30} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
      </g>
      <text x={20 + W / 2 + 26} y={297} fontSize={14} fontWeight={700} fill={ground ? GREEN : "#8E89A3"}>
        Aterramento {ground ? "· aferição com terrômetro" : ""}
      </text>
      <text x={980} y={322} fontSize={12} textAnchor="end" fill="#8E89A3">
        * se necessário
      </text>
    </svg>
  );
}

function Signature({ name, role, image }: { name: string; role: string; image?: string | null }) {
  return (
    <div className="pt-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={`Assinatura de ${name}`} className="mb-2 h-24 w-auto max-w-full object-contain object-left" />
      ) : (
        <div className="mb-2 h-24" />
      )}
      <BrandRule className="mb-3 h-0.5" />
      <p className="font-semibold text-ink-900">{name}</p>
      <p className="text-sm text-ink-500">{role}</p>
    </div>
  );
}
