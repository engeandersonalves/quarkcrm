import { dateBr, dateInWords, digits, endOfTerm, formatCep, formatDoc, moneyFull, numberInWords } from "./br.ts";

const nw = (n: number) => `${n} (${numberInWords(n)})`;

/* ---------------------------------------------------------------- tipos */

export type DocKind = "procuracao" | "aluguel" | "contrato";
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

/* ------------------------------------------- contrato de energia solar */

export type EquipKind = "modulo" | "inversor" | "microinversor" | "bateria" | "outro";

export interface Equipment {
  id: string;
  kind: EquipKind;
  qty: number;
  /** W para módulos; kW para inversores e microinversores; kWh para baterias. */
  power: number;
  brand: string;
  model: string;
  /** Descrição livre (usada no tipo "outro"). */
  description: string;
}

/** Empresa que fornece o equipamento e é contratada (Quark), com o representante que assina. */
export interface Contractor {
  name: string;
  doc: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  repName: string;
  repDoc: string;
  repRole: string;
  repNationality: string;
  repMarital: string;
}

export interface Supplier {
  name: string;
  doc: string;
}

export type PaymentMethod = "pix" | "cartao" | "entrada" | "financiamento" | "personalizado";

export interface ContratoData {
  contractor: Contractor;
  client: Party;
  /** Endereço da instalação, quando diferente do endereço do contratante. */
  installAddress: string;
  supplier: Supplier;
  equipment: Equipment[];
  /** Ex.: "Telhado colonial" (vira "estrutura de fixação para telhado colonial"). */
  structure: string;
  utility: string;
  price: number;
  payment: {
    method: PaymentMethod;
    installments: number;
    withInterest: boolean;
    multipleCards: boolean;
    entry: number;
    balanceWhen: string;
    bank: string;
    custom: string;
  };
  deadlines: { purchase: number; delivery: number; project: number; request: number; install: number; inspection: number; docs: number };
  warranty: { modules: number; linearYears: number; linearPct: number; inverter: number; structure: number; cables: number; box: number; service: number };
  lateFee: number;
  interest: number;
  breachFee: number;
  attorneyFee: number;
  forum: string;
  forumState: string;
  copies: number;
  extraClauses: string;
  witnesses: { name: string; doc: string }[];
  /** Assinatura da CONTRATADA (imagem): a assinatura padrão da empresa. */
  contractorSignature: string;
  place: string;
  date: string;
}

export type DocData = ProcuracaoData | AluguelData | ContratoData;

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

export const EQUIP_KINDS: Record<EquipKind, { label: string; one: string; many: string; unit: string }> = {
  modulo: { label: "Módulo fotovoltaico", one: "módulo fotovoltaico", many: "módulos fotovoltaicos", unit: "W" },
  inversor: { label: "Inversor", one: "inversor", many: "inversores", unit: "kW" },
  microinversor: { label: "Microinversor", one: "microinversor", many: "microinversores", unit: "kW" },
  bateria: { label: "Bateria", one: "bateria", many: "baterias", unit: "kWh" },
  outro: { label: "Outro item", one: "", many: "", unit: "" },
};

export const newEquipment = (p: Partial<Equipment> = {}): Equipment => ({
  id: Math.random().toString(36).slice(2, 10),
  kind: "modulo",
  qty: 1,
  power: 0,
  brand: "",
  model: "",
  description: "",
  ...p,
});

export const emptyContractor = (p: Partial<Contractor> = {}): Contractor => ({
  name: "",
  doc: "",
  address: "",
  city: "",
  state: "AL",
  cep: "",
  repName: "",
  repDoc: "",
  repRole: "Diretor Técnico",
  repNationality: "brasileiro",
  repMarital: "",
  ...p,
});

export const DEFAULT_SUPPLIER: Supplier = { name: "FORTLEV SOLAR", doc: "" };

/** O que pode ser salvo como padrão para os próximos contratos (Configurações). */
export type ContractDefaults = Partial<Pick<ContratoData, "contractor" | "supplier" | "deadlines" | "warranty" | "lateFee" | "interest" | "breachFee" | "attorneyFee" | "forum" | "forumState" | "copies" | "utility">>;

