"use client";

import type { ReactNode } from "react";
import { PDF_PAGE_H, PDF_PAGE_W } from "@/components/bf/proposal-pdf";
import { REQUEST_LABEL, UF_NAME, calc, type ProjectData } from "@/lib/solar-project";

/**
 * Formulário de Solicitação de Orçamento de Conexão (ANEXO I · NT.020 Equatorial,
 * microgeração grupo B) em PDF organizado: os mesmos campos do Excel, em 2 páginas A4.
 */

const INK = "#14201A";
const GREEN = "#1F7A45";
const LINE = "rgba(20,32,26,0.16)";
const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const b = (v: string | number | null | undefined) => (v == null || String(v).trim() === "" ? "—" : String(v));

function Page({ n, total, children }: { n: number; total: number; children: ReactNode }) {
  return (
    <div data-pdf-page className="relative overflow-hidden bg-white font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)" }} />
      <div className="absolute inset-x-[44px] top-[26px] flex items-center justify-between gap-6 border-b pb-3" style={{ borderColor: LINE }}>
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
            NT.020.EQTL · Anexo I
          </p>
          <p className="text-[15px] leading-tight font-extrabold">Formulário de Solicitação de Orçamento de Conexão</p>
          <p className="text-[11px] text-[#14201A]/60">Microgeração distribuída · Grupo B</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-h-color.png" alt="" className="h-[30px] w-auto" />
      </div>
      <div className="absolute inset-x-[44px] top-[100px] bottom-[52px] text-[11.5px] leading-snug">{children}</div>
      <div className="absolute inset-x-[44px] bottom-[22px] flex justify-between border-t pt-2 text-[9.5px] text-[#14201A]/50" style={{ borderColor: LINE }}>
        <span>Dados do formulário oficial da distribuidora (arquivo Excel anexo)</span>
        <span className="font-semibold tabular-nums">
          {n} / {total}
        </span>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-3.5">
      <p className="mb-1.5 flex items-center gap-2 rounded-[6px] px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-white uppercase" style={{ background: INK }}>
        <span className="text-[#9FDB7C]">{n}</span> {title}
      </p>
      {children}
    </section>
  );
}

