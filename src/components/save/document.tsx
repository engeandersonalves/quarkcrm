"use client";

import { AtSign, BatteryCharging, Check, Clock, Download, Info, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { mergeSettings } from "@/lib/defaults";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import { brl, fmtNum } from "@/lib/pricing";
import { COMMON_SOCKET_KW, REF_BATTERY_KWH, chargeHours, fillCondition, mergeSave, saveCardInstallment, type SaveInputs } from "@/lib/save";
import { Button, cx } from "../ui";
import { AcceptModal, Brand, CoverKpi, Explain, PayOption, Photo, Section, SectionTitle, type PublicProposal } from "../proposal/document";
import { SaveDiagram, WallboxRender } from "../proposal/renders";

/** Foto padrão da capa (recarga de veículo elétrico). Troque em Configurações → Proposta. */
const DEFAULT_SAVE_COVER = "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=2000&q=75";
const NAVY = "#0E2A47";

export function SaveDocument({ data, token }: { data: PublicProposal; token: string | null }) {
  const s = mergeSettings(data.settings);
  const i = mergeSave(data.proposal.inputs as Partial<SaveInputs>);
  const price = Number(data.proposal.final_price);
  const [accepted, setAccepted] = useState<{ at: string; by: string } | null>(
    data.proposal.accepted_at ? { at: data.proposal.accepted_at, by: data.proposal.accepted_by ?? "" } : null,
  );
  const [acceptOpen, setAcceptOpen] = useState(false);

  const kwLabel = `${fmtNum(i.chargerPowerKw, i.chargerPowerKw % 1 ? 1 : 0)} kW`;
  const phaseLabel = i.phases === "tri" ? "Trifásico" : "Monofásico";
  const hours = chargeHours(i.chargerPowerKw);
  const socketHours = chargeHours(COMMON_SOCKET_KW);
  const timesFaster = socketHours / hours;
  const card = saveCardInstallment(price, i);
  const chargerImg = i.chargerImage || s.proposal.chargerImage;

  const firstName = data.lead.name.split(" ")[0];
  const expired = !!data.proposal.valid_until && new Date(`${data.proposal.valid_until}T23:59:59`) < new Date() && !accepted;
  const location = [data.lead.address, [data.lead.city, data.lead.state].filter(Boolean).join(" – ")].filter(Boolean).join(" · ");
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  const waText = `Olá! Estou analisando a proposta nº ${data.proposal.number} do carregador veicular (S.A.V.E) e gostaria de conversar.`;
  const conditions = (i.conditions ?? []).map((c) => fillCondition(c, i)).filter((c) => c.trim());

  const scope = [
    {
      title: `Carregador veicular ${kwLabel}`,
      text: `Wallbox de corrente alternada (AC, modo 3) com conector ${i.connector}, ${phaseLabel.toLowerCase()} ${i.currentA} A.${i.chargerModel ? ` Modelo ${i.chargerModel}.` : ""}${i.chargerBrands ? ` Marcas homologadas: ${i.chargerBrands}.` : ""}`,
      on: true,
    },
    { title: "Quadro de proteção", text: "Disjuntores, dispositivo DR (proteção contra choque elétrico) e DPS (proteção contra surtos), dimensionados para o circuito do carregador.", on: i.includePanel },
    { title: "Botão de emergência", text: "Tipo cogumelo com trava, para desligamento imediato do carregador em qualquer situação de risco.", on: i.includeEmergency },
    { title: "Tomada industrial IEC 60309", text: "Ponto de força robusto e padronizado, para uso de equipamentos e como alternativa de alimentação.", on: i.includeSocket },
    { title: `Infraestrutura · ${fmtNum(i.distanceM)} m`, text: "Cabos e eletrodutos do ponto de conexão até o carregador, dimensionados conforme a NBR 5410.", on: true },
    { title: "Instalação e comissionamento", text: "Montagem, testes elétricos, configuração do carregador, primeira recarga assistida e orientação de uso.", on: true },
  ].filter((x) => x.on);

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

  return (
    <div className="min-h-dvh bg-[#F6F4EF] text-ink-900 print:bg-white">
      <div className="no-print fixed top-4 right-4 z-40 hidden gap-2 sm:flex">
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
        {!accepted && !expired && token && (
          <Button size="sm" onClick={() => setAcceptOpen(true)} style={{ background: NAVY }}>
            <Check className="h-4 w-4" /> Aceitar proposta
          </Button>
        )}
      </div>

      <div className="mx-auto max-w-[1040px] sm:px-6 sm:py-10 print:max-w-none print:p-0">
        <article className="overflow-hidden bg-white shadow-[0_30px_80px_-30px_rgba(14,42,71,0.35)] sm:rounded-2xl print:rounded-none print:shadow-none">
          {/* ============================================================ CAPA */}
          <header className="relative flex min-h-[640px] flex-col overflow-hidden text-white print:min-h-[297mm]">
            <Photo src={s.proposal.saveCoverImage || DEFAULT_SAVE_COVER} className="absolute inset-0 h-full w-full" fallback={<SaveCoverFallback power={kwLabel} />} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1B2E]/95 via-[#0B1B2E]/75 to-[#0B1B2E]/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B2E] via-transparent to-transparent" />

            <div className="relative flex items-start justify-between gap-6 px-6 pt-8 sm:px-14 sm:pt-12">
              <Brand settings={s} />
              <div className="text-right text-xs leading-relaxed text-white/70">
                <p className="font-semibold tracking-[0.18em] text-white uppercase">Proposta nº {data.proposal.number}</p>
                <p>{formatDate(data.proposal.created_at, { day: "2-digit", month: "long", year: "numeric" })}</p>
                {data.proposal.valid_until && <p>Válida até {formatDate(data.proposal.valid_until)}</p>}
              </div>
            </div>

            <div className="relative mt-auto px-6 pb-10 sm:px-14 sm:pb-14">
              <p className="text-xs font-semibold tracking-[0.3em] text-[#E7C27A] uppercase">S.A.V.E · Sistema de Abastecimento de Veículo Elétrico</p>
              <h1 className="mt-4 max-w-2xl font-display text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-[50px]">
                Recarga do seu veículo elétrico para <span className="text-[#E7C27A]">{data.lead.name}</span>
              </h1>
              {location && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70">
                  <MapPin className="h-4 w-4" /> {location}
                </p>
              )}
              <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/15 backdrop-blur-sm sm:grid-cols-4">
                <CoverKpi label="Carregador" value={`${kwLabel} · ${i.connector}`} />
                <CoverKpi label="Infraestrutura" value={`${fmtNum(i.distanceM)} m`} />
                <CoverKpi label="Investimento" value={brl(price, 0)} />
                <CoverKpi label="Execução" value={`${fmtNum(i.executionDays)} dias`} />
              </dl>
            </div>
          </header>

          {accepted && (
            <div className="flex items-center gap-3 bg-emerald-700 px-6 py-4 text-sm text-white sm:px-14">
              <Check className="h-4 w-4 shrink-0" />
              <p>
                Proposta aceita por <b>{accepted.by}</b> em {formatDate(accepted.at, { day: "2-digit", month: "long", year: "numeric" })}. Nossa equipe entrará em contato para agendar a
                instalação.
              </p>
            </div>
          )}
          {expired && (
            <div className="flex items-center gap-3 bg-amber-50 px-6 py-4 text-sm text-amber-900 sm:px-14">
              <Clock className="h-4 w-4 shrink-0" />
              <p>Esta proposta passou da validade. Fale com a nossa equipe para atualizar os valores.</p>
            </div>
          )}

          {/* ======================================================= ESCOPO */}
          <Section num={num()} kicker="O que está incluso" title="Escopo do fornecimento">
            <p className="max-w-2xl leading-relaxed text-ink-600">
              {firstName}, esta proposta entrega um ponto de recarga completo, seguro e pronto para uso: do quadro de energia do imóvel até o carregador na sua garagem.
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.35fr] md:items-start">
              <div className="overflow-hidden rounded-xl border border-ink-200">
                <div className="relative grid aspect-[4/5] place-items-center bg-gradient-to-b from-[#EEF1F5] to-[#DDE3EA]">
                  {chargerImg ? (
                    <Photo src={chargerImg} className="absolute inset-0 h-full w-full" fallback={<WallboxRender className="h-[80%] w-auto" power={kwLabel} />} />
                  ) : (
                    <WallboxRender className="h-[80%] w-auto" power={kwLabel} />
                  )}
                </div>
                <dl className="divide-y divide-ink-100 p-5 text-sm">
                  {(
                    [
                      ["Potência", kwLabel],
                      ["Alimentação", `${phaseLabel} · ${i.currentA} A`],
                      ["Conector", `${i.connector} (padrão europeu)`],
                      ["Modo de recarga", "AC · Modo 3"],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2">
                      <dt className="text-ink-500">{k}</dt>
                      <dd className="text-right font-medium text-ink-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <ol className="grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200">
                {scope.map((it, idx) => (
                  <li key={it.title} className="flex gap-4 bg-white p-5">
                    <span className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: NAVY }}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-ink-900">{it.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{it.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Section>

          {/* ===================================================== DIAGRAMA */}
          <Section num={num()} kicker="Como fica a instalação" title="Diagrama de ligação" tone="paper">
            <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white p-4 sm:p-6">
              <SaveDiagram
                className="h-auto w-full min-w-[640px]"
                distance={i.distanceM}
                power={kwLabel}
                panel={i.includePanel}
                emergency={i.includeEmergency}
                socket={i.includeSocket}
              />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Explain title="circuito dedicado">
                O carregador recebe um circuito exclusivo, saindo do quadro do imóvel. Assim ele não divide carga com chuveiro, ar-condicionado ou outros aparelhos, e as proteções
                desligam apenas o que for necessário.
              </Explain>
              <Explain title="proteções">
                O disjuntor protege os cabos contra sobrecarga; o DR desliga em milissegundos se houver fuga de corrente (risco de choque); o DPS protege o carregador e o veículo
                contra surtos de raios na rede.
              </Explain>
            </div>
          </Section>

          {/* ======================================================= RECARGA */}
          <Section num={num()} kicker="Na prática" title="Quanto tempo leva para carregar">
            <p className="max-w-2xl leading-relaxed text-ink-600">
              Tempo aproximado para recarregar um carro elétrico médio de <b>20% a 80%</b> da bateria ({fmtNum(REF_BATTERY_KWH)} kWh):
            </p>
            <div className="mt-8 grid gap-5">
              <SpeedBar label={`Tomada comum de casa (${fmtNum(COMMON_SOCKET_KW, 1)} kW)`} hours={socketHours} max={socketHours} color="#94A3B8" />
              <SpeedBar label={`Seu carregador (${kwLabel})`} hours={hours} max={socketHours} color={NAVY} />
            </div>
            <p className="mt-6 text-sm leading-relaxed text-ink-600">
              Até <b style={{ color: NAVY }}>{fmtNum(timesFaster)}× mais rápido</b> que a tomada comum: o carro fica pronto durante a noite ou em poucas horas de uso da garagem.
            </p>
            <Explain title="por que “até”" className="mt-6">
              Cada modelo de carro tem um limite de potência que aceita ao carregar em casa. Se o seu veículo aceitar menos que {kwLabel}, ele carrega na velocidade máxima dele, com
              total segurança. O carregador continua pronto para modelos mais novos e para outros veículos da casa ou da empresa.
            </Explain>
          </Section>

          {/* ================================================= INVESTIMENTO */}
          <section className="print-break relative overflow-hidden px-6 py-14 text-white sm:px-14 sm:py-16" style={{ background: NAVY }}>
            <SectionTitle num={num()} kicker="Investimento" title="Condições comerciais" dark />
            <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
              <div>
                <p className="text-sm text-white/60">Valor total, com equipamentos e instalação</p>
                <p className="tnum mt-1 font-display text-5xl font-semibold tracking-tight sm:text-6xl">{brl(price)}</p>
                <ul className="mt-6 grid gap-2 text-sm text-white/80">
                  {["Equipamentos com nota fiscal", "Materiais e infraestrutura inclusos", "Instalação por equipe técnica própria", "Testes e comissionamento"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#E7C27A]" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <PayOption title="À vista" main={brl(price)} sub="Espécie ou Pix" />
                  {card > 0 && <PayOption title="Cartão de crédito" main={`${i.cardInstallments}× de ${brl(card)}`} sub={`Total ${brl(card * i.cardInstallments, 0)}`} />}
                  <PayOption title="Execução" main={`${fmtNum(i.executionDays)} dias`} sub="após a entrega do equipamento" />
                  <PayOption title="Validade" main={`${fmtNum(i.validityDays)} dias`} sub={data.proposal.valid_until ? `até ${formatDate(data.proposal.valid_until)}` : "a partir da emissão"} />
                </div>
                {i.paymentNotes && <p className="rounded-xl bg-white/[0.06] px-4 py-3 text-sm whitespace-pre-line text-white/80 ring-1 ring-white/10">{i.paymentNotes}</p>}
              </div>
            </div>
          </section>

          {/* ===================================================== GARANTIAS */}
          <Section num={num()} kicker="Tranquilidade" title="Garantias">
            <div className="grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-2">
              <WarrantyBox value={i.installWarrantyMonths} unit={i.installWarrantyMonths === 1 ? "mês" : "meses"} title="Instalação" text="Mão de obra, conexões e infraestrutura executadas pela nossa equipe." />
              <WarrantyBox value={i.factoryWarrantyYears} unit={i.factoryWarrantyYears === 1 ? "ano" : "anos"} title="Fabricação do carregador" text="Garantia do fabricante contra defeitos do equipamento." />
            </div>
          </Section>

          {/* ===================================================== CONDIÇÕES */}
          {conditions.length > 0 && (
            <Section num={num()} kicker="Transparência" title="Condições gerais" tone="paper">
              <ul className="grid gap-3">
                {conditions.map((c) => (
                  <li key={c} className="flex gap-3 text-sm leading-relaxed text-ink-700">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#9A6F1E]" />
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* ===================================================== ASSINATURA */}
          <section className="avoid-break px-6 py-14 sm:px-14">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#9A6F1E] uppercase">De acordo</p>
            <div className="mt-12 grid gap-12 sm:grid-cols-2">
              <Signature name={s.tech_name || s.company_name} role={s.tech_name ? `Responsável técnico${s.tech_registry ? ` · ${s.tech_registry}` : ""}` : s.cnpj ? `CNPJ ${s.cnpj}` : "Contratada"} />
              <Signature name={accepted?.by || data.lead.name} role="Contratante" />
            </div>
          </section>

          {/* ======================================================= SOBRE */}
          <section className="border-t border-ink-100 bg-[#F6F4EF]/70 px-6 py-10 sm:px-14">
            <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="font-display text-xl font-semibold" style={{ color: NAVY }}>
                  {s.company_name}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.about}</p>
              </div>
              <div className="grid content-start gap-2.5 text-sm">
                {data.seller?.name && (
                  <p className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-ink-400" /> Consultor: <b>{data.seller.name}</b>
                  </p>
                )}
                {contactPhone && (
                  <p className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-ink-400" /> {formatPhone(contactPhone)}
                  </p>
                )}
                {(s.email || data.seller?.email) && (
                  <p className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-ink-400" /> {s.email || data.seller?.email}
                  </p>
                )}
                {s.instagram && (
                  <p className="flex items-center gap-2.5">
                    <AtSign className="h-4 w-4 text-ink-400" /> {s.instagram.replace(/^@/, "")}
                  </p>
                )}
                {(s.address || s.city) && (
                  <p className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-ink-400" /> {s.address || s.city}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ========================================================= CTA */}
          <section className="no-print border-t border-ink-100 px-6 py-12 sm:px-14">
            <div className="flex flex-col gap-6 rounded-2xl border border-ink-200 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="font-display text-2xl font-semibold tracking-tight" style={{ color: NAVY }}>
                  {accepted ? "Proposta aceita. Obrigado pela confiança." : "Pronto para carregar em casa?"}
                </p>
                <p className="mt-1 max-w-md text-sm text-ink-500">
                  {accepted ? "Entraremos em contato para agendar a instalação." : "Aceite a proposta online ou fale com a nossa equipe para tirar qualquer dúvida."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!accepted && !expired && token && (
                  <Button size="lg" onClick={() => setAcceptOpen(true)} style={{ background: NAVY }}>
                    <Check className="h-5 w-5" /> Aceitar proposta
                  </Button>
                )}
                {contactPhone && (
                  <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer">
                    <Button size="lg" variant="secondary" className="w-full">
                      <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp
                    </Button>
                  </a>
                )}
                <Button size="lg" variant="secondary" onClick={() => window.print()} className="sm:hidden">
                  <Download className="h-5 w-5" /> PDF
                </Button>
              </div>
            </div>
          </section>

          <footer className="border-t border-ink-100 px-6 py-6 text-[11px] leading-relaxed text-ink-400 sm:px-14">
            Tempos de recarga estimados para uma bateria de {fmtNum(REF_BATTERY_KWH)} kWh, de 20% a 80%, com 90% de eficiência; variam conforme o veículo e a temperatura. Proposta nº{" "}
            {data.proposal.number}.
          </footer>
        </article>
      </div>

      {!accepted && !expired && token && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <div className="flex gap-2">
            {contactPhone && (
              <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="secondary" className="w-full">
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                </Button>
              </a>
            )}
            <Button className="flex-1" style={{ background: NAVY }} onClick={() => setAcceptOpen(true)}>
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
          days={i.executionDays}
          note={`O aceite online não gera cobrança: ele reserva as condições desta proposta. A instalação é concluída em até ${fmtNum(i.executionDays)} dias após a entrega do equipamento.`}
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

function fmtHours(h: number) {
  if (!Number.isFinite(h) || h <= 0) return "—";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm} min`;
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}

function SaveCoverFallback({ power }: { power: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#0B1B2E] via-[#10263F] to-[#0B1B2E]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.22),transparent_45%)]" />
      <WallboxRender className="absolute top-[22%] right-[6%] h-[48%] w-auto opacity-70" power={power} />
    </div>
  );
}

function SpeedBar({ label, hours, max, color }: { label: string; hours: number; max: number; color: string }) {
  const Icon = color === NAVY ? Zap : BatteryCharging;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-ink-600">
          <Icon className="h-4 w-4" style={{ color }} /> {label}
        </span>
        <span className="tnum font-display text-xl font-semibold" style={{ color: color === NAVY ? NAVY : "#475569" }}>
          {fmtHours(hours)}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, (hours / Math.max(0.01, max)) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}


function WarrantyBox({ value, unit, title, text }: { value: number; unit: string; title: string; text: string }) {
  return (
    <div className="bg-white p-6">
      <p className="tnum font-display text-4xl font-semibold tracking-tight" style={{ color: NAVY }}>
        {fmtNum(value)}
        <span className="ml-1.5 text-sm font-medium text-ink-400">{unit}</span>
      </p>
      <p className="mt-2 font-semibold text-ink-900">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{text}</p>
    </div>
  );
}

function Signature({ name, role }: { name: string; role: string }) {
  return (
    <div className={cx("border-t-2 pt-3")} style={{ borderColor: NAVY }}>
      <p className="font-semibold text-ink-900">{name}</p>
      <p className="text-sm text-ink-500">{role}</p>
    </div>
  );
}