export function defaultContrato(opts: { client?: Partial<Party>; defaults?: ContractDefaults; contractor?: Partial<Contractor>; signature?: string; place?: string } = {}): ContratoData {
  const d = opts.defaults ?? {};
  return {
    contractor: emptyContractor({ ...opts.contractor, ...d.contractor }),
    client: emptyParty(opts.client),
    installAddress: "",
    supplier: { ...DEFAULT_SUPPLIER, ...d.supplier },
    equipment: [newEquipment({ kind: "modulo", qty: 0, power: 0 }), newEquipment({ kind: "inversor", qty: 1, power: 0 })],
    structure: "Telhado colonial",
    utility: d.utility || "Equatorial Alagoas",
    price: 0,
    payment: { method: "cartao", installments: 12, withInterest: true, multipleCards: true, entry: 0, balanceWhen: "na conclusão da instalação", bank: "", custom: "" },
    deadlines: { purchase: 5, delivery: 35, project: 5, request: 5, install: 15, inspection: 7, docs: 5, ...d.deadlines },
    warranty: { modules: 15, linearYears: 25, linearPct: 84, inverter: 10, structure: 15, cables: 5, box: 1, service: 1, ...d.warranty },
    lateFee: d.lateFee ?? 2,
    interest: d.interest ?? 1,
    breachFee: d.breachFee ?? 2,
    attorneyFee: d.attorneyFee ?? 20,
    forum: d.forum || "Maceió",
    forumState: d.forumState || "Alagoas",
    copies: d.copies ?? 3,
    extraClauses: "",
    witnesses: [
      { name: "", doc: "" },
      { name: "", doc: "" },
    ],
    contractorSignature: opts.signature ?? "",
    place: opts.place ?? "Maceió/AL",
    date: today(),
  };
}

/** Potência instalada (kWp) somando os módulos. */
export const contractKwp = (d: Pick<ContratoData, "equipment">) =>
  d.equipment.filter((e) => e.kind === "modulo").reduce((t, e) => t + (Number(e.qty) || 0) * (Number(e.power) || 0), 0) / 1000;

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
  contratante: "Contratante",
  contratada: "Contratada",
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
  if (kind === "contrato") {
    const d = data as ContratoData;
    const list = [signerOf("contratante", d.client)];
    d.witnesses.forEach((w, i) => w.name.trim() && list.push({ role: `testemunha${i + 1}`, name: w.name.trim(), email: "", phone: "", cpf: w.doc }));
    return list.filter((s) => s.name);
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

/* ------------------------------------------------- contrato: o texto */

const num = (v: number, max = 2) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: max });
/** "5 (cinco)" */
const nwd = (n: number) => `${num(n, 0)} (${numberInWords(n)})`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "4 módulos fotovoltaicos de 710 W" */
export function equipmentPhrase(e: Equipment) {
  const k = EQUIP_KINDS[e.kind];
  if (e.kind === "outro") return `${num(e.qty, 0)} ${e.description.trim() || "item"}`.trim();
  const power = e.power > 0 ? ` de ${num(e.power)} ${k.unit}` : "";
  return `${num(e.qty, 0)} ${plural(e.qty, k.one, k.many)}${power}`;
}

/** Linha do Anexo I: "4 × Módulo fotovoltaico 710 W — marca X, modelo Y" */
export function equipmentLine(e: Equipment) {
  const k = EQUIP_KINDS[e.kind];
  const name = e.kind === "outro" ? e.description.trim() || "Item" : k.label;
  const power = e.kind !== "outro" && e.power > 0 ? ` ${num(e.power)} ${k.unit}` : "";
  const extra = [e.brand.trim() && `marca ${e.brand.trim()}`, e.model.trim() && `modelo ${e.model.trim()}`].filter(Boolean).join(", ");
  return `${num(e.qty, 0)} × ${name}${power}${extra ? ` — ${extra}` : ""}`;
}

function contractorQualify(c: Contractor) {
  const where = [c.address.trim(), c.city.trim() && `${c.city.trim()}/${c.state || "AL"}`, digits(c.cep) && `CEP ${formatCep(c.cep)}`].filter(Boolean).join(", ");
  const rep = c.repName.trim()
    ? `, neste ato representada por seu ${c.repRole.trim() || "representante legal"}, ${[c.repName.trim(), c.repNationality.trim(), c.repMarital.trim(), `inscrito no CPF sob o nº ${blank(formatDoc(c.repDoc), 14)}`].filter(Boolean).join(", ")}`
    : "";
  return `${blank(c.name, 30).toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${blank(formatDoc(c.doc), 18)}, localizada na ${where || blank("", 30)}${rep}`;
}

