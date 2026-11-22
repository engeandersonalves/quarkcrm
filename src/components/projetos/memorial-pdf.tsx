"use client";

import type { ReactNode } from "react";
import { PDF_PAGE_H, PDF_PAGE_W } from "@/components/bf/proposal-pdf";
import { LOSSES, UF_NAME, calc, mm2, type ProjectData } from "@/lib/solar-project";

/**
 * Memorial Técnico Descritivo (ANEXO III · NT.020 Equatorial) em páginas A4,
 * no mesmo roteiro do modelo da Quark, com todos os números calculados do projeto.
 */

export interface MemorialImages {
  localizacao?: string;
  caixa?: string;
  cresesb?: string;
  assinatura?: string;
}

const INK = "#14201A";
const GREEN = "#1F7A45";
const LINE = "rgba(20,32,26,0.14)";
const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const f0 = (v: number) => f(v, 0);
const blank = (v: string | number | null | undefined) => (v == null || String(v).trim() === "" ? "—" : String(v));

const SIGLAS: [string, string][] = [
  ["ABNT", "Associação Brasileira de Normas Técnicas"],
  ["ANEEL", "Agência Nacional de Energia Elétrica"],
  ["BT", "Baixa tensão (220/127 V, 380/220 V)"],
  ["C.A.", "Corrente alternada"],
  ["C.C.", "Corrente contínua"],
  ["CD", "Custo de disponibilidade (30, 50 ou 100 kWh para ligações monofásicas, bifásicas ou trifásicas)"],
  ["CI", "Carga instalada"],
  ["DPS", "Dispositivo de proteção contra surtos"],
  ["DSV", "Dispositivo de seccionamento visível"],
  ["FP", "Fator de potência"],
  ["FV", "Fotovoltaico"],
  ["GD", "Geração distribuída"],
  ["HSP", "Horas de sol pleno"],
  ["IEC", "International Electrotechnical Commission"],
  ["IN", "Corrente nominal"],
  ["IDG", "Corrente nominal do disjuntor de entrada da unidade consumidora (A)"],
  ["Isc", "Corrente de curto-circuito do módulo fotovoltaico (A)"],
  ["kW", "Quilowatt"],
  ["kWp", "Quilowatt-pico"],
  ["kWh", "Quilowatt-hora"],
  ["MicroGD", "Microgeração distribuída"],
  ["MT", "Média tensão (13,8 kV, 34,5 kV)"],
  ["NF", "Fator do número de fases: 1 para monofásico e bifásico, √3 para trifásico"],
  ["PRODIST", "Procedimentos de Distribuição"],
  ["PD", "Potência disponibilizada para a unidade consumidora"],
  ["QGBT", "Quadro geral de baixa tensão"],
  ["REN", "Resolução Normativa"],
  ["SPDA", "Sistema de proteção contra descargas atmosféricas"],
  ["SFVCR", "Sistema fotovoltaico conectado à rede"],
  ["UC", "Unidade consumidora"],
  ["UTM", "Universal Transversa de Mercator"],
  ["VN", "Tensão nominal de atendimento (V)"],
  ["Voc", "Tensão de circuito aberto do módulo fotovoltaico (V)"],
];

const REFS = [
  "ABNT NBR 5410: Instalações elétricas de baixa tensão.",
  "ABNT NBR 10899: Energia solar fotovoltaica – Terminologia.",
  "ABNT NBR 16149: Sistemas fotovoltaicos (FV) – Características da interface de conexão com a rede elétrica de distribuição.",
  "ABNT NBR 16150: Sistemas fotovoltaicos (FV) – Características da interface de conexão com a rede elétrica de distribuição – Procedimento de ensaio de conformidade.",
  "ABNT NBR 16274: Sistemas fotovoltaicos conectados à rede – Requisitos mínimos para documentação, ensaios de comissionamento, inspeção e avaliação de desempenho.",
  "ABNT NBR 16690: Instalações elétricas de arranjos fotovoltaicos – Requisitos de projeto.",
  "ABNT NBR IEC 62116: Procedimento de ensaio de anti-ilhamento para inversores de sistemas fotovoltaicos conectados à rede elétrica.",
  "EQUATORIAL ENERGIA NT.020.EQTL – Conexão de micro e minigeração distribuída ao sistema de distribuição.",
  "EQUATORIAL ENERGIA NT.001.EQTL – Fornecimento de energia elétrica em baixa tensão.",
  "EQUATORIAL ENERGIA NT.030.EQTL – Padrões construtivos de caixas de medição e proteção.",
  "ANEEL – PRODIST Módulo 3: Conexão ao sistema de distribuição de energia elétrica.",
  "ANEEL – Resolução Normativa nº 1.000/2021: regras de prestação do serviço público de distribuição de energia elétrica.",
  "Lei nº 14.300/2022: marco legal da microgeração e minigeração distribuída e do sistema de compensação de energia elétrica.",
  "IEC 61727: Photovoltaic (PV) systems – Characteristics of the utility interface.",
];

