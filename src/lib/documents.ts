import { dateBr, dateInWords, digits, endOfTerm, formatCep, formatDoc, moneyFull, numberInWords } from "./br.ts";

const nw = (n: number) => `${n} (${numberInWords(n)})`;

/* ---------------------------------------------------------------- tipos */

export type DocKind = "procuracao" | "aluguel";
export type DocStatus = "rascunho" | "enviado" | "assinado" | "cancelado";

export interface Party {
  kind: "pf" | "pj";
  name: string;
  /** CPF (pessoa física) ou CNPJ (empresa). */
  doc: string;
  rg: string;
  nationality: string;
  marital: string;
  profession: string;
  /** Representante legal quando for empresa. */
  repName: string;
  repDoc: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  email: string;
  phone: string;
}

export interface Grantee {
  name: string;
  doc: string;
  address: string;
  city: string;
  state: string;
  /** Responsável técnico que também representa o cliente. */
  techName: string;
  techRegistry: string;
}

export interface ProcuracaoData {
  grantor: Party;
  grantee: Grantee;
  utility: string;
  /** Unidade consumidora (conta contrato) e endereço da instalação. */
  uc: string;
  ucAddress: string;
  powers: PowerKey[];
  extraPowers: string;
  substabelecer: boolean;
  validityMonths: number;
  place: string;
  date: string;
}

export type Purpose = "residencial" | "comercial" | "usina";
export type Guarantee = "nenhuma" | "caucao" | "fiador" | "seguro";

export interface AluguelData {
  landlord: Party;
  tenant: Party;
  guarantor: Party;
  property: { address: string; city: string; state: string; cep: string; description: string; purpose: Purpose };
  rent: number;
  dueDay: number;
  payment: string;
  startDate: string;
  months: number;
  index: "IGP-M" | "IPCA" | "INPC";
  guarantee: Guarantee;
  depositMonths: number;
  lateFee: number;
  penaltyMonths: number;
  chargesByTenant: boolean;
  extraClauses: string;
  witnesses: { name: string; doc: string }[];
  place: string;
  date: string;
}

export type DocData = ProcuracaoData | AluguelData;

export interface SignerInfo {
  role: string;
  name: string;
  signed_at?: string | null;
  signed_name?: string | null;
  signed_cpf?: string | null;
  signature?: string | null;
  ip?: string | null;
  content_hash?: string | null;
}

/* ------------------------------------------------------------- padrões */

export const emptyParty = (p: Partial<Party> = {}): Party => ({
  kind: "pf",
  name: "",
  doc: "",
  rg: "",
  nationality: "brasileiro(a)",
  marital: "",
  profession: "",
  repName: "",
  repDoc: "",
  address: "",
  city: "",
  state: "AL",
  cep: "",
  email: "",
  phone: "",
  ...p,
});

export const POWERS = [
  {
    key: "acesso",
    label: "Projeto de energia solar (acesso e conexão)",
    text: "solicitar orçamento de conexão e parecer de acesso, protocolar e acompanhar projetos de micro e minigeração distribuída, nos termos da Lei nº 14.300/2022 e da Resolução Normativa ANEEL nº 1.000/2021",
  },
  { key: "documentos", label: "Assinar formulários e requerimentos", text: "assinar formulários, requerimentos, termos, memoriais descritivos e demais documentos exigidos pela distribuidora" },
  { key: "vistoria", label: "Vistoria e troca do medidor", text: "solicitar e acompanhar vistorias, a substituição do medidor por medidor bidirecional e a ligação do sistema à rede" },
  { key: "carga", label: "Aumento de carga e padrão de entrada", text: "solicitar aumento de carga, alteração do padrão de entrada, do tipo de ligação ou do grupo tarifário" },
  { key: "titularidade", label: "Troca de titularidade", text: "solicitar a alteração de titularidade da unidade consumidora" },
  {
    key: "rateio",
    label: "Rateio de créditos (beneficiárias)",
    text: "cadastrar, alterar e excluir unidades beneficiárias e percentuais de rateio dos créditos de energia, inclusive em autoconsumo remoto e geração compartilhada",
  },
  { key: "informacoes", label: "Consultas, faturas e protocolos", text: "obter informações, histórico de consumo, segundas vias de faturas e protocolos, e acompanhar processos em andamento" },
  { key: "recursos", label: "Reclamações e recursos", text: "apresentar reclamações, recursos e manifestações perante a distribuidora, sua ouvidoria e a ANEEL" },
] as const;
export type PowerKey = (typeof POWERS)[number]["key"];