/** Campos em grade: [rótulo, valor, colunas que ocupa (de 6)]. */
function Fields({ items }: { items: [string, ReactNode, number?][] }) {
  return (
    <div className="grid grid-cols-6 border-t border-l" style={{ borderColor: LINE }}>
      {items.map(([k, v, span], i) => (
        <div key={i} className="min-w-0 border-r border-b px-2 py-1" style={{ borderColor: LINE, gridColumn: `span ${span ?? 2} / span ${span ?? 2}` }}>
          <p className="text-[8.5px] font-semibold tracking-[0.06em] text-[#14201A]/50 uppercase">{k}</p>
          <p className="min-h-[15px] text-[11.5px] leading-tight font-semibold break-words">{v}</p>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows, total }: { head: string[]; rows: ReactNode[][]; total?: ReactNode[] }) {
  return (
    <table className="w-full border-collapse text-[10.5px]">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} className="border px-1.5 py-1 text-center leading-tight font-bold" style={{ borderColor: LINE, background: "#EEF4EC" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="border px-1.5 py-[3px] text-center tabular-nums" style={{ borderColor: LINE }}>
                {c}
              </td>
            ))}
          </tr>
        ))}
        {total && (
          <tr className="font-bold">
            {total.map((c, j) => (
              <td key={j} className="border px-1.5 py-[3px] text-center tabular-nums" style={{ borderColor: LINE, background: "#F6F9F5" }}>
                {c}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

const DECLARATIONS: [string, string][] = [
  ["Solicito que a contagem do prazo para a vistoria, conforme art. 68 da REN nº 1.000/2021, inicie a partir da solicitação de vistoria.", "SIM"],
  ["Autorizo a distribuidora a entregar, junto com o orçamento de conexão, os contratos e o meio de pagamento dos custos de minha responsabilidade.", "SIM"],
  ["Declaro que as instalações internas da unidade consumidora, incluindo a geração distribuída, atendem às normas e padrões da distribuidora.", "SIM"],
  ["Dispensa da análise de inversão de fluxo: não injeção na rede (“Grid Zero”).", "NÃO"],
  ["Dispensa da análise de inversão de fluxo: critérios de gratuidade da REN 1.000/2021 e geração compatível com o consumo no horário de geração.", "SIM"],
  ["Dispensa da análise de inversão de fluxo: autoconsumo local com potência instalada de geração até 7,5 kW.", "NÃO"],
  ["Declaro, para todos os fins, que todas as informações prestadas neste documento são verdadeiras.", "SIM"],
];

export function FormPages({ d, date, attached }: { d: ProjectData; date: string; /** Itens anexados (chaves da pasta); sem a lista, todos. */ attached?: string[] }) {
  const c = calc(d);
  const doc = d.client.doc.replace(/\D/g, "");
  const docFmt = doc.length === 14 ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : doc.length === 11 ? doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : d.client.doc;
  const u = d.uc;
  const t = d.rt;
  const uf = d.client.state || "AL";
  const pgt = c.pg;
  const check = pgt > 75 ? "PGT acima do limite do grupo B" : c.pgOk ? "OK: PGT ≤ PD" : "NÃO OK: PGT > PD";
  return (
    <>
      <Page n={1} total={2}>
        <Section n="UG" title="Informações das unidades geradoras · solar fotovoltaica">
          <Table
            head={["Item", "Potência do módulo (W)", "Quantidade", "Potência de pico (kWp)", "Área do arranjo (m²)", "Fabricante", "Modelo"]}
            rows={c.mods.map((m, i) => [
              i + 1,
              f(Number(m.powerW), 0),
              m.qty,
              f((Number(m.qty) * Number(m.powerW)) / 1000),
              f(Number(m.qty) * (Number(m.lengthM) > 0 && Number(m.widthM) > 0 ? Number(m.lengthM) * Number(m.widthM) : 2.57)),
              b(m.brand),
              b(m.model),
            ])}
            total={["TOTAL", "", c.moduleQty, f(c.kwp), f(c.area), "", ""]}
          />
          <p className="mt-2 mb-1 text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: GREEN }}>
            Dados dos inversores
          </p>
          <Table
            head={["Item", "Fabricante", "Modelo", "Potência nominal (kW)", "Faixa de tensão (V)", "Corrente nominal (A)", "Fator de potência", "Rendimento (%)", "DHT de corrente (%)"]}
            rows={c.invs.map((v, i) => [i + 1, b(v.brand), `${b(v.model)}${Number(v.qty) > 1 ? ` (${v.qty} un.)` : ""}`, f(Number(v.powerKw) * Math.max(1, Number(v.qty))), b(v.voltageRange), b(v.acA), b(v.pf), v.efficiency ? f(Number(v.efficiency), 1) : "—", b(v.thd)])}
            total={["TOTAL", "", "", f(c.inverterKw), "", "", "", "", ""]}
          />
        </Section>

        <Section n="1." title="Identificação e dados cadastrais da unidade consumidora">
          <Fields
            items={[
              ["Nome do cliente / razão social (titular da UC)", b(d.client.name).toUpperCase(), 4],
              [doc.length === 14 ? "CNPJ" : "CPF", b(docFmt), 2],
              ["RG", b(d.client.rg), 2],
              ["Data de expedição", b(d.client.rgDate), 2],
              ["Celular", b(d.client.phone), 2],
              ["Endereço", b([d.client.address, d.client.district].filter((x) => x.trim()).join(" - ")).toUpperCase(), 6],
              ["CEP", b(d.client.cep), 1],
              ["Município", b(d.client.city).toUpperCase(), 2],
              ["UF", uf, 1],
              ["E-mail", b(d.client.email), 2],
              ["Tipo de orçamento", "Orçamento de Conexão", 2],
              ["Conta contrato", b(u.account), 2],
              ["Cargas especiais", u.specialLoads ? "SIM" : "NÃO", 2],
              ["Tipo de solicitação", REQUEST_LABEL[u.requestType] ?? u.requestType, 6],
              ["Ramo de atividade", b(u.activity).toUpperCase(), 3],
              ["Classe", u.cls, 3],
              ["Tipo de ligação", u.phase, 2],
              ["Tensão de atendimento", `${u.voltage} V`, 2],
              ["Carga declarada", `${f(Number(u.declaredLoadKw))} kW`, 2],
              ["Disjuntor de entrada", `${u.breakerA} A`, 2],
              ["Potência disponibilizada (PD)", `${f(c.pdKw)} kW (${f(c.pdKva)} kVA)`, 2],
              ["Tipo de ramal", u.branch, 2],
              ["Poste / transformador mais próximo", b(u.pole), 2],
              ["Coordenada X (UTM)", b(u.utmX), 2],
              ["Coordenada Y (UTM)", b(u.utmY), 2],
            ]}
          />
        </Section>
      </Page>

      <Page n={2} total={2}>
        <Section n="2." title="Dados cadastrais do responsável técnico">
          <Fields
            items={[
              ["Nome completo", b(t.name).toUpperCase(), 3],
              ["Título profissional", b(t.title), 2],
              ["Registro · UF", `${b(t.register)}${t.registerUf ? ` · ${t.registerUf}` : ""}`, 1],
              ["E-mail", b(t.email), 3],
              ["Telefone fixo", b(t.landline), 1],
              ["Celular", b(t.mobile), 2],
              ["Endereço de correspondência", b(t.address), 3],
              ["Bairro", b(t.district), 1],
              ["Município · UF", `${b(t.city)} · ${b(t.uf)}`, 1],
              ["CEP", b(t.cep), 1],
            ]}
          />
        </Section>

        <Section n="3." title="Características da microgeração distribuída">
          <Fields
            items={[
              ["Tipo de fonte primária", "SOLAR FOTOVOLTAICA", 3],
              ["Tipo de geração", "EMPREGANDO CONVERSOR ELETRÔNICO/INVERSOR", 3],
              ["Modalidade de compensação", u.modality, 3],
              ["Potência de geração do orçamento", `${f(c.pg)} kW`, 1],
              ["Potência de geração total (PGT)", `${f(pgt)} kW`, 1],
              ["Verificação", check, 1],
              ["Rateio de créditos", u.modality === "AUTOCONSUMO LOCAL" ? "Não é necessário preencher a lista de rateio" : "Preencher a lista de rateio (guia 2 do Excel)", 6],
            ]}
          />
        </Section>

        <Section n="4." title="Documentos anexados à solicitação">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
            {(
              [
                ["formulario", "Formulário de solicitação (este documento e o Excel)"],
                ["rg", "Documento de identificação do titular (RG)"],
                ["trt", "Responsabilidade técnica (TRT)"],
                ["unifilar", "Diagrama unifilar"],
                ["blocos", "Diagrama de blocos"],
                ["memorial", "Memorial técnico descritivo"],
                ["datasheet", "Datasheet do inversor"],
              ] as const
            ).map(([k, x], i) => {
              const ok = !attached || attached.includes(k);
              return (
                <p key={x} className={ok ? "flex items-center gap-2" : "flex items-center gap-2 text-[#14201A]/40"}>
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border text-[9px] font-black text-white" style={{ background: ok ? GREEN : "transparent", borderColor: ok ? GREEN : LINE }}>
                    {ok ? "✓" : ""}
                  </span>
                  {i + 1}. {x}
                </p>
              );
            })}
          </div>
        </Section>

        <Section n="6." title="Solicitações e declarações">
          <div className="border-t border-l" style={{ borderColor: LINE }}>
            {DECLARATIONS.map(([q, a]) => (
              <div key={q} className="flex items-stretch border-r border-b text-[10.5px]" style={{ borderColor: LINE }}>
                <p className="flex-1 px-2 py-1 leading-snug">{q}</p>
                <p className="grid w-14 shrink-0 place-items-center border-l font-bold" style={{ borderColor: LINE }}>
                  {a}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-8 grid grid-cols-[1fr_1fr_1.4fr] items-end gap-6 text-center text-[11px]">
          <div>
            <p className="border-b pb-1 font-semibold" style={{ borderColor: INK }}>
              {`${(d.client.city || "Maceió").toUpperCase()}, ${(UF_NAME[uf] ?? uf).toUpperCase()}`}
            </p>
            <p className="mt-1 text-[#14201A]/55">Local</p>
          </div>
          <div>
            <p className="border-b pb-1 font-semibold" style={{ borderColor: INK }}>
              {date}
            </p>
            <p className="mt-1 text-[#14201A]/55">Data</p>
          </div>
          <div>
            <p className="h-[18px] border-b" style={{ borderColor: INK }} />
            <p className="mt-1 text-[#14201A]/55">Assinatura do responsável</p>
          </div>
        </div>
      </Page>
    </>
  );
}