const DOCS: [string, string, string, string][] = [
  ["1. Formulário de solicitação de orçamento de conexão", "SIM", "SIM", ""],
  ["2. Documento de responsabilidade técnica (ART/TRT)", "SIM", "SIM", ""],
  ["3. Diagrama unifilar do sistema de geração, carga, proteção e medição", "SIM", "SIM", ""],
  ["4. Diagrama de blocos do sistema de geração, carga e proteção", "NÃO", "SIM", "Até 10 kW, apenas o diagrama unifilar"],
  ["5. Memorial técnico descritivo", "SIM", "SIM", ""],
  ["6. Folha de dados (datasheet) dos inversores", "SIM", "SIM", ""],
  ["7. Certificado de conformidade dos inversores ou registro no INMETRO", "SIM", "SIM", "Acima de 10 kW, certificados de conformidade"],
  ["8. Lista de unidades participantes do sistema de compensação", "Ver obs.", "Ver obs.", "Autoconsumo remoto, geração compartilhada e EMUC"],
  ["9. Instrumento jurídico de solidariedade entre os integrantes", "Ver obs.", "Ver obs.", "EMUC e geração compartilhada"],
  ["10. Contrato de aluguel ou arrendamento", "Ver obs.", "Ver obs.", "Quando a UC for alugada ou arrendada"],
  ["11. Procuração", "Ver obs.", "Ver obs.", "Quando a solicitação for feita por terceiros"],
  ["12. Autorização de uso de área comum em condomínio", "Ver obs.", "Ver obs.", "Quando a central usar área comum"],
];

const PROTECTION = (vmin: number, vmax: number): [string, string, string][] => [
  ["Elemento de desconexão", "Sim, quando não usar inversor", "Não se aplica"],
  ["Elemento de interrupção (52)", "Sim", "Curva C"],
  ["Proteção de subtensão (27) e sobretensão (59)", "Sim", `${vmin} – ${vmax} V`],
  ["Proteção de subfrequência (81U) e sobrefrequência (81O)", "Sim", "57,5 – 62 Hz"],
  ["Relé de sincronismo (25)", "Sim", "± 5%"],
  ["Anti-ilhamento (78 e 81 df/dt – ROCOF)", "Sim", "0,1 – 1,20 Hz/s"],
  ["Proteção direcional de potência (32)", "Sim, quando não usar inversor", "Não se aplica"],
  ["Tempo de reconexão (62)", "Opcional, quando não usar inversor", "180 s"],
];

const TOC: [string, string, number][] = [
  ["1.", "Objetivo", 3],
  ["2.", "Referências normativas e regulatórias", 3],
  ["3.", "Documentos obrigatórios", 4],
  ["4.", "Dados da unidade consumidora", 5],
  ["5.", "Levantamento de carga e consumo", 6],
  ["6.", "Padrão de entrada", 7],
  ["7.", "Estimativa de geração", 9],
  ["8.", "Dimensionamento do gerador", 10],
  ["9.", "Dimensionamento do inversor", 11],
  ["10.", "Dimensionamento da proteção", 12],
  ["11.", "Dimensionamento dos cabos", 13],
  ["12.", "Placa de advertência", 14],
];
const TOTAL = 14;

/* ------------------------------------------------------------------ peças */