export const DEFAULT_UTILITY = "Equatorial Alagoas Distribuidora de Energia S.A. (Equatorial Energia Alagoas)";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function defaultProcuracao(grantee: Partial<Grantee>, grantor: Partial<Party> = {}, place = "Maceió/AL"): ProcuracaoData {
  return {
    grantor: emptyParty(grantor),
    grantee: { name: "", doc: "", address: "", city: "", state: "AL", techName: "", techRegistry: "", ...grantee },
    utility: DEFAULT_UTILITY,
    uc: "",
    ucAddress: [grantor.address, grantor.city && `${grantor.city}/${grantor.state || "AL"}`].filter(Boolean).join(", "),
    powers: ["acesso", "documentos", "vistoria", "carga", "informacoes"],
    extraPowers: "",
    substabelecer: false,
    validityMonths: 12,
    place,
    date: today(),
  };
}

export function defaultAluguel(tenant: Partial<Party> = {}, place = "Maceió/AL"): AluguelData {
  return {
    landlord: emptyParty(),
    tenant: emptyParty(tenant),
    guarantor: emptyParty(),
    property: { address: "", city: "Maceió", state: "AL", cep: "", description: "", purpose: "residencial" },
    rent: 0,
    dueDay: 10,
    payment: "",
    startDate: today(),
    months: 30,
    index: "IGP-M",
    guarantee: "caucao",
    depositMonths: 3,
    lateFee: 10,
    penaltyMonths: 3,
    chargesByTenant: true,
    extraClauses: "",
    witnesses: [
      { name: "", doc: "" },
      { name: "", doc: "" },
    ],
    place,
    date: today(),
  };
}

/* ---------------------------------------------------------- assinantes */