export function paymentText(d: ContratoData) {
  const p = d.payment;
  const total = moneyFull(d.price);
  switch (p.method) {
    case "pix":
      return `O CONTRATANTE pagará o valor total de ${total} à vista, via PIX ou transferência bancária, na assinatura deste contrato.`;
    case "cartao":
      return `O CONTRATANTE pagará o valor total de ${total}. O valor será pago de forma parcelada, em ${nwd(p.installments)} ${plural(p.installments, "vez", "vezes")} no cartão de crédito (${p.withInterest ? "com a presença de juros" : "sem juros"}), diretamente para a CONTRATADA${p.multipleCards ? ", podendo ser utilizado mais de 1 (um) cartão de crédito" : ""}.`;
    case "entrada": {
      const rest = Math.max(0, d.price - p.entry);
      return `O CONTRATANTE pagará o valor total de ${total}, sendo ${moneyFull(p.entry)} de entrada, na assinatura deste contrato, e o saldo de ${moneyFull(rest)} ${p.balanceWhen.trim() || "na conclusão da instalação"}.`;
    }
    case "financiamento":
      return `O CONTRATANTE pagará o valor total de ${total} por meio de financiamento contratado junto à instituição financeira ${blank(p.bank, 20)}, sendo o valor liberado diretamente à CONTRATADA. A aquisição do kit fotovoltaico ocorrerá após a liberação do crédito.`;
    default:
      return p.custom.trim() || `O CONTRATANTE pagará o valor total de ${total}, ${blank("", 40)}.`;
  }
}