function Page({ n, children, cover }: { n: number; children: ReactNode; cover?: boolean }) {
  return (
    <div data-pdf-page className="relative overflow-hidden bg-white font-[family-name:var(--font-outfit)] antialiased" style={{ width: PDF_PAGE_W, height: PDF_PAGE_H, color: INK }}>
      {!cover && (
        <>
          <div className="absolute inset-x-[56px] top-[30px] flex items-center justify-between border-b pb-3" style={{ borderColor: LINE }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-h-color.png" alt="" className="h-[30px] w-auto" />
            <span className="text-[10.5px] font-semibold tracking-[0.16em] text-[#14201A]/55 uppercase">Memorial técnico descritivo</span>
          </div>
          <div className="absolute inset-x-[56px] bottom-[26px] flex items-center justify-between border-t pt-2.5 text-[10px] text-[#14201A]/50" style={{ borderColor: LINE }}>
            <span>Microgeração distribuída · sistema solar fotovoltaico conectado à rede</span>
            <span className="font-semibold tabular-nums">
              {n} / {TOTAL}
            </span>
          </div>
        </>
      )}
      <div className={cover ? "relative h-full" : "absolute inset-x-[56px] top-[86px] bottom-[60px] text-[12.5px] leading-[1.62]"}>{children}</div>
    </div>
  );
}

function H1({ n, children }: { n: string; children: ReactNode }) {
  return (
    <h2 className="mt-5 mb-2.5 flex items-baseline gap-2.5 text-[15.5px] font-bold tracking-[0.02em] uppercase first:mt-0" style={{ color: INK }}>
      <span style={{ color: GREEN }}>{n}</span> {children}
    </h2>
  );
}
function H2({ n, children }: { n: string; children: ReactNode }) {
  return (
    <h3 className="mt-4 mb-1.5 text-[13.5px] font-bold">
      <span style={{ color: GREEN }}>{n}</span> {children}
    </h3>
  );
}
const P = ({ children, className }: { children: ReactNode; className?: string }) => <p className={`mb-2 text-justify ${className ?? ""}`}>{children}</p>;
const Caption = ({ children }: { children: ReactNode }) => <p className="mt-1.5 mb-3 text-center text-[11px] font-semibold text-[#14201A]/60">{children}</p>;

function KV({ rows, head }: { rows: [ReactNode, ReactNode][]; head?: string }) {
  return (
    <table className="w-full border-collapse text-[12px]">
      {head && (
        <thead>
          <tr>
            <th colSpan={2} className="px-3 py-1.5 text-left text-[11px] font-bold tracking-[0.1em] text-white uppercase" style={{ background: INK }}>
              {head}
            </th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} className={i % 2 ? "bg-[#F4F7F3]" : ""}>
            <td className="w-[58%] border px-3 py-[5px]" style={{ borderColor: LINE }}>
              {k}
            </td>
            <td className="border px-3 py-[5px] font-semibold tabular-nums" style={{ borderColor: LINE }}>
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Grid({ head, rows, widths, small }: { head: string[]; rows: ReactNode[][]; widths?: string[]; small?: boolean }) {
  return (
    <table className={`w-full border-collapse ${small ? "text-[10.5px]" : "text-[11.5px]"}`}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} className="border px-2 py-1.5 text-center leading-tight font-bold text-white" style={{ background: INK, borderColor: INK, width: widths?.[i] }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i % 2 ? "bg-[#F4F7F3]" : ""}>
            {r.map((c, j) => (
              <td key={j} className={`border px-2 py-[4px] tabular-nums ${j === 0 ? "text-left" : "text-center"}`} style={{ borderColor: LINE }}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Figure({ src, h, empty }: { src?: string; h: number; empty: string }) {
  return (
    <div className="grid place-items-center overflow-hidden rounded-[10px] border bg-[#F6F8F5]" style={{ height: h, borderColor: LINE }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <p className="px-8 text-center text-[11.5px] text-[#14201A]/45">{empty}</p>
      )}
    </div>
  );
}

function WarningPlate() {
  return (
    <div className="mx-auto w-[330px]">
      <div className="flex items-center gap-2 text-[10px] text-[#14201A]/60">
        <span className="h-px flex-1 bg-[#14201A]/40" /> 25 cm <span className="h-px flex-1 bg-[#14201A]/40" />
      </div>
      <div className="mt-1 flex items-stretch gap-2">
        <div className="flex h-[236px] flex-1 flex-col items-center justify-center rounded-[22px] border-[3px] border-black bg-[#FFE600] px-5 text-center">
          <div className="w-full bg-black py-2 text-[36px] leading-none font-black tracking-[0.04em] text-[#FFE600]">CUIDADO</div>
          <p className="mt-4 text-[17px] leading-tight font-black text-black">RISCO DE CHOQUE ELÉTRICO</p>
          <p className="mt-2 text-[17px] leading-tight font-black text-black">GERAÇÃO PRÓPRIA</p>
        </div>
        <div className="flex flex-col items-center text-[10px] text-[#14201A]/60">
          <span className="w-px flex-1 bg-[#14201A]/40" />
          <span className="py-1 [writing-mode:vertical-rl]">18 cm</span>
          <span className="w-px flex-1 bg-[#14201A]/40" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ documento */

export function MemorialPages({ d, images = {}, date }: { d: ProjectData; images?: MemorialImages; date: string }) {
  const c = calc(d);
  const uf = d.client.state || "AL";
  const ufName = UF_NAME[uf] ?? uf;
  const dist = `Equatorial Energia ${ufName}`;
  const inv = c.invs[0] ?? d.inverters[0];
  const mods = c.mods.length ? c.mods : d.modules;
  const year = date.slice(-4);
  const phaseWord = d.uc.phase;
  const kwInv = f(c.inverterKw);
  const kwp = f(c.kwp);
  const title = `Microgeração distribuída utilizando um sistema solar fotovoltaico de ${kwp} kWp (${kwInv} kW de inversor) conectado à rede de baixa tensão em ${d.uc.voltage} V, caracterizado como ${d.uc.modality.toLowerCase()}.`;
  const addr = [d.client.address, d.client.district, d.client.cep, d.client.city, uf].filter((x) => String(x ?? "").trim()).join(", ");
  const doc = d.client.doc.replace(/\D/g, "");
  const docLabel = doc.length === 14 ? "CNPJ" : "CPF";
  const docFmt = doc.length === 14 ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : doc.length === 11 ? doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : d.client.doc;
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const rt = d.rt;

  return (
    <>
      {/* 1 · capa */}
      <Page n={1} cover>
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#F5F8F2 0%,#FFFFFF 46%,#EEF5EA 100%)" }} />
        <div className="absolute inset-x-0 top-0 h-[8px]" style={{ background: "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)" }} />
        <div className="relative flex h-full flex-col px-[72px] pt-[70px] pb-[64px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-h-color.png" alt="" className="h-[52px] w-auto self-start" />
          <div className="mt-[150px]">
            <p className="text-[13px] font-bold tracking-[0.3em] uppercase" style={{ color: GREEN }}>
              Projeto de microgeração distribuída
            </p>
            <h1 className="mt-3 text-[46px] leading-[1.02] font-extrabold tracking-[-0.03em]">
              Memorial Técnico
              <br />
              Descritivo<span style={{ color: "#3FBF6A" }}>.</span>
            </h1>
            <p className="mt-6 max-w-[560px] text-[15.5px] leading-relaxed text-[#14201A]/75 uppercase">{title}</p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="rounded-[16px] border bg-white px-5 py-4" style={{ borderColor: LINE }}>
              <p className="text-[10.5px] font-bold tracking-[0.18em] text-[#14201A]/50 uppercase">Titular da unidade consumidora</p>
              <p className="mt-1.5 text-[16px] leading-snug font-extrabold uppercase">{blank(d.client.name)}</p>
              <p className="mt-1 text-[12.5px] text-[#14201A]/65">
                {docLabel}: {blank(docFmt)}
                {d.client.rg ? ` · RG: ${d.client.rg}` : ""}
              </p>
              <p className="text-[12.5px] text-[#14201A]/65">Conta contrato: {blank(d.uc.account)}</p>
            </div>
            <div className="rounded-[16px] border bg-white px-5 py-4" style={{ borderColor: LINE }}>
              <p className="text-[10.5px] font-bold tracking-[0.18em] text-[#14201A]/50 uppercase">Responsável técnico</p>
              <p className="mt-1.5 text-[16px] leading-snug font-extrabold uppercase">{blank(rt.name)}</p>
              <p className="mt-1 text-[12.5px] text-[#14201A]/65 uppercase">{blank(rt.title)}</p>
              <p className="text-[12.5px] text-[#14201A]/65">Registro: {blank(rt.register)}{rt.registerUf ? ` · ${rt.registerUf}` : ""}</p>
            </div>
          </div>
          <div className="grow" />
          <div className="flex items-end justify-between border-t pt-4 text-[13px] font-semibold tracking-[0.14em] uppercase" style={{ borderColor: LINE }}>
            <span>{ufName}</span>
            <span>{year}</span>
          </div>
        </div>
      </Page>

      {/* 2 · siglas */}
      <Page n={2}>
        <H1 n="">Lista de siglas e abreviaturas</H1>
        <div className="mt-2 grid gap-y-[5px]">
          {SIGLAS.map(([k, v]) => (
            <p key={k} className="grid grid-cols-[86px_1fr] gap-3 text-[12px] leading-snug">
              <b>{k}</b>
              <span className="text-[#14201A]/80">{v}</span>
            </p>
          ))}
        </div>
      </Page>

      {/* 3 · sumário, objetivo, referências */}
      <Page n={3}>
        <H1 n="">Sumário</H1>
        <div className="mb-4 grid gap-[3px]">
          {TOC.map(([n, t, p]) => (
            <p key={n} className="flex items-baseline gap-2 text-[12px]">
              <b className="w-7" style={{ color: GREEN }}>
                {n}
              </b>
              <span>{t}</span>
              <span className="mb-[3px] flex-1 border-b border-dotted border-[#14201A]/30" />
              <span className="tabular-nums">{p}</span>
            </p>
          ))}
        </div>
        <H1 n="1.">Objetivo</H1>
        <P>
          O presente memorial técnico descritivo tem como objetivo apresentar a metodologia utilizada na elaboração e na apresentação à <b>{dist.toUpperCase()}</b> dos documentos necessários, em conformidade com a Lei nº 14.300/2022, com a Resolução
          Normativa ANEEL nº 1.000/2021, com o PRODIST Módulo 3, com a norma NT.020.EQTL e com as normas técnicas nacionais (ABNT) e internacionais (IEC), para a <b>SOLICITAÇÃO DE ORÇAMENTO DE CONEXÃO</b> de microgeração distribuída com sistema
          solar fotovoltaico de <b>{kwp} kWp</b> de módulos e <b>{kwInv} kW</b> de inversor, na unidade consumidora de titularidade de <b>{blank(d.client.name).toUpperCase()}</b>.
        </P>
        <H1 n="2.">Referências normativas e regulatórias</H1>
        <P>Para a elaboração deste memorial, na área de concessão do estado de {ufName}, foram utilizadas as normas e resoluções abaixo, nas revisões vigentes:</P>
        <ul className="ml-4 list-disc text-[11.5px] leading-[1.5]">
          {REFS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Page>

      {/* 4 · documentos obrigatórios */}
      <Page n={4}>
        <H1 n="3.">Documentos obrigatórios</H1>
        <Caption>Tabela 1 – Documentos obrigatórios para a solicitação de acesso de microgeração distribuída</Caption>
        <Grid head={["Documento", "Até 10 kW", "Acima de 10 kW", "Observações"]} widths={["46%", "11%", "12%", "31%"]} rows={DOCS.map((r) => [r[0], r[1], r[2], r[3]])} />
        <P className="mt-3 text-[11.5px]">
          <b>Nota 1:</b> para inversores até 10 kW é obrigatório o registro de concessão do INMETRO. Este projeto, com <b>{kwInv} kW</b> de potência de inversor, apresenta {c.inverterKw > 10 ? "diagrama unifilar e diagrama de blocos" : "o diagrama unifilar (e o diagrama de blocos, por organização)"}.
        </P>
      </Page>

      {/* 5 · dados da UC */}
      <Page n={5}>
        <H1 n="4.">Dados da unidade consumidora</H1>
        <KV
          rows={[
            ["Número da conta contrato", blank(d.uc.account)],
            ["Classe", d.uc.cls],
            ["Ramo de atividade", blank(d.uc.activity)],
            ["Nome do titular", blank(d.client.name).toUpperCase()],
            [docLabel, blank(docFmt)],
            ["Endereço completo", blank(addr).toUpperCase()],
            ["Poste ou transformador mais próximo", d.uc.pole.trim() || "Não identificado"],
            ["Coordenadas georreferenciadas (UTM)", d.uc.utmX || d.uc.utmY ? `${blank(d.uc.utmX)} · ${blank(d.uc.utmY)}` : "—"],
            ["Modalidade de compensação", d.uc.modality],
          ]}
        />
        {images.localizacao && (
          <div className="mt-4">
            <Figure src={images.localizacao} h={470} empty="" />
            <Caption>Figura 1 – Localização da unidade consumidora</Caption>
          </div>
        )}
      </Page>

      {/* 6 · carga e consumo */}
      <Page n={6}>
        <H1 n="5.">Levantamento de carga e consumo</H1>
        <H2 n="5.1.">Levantamento de carga</H2>
        <Caption>Tabela 2 – Levantamento de carga</Caption>
        <Grid
          small
          head={["Descrição", "P (W)", "Qtd.", "CI (kW)", "FP", "CI (kVA)", "FD", "D (kW)", "D (kVA)"]}
          widths={["26%"]}
          rows={[
            ...(c.loads.length ? c.loads.map((l) => [l.name, f0(Number(l.w) || 0), String(l.qty || 0), f(l.ci), f(Number(l.fp) || 1), f(l.kva), f(Number(l.fd) || 1), f(l.dkw), f(l.dkva)]) : [["Levantamento não informado", "—", "—", "—", "—", "—", "—", "—", "—"]]),
            [<b key="t">TOTAL</b>, "", "", <b key="a">{f(c.loadTotal.ci)}</b>, "", <b key="b">{f(c.loadTotal.kva)}</b>, "", <b key="c">{f(c.loadTotal.dkw)}</b>, <b key="d">{f(c.loadTotal.dkva)}</b>],
          ]}
        />
        <P className="mt-2 text-[11.5px]">Carga declarada da unidade consumidora: <b>{f(Number(d.uc.declaredLoadKw) || c.loadTotal.ci)} kW</b>.</P>
        <H2 n="5.2.">Consumo mensal</H2>
        <Caption>Tabela 3 – Consumo mensal dos últimos 12 meses</Caption>
        {c.consumption.length ? (
          <>
            <Grid small head={months.slice(0, d.consumption.length || 12)} rows={[d.consumption.slice(0, 12).map((v) => (Number(v) ? f0(Number(v)) : "—"))]} />
            <P className="mt-2 text-[11.5px]">
              Média de consumo: <b>{f0(c.consumptionAvg)} kWh/mês</b>. Geração estimada do sistema: <b>{f(c.monthly)} kWh/mês</b>.
            </P>
          </>
        ) : (
          <P className="text-center font-bold">SEM HISTÓRICO DE CONSUMO DOS MESES ANTERIORES.</P>
        )}
      </Page>

      {/* 7 · padrão de entrada */}
      <Page n={7}>
        <H1 n="6.">Padrão de entrada</H1>
        <H2 n="6.1.">Tipo de ligação e tensão de atendimento</H2>
        <P>
          A unidade consumidora é ligada em ramal de ligação em baixa tensão, através de um circuito <b>{phaseWord}</b> a {c.conductorsTotal}, sendo {c.conductors} de seção nominal <b>{mm2(d.entrance.phaseMm2 || c.entranceCable)} mm²</b> e um condutor neutro de seção nominal{" "}
          <b>{mm2(d.entrance.neutralMm2 || d.entrance.phaseMm2 || c.entranceCable)} mm²</b>, com tensão de atendimento em <b>{d.uc.voltage} V</b>, derivado de uma rede {d.uc.branch === "SUBTERRÂNEO" ? "subterrânea" : "aérea"} de distribuição secundária da {dist}.
        </P>
        <H2 n="6.2.">Disjuntor de entrada</H2>
        <P>No ponto de entrega/conexão é instalado um disjuntor termomagnético, em conformidade com a norma NT.001.EQTL, com as seguintes características:</P>
        <KV
          rows={[
            ["Número de polos", String(c.phases)],
            ["Tensão nominal", `${d.uc.voltage} V`],
            ["Corrente nominal (IDG)", `${d.uc.breakerA} A`],
            ["Frequência nominal", "60 Hz"],
            ["Elemento de proteção", "Termomagnético"],
            ["Capacidade mínima de interrupção", "3 kA"],
            ["Curva de atuação (disparo)", "C"],
          ]}
        />
        <H2 n="6.3.">Potência disponibilizada</H2>
        <P>A potência disponibilizada (PD) para a unidade consumidora onde será instalada a microgeração distribuída é:</P>
        <div className="rounded-[12px] border bg-[#F4F7F3] px-5 py-3.5 text-[12.5px] leading-[1.8]" style={{ borderColor: LINE }}>
          <p>
            PD [kVA] = VN × IDG × NF / 1000 = {d.uc.voltage} × {d.uc.breakerA} × {c.nf === 1 ? "1" : "1,73"} / 1000 = <b>{f(c.pdKva)} kVA</b>
          </p>
          <p>
            PD [kW] = PD [kVA] × FP = {f(c.pdKva)} × 0,92 = <b>{f(c.pdKw)} kW</b>
          </p>
          <p className="text-[11.5px] text-[#14201A]/65">
            VN = {d.uc.voltage} V · IDG = {d.uc.breakerA} A · NF = {c.nf === 1 ? "1" : "√3"} · FP = 0,92
          </p>
        </div>
        <P className="mt-3 text-[11.5px]">
          <b>Nota 2:</b> a potência de geração deve ser menor ou igual à potência disponibilizada. Potência de geração deste projeto: <b>{f(c.pg)} kW</b> {c.pgOk ? "≤" : ">"} PD <b>{f(c.pdKw)} kW</b> — {c.pgOk ? "atende." : "NÃO atende: revisar."}
        </P>
      </Page>

      {/* 8 · caixa e ramal */}
      <Page n={8}>
        <H2 n="6.4.">Caixa de medição</H2>
        <P>
          A caixa de medição {d.entrance.meterBox}, com dimensões de {d.entrance.meterBoxDims} (comprimento, altura e largura), está instalada {d.entrance.meterBoxPlace}, no ponto de entrega caracterizado como o limite da via pública com a
          propriedade, atendendo aos requisitos de localização, facilidade de acesso e leiaute, em conformidade com as normas da concessionária.
        </P>
        {images.caixa && (
          <>
            <Figure src={images.caixa} h={520} empty="" />
            <Caption>Figura 2 – Caixa de medição ou local de instalação da futura caixa de medição</Caption>
          </>
        )}
        <P>
          O aterramento da caixa de medição é feito com 1 haste de aterramento de 2.400 mm de comprimento e diâmetro de 5/8&quot;, condutor de <b>{mm2(d.entrance.groundMm2 || 10)} mm²</b> e conexão por conector tipo grampo com parafuso tipo “U”.
        </P>
        <H2 n="6.5.">Ramal de entrada</H2>
        <P>
          O ramal de entrada da unidade consumidora é formado por um circuito {phaseWord} a {c.conductorsTotal}, sendo {c.conductors} de seção nominal <b>{mm2(d.entrance.phaseMm2 || c.entranceCable)} mm²</b> e um condutor neutro de{" "}
          <b>{mm2(d.entrance.neutralMm2 || d.entrance.phaseMm2 || c.entranceCable)} mm²</b>, em {d.uc.voltage} V.
        </P>
      </Page>

      {/* 9 · geração */}
      <Page n={9}>
        <H1 n="7.">Estimativa de geração</H1>
        <P>
          Com base no banco de dados SunData do Centro de Referência para Energia Solar e Eólica Sérgio de S. Brito (CRESESB)
          {d.generation.source && !/cresesb|sundata/i.test(d.generation.source) ? `, conforme ${d.generation.source},` : ","} foi adotada a irradiação solar diária média mensal de <b>{f(d.generation.hsp)} kWh/m².dia</b> para o local
          mais próximo da instalação com dados disponíveis.
        </P>
        {images.cresesb && (
          <>
            <Figure src={images.cresesb} h={300} empty="" />
            <Caption>Figura 3 – Irradiação solar no plano horizontal (CRESESB)</Caption>
          </>
        )}
        <div className="grid grid-cols-[1fr_1.15fr] gap-4">
          <div>
            <Grid
              small
              head={["Estudo de performance ratio", "Valor"]}
              rows={[["Temperatura máxima média (°C)", String(d.generation.tempMax)], ["Inicial", "100%"], ...LOSSES.map(([k, v]) => [k, v]), [<b key="pr">Performance ratio</b>, <b key="v">{f0(d.generation.pr * 100)}%</b>]]}
            />
          </div>
          <div className="rounded-[12px] border bg-[#F4F7F3] px-4 py-3 text-[12px] leading-[1.75]" style={{ borderColor: LINE }}>
            <p className="font-bold">Energia gerada</p>
            <p>Ps = potência dos módulos = {kwp} kWp</p>
            <p>Rsol = irradiação = {f(d.generation.hsp)} kWh/m².dia</p>
            <p>PR = performance ratio = {f0(d.generation.pr * 100)}%</p>
            <p className="mt-2">E = Ps × Rsol × 30 dias × PR</p>
            <p>
              E = ({kwp} × {f(d.generation.hsp)} × 30) × {f0(d.generation.pr * 100)}%
            </p>
            <p>
              E = {f(c.monthlyRaw)} × {f0(d.generation.pr * 100)}%
            </p>
            <p className="mt-2 text-[15px] font-extrabold" style={{ color: GREEN }}>
              E = {f(c.monthly)} kWh/mês
            </p>
            <p className="text-[11.5px] text-[#14201A]/60">≈ {f0(c.yearly)} kWh/ano</p>
          </div>
        </div>
      </Page>

      {/* 10 · gerador */}
      <Page n={10}>
        <H1 n="8.">Dimensionamento do gerador</H1>
        <P>
          O sistema foi dimensionado considerando as características de instalação e climatológicas do local: <b>{kwInv} kW</b> de inversor e <b>{kwp} kWp</b> de módulos ({c.moduleQty} módulos, área total de {f(c.area)} m², relação CC/CA de{" "}
          {f(c.dcAcRatio)}).
        </P>
        <H2 n="8.1.">Características dos módulos</H2>
        <P>Parâmetros nas condições padrão de teste (STC): irradiância de 1.000 W/m², temperatura de célula de 25 °C e AM 1,5.</P>
        <Caption>Tabela 4 – Características técnicas do gerador</Caption>
        {mods.map((m, i) => {
          const area = Number(m.lengthM) > 0 && Number(m.widthM) > 0 ? Number(m.lengthM) * Number(m.widthM) : 0;
          return (
            <div key={i} className="mb-3">
              <KV
                head={mods.length > 1 ? `Módulo ${i + 1}` : undefined}
                rows={[
                  ["Fabricante", blank(m.brand)],
                  ["Modelo", blank(m.model)],
                  ["Potência nominal – Pn [W]", f0(Number(m.powerW) || 0)],
                  ["Tensão de circuito aberto – Voc [V]", blank(m.voc)],
                  ["Corrente de curto-circuito – Isc [A]", blank(m.isc)],
                  ["Tensão de máxima potência – Vmp [V]", blank(m.vmp)],
                  ["Corrente de máxima potência – Imp [A]", blank(m.imp)],
                  ["Eficiência [%]", blank(m.efficiency)],
                  ["Dimensões (comprimento × largura) [m]", area ? `${f(Number(m.lengthM), 3)} × ${f(Number(m.widthM), 3)}` : "—"],
                  ["Área do módulo [m²]", area ? f(area) : "—"],
                  ["Peso [kg]", blank(m.weightKg)],
                  ["Quantidade", String(m.qty || 0)],
                  ["Potência do gerador [kWp]", f(((Number(m.qty) || 0) * (Number(m.powerW) || 0)) / 1000)],
                ]}
              />
            </div>
          );
        })}
      </Page>

      {/* 11 · inversor */}
      <Page n={11}>
        <H1 n="9.">Dimensionamento do inversor</H1>
        <P>
          Para este sistema será{c.inverterQty > 1 ? "ão" : ""} utilizado{c.inverterQty > 1 ? "s" : ""} <b>{c.inverterQty || 1}</b> inversor{c.inverterQty > 1 ? "es" : ""} interativo{c.inverterQty > 1 ? "s" : ""} do fabricante <b>{blank(inv?.brand)}</b>, instalado
          {c.inverterQty > 1 ? "s" : ""} em área técnica abrigada, dentro da residência/estabelecimento.
        </P>
        <Caption>Tabela 5 – Características técnicas do inversor</Caption>
        {inv && (
          <KV
            rows={[
              ["Fabricante", blank(inv.brand)],
              ["Modelo", blank(inv.model)],
              ["Quantidade", String(inv.qty || 1)],
              [<b key="e">Entrada (CC)</b>, ""],
              ["Máxima potência na entrada CC [kW]", blank(inv.maxDcKw)],
              ["Máxima tensão CC [V]", blank(inv.maxDcV)],
              ["Máxima corrente CC [A]", blank(inv.maxDcA)],
              ["Máxima tensão MPPT [V]", blank(inv.mpptMaxV)],
              ["Mínima tensão MPPT [V]", blank(inv.mpptMinV)],
              ["Tensão CC de partida [V]", blank(inv.startV)],
              ["Quantidade de strings", blank(inv.strings)],
              ["Quantidade de entradas MPPT", blank(inv.mppts)],
              [<b key="s">Saída (CA)</b>, ""],
              ["Potência nominal CA [kW]", f(Number(inv.powerKw) || 0)],
              ["Máxima potência na saída CA [kW]", blank(inv.acMaxKw)],
              ["Máxima corrente na saída CA [A]", f(Number(inv.acA) || 0, 1)],
              ["Tensão nominal CA [V]", blank(inv.acV)],
              ["Frequência nominal [Hz]", "60"],
              ["Faixa de tensão CA [V]", inv.acMinV || inv.acMaxV ? `${blank(inv.acMinV)} – ${blank(inv.acMaxV)}` : blank(inv.voltageRange)],
              ["THD de corrente [%]", blank(inv.thd)],
              ["Fator de potência", blank(inv.pf)],
              ["Tipo de conexão", `${inv.phases} F + N + PE`],
              ["Eficiência máxima [%]", inv.efficiency ? f(Number(inv.efficiency), 1) : "—"],
            ]}
          />
        )}
      </Page>

      {/* 12 · proteção */}
      <Page n={12}>
        <H1 n="10.">Dimensionamento da proteção</H1>
        <P>Para a proteção contra curto-circuito, desconexão, seccionamento e interrupção do sistema foram consideradas as correntes contínua e alternada.</P>
        <H2 n="10.1.">Fusíveis</H2>
        <P>{d.protection.fuses}</P>
        <H2 n="10.2.">Chave de seccionamento CC</H2>
        <P>Para a desconexão do sistema está prevista uma chave de seccionamento de {d.protection.dcSwitch}.</P>
        <H2 n="10.3.">Disjuntores</H2>
        <P>
          Os disjuntores termomagnéticos foram dimensionados de acordo com a seção dos cabos, de modo a evitar danos à sua isolação, e possuem certificação do INMETRO. Para proteção contra curto-circuito, desconexão e interrupção no lado CA, será
          instalado {c.inverterQty > 1 ? `1 disjuntor de ${c.acBreaker} A para a saída de cada inversor` : `1 disjuntor de ${c.acBreaker} A para a saída do inversor`} (conforme diagrama unifilar), com capacidade de interrupção simétrica mínima de 3 kA em{" "}
          {d.uc.voltage} Vca, localizado no QGBT:
        </P>
        <KV
          rows={[
            ["Número de polos", String(c.acPoles)],
            ["Tensão nominal CA", `${d.uc.voltage} V`],
            ["Corrente nominal", `${c.acBreaker} A`],
            ["Frequência", "60 Hz"],
            ["Capacidade mínima de interrupção", "3 kA"],
            ["Curva de atuação", d.protection.curve || "C"],
          ]}
        />
        <H2 n="10.4.">DPS</H2>
        <P>Os dispositivos de proteção contra surtos protegem o sistema de geração contra surtos e descargas atmosféricas.</P>
        <KV
          rows={[
            ["DPS de corrente contínua", "Internos ao inversor, conforme datasheet"],
            ["DPS de corrente alternada · classe", d.protection.dpsClass],
            ["DPS de corrente alternada · tensão", d.protection.dpsV],
            ["DPS de corrente alternada · corrente nominal", d.protection.dpsIn],
            ["DPS de corrente alternada · corrente máxima", d.protection.dpsMax],
          ]}
        />
      </Page>

      {/* 13 · aterramento, requisitos, cabos */}
      <Page n={13}>
        <H2 n="10.5.">Aterramento</H2>
        <P>
          O inversor será aterrado por cabo de cobre de <b>{mm2(c.groundInverter)} mm²</b> PVC 0,75 kV e os módulos por cabo de <b>{mm2(d.protection.groundModuleMm2 || 4)} mm²</b> XLPE 1,5 kV, ligados ao aterramento da instalação, composto por{" "}
          {d.protection.rods} haste{d.protection.rods > 1 ? "s" : ""} de 5/8&quot; com 2,4 m de comprimento, cravada{d.protection.rods > 1 ? "s" : ""} no solo de modo que a resistência de terra não ultrapasse 10 Ω. Não se atingindo esse valor, serão
          adotadas alternativas como o aumento do número de hastes ou o tratamento do solo.
        </P>
        <H2 n="10.6.">Requisitos de proteção</H2>
        <Caption>Tabela 6 – Requisitos de proteção (PRODIST Módulo 3 e NT.020)</Caption>
        <Grid head={["Requisito de proteção", "Obrigatório", "Ajuste"]} widths={["52%", "26%", "22%"]} rows={PROTECTION(c.protMin, c.protMax)} />
        <P className="mt-2 text-[11.5px]">As funções de proteção são integradas ao inversor, certificado conforme ABNT NBR 16149, NBR 16150 e NBR IEC 62116.</P>
        <H1 n="11.">Dimensionamento dos cabos</H1>
        <P>
          Serão utilizados condutores de <b>{mm2(d.cables.dcMm2 || 4)} mm²</b> XLPE 1,5 kVcc (cabo fotovoltaico) no lado CC e cabos de <b>{mm2(c.acCable)} mm²</b> PVC 0,75 kV no lado CA do sistema de geração (conforme diagrama unifilar), ligados ao
          barramento do QGBT.
        </P>
        <P>Foram considerados no dimensionamento: capacidade de condução de corrente, temperatura, agrupamento, método de instalação e queda de tensão, de acordo com a ABNT NBR 5410.</P>
      </Page>

      {/* 14 · placa e assinatura */}
      <Page n={14}>
        <H1 n="12.">Placa de advertência</H1>
        <P>Será utilizada uma placa de sinalização, parafusada à parede próxima ao medidor, conforme as normas da concessionária, para a identificação da central geradora:</P>
        <ul className="mb-4 ml-4 list-disc text-[12px] leading-[1.6]">
          <li>Espessura: 2 mm;</li>
          <li>Material: policarbonato com aditivos anti-UV;</li>
          <li>Gravação: letras em Arial Black;</li>
          <li>Acabamento: cor amarela, obtida por masterização a 2%, com opacidade que permita a visualização das marcações.</li>
        </ul>
        <WarningPlate />
        <Caption>Figura 4 – Placa de advertência</Caption>
        <div className="absolute inset-x-0 bottom-0">
          <p className="text-center text-[12.5px]">
            {d.client.city || "Maceió"}/{uf}, {date}.
          </p>
          <div className="mx-auto mt-2 w-[360px] text-center">
            <div className="grid h-[86px] place-items-end justify-center">
              {images.assinatura && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images.assinatura} alt="" className="max-h-[86px] w-auto object-contain" />
              )}
            </div>
            <div className="border-t pt-1.5" style={{ borderColor: INK }}>
              <p className="text-[13px] font-bold uppercase">{blank(rt.name)}</p>
              <p className="text-[11.5px] text-[#14201A]/65 uppercase">
                {blank(rt.title)} · Registro {blank(rt.register)}
                {rt.registerUf ? `/${rt.registerUf}` : ""}
              </p>
              <p className="text-[11px] text-[#14201A]/55">Responsável técnico</p>
            </div>
          </div>
        </div>
      </Page>
    </>
  );
}