export interface SignerSpec {
  role: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export const ROLE_LABEL: Record<string, string> = {
  outorgante: "Outorgante",
  locador: "Locador(a)",
  locatario: "Locatário(a)",
  fiador: "Fiador(a)",
  testemunha1: "Testemunha 1",
  testemunha2: "Testemunha 2",
};

const signerOf = (role: string, p: Party): SignerSpec => ({
  role,
  name: (p.kind === "pj" && p.repName ? `${p.repName} (${p.name})` : p.name).trim(),
  email: p.email.trim(),
  phone: p.phone.trim(),
  cpf: p.kind === "pj" ? p.repDoc : p.doc,
});

/** Quem precisa assinar o documento. */
export function signersFor(kind: DocKind, data: DocData): SignerSpec[] {
  if (kind === "procuracao") {
    const d = data as ProcuracaoData;
    return [signerOf("outorgante", d.grantor)].filter((s) => s.name);
  }
  const d = data as AluguelData;
  const list = [signerOf("locador", d.landlord), signerOf("locatario", d.tenant)];
  if (d.guarantee === "fiador") list.push(signerOf("fiador", d.guarantor));
  d.witnesses.forEach((w, i) => w.name.trim() && list.push({ role: `testemunha${i + 1}`, name: w.name.trim(), email: "", phone: "", cpf: w.doc }));
  return list.filter((s) => s.name);
}

/* ------------------------------------------------------------- texto */

export type Block = { t: "title" | "sub" | "h" | "p" | "li" | "place"; text: string };

const blank = (v: string | null | undefined, size = 18) => (v && v.trim() ? v.trim() : "_".repeat(size));

function addressOf(p: { address: string; city: string; state: string; cep: string }) {
  const parts = [p.address.trim(), p.city.trim() && `${p.city.trim()}/${p.state || "AL"}`, digits(p.cep) && `CEP ${formatCep(p.cep)}`].filter(Boolean);
  return parts.length ? parts.join(", ") : blank("", 30);
}

/** Qualificação completa de uma parte (pessoa física ou empresa). */
export function qualify(p: Party) {
  if (p.kind === "pj") {
    const rep = p.repName.trim() ? `, neste ato representada por ${p.repName.trim()}, inscrito(a) no CPF sob o nº ${blank(formatDoc(p.repDoc), 14)}` : "";
    return `${blank(p.name, 30).toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${blank(formatDoc(p.doc), 18)}, com sede em ${addressOf(p)}${rep}`;
  }
  const bits = [
    blank(p.name, 30).toUpperCase(),
    p.nationality.trim() || null,
    p.marital.trim() || null,
    p.profession.trim() || null,
    p.rg.trim() ? `portador(a) do RG nº ${p.rg.trim()}` : null,
    `inscrito(a) no CPF sob o nº ${blank(formatDoc(p.doc), 14)}`,
    `residente e domiciliado(a) em ${addressOf(p)}`,
  ].filter(Boolean);
  return bits.join(", ");
}

const ESIGN =
  "As partes reconhecem a validade da assinatura eletrônica deste instrumento, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020, sendo registrados data, hora, endereço IP e código de verificação (hash) de cada assinatura.";

export function procuracaoBlocks(d: ProcuracaoData): Block[] {
  const g = d.grantee;
  const grantee = `${blank(g.name, 30).toUpperCase()}${digits(g.doc) ? `, inscrita no ${digits(g.doc).length > 11 ? "CNPJ" : "CPF"} sob o nº ${formatDoc(g.doc)}` : ""}${
    g.address.trim() || g.city.trim() ? `, com endereço em ${addressOf({ ...g, cep: "" })}` : ""
  }`;
  const tech = g.techName.trim() ? `, bem como seu(sua) responsável técnico(a) ${g.techName.trim().toUpperCase()}${g.techRegistry.trim() ? `, registro profissional nº ${g.techRegistry.trim()}` : ""}` : "";
  const chosen: string[] = POWERS.filter((p) => d.powers.includes(p.key)).map((p) => p.text);
  if (d.extraPowers.trim()) chosen.push(d.extraPowers.trim().replace(/[.;]+$/, ""));
  const blocks: Block[] = [
    { t: "title", text: "Procuração" },
    { t: "sub", text: "Instrumento particular de mandato" },
    { t: "h", text: "Outorgante" },
    { t: "p", text: `${qualify(d.grantor)}.` },
    { t: "h", text: "Outorgado(s)" },
    { t: "p", text: `${grantee}${tech}.` },
    { t: "h", text: "Poderes" },
    {
      t: "p",
      text: `Pelo presente instrumento particular, o(a) OUTORGANTE nomeia e constitui seu(s) bastante(s) procurador(es) o(s) OUTORGADO(S) acima qualificado(s), a quem confere poderes específicos para representá-lo(a) perante a ${blank(d.utility, 30)}, em relação à unidade consumidora nº ${blank(d.uc, 14)}, localizada em ${blank(d.ucAddress, 30)}, podendo, para tanto:`,
    },
    ...chosen.map((text, i) => ({ t: "li" as const, text: `${String.fromCharCode(97 + i)}) ${text};` })),
    {
      t: "p",
      text: `podendo, ainda, praticar todos os demais atos necessários ao fiel cumprimento deste mandato, ${d.substabelecer ? "com" : "vedado o"} ${d.substabelecer ? "poderes para substabelecer, no todo ou em parte" : "substabelecimento"}.`,
    },
    { t: "h", text: "Validade" },
    {
      t: "p",
      text: `Esta procuração é válida por ${d.validityMonths > 0 ? `${nw(d.validityMonths)} ${d.validityMonths === 1 ? "mês" : "meses"}` : "prazo indeterminado"} a contar da data de sua assinatura, podendo ser revogada a qualquer tempo pelo(a) OUTORGANTE.`,
    },
    { t: "p", text: ESIGN },
    { t: "place", text: `${blank(d.place, 16)}, ${dateInWords(d.date)}.` },
  ];
  return blocks;
}

const PURPOSE_TEXT: Record<Purpose, string> = {
  residencial: "fins exclusivamente residenciais, para moradia do(a) LOCATÁRIO(A) e de sua família",
  comercial: "fins exclusivamente comerciais, para o exercício das atividades do(a) LOCATÁRIO(A)",
  usina: "a instalação e operação de sistema de geração de energia solar fotovoltaica (usina)",
};

export function aluguelBlocks(d: AluguelData): Block[] {
  const end = d.startDate ? endOfTerm(d.startDate, d.months) : "";
  const pr = d.property;
  const by = d.chargesByTenant ? "do(a) LOCATÁRIO(A)" : "do(a) LOCADOR(A)";
  const clauses: [string, string[]][] = [
    [
      "Do objeto",
      [
        `O(A) LOCADOR(A) dá em locação ao(à) LOCATÁRIO(A) o imóvel situado em ${addressOf(pr)}${pr.description.trim() ? `, assim descrito: ${pr.description.trim().replace(/\.$/, "")}` : ""}, destinado a ${PURPOSE_TEXT[pr.purpose]}, sendo vedada a alteração da destinação sem autorização por escrito do(a) LOCADOR(A).`,
      ],
    ],
    [
      "Do prazo",
      [
        `A locação terá prazo de ${nw(d.months)} ${d.months === 1 ? "mês" : "meses"}, com início em ${dateBr(d.startDate)} e término em ${dateBr(end)}, data em que o imóvel deverá ser restituído livre e desocupado, salvo prorrogação nos termos da Lei nº 8.245/1991.`,
      ],
    ],
    [
      "Do aluguel e do pagamento",
      [
        `O aluguel mensal é de ${moneyFull(d.rent)}, com vencimento todo dia ${d.dueDay} de cada mês${d.payment.trim() ? `, pago por meio de ${d.payment.trim().replace(/\.$/, "")}` : ""}.`,
        `O atraso no pagamento sujeitará o(a) LOCATÁRIO(A) à multa de ${d.lateFee}% (${numberInWords(d.lateFee)} por cento) sobre o valor devido, acrescida de juros de mora de 1% (um por cento) ao mês e correção monetária.`,
      ],
    ],
    [
      "Do reajuste",
      [`O aluguel será reajustado anualmente, na data de aniversário do contrato, pela variação acumulada do ${d.index} nos últimos 12 meses ou, na sua falta, pelo índice oficial que o substituir.`],
    ],
    [
      "Dos encargos",
      [`São de responsabilidade ${by} o pagamento do IPTU, da taxa de condomínio (se houver) e das contas de energia elétrica, água e gás do imóvel durante a locação.`],
    ],
    [
      "Da conservação e das benfeitorias",
      [
        "O(A) LOCATÁRIO(A) declara receber o imóvel em perfeitas condições de uso, obrigando-se a conservá-lo e a devolvê-lo no mesmo estado, ressalvado o desgaste natural pelo uso normal (art. 23, III, da Lei nº 8.245/1991).",
        "Quaisquer benfeitorias ou modificações dependerão de autorização prévia e por escrito do(a) LOCADOR(A), e as necessárias e úteis autorizadas serão indenizáveis nos termos da lei.",
      ],
    ],
    ["Da cessão e da sublocação", ["É vedado ao(à) LOCATÁRIO(A) ceder, emprestar ou sublocar o imóvel, no todo ou em parte, sem o consentimento prévio e por escrito do(a) LOCADOR(A) (art. 13 da Lei nº 8.245/1991)."]],
  ];

  if (pr.purpose === "usina")
    clauses.push([
      "Da usina solar",
      [
        "O(A) LOCADOR(A) autoriza a instalação de módulos fotovoltaicos, inversores, estruturas, cabeamento e demais equipamentos necessários, bem como o livre acesso da equipe técnica do(a) LOCATÁRIO(A) para instalação, operação, limpeza e manutenção.",
        "Todos os equipamentos instalados pertencem ao(à) LOCATÁRIO(A) e poderão ser retirados ao término da locação, devendo o imóvel ser restituído no estado em que foi recebido.",
      ],
    ]);

  const guarantee: Record<Guarantee, string | null> = {
    nenhuma: null,
    caucao: `Em garantia do fiel cumprimento deste contrato, o(a) LOCATÁRIO(A) entrega ao(à) LOCADOR(A), a título de caução, o valor de ${moneyFull(d.rent * d.depositMonths)}, correspondente a ${d.depositMonths} ${d.depositMonths === 1 ? "aluguel" : "aluguéis"}, que será devolvido ao final da locação, descontados eventuais débitos (art. 38, § 2º, da Lei nº 8.245/1991).`,
    fiador: `Assina também este contrato, como FIADOR(A) e principal pagador(a), ${qualify(d.guarantor)}, que responde solidariamente por todas as obrigações do(a) LOCATÁRIO(A) até a efetiva entrega das chaves, renunciando ao benefício de ordem previsto no art. 827 do Código Civil.`,
    seguro: "Em garantia deste contrato, o(a) LOCATÁRIO(A) contratará seguro de fiança locatícia, mantendo-o vigente durante toda a locação, com o(a) LOCADOR(A) como beneficiário(a).",
  };
  if (guarantee[d.guarantee]) clauses.push(["Da garantia", [guarantee[d.guarantee]!]]);

  clauses.push([
    "Da rescisão",
    [
      `A parte que infringir qualquer cláusula deste contrato pagará à outra multa equivalente a ${nw(d.penaltyMonths)} ${d.penaltyMonths === 1 ? "aluguel vigente" : "aluguéis vigentes"}. Em caso de devolução antecipada do imóvel pelo(a) LOCATÁRIO(A), a multa será proporcional ao período restante do contrato (art. 4º da Lei nº 8.245/1991).`,
    ],
  ]);
  if (d.extraClauses.trim()) clauses.push(["Disposições especiais", d.extraClauses.trim().split(/\n+/)]);
  clauses.push([
    "Do foro",
    [
      `Fica eleito o foro da comarca de ${blank(pr.city, 14)}/${pr.state || "AL"} para dirimir quaisquer questões oriundas deste contrato.`,
      ESIGN,
    ],
  ]);

  const blocks: Block[] = [
    { t: "title", text: "Contrato de locação" },
    { t: "sub", text: pr.purpose === "comercial" ? "Imóvel comercial" : pr.purpose === "usina" ? "Área para usina solar" : "Imóvel residencial" },
    { t: "h", text: "Locador(a)" },
    { t: "p", text: `${qualify(d.landlord)}.` },
    { t: "h", text: "Locatário(a)" },
    { t: "p", text: `${qualify(d.tenant)}.` },
    { t: "p", text: "As partes acima identificadas têm entre si justo e contratado o presente contrato de locação, que se regerá pelas cláusulas seguintes e pela Lei nº 8.245/1991." },
  ];
  clauses.forEach(([title, paragraphs], i) => {
    blocks.push({ t: "h", text: `Cláusula ${i + 1}ª — ${title}` });
    paragraphs.forEach((text) => blocks.push({ t: "p", text }));
  });
  blocks.push({ t: "place", text: `${blank(d.place, 16)}, ${dateInWords(d.date)}.` });
  return blocks;
}

export function documentBlocks(kind: DocKind, data: DocData) {
  return kind === "procuracao" ? procuracaoBlocks(data as ProcuracaoData) : aluguelBlocks(data as AluguelData);
}

export function documentTitle(kind: DocKind, data: DocData) {
  if (kind === "procuracao") {
    const d = data as ProcuracaoData;
    return `Procuração — ${d.grantor.name.trim() || "novo cliente"}`;
  }
  const d = data as AluguelData;
  return `Locação — ${d.tenant.name.trim() || "locatário"}${d.property.address.trim() ? ` · ${d.property.address.trim().split(",")[0]}` : ""}`;
}

/** Campos que faltam para o documento poder ser enviado. */
export function missingFields(kind: DocKind, data: DocData): string[] {
  const miss: string[] = [];
  const party = (p: Party, label: string) => {
    if (!p.name.trim()) miss.push(`Nome do(a) ${label}`);
    if (!digits(p.doc)) miss.push(`${p.kind === "pj" ? "CNPJ" : "CPF"} do(a) ${label}`);
  };
  if (kind === "procuracao") {
    const d = data as ProcuracaoData;
    party(d.grantor, "outorgante");
    if (!d.grantee.name.trim()) miss.push("Nome do outorgado (sua empresa)");
    if (!d.uc.trim()) miss.push("Número da unidade consumidora");
    if (!d.powers.length && !d.extraPowers.trim()) miss.push("Pelo menos um poder");
  } else {
    const d = data as AluguelData;
    party(d.landlord, "locador");
    party(d.tenant, "locatário");
    if (d.guarantee === "fiador") party(d.guarantor, "fiador");
    if (!d.property.address.trim()) miss.push("Endereço do imóvel");
    if (!(d.rent > 0)) miss.push("Valor do aluguel");
  }
  return miss;
}

export const DOC_KINDS: Record<DocKind, { label: string; plural: string; short: string }> = {
  procuracao: { label: "Procuração", plural: "Procurações", short: "Procuração" },
  aluguel: { label: "Contrato de aluguel", plural: "Contratos de aluguel", short: "Aluguel" },
};

export const DOC_STATUS: Record<DocStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-ink-100 text-ink-600 ring-ink-500/15" },
  enviado: { label: "Aguardando assinatura", cls: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  assinado: { label: "Assinado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  cancelado: { label: "Cancelado", cls: "bg-rose-50 text-rose-700 ring-rose-600/15" },
};