export function contratoBlocks(d: ContratoData): Block[] {
  const w = d.warranty;
  const dl = d.deadlines;
  const kwp = contractKwp(d);
  const utility = d.utility.trim() || "Equatorial Alagoas";
  const eq = d.equipment.filter((e) => e.qty > 0);
  const supplier = d.supplier.name.trim() ? d.supplier.name.trim().toUpperCase() : blank("", 20);
  const supplierQ = `a empresa FORNECEDORA, ${supplier}${digits(d.supplier.doc) ? `, inscrita no CNPJ sob o nº ${formatDoc(d.supplier.doc)}` : ""}`;
  const items = [...eq.map(equipmentPhrase), d.structure.trim() && `estrutura de fixação para ${d.structure.trim().toLowerCase()}`].filter(Boolean) as string[];
  const itemsText = items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}` : items[0] ?? blank("", 30);
  const where = d.installAddress.trim() ? `, a ser instalado no imóvel situado em ${d.installAddress.trim().replace(/\.$/, "")}` : "";

  let n = 0;
  const cl = () => `Cláusula ${++n}ª.`;
  const blocks: Block[] = [
    { t: "title", text: "Contrato de prestação de serviços" },
    { t: "sub", text: "Projeto de engenharia, fornecimento, instalação e comissionamento de kit de microgeração solar conectado à rede" },
    { t: "h", text: "Contratada" },
    { t: "p", text: `${contractorQualify(d.contractor)}.` },
    { t: "h", text: "Contratante" },
    { t: "p", text: `${qualify(d.client)}.` },

    { t: "h", text: "Do objeto" },
    {
      t: "p",
      text: `${cl()} O presente contrato tem como objetivo o fornecimento do projeto técnico fotovoltaico, conforme resolução 482 da ANEEL, referente a um sistema com potência instalada de ${kwp > 0 ? `${num(kwp)} kWp` : blank("", 8)}, sendo ${itemsText}${where}, bem como registro, acompanhamento e aprovação do projeto junto à concessionária local. Inclui ainda o acompanhamento do procedimento de acesso, testes elétricos, primeira utilização e visita técnica para coleta dos dados necessários para início do projeto.`,
    },
    { t: "p", text: `${cl()} É de competência da CONTRATADA a prestação dos seguintes serviços:` },
  ];
  const services = [
    "Memorial descritivo",
    "Diagrama unifilar e/ou trifilar",
    "Layout da cobertura",
    "Layout do inversor",
    "Layout de montagem da String Box",
    "Planta de localização",
    "Emissão de ART do projeto",
    "Parecer da visita técnica",
    "Fornecimento e instalação de materiais elétricos (Quadro CC e Quadro CA)",
    "Fornecimento e instalação de estrutura para suporte dos módulos fotovoltaicos",
    "Fornecimento e instalação de componentes elétricos para conexão dos módulos FV, quadros CC, inversores e quadro de baixa tensão",
    "Teste de funcionalidade e entrega de conformidade da usina",
    ...eq.map((e) => `Fornecimento de ${e.kind === "outro" ? equipmentPhrase(e) : `${num(e.qty, 0)} ${plural(e.qty, EQUIP_KINDS[e.kind].one, EQUIP_KINDS[e.kind].many)}`}`),
  ];
  services.forEach((text, i) => blocks.push({ t: "li", text: `${String.fromCharCode(97 + i)}. ${text}${i === services.length - 1 ? "." : ";"}` }));

  blocks.push(
    { t: "h", text: "Dos valores e forma de pagamento" },
    { t: "p", text: `${cl()} Pela prestação dos serviços, o CONTRATANTE pagará à CONTRATADA a quantia total de ${moneyFull(d.price)}.` },
    { t: "p", text: `§1º. O pagamento será realizado da seguinte maneira: ${paymentText(d)}` },

    { t: "h", text: "Do prazo" },
    { t: "p", text: `${cl()} Dado o início do projeto, atribuem-se os prazos abaixo especificados:` },
    { t: "li", text: `i. Fornecimento: a aquisição do kit fotovoltaico será feita em até ${nwd(dl.purchase)} dias úteis após a assinatura do contrato. O prazo para entrega é de até ${nwd(dl.delivery)} dias úteis a partir da confirmação do pedido.` },
    { t: "li", text: `ii. Projeto: até ${nwd(dl.project)} dias úteis a contar da data de assinatura do contrato;` },
    {
      t: "li",
      text: `iii. Formalização: a solicitação de acesso ao sistema de distribuição da concessionária local (${utility}) ocorrerá dentro de ${nwd(dl.request)} dias úteis a contar da conclusão do projeto, podendo ser comprovada mediante a apresentação do protocolo obtido perante a concessionária local. Todavia, a autorização para o início da execução dos serviços (Parecer de Acesso) é ato exclusivo da concessionária local, que de acordo com a Resolução nº 482/2012 da ANEEL é de até 15 (quinze) dias após o recebimento da solicitação de acesso, para central geradora classificada como microgeração distribuída, quando não houver necessidade de melhorias ou reforços no sistema de distribuição acessado. Quando houver necessidade de execução de obras de melhoria ou reforço no sistema de distribuição, o prazo para emissão do Parecer de Acesso é de até 30 (trinta) dias após o recebimento da solicitação de acesso.`,
    },
    { t: "li", text: `iv. Instalação e Comissionamento: ${nwd(dl.install)} dias a contar da entrega do kit fotovoltaico no local de execução da instalação, salvo condições climáticas adversas que impeçam ou dificultem os serviços.` },
    {
      t: "li",
      text: `v. Vistoria das instalações de conexão: em até ${nwd(dl.inspection)} dias contados da data de solicitação formal junto à concessionária. A solicitação da vistoria será feita após a aprovação do projeto e emissão do Parecer de Acesso pela ${utility} e conclusão da instalação e realização de todos os testes e comissionamento;`,
    },
    { t: "li", text: `vi. Documentação: em até ${nwd(dl.docs)} dias úteis após a aprovação da vistoria e liberação para funcionamento pela ${utility}.` },
    { t: "p", text: "Parágrafo único. O fornecimento do equipamento objeto deste contrato ocorrerá em sincronia com os prazos de realização dos serviços." },
    { t: "p", text: "*Os prazos acima descritos serão atendidos, salvo se o local da instalação não estiver atendendo aos padrões de entrada da concessionária de energia." },

    { t: "h", text: "Das garantias" },
    {
      t: "p",
      text: `${cl()} As garantias dos módulos fotovoltaicos e dos inversores/microinversores ficarão sob responsabilidade de ${supplierQ}. A Nota Fiscal de compra terá validade como garantia dos materiais e equipamentos descritos no Anexo I, estabelecido e listado na sua proposta. Havendo defeitos de fábrica que interfiram no seu bom funcionamento, a FORNECEDORA será responsável pela reposição dos equipamentos e/ou componentes nos locais indicados para a instalação, dentro dos prazos de garantia autorizados pelo fabricante.`,
    },
    {
      t: "p",
      text: `§1º. A FORNECEDORA (${supplier}), através do fabricante, oferecerá garantia dos módulos solares fotovoltaicos pelo prazo de ${num(w.modules, 0)} anos contra defeitos de fabricação e garantia linear de produção de ${num(w.linearYears, 0)} anos com entrega mínima de ${num(w.linearPct)}% (${numberInWords(w.linearPct)} por cento) da capacidade total do módulo.`,
    },
    { t: "p", text: `§2º. A FORNECEDORA (${supplier}), através do fabricante, oferecerá a garantia dos inversores de ${num(w.inverter, 0)} anos contra defeitos de fabricação.` },
    {
      t: "p",
      text: `§3º. As garantias das estruturas de fixação em alumínio são de ${num(w.structure, 0)} anos, cabos solares e conectores são de ${num(w.cables, 0)} anos e a caixa de proteção tem garantia de ${num(w.box, 0)} ${plural(w.box, "ano", "anos")} contra defeitos de fabricação, por parte dos fabricantes. Os serviços de instalação do sistema têm garantia de ${num(w.service, 0)} ${plural(w.service, "ano", "anos")} por parte da CONTRATADA.`,
    },
    { t: "p", text: "§4º. Ocorrerá anulação das garantias se houver intervenção no sistema fotovoltaico pela CONTRATANTE ou por terceiros (sendo eles profissionais ou não) que não forem indicados pela CONTRATADA para instalação do sistema." },

    { t: "h", text: "Das obrigações da contratada" },
    { t: "li", text: "a. A CONTRATADA se compromete a fornecer os equipamentos e executar a instalação dos itens contidos na Cláusula 1ª deste contrato." },
    { t: "li", text: "b. Utilizar equipamentos adequados à realização dos serviços e pessoal qualificado, assumindo plena e exclusiva responsabilidade por sua contratação, eximindo a CONTRATANTE de qualquer responsabilidade." },
    { t: "li", text: "c. Executar as atividades necessárias à implantação do empreendimento de modo a não interferir desnecessária ou indevidamente com instalações ou serviços já existentes." },
    { t: "li", text: "d. Prestar informação adequada e clara ao CONTRATANTE sobre os produtos e serviços." },

    { t: "h", text: "Das obrigações do contratante" },
    { t: "li", text: "a. Efetuar os pagamentos à CONTRATADA, de forma tempestiva, nos termos deste Contrato." },
    { t: "li", text: "b. Fornecer à CONTRATADA todas as informações solicitadas para o cumprimento integral do presente contrato, estando ciente de que a omissão de quaisquer informações poderá comprometer a qualidade do resultado do projeto;" },
    { t: "li", text: "c. Pagar os custos do projeto advindos do atraso ocorrido por ação sua, a exemplo de cancelamento de visitas, atraso na entrega de documentos solicitados ou mudanças não programadas no planejamento do presente contrato;" },
    { t: "li", text: "d. Liberar a entrada dos profissionais para a execução dos serviços de instalação nas áreas do imóvel para isso necessárias." },
    { t: "li", text: "e. Providenciar a disponibilização dos pontos de energia." },
    { t: "li", text: "f. Receber e armazenar os equipamentos entregues pela CONTRATADA de forma segura durante a etapa de instalação, zelando pela sua guarda e respondendo por eventuais perdas e danos. Eventuais restrições implicam atrasos consideráveis de responsabilidade do CONTRATANTE." },
    { t: "li", text: "g. Garantir que o local do serviço não possua nenhuma inconformidade na instalação elétrica que interfira ou impeça a instalação, ou que danifique o equipamento de energia solar. Caso contrário, a CONTRATANTE deverá readequar as instalações a pedido da CONTRATADA;" },
    { t: "li", text: "h. Quaisquer necessidades de obras de reforço estrutural ou adequação de infraestrutura serão apontadas pela CONTRATADA durante a visita técnica, devendo ser sanadas pela CONTRATANTE, tendo em vista, como exposto na proposta contratual, que o pré-orçamento não cobre essas necessidades." },
    { t: "li", text: "i. Na indisponibilidade de local no imóvel do CONTRATANTE para receber e armazenar em segurança os equipamentos, materiais e componentes do sistema gerador, a partir da data estabelecida para a instalação, este deverá providenciar depósito alternativo para entrega imediata, cabendo-lhe os ônus respectivos, bem como a obrigação de transportar para o local da instalação posteriormente;" },

    { t: "p", text: `${cl()} Não compete à CONTRATADA:` },
    { t: "li", text: "I. Realizar mais que 1 (uma) modificação ao final da elaboração do projeto fotovoltaico. Caso a CONTRATANTE deseje mais modificações que o previsto, esta estará ciente de que poderá acarretar acréscimos de prazo e preço do projeto, sendo de inteira e única responsabilidade do próprio;" },
    { t: "li", text: "II. Realizar o processo de legalização da obra ou do empreendimento perante qualquer instância;" },
    { t: "li", text: "III. Fornecimento de telha;" },
    { t: "li", text: "IV. Obras de transmissão de energia em linha aérea;" },
    { t: "li", text: "V. Estrutura mecânica de reforço de telhado;" },
    { t: "li", text: "VI. Reforma no padrão de entrada da unidade consumidora;" },
    { t: "li", text: "VII. Instalação de internet no local para ser estabelecido o monitoramento da usina;" },
    { t: "li", text: "VIII. Obras civis." },

    { t: "h", text: "Da extinção contratual" },
    { t: "p", text: `${cl()} É assegurado às partes rescindir o presente contrato antes do término do prazo.` },
    {
      t: "p",
      text: `${cl()} Em caso de inadimplemento por parte do CONTRATANTE quanto ao pagamento dos produtos fornecidos e serviços prestados, deverá incidir, sobre o valor do presente instrumento, multa moratória de ${num(d.lateFee)}%, juros de mora de ${num(d.interest)}% ao mês e correção monetária.`,
    },
    { t: "p", text: `Parágrafo único. Em caso de cobrança judicial, devem ser acrescidas custas processuais e ${num(d.attorneyFee)}% de honorários advocatícios.` },
    {
      t: "p",
      text: `${cl()} A parte que descumprir qualquer cláusula estabelecida neste instrumento, exceto aquelas relativas ao preço e condições de pagamento, se responsabilizará por multa de ${num(d.breachFee)}% (${numberInWords(d.breachFee)} por cento) do valor total do presente contrato.`,
    },
    { t: "p", text: `Parágrafo único. Em caso de ação judicial, devem ser acrescidas custas processuais e ${num(d.attorneyFee)}% de honorários advocatícios.` },

    { t: "h", text: "Das disposições gerais" },
    { t: "p", text: `${cl()} O presente contrato é celebrado em caráter irrevogável e irretratável e obriga as partes e seus eventuais sucessores de qualquer título.` },
    { t: "p", text: `${cl()} A CONTRATADA é pessoa jurídica de direito privado formalmente constituída, de modo que inexiste qualquer espécie de vínculo, inclusive trabalhista, entre os diretores e/ou os funcionários e prepostos da CONTRATADA e a CONTRATANTE.` },
    { t: "p", text: `${cl()} Os direitos e obrigações decorrentes do presente contrato não poderão ser cedidos ou transferidos, total ou parcialmente, a terceiros, a qualquer título, salvo por concordância prévia e expressa da outra parte.` },
    {
      t: "p",
      text: `${cl()} É vedado à CONTRATADA utilizar o presente objeto contratual em garantias para transações, inclusive bancárias e/ou financeiras de qualquer espécie, efetuar operação de desconto, negociar, repassar ou de qualquer forma ceder os créditos decorrentes da execução deste a bancos, empresas de “factoring” ou terceiros, sem prévia autorização por escrito da CONTRATANTE.`,
    },
    {
      t: "p",
      text: `${cl()} Se qualquer disposição deste contrato for declarada ou considerada ilegal, inexequível ou nula, as partes deverão, de comum acordo, alterar este contrato, modificando a referida disposição para torná-la legal e exequível, devendo preservar o seu objetivo, ou, se não for possível, substituí-la por outra disposição que seja legal e exequível e atinja objetivo semelhante.`,
    },
    {
      t: "p",
      text: `${cl()} O presente contrato não poderá ser, em todo ou em qualquer parte, alterado, modificado ou rescindido oralmente. Qualquer alteração, modificação, rescisão ou renúncia relativa a este contrato deverá ser feita apenas por instrumento escrito e assinado pelas partes, o qual será parte integrante e inseparável deste contrato.`,
    },
    { t: "p", text: `${cl()} Este instrumento de contrato serve como título executivo extrajudicial, nos termos do inciso III do art. 784 do Código de Processo Civil de 2015.` },
    {
      t: "p",
      text: `${cl()} Em caso de ocorrência de fatos não previstos neste contrato, a solução do impasse será dada através da aplicação de lei ou princípio que regule o caso, não sendo configurada a presente relação como de consumo.`,
    },
  );

  const extras = d.extraClauses.trim() ? d.extraClauses.trim().split(/\n+/) : [];
  if (extras.length) {
    blocks.push({ t: "h", text: "Disposições especiais" });
    extras.forEach((text) => blocks.push({ t: "p", text: `${cl()} ${text.trim()}` }));
  }

  blocks.push(
    { t: "h", text: "Do foro" },
    {
      t: "p",
      text: `${cl()} Elegem as partes o foro da Comarca de ${blank(d.forum, 14)}, no Estado de ${blank(d.forumState, 10)}, para nele serem dirimidas todas e quaisquer dúvidas ou questões oriundas do presente contrato, renunciando as partes a qualquer outro, por mais especial e privilegiado que seja.`,
    },
    { t: "p", text: `Por estarem assim justos e contratados, firmam o presente instrumento, em ${nwd(d.copies)} ${plural(d.copies, "via", "vias")} de igual teor.` },
    { t: "p", text: ESIGN },
  );

  if (eq.length) {
    blocks.push({ t: "h", text: "Anexo I — Relação de equipamentos" });
    eq.forEach((e) => blocks.push({ t: "li", text: equipmentLine(e) }));
    if (d.structure.trim()) blocks.push({ t: "li", text: `Estrutura de fixação para ${d.structure.trim().toLowerCase()}` });
    blocks.push({ t: "li", text: `Fornecedora: ${supplier}${digits(d.supplier.doc) ? ` · CNPJ ${formatDoc(d.supplier.doc)}` : ""}${kwp > 0 ? ` · Potência instalada: ${num(kwp)} kWp` : ""}` });
  }

  blocks.push({ t: "place", text: `${blank(d.place, 16)}, ${dateInWords(d.date)}.` });
  return blocks;
}

export function documentBlocks(kind: DocKind, data: DocData) {
  if (kind === "contrato") return contratoBlocks(data as ContratoData);
  return kind === "procuracao" ? procuracaoBlocks(data as ProcuracaoData) : aluguelBlocks(data as AluguelData);
}

export function documentTitle(kind: DocKind, data: DocData) {
  if (kind === "procuracao") {
    const d = data as ProcuracaoData;
    return `Procuração — ${d.grantor.name.trim() || "novo cliente"}`;
  }
  if (kind === "contrato") {
    const d = data as ContratoData;
    const kwp = contractKwp(d);
    return `Contrato — ${d.client.name.trim() || "novo cliente"}${kwp > 0 ? ` · ${num(kwp)} kWp` : ""}`;
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
  } else if (kind === "contrato") {
    const d = data as ContratoData;
    party(d.client, "contratante");
    if (!d.contractor.name.trim() || !digits(d.contractor.doc)) miss.push("Dados da contratada (sua empresa)");
    if (!d.supplier.name.trim()) miss.push("Empresa fornecedora");
    if (!d.equipment.some((e) => e.qty > 0)) miss.push("Equipamentos");
    if (!(d.price > 0)) miss.push("Valor do contrato");
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
  contrato: { label: "Contrato solar", plural: "Contratos solares", short: "Contrato solar" },
};

export const DOC_STATUS: Record<DocStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-ink-100 text-ink-600 ring-ink-500/15" },
  enviado: { label: "Aguardando assinatura", cls: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  assinado: { label: "Assinado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  cancelado: { label: "Cancelado", cls: "bg-rose-50 text-rose-700 ring-rose-600/15" },
};
