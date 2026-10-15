import { BadgeCheck, Camera, CheckCircle2, Clock, Fingerprint, MapPin, PenLine, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { brlPlain, dateBr, maskDoc } from "@/lib/br";
import {
  DOC_KINDS,
  EQUIP_KINDS,
  ROLE_LABEL,
  contractKwp,
  documentBlocks,
  signersFor,
  type AluguelData,
  type Block,
  type ContratoData,
  type DocData,
  type DocKind,
  type ProcuracaoData,
  type SignerInfo,
} from "@/lib/documents";

const NAVY = "#1C1234";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const num = (v: number, max = 2) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: max });

/** Os números que resumem o documento, no topo da folha. */
function summary(kind: DocKind, data: DocData): { k: string; v: string }[] {
  if (kind === "contrato") {
    const d = data as ContratoData;
    const kwp = contractKwp(d);
    const eq = d.equipment.filter((e) => e.qty > 0 && e.kind !== "outro");
    const p = d.payment;
    const pay =
      p.method === "cartao" ? `${p.installments}× no cartão` : p.method === "pix" ? "À vista" : p.method === "entrada" ? "Entrada + saldo" : p.method === "financiamento" ? "Financiamento" : "Personalizado";
    return [
      { k: "Potência instalada", v: kwp > 0 ? `${num(kwp)} kWp` : "—" },
      { k: "Equipamentos", v: eq.length ? eq.map((e) => `${num(e.qty, 0)} ${e.qty === 1 ? EQUIP_KINDS[e.kind].one.split(" ")[0] : EQUIP_KINDS[e.kind].many.split(" ")[0]}`).join(" · ") : "—" },
      { k: "Valor total", v: d.price > 0 ? brlPlain(d.price) : "—" },
      { k: "Pagamento", v: pay },
    ];
  }
  if (kind === "procuracao") {
    const d = data as ProcuracaoData;
    return [
      { k: "Unidade consumidora", v: d.uc.trim() || "—" },
      { k: "Distribuidora", v: (d.utility.split("(")[0].replace(/Distribuidora de Energia S\.?A\.?/i, "").trim() || "—").slice(0, 28) },
      { k: "Validade", v: d.validityMonths > 0 ? `${d.validityMonths} meses` : "Indeterminada" },
      { k: "Poderes", v: `${d.powers.length + (d.extraPowers.trim() ? 1 : 0)} autorizações` },
    ];
  }
  const d = data as AluguelData;
  const g = { nenhuma: "Sem garantia", caucao: "Caução", fiador: "Fiador", seguro: "Seguro fiança" }[d.guarantee];
  return [
    { k: "Aluguel mensal", v: d.rent > 0 ? brlPlain(d.rent) : "—" },
    { k: "Prazo", v: `${d.months} meses` },
    { k: "Vencimento", v: `Todo dia ${d.dueDay}` },
    { k: "Garantia", v: g },
  ];
}

const PARTY = /^(contratad[ao]|contratante|outorgante|outorgado|locador|locat[áa]rio)/i;
const LEAD = /^(Cláusula \d+ª\.|§\s?\d+º\.|Parágrafo único\.)\s*/;
const MARK = /^((?:[a-z]|[ivx]+|[IVX]+)[.)])\s+([\s\S]*)$/;

/** Texto do parágrafo com o "Cláusula Nª." / "§1º." em destaque. */
function Rich({ text }: { text: string }) {
  const m = text.match(LEAD);
  if (!m) return <>{text}</>;
  return (
    <>
      <strong className="font-semibold" style={{ color: NAVY }}>
        {m[1]}
      </strong>{" "}
      {text.slice(m[0].length)}
    </>
  );
}

interface Group {
  h: string | null;
  items: Block[];
}

/**
 * O documento como uma folha da marca Quark: capa navy com resumo, partes em
 * cartões, cláusulas legíveis, assinaturas e o registro de auditoria (com a
 * selfie de segurança quando houver).
 */
export function DocumentView({
  kind,
  data,
  signers,
  company,
  hash,
}: {
  kind: DocKind;
  data: DocData;
  /** Assinantes já cadastrados (com assinatura, se houver). Sem isso, usa as partes do documento. */
  signers?: SignerInfo[];
  company?: { company_name?: string | null; logo_url?: string | null } | null;
  hash?: string | null;
}) {
  const blocks = documentBlocks(kind, data);
  const title = blocks.find((b) => b.t === "title")?.text ?? DOC_KINDS[kind].label;
  const sub = blocks.find((b) => b.t === "sub")?.text ?? "";
  const place = blocks.find((b) => b.t === "place")?.text ?? "";

  // Agrupa por título de seção.
  const groups: Group[] = [];
  for (const b of blocks) {
    if (b.t === "title" || b.t === "sub" || b.t === "place") continue;
    if (b.t === "h") groups.push({ h: b.text, items: [] });
    else {
      if (!groups.length) groups.push({ h: null, items: [] });
      groups[groups.length - 1].items.push(b);
    }
  }
  const firstClause = groups.findIndex((g) => !g.h || !PARTY.test(g.h));
  const partyGroups = (firstClause === -1 ? groups : groups.slice(0, firstClause)).filter((g) => g.h && PARTY.test(g.h));
  const rest = firstClause === -1 ? [] : groups.slice(firstClause);
  const afterParties = partyGroups.flatMap((g) => g.items.slice(1));

  const people: SignerInfo[] = signers?.length ? signers : signersFor(kind, data).map((s) => ({ role: s.role, name: s.name }));
  const signed = people.filter((s) => s.signed_at);
  // Contrato solar: a CONTRATADA já sai assinada com a assinatura padrão da empresa.
  const c = kind === "contrato" ? (data as ContratoData).contractor : null;
  const contractorSig = kind === "contrato" ? (data as ContratoData).contractorSignature : "";
  const list: (SignerInfo & { fixed?: string })[] = c
    ? [
        { role: "contratante", name: "", ...people.find((s) => s.role === "contratante") },
        { role: "contratada", name: c.name || "Contratada", signature: contractorSig || null, fixed: [c.repName, c.repRole].filter(Boolean).join(" · ") },
        ...people.filter((s) => s.role !== "contratante"),
      ]
    : people;

  const kpis = summary(kind, data);
  const companyName = company?.company_name || "Quark Energia";
  const date = (data as { date?: string }).date;
  const where = (data as { place?: string }).place;

  return (
    <article className="doc-paper palette-classic @container relative mx-auto w-full max-w-[820px] overflow-hidden bg-white font-sans text-[14px] leading-[1.75] text-[#2B2541] shadow-lift ring-1 ring-ink-200/70 sm:rounded-[28px] print:max-w-none print:overflow-visible print:rounded-none print:text-[10.5pt] print:leading-[1.6] print:shadow-none print:ring-0">
      {/* ------------------------------------------------------------ capa */}
      <header className="relative overflow-hidden px-6 pt-7 pb-6 text-white sm:px-12 sm:pt-10 sm:pb-8 print:rounded-[18px] print:px-8 print:pt-7 print:pb-6" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #261845 55%, #120B24 100%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/symbol.png" alt="" aria-hidden className="pointer-events-none absolute -right-10 -bottom-16 w-[260px] opacity-[0.07] select-none sm:w-[320px]" />
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#F3EA3B]/20 blur-3xl print:hidden" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-[#6CC690]/15 blur-3xl print:hidden" />

        <div className="relative flex items-center justify-between gap-4">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={companyName} className="h-8 w-auto max-w-[170px] object-contain brightness-0 invert sm:h-9" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/logo-h-white.png" alt={companyName} className="h-8 w-auto sm:h-9" />
          )}
          <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] whitespace-nowrap text-white/80 uppercase ring-1 ring-white/15 @md:flex print:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-[#C9E97A]" /> Documento eletrônico
          </span>
        </div>

        <p className="relative mt-7 text-[11px] font-semibold tracking-[0.24em] text-[#C9E97A] uppercase sm:mt-9">{DOC_KINDS[kind].label.toLowerCase() === title.toLowerCase() ? "Documento para assinatura" : DOC_KINDS[kind].label}</p>
        <h1 className="relative mt-1.5 max-w-[640px] font-display text-[25px] leading-[1.15] font-semibold tracking-tight @2xl:text-[34px] print:text-[22pt]">{title}</h1>
        {sub && <p className="relative mt-2 max-w-[600px] text-[13px] leading-relaxed text-white/65 sm:text-sm">{sub}</p>}

        <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-white/70">
          {where && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#F3EA3B]" /> {where}
            </span>
          )}
          {date && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#F3EA3B]" /> {dateBr(date)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#F3EA3B]" /> {list.length} {list.length === 1 ? "assinatura" : "assinaturas"}
          </span>
          {hash && (
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <Fingerprint className="h-3.5 w-3.5 text-[#F3EA3B]" /> {hash.slice(0, 12).toUpperCase()}
            </span>
          )}
        </div>

        <dl className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 @2xl:grid-cols-4 print:grid-cols-4">
          {kpis.map((x) => (
            <div key={x.k} className="bg-[#120B24]/55 px-4 py-3">
              <dt className="text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">{x.k}</dt>
              <dd className="mt-0.5 font-display text-[15px] leading-snug font-semibold tabular-nums sm:text-base print:text-[10.5pt]">{x.v}</dd>
            </div>
          ))}
        </dl>
      </header>
      <div className="h-1.5 bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] print:mt-2 print:rounded-full" />

      <div className="px-6 py-8 sm:px-12 sm:py-10 print:px-1 print:py-6">
        {/* --------------------------------------------------------- partes */}
        {partyGroups.length > 0 && (
          <div className="grid gap-3 @2xl:grid-cols-2 print:grid-cols-2">
            {partyGroups.map((g) => {
              const text = g.items[0]?.text ?? "";
              const cut = text.indexOf(", ");
              const name = cut > 0 ? text.slice(0, cut) : text;
              const qual = cut > 0 ? text.slice(cut + 2) : "";
              return (
                <div key={g.h} className="relative break-inside-avoid overflow-hidden rounded-2xl bg-[#F6F5FA] p-4 ring-1 ring-ink-200/70 sm:p-5">
                  <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#F3EA3B] to-[#6CC690]" />
                  <p className="text-[10px] font-bold tracking-[0.2em] text-[#2C7A52] uppercase">{g.h}</p>
                  <p className="mt-1 font-display text-[15px] leading-snug font-semibold" style={{ color: NAVY }}>
                    {name}
                  </p>
                  {qual && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 print:text-[9pt]">{qual}</p>}
                </div>
              );
            })}
          </div>
        )}
        {afterParties.map((b, i) => (
          <p key={i} className="mt-5 text-pretty text-ink-600 italic">
            {b.text}
          </p>
        ))}

        {/* ------------------------------------------------------ cláusulas */}
        {rest.map((g, gi) => {
          const annex = g.h ? /^anexo/i.test(g.h) : false;
          return (
            <div key={gi} className={cx(annex && "break-inside-avoid")}>
              {g.h && (
                <h2 className="mt-9 mb-3 flex items-center gap-3 break-after-avoid print:mt-6">
                  <span className="h-5 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-[#F3EA3B] to-[#6CC690]" />
                  <span className="font-display text-[13px] font-semibold tracking-[0.12em] uppercase" style={{ color: NAVY }}>
                    {g.h}
                  </span>
                  <span className="h-px flex-1 bg-ink-200/70" />
                </h2>
              )}
              {annex ? (
                <div className="overflow-hidden rounded-2xl ring-1 ring-ink-200/80">
                  {g.items.map((b, i) => {
                    const m = b.text.match(/^(\d+) × (.*)$/);
                    return (
                      <div key={i} className={cx("flex items-center gap-3 px-4 py-2.5 text-[13px]", i % 2 ? "bg-white" : "bg-[#F6F5FA]")}>
                        {m ? (
                          <>
                            <span className="grid h-7 min-w-7 place-items-center rounded-lg px-1.5 font-display text-[12px] font-bold text-[#F3EA3B] tabular-nums" style={{ background: NAVY }}>
                              {m[1]}
                            </span>
                            <span className="font-medium text-ink-800">{m[2]}</span>
                          </>
                        ) : (
                          <span className="text-ink-500">{b.text}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                g.items.map((b, i) => {
                  if (b.t === "li") {
                    const m = b.text.match(MARK);
                    return (
                      <div key={i} className="my-1.5 grid grid-cols-[30px_minmax(0,1fr)] items-baseline gap-1 pl-1 sm:pl-3">
                        <span className="font-display text-[12.5px] font-semibold text-[#2C7A52]">{m ? m[1] : "•"}</span>
                        <span className="hyphens-auto sm:text-justify print:text-justify">{m ? m[2] : b.text}</span>
                      </div>
                    );
                  }
                  return (
                    <p key={i} className="my-2.5 hyphens-auto sm:text-justify print:text-justify">
                      <Rich text={b.text} />
                    </p>
                  );
                })
              )}
            </div>
          );
        })}

        {place && <p className="mt-8 text-right font-medium text-ink-700">{place}</p>}

        {/* ---------------------------------------------------- assinaturas */}
        <div className="mt-10">
          <h2 className="mb-4 flex items-center gap-3 break-after-avoid">
            <span className="h-5 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-[#F3EA3B] to-[#6CC690]" />
            <span className="font-display text-[13px] font-semibold tracking-[0.12em] uppercase" style={{ color: NAVY }}>
              Assinaturas
            </span>
            <span className="h-px flex-1 bg-ink-200/70" />
          </h2>
          <div className="grid gap-3 @lg:grid-cols-2 print:grid-cols-2">
            {list.map((s) => {
              const fixed = s.fixed !== undefined;
              const ok = !!s.signature;
              return (
                <div key={s.role} className="break-inside-avoid rounded-2xl p-4 ring-1 ring-ink-200/80">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold tracking-[0.2em] text-[#2C7A52] uppercase">{ROLE_LABEL[s.role] ?? s.role}</p>
                    {ok ? (
                      <span className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                        {fixed ? <BadgeCheck className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {fixed ? "Assinatura da empresa" : "Assinado"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-700">
                        <PenLine className="h-3.5 w-3.5" /> Pendente
                      </span>
                    )}
                  </div>
                  <div className={cx("mt-2 flex items-end justify-center", fixed ? "h-28" : "h-24")}>
                    {ok ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.signature!} alt={`Assinatura de ${s.signed_name ?? s.name}`} className={cx("w-auto max-w-[250px] object-contain", fixed ? "mb-1.5 max-h-28" : "max-h-24")} />
                    ) : (
                      <span className="mb-2 text-xs text-ink-300 italic">aguardando assinatura</span>
                    )}
                  </div>
                  <div className="border-t border-dashed border-ink-300 pt-2 text-center">
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>
                      {s.signed_name ?? s.name}
                    </p>
                    <p className="text-[11.5px] text-ink-500">
                      {s.signed_cpf ? `CPF ${maskDoc(s.signed_cpf)}` : fixed ? s.fixed : ""}
                      {s.signed_at ? `${s.signed_cpf ? " · " : ""}${fmt(s.signed_at)}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------- auditoria */}
        {signed.length > 0 && (
          <div className="mt-8 break-inside-avoid overflow-hidden rounded-2xl ring-1 ring-ink-200/80">
            <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: NAVY }}>
              <ShieldCheck className="h-4 w-4 text-[#C9E97A]" />
              <p className="font-display text-[13px] font-semibold">Registro de assinaturas eletrônicas</p>
            </div>
            <ul className="divide-y divide-ink-100 bg-[#F6F5FA]/60 text-[11.5px] leading-relaxed text-ink-600">
              {signed.map((s) => (
                <li key={s.role} className="flex gap-3 px-4 py-3">
                  {s.selfie ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.selfie} alt={`Selfie de ${s.signed_name}`} className="h-[72px] w-[56px] shrink-0 rounded-lg object-cover ring-1 ring-ink-200" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p>
                      <b className="text-ink-900">{s.signed_name}</b> ({ROLE_LABEL[s.role] ?? s.role}) · CPF {maskDoc(s.signed_cpf)} · assinou em {fmt(s.signed_at!)} (horário de Brasília)
                      {s.ip ? ` · IP ${s.ip}` : ""}
                    </p>
                    {(s.selfie || s.selfie_at) && (
                      <p className="mt-0.5 flex items-center gap-1 font-semibold text-emerald-700">
                        <Camera className="h-3.5 w-3.5" /> Selfie de segurança registrada{s.selfie_at ? ` em ${fmt(s.selfie_at)}` : ""}
                      </p>
                    )}
                    {s.content_hash && <p className="mt-0.5 font-mono text-[10px] break-all text-ink-400">Código de verificação: {s.content_hash}</p>}
                  </div>
                </li>
              ))}
            </ul>
            {hash && <p className="border-t border-ink-100 px-4 py-2 font-mono text-[10px] break-all text-ink-400">Hash do documento (SHA-256): {hash}</p>}
          </div>
        )}

        <Footer company={companyName} />
      </div>
    </article>
  );
}

function Footer({ company }: { company: string }): ReactNode {
  return (
    <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5 text-[11px] text-ink-400">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-h-color.png" alt={company} className="h-7 w-auto" />
      <p className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[#2C7A52]" /> Assinatura eletrônica com validade jurídica · MP 2.200-2/2001 e Lei 14.063/2020
      </p>
    </footer>
  );
}
