/**
 * Organiza um texto livre de cadastro (ficha colada do WhatsApp, e-mail, formulário)
 * em campos: dados pessoais, endereço, contato e, quando houver, a scooter da venda.
 * Funciona com rótulos ("Nome: …", "CPF …") e também com texto corrido.
 */
import { digits, isValidCnpj, isValidCpf } from "./br.ts";

export interface Cadastro {
  name: string;
  doc: string;
  rg: string;
  birth: string;
  nationality: string;
  marital: string;
  profession: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  cep: string;
  phone: string;
  email: string;
  model: "" | "t1" | "cappuccino" | "mz";
  color: string;
  chassis: string;
  motorNo: string;
  batteryNo: string;
  payment: string;
  notes: string;
}

export const EMPTY_CADASTRO: Cadastro = {
  name: "",
  doc: "",
  rg: "",
  birth: "",
  nationality: "",
  marital: "",
  profession: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  cep: "",
  phone: "",
  email: "",
  model: "",
  color: "",
  chassis: "",
  motorNo: "",
  batteryNo: "",
  payment: "",
  notes: "",
};

export const UFS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const STATE_NAMES: Record<string, string> = {
  alagoas: "AL",
  pernambuco: "PE",
  bahia: "BA",
  sergipe: "SE",
  paraiba: "PB",
  "rio grande do norte": "RN",
  ceara: "CE",
  "sao paulo": "SP",
  "rio de janeiro": "RJ",
  "minas gerais": "MG",
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s:;,.\-–—=>*•]+|[\s;,.*]+$/g, "").trim();

/** Rótulos aceitos para cada campo (sem acento, minúsculos). */
const LABELS: [keyof Cadastro, string[]][] = [
  ["name", ["nome completo", "nome do cliente", "nome do comprador", "nome", "cliente", "comprador", "comprador(a)"]],
  ["doc", ["cpf/cnpj", "cpf ou cnpj", "cpf", "cnpj"]],
  ["rg", ["rg", "identidade", "carteira de identidade", "doc de identidade"]],
  ["birth", ["data de nascimento", "nascimento", "data nasc", "dt nasc", "nasc"]],
  ["nationality", ["nacionalidade"]],
  ["marital", ["estado civil"]],
  ["profession", ["profissao", "ocupacao", "trabalho"]],
  ["street", ["endereco completo", "endereco residencial", "endereco", "end", "logradouro", "residencia", "mora em"]],
  ["number", ["numero", "nº", "n°", "no"]],
  ["complement", ["complemento", "compl", "apto", "apartamento", "bloco"]],
  ["district", ["bairro"]],
  ["city", ["cidade", "municipio", "cidade/uf", "cidade - uf"]],
  ["state", ["estado", "uf"]],
  ["cep", ["cep"]],
  ["phone", ["whatsapp", "whats", "zap", "telefone", "celular", "fone", "tel", "contato", "cel"]],
  ["email", ["e-mail", "email", "mail"]],
  ["model", ["modelo", "scooter", "moto", "veiculo"]],
  ["color", ["cor"]],
  ["chassis", ["chassi", "quadro", "numero do chassi", "n do chassi"]],
  ["motorNo", ["numero do motor", "n do motor", "motor"]],
  ["batteryNo", ["numero da bateria", "n da bateria", "bateria"]],
  ["payment", ["forma de pagamento", "pagamento", "condicao", "parcelamento"]],
  ["notes", ["observacoes", "observacao", "obs"]],
];

const MARITAL = [
  [/\b(solteir[oa])\b/i, "solteiro(a)"],
  [/\b(casad[oa])\b/i, "casado(a)"],
  [/\b(divorciad[oa]|separad[oa])\b/i, "divorciado(a)"],
  [/\b(vi[uú]v[oa])\b/i, "viúvo(a)"],
  [/\buni[aã]o est[aá]vel\b/i, "em união estável"],
] as const;

const STREET_START = /^(rua|r\.|av\.?|avenida|travessa|tv\.?|trav\.?|rodovia|rod\.?|estrada|alameda|al\.|pra[cç]a|conjunto|conj\.?|residencial|loteamento|lot\.?|condom[ií]nio|cond\.?|vila|quadra|sitio|s[ií]tio|fazenda|povoado|br-?\d)/i;

const formatPhoneBr = (v: string) => {
  let d = digits(v);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v.trim();
};

/** Troca nomes em CAIXA ALTA ou minúsculos por nomes próprios ("MARIA DA SILVA" → "Maria da Silva"). */
export function properName(v: string) {
  const small = new Set(["da", "de", "do", "das", "dos", "e"]);
  const t = clean(v);
  if (!t) return "";
  const mixed = /[a-zà-ú]/.test(t) && /[A-ZÀ-Ú]/.test(t);
  if (mixed) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function modelOf(v: string): Cadastro["model"] {
  const s = strip(v);
  if (/cappuc+in+o|capuc+in+o|capuchino|cappuchino/.test(s)) return "cappuccino";
  if (/\bmz\b/.test(s)) return "mz";
  if (/\bt-?1\b/.test(s)) return "t1";
  return "";
}

const COLORS = ["branca", "branco", "preta", "preto", "prata", "cinza", "creme", "bege", "verde menta", "verde", "vermelha", "vermelho", "azul", "rosa", "laranja", "amarela", "grafite"];
function colorOf(v: string) {
  const s = strip(v);
  const hit = COLORS.find((c) => new RegExp(`\\b${c}\\b`).test(s));
  if (!hit) return "";
  if (/cinza e laranja/.test(s)) return "Cinza e laranja";
  return hit.charAt(0).toUpperCase() + hit.slice(1);
}

/** Separa "Maceió - AL", "Maceió/AL" ou "Maceió AL" em cidade e UF. */
function splitCityUf(v: string): { city: string; state: string } {
  const t = clean(v);
  const m = t.match(/^(.*?)[\s/,\-–]+([A-Za-z]{2})$/);
  if (m && UFS_BR.includes(m[2].toUpperCase())) return { city: properName(m[1]), state: m[2].toUpperCase() };
  for (const [name, uf] of Object.entries(STATE_NAMES)) {
    const re = new RegExp(`[\\s/,\\-–]+${name}$`, "i");
    if (re.test(strip(t))) return { city: properName(t.slice(0, strip(t).search(re))), state: uf };
  }
  return { city: properName(t), state: "" };
}

/** Lê "Rua X, 120, apto 3 - Ponta Verde" em rua, número, complemento e bairro. */
function splitStreet(v: string) {
  let rest = clean(v);
  let number = "";
  let complement = "";
  let district = "";
  const dash = rest.split(/\s+[-–—]\s+/);
  if (dash.length > 1) {
    rest = dash[0];
    district = clean(dash.slice(1).join(" - "));
  }
  const parts = rest.split(/\s*,\s*/);
  const street = parts.shift() ?? "";
  for (const p of parts) {
    const q = clean(p);
    if (!number && /^(n[º°o.]?\s*)?\d+[a-z]?$|^s\/?n$/i.test(q)) number = q.replace(/^n[º°o.]?\s*/i, "");
    else if (/^(apto|ap\.?|apartamento|bloco|bl\.?|casa|lote|qd\.?|quadra|sala|cond)/i.test(q)) complement = complement ? `${complement}, ${q}` : q;
    else if (/^bairro\s/i.test(q)) district = q.replace(/^bairro\s+/i, "");
    else if (!district && !/\d{5}-?\d{3}/.test(q) && !UFS_BR.includes(q.toUpperCase())) district = q;
  }
  // "Rua das Flores 120" sem vírgula
  let s = street;
  if (!number) {
    const m = s.match(/^(.*?\D)\s+(\d{1,5}[a-z]?)$/i);
    if (m) {
      s = m[1];
      number = m[2];
    }
  }
  return { street: clean(s), number, complement, district: clean(district) };
}

/** Encontra o valor de um rótulo no começo da linha ("Nome: Maria", "CPF 123…", "Bairro - Centro"). */
function labelled(line: string): { key: keyof Cadastro; value: string } | null {
  const s = strip(line).replace(/^[\s*•\-–>]+/, "");
  for (const [key, labels] of LABELS) {
    for (const l of labels) {
      const esc = l.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      const re = new RegExp(`^${esc}\\s*(?:[:=\\-–—]|\\s(?=\\S))\\s*`);
      const m = s.match(re);
      if (!m) continue;
      // "No" e "Nº" só valem como número quando seguidos de dígito
      if (key === "number" && !/^\d/.test(s.slice(m[0].length))) continue;
      // "motor"/"bateria" só são número de série quando há dígitos
      if ((key === "motorNo" || key === "batteryNo" || key === "chassis") && !/\d/.test(s.slice(m[0].length))) continue;
      const offset = line.length - line.replace(/^[\s*•\-–>]+/, "").length;
      const value = clean(line.slice(offset + m[0].length));
      if (value) return { key, value };
    }
  }
  return null;
}

const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}[-.\s]?\d{2}\b/g;
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const CEP_RE = /\b\d{5}-?\d{3}\b/;
const EMAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const PHONE_RE = /(?:\+?55\s?)?\(?\b\d{2}\)?[\s.-]?9?\s?\d{4}[\s.-]?\d{4}\b/g;
const DATE_RE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;

/** Organiza o texto colado. `found` lista os campos reconhecidos. */
export function parseCadastro(text: string): { data: Cadastro; found: (keyof Cadastro)[] } {
  const d: Cadastro = { ...EMPTY_CADASTRO };
  const set = (k: keyof Cadastro, v: string) => {
    if (v && !d[k]) (d as unknown as Record<string, string>)[k] = v;
  };
  const leftovers: string[] = [];
  const lines = text
    .replace(/\r/g, "")
    .split(/\n|;|\s\|\s/)
    .map((l) => l.trim())
    .filter(Boolean)
    // Tudo numa linha só ("Maria, cpf 123…, rua X 12, Maceió AL"): quebra nas vírgulas,
    // mantendo juntos o nome da rua e o número que vem logo depois.
    .flatMap((l) => {
      if ((l.match(/,/g) ?? []).length < 3 || l.length < 50) return [l];
      const out: string[] = [];
      for (const part of l.split(/\s*,\s*/)) {
        const prev = out[out.length - 1];
        const streetPrev = prev && STREET_START.test(prev);
        const isNumber = /^(n[º°o.]?\s*)?\d+[a-z]?$|^(apto|ap\.?|bloco|casa|lote|qd)/i.test(part);
        // bairro logo depois de "rua X, 12": só letras e sem "cidade UF" no fim
        const isDistrict = streetPrev && /,\s*\S*\d/.test(prev) && /^[A-Za-zÀ-ú\s.']{3,40}$/.test(part) && !(/[\s/\-–][A-Za-z]{2}$/.test(part) && UFS_BR.includes(part.slice(-2).toUpperCase()));
        if (streetPrev && (isNumber || isDistrict)) out[out.length - 1] = `${prev}, ${part}`;
        else out.push(part);
      }
      return out;
    });

  for (const line of lines) {
    const hit = labelled(line);
    if (!hit) {
      leftovers.push(line);
      continue;
    }
    const v = hit.value;
    switch (hit.key) {
      case "name":
        set("name", properName(v.replace(CPF_RE, "")));
        break;
      case "doc": {
        const dd = digits(v);
        set("doc", dd.length >= 14 ? dd.slice(0, 14) : dd.slice(0, 11));
        break;
      }
      case "birth": {
        const m = v.match(DATE_RE);
        if (m) set("birth", `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3].length === 2 ? `19${m[3]}` : m[3]}`);
        break;
      }
      case "marital": {
        const m = MARITAL.find(([re]) => re.test(v));
        set("marital", m ? m[1] : v.toLowerCase());
        break;
      }
      case "street": {
        const p = splitStreet(v);
        set("street", p.street);
        set("number", p.number);
        set("complement", p.complement);
        set("district", p.district);
        const cep = v.match(CEP_RE);
        if (cep) set("cep", cep[0]);
        break;
      }
      case "city": {
        const c = splitCityUf(v);
        set("city", c.city);
        set("state", c.state);
        break;
      }
      case "state": {
        const uf = v.trim().toUpperCase();
        set("state", UFS_BR.includes(uf) ? uf : (STATE_NAMES[strip(v)] ?? ""));
        break;
      }
      case "cep":
        set("cep", (v.match(CEP_RE)?.[0] ?? digits(v)).replace(/^(\d{5})(\d{3})$/, "$1-$2"));
        break;
      case "phone": {
        const m = v.match(PHONE_RE);
        set("phone", formatPhoneBr(m ? m[0] : v));
        break;
      }
      case "email":
        set("email", (v.match(EMAIL_RE)?.[0] ?? v).toLowerCase());
        break;
      case "model": {
        set("model", modelOf(v));
        set("color", colorOf(v));
        break;
      }
      case "color":
        set("color", properName(v));
        break;
      case "profession":
      case "nationality":
        set(hit.key, v.toLowerCase());
        break;
      case "chassis":
      case "motorNo":
      case "batteryNo":
        set(hit.key, v.toUpperCase().replace(/\s+/g, ""));
        break;
      default:
        set(hit.key, v);
    }
  }

  // Texto corrido: procura os padrões no que sobrou.
  const loose = leftovers.join("\n");
  const all = text;
  if (!d.email) set("email", (loose.match(EMAIL_RE)?.[0] ?? "").toLowerCase());
  if (!d.doc) {
    const cnpj = (all.match(CNPJ_RE) ?? []).find((c) => isValidCnpj(c));
    const cpf = (all.match(CPF_RE) ?? []).find((c) => isValidCpf(c));
    set("doc", digits(cnpj ?? cpf ?? ""));
  }
  if (!d.cep) {
    const m = loose.match(/(?:cep\s*:?\s*)?\b(\d{5})-?(\d{3})\b/i);
    if (m && !d.doc.includes(m[1] + m[2])) set("cep", `${m[1]}-${m[2]}`);
  }
  if (!d.phone) {
    const phones = (loose.match(PHONE_RE) ?? []).filter((p) => {
      const pd = digits(p);
      return (pd.length === 10 || pd.length === 11 || pd.length === 12 || pd.length === 13) && !isValidCpf(pd) && pd !== digits(d.cep);
    });
    if (phones[0]) set("phone", formatPhoneBr(phones[0]));
  }
  if (!d.birth) {
    const m = loose.match(/(?:nasc\w*|dn)\D{0,12}(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i);
    if (m) set("birth", `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3].length === 2 ? `19${m[3]}` : m[3]}`);
  }
  if (!d.marital) {
    const m = MARITAL.find(([re]) => re.test(loose));
    if (m) set("marital", m[1]);
  }
  if (!d.rg) {
    const m = loose.match(/\brg\b\D{0,6}([\d.\-xX]{5,15}(?:\s*[-/]?\s*(?:ssp|sds|pc|detran)\s*[-/]?\s*[a-z]{2})?)/i);
    if (m) set("rg", m[1].trim().toUpperCase());
  }
  if (!d.payment) {
    const m = loose.match(/\b\d{1,2}\s*x(?:\s+(?:no|de|sem juros|com juros))*(?:\s+(?:cart[aã]o|cr[eé]dito))?|\bpix\b|[àa] vista|\bentrada de [^,.;\n]+/i);
    if (m) set("payment", clean(m[0]));
  }
  if (!d.model) {
    set("model", modelOf(loose));
    if (d.model && !d.color) set("color", colorOf(loose));
  }

  const rest: string[] = [];
  for (const raw of leftovers) {
    const line = clean(raw);
    if (!line) continue;
    // Endereço sem rótulo: "Rua das Flores, 120 - Ponta Verde"
    if (!d.street && STREET_START.test(line)) {
      const noCep = line.replace(/,?\s*cep\s*:?\s*\d{5}-?\d{3}/i, "");
      const p = splitStreet(noCep.split(/\s*,\s*(?=[^,]*\b[A-Za-z]{2}$)/)[0]);
      set("street", p.street);
      set("number", p.number);
      set("complement", p.complement);
      set("district", p.district);
      // cidade/UF no fim da mesma linha
      const tail = noCep.match(/,\s*([^,\d]+?)\s*[/\-–]\s*([A-Za-z]{2})\s*$/);
      if (tail && UFS_BR.includes(tail[2].toUpperCase())) {
        set("city", properName(tail[1]));
        set("state", tail[2].toUpperCase());
        if (d.district && strip(d.district) === strip(tail[1])) d.district = "";
      }
      continue;
    }
    // "Maceió - AL" sozinho numa linha
    if (!d.city && /^[A-Za-zÀ-ú\s]{3,40}(\s*[/\-–]\s*|\s+)[A-Za-z]{2}$/.test(line) && UFS_BR.includes(line.slice(-2).toUpperCase())) {
      const c = splitCityUf(line);
      if (c.state) {
        set("city", c.city);
        set("state", c.state);
        continue;
      }
    }
    // Nome: primeira linha só com palavras (2+), sem números nem @
    if (!d.name && /^[A-Za-zÀ-ú'´`.\s]{5,80}$/.test(line) && line.trim().split(/\s+/).length >= 2 && !STREET_START.test(line) && !MARITAL.some(([re]) => re.test(line))) {
      set("name", properName(line));
      continue;
    }
    // "solteiro, motorista de aplicativo": o que vem junto do estado civil é a profissão.
    if (MARITAL.some(([re]) => re.test(line))) {
      const other = line
        .split(/\s*[,;/]\s*|\s+e\s+/)
        .map(clean)
        .filter((x) => x && !MARITAL.some(([re]) => re.test(x)) && /^[A-Za-zÀ-ú\s]{3,40}$/.test(x) && x.split(" ").length <= 4);
      if (other[0] && !d.profession) set("profession", other[0].toLowerCase());
      if (other.length <= 1) continue;
    }
    // Frase só de interesse/pagamento ("quero a MZ preta em 21x") já virou campo.
    const meaningful = strip(line)
      .replace(/\b\d{1,2}\s*x\b|\bpix\b|a vista|cartao|credito|sem juros|com juros|\bt-?1\b|\bmz\b|cap+uc+in+o|scooter|moto|eletrica/g, " ")
      .replace(new RegExp(`\\b(${COLORS.join("|")})\\b`, "g"), " ")
      .split(/\W+/)
      .filter((w) => w.length > 2 && !["quero", "queria", "gostaria", "comprar", "pagar", "vou", "pra", "para", "uma", "num", "ela", "ele", "essa", "esse", "modelo", "cor", "com", "sem", "parcelado", "parcelas", "vezes"].includes(w));
    if ((d.model || d.payment) && meaningful.length === 0) continue;
    // Linha que só tinha dados já reconhecidos não vira observação.
    const residue = line.replace(EMAIL_RE, "").replace(CPF_RE, "").replace(CNPJ_RE, "").replace(PHONE_RE, "").replace(CEP_RE, "").replace(/\b(cpf|cnpj|cep|rg|tel|telefone|whats(app)?|e-?mail)\b/gi, "");
    if (residue.replace(/[\W_]/g, "").length > 3) rest.push(line);
  }
  if (rest.length) d.notes = [d.notes, ...rest].filter(Boolean).join("\n");
  if (!d.nationality && d.name) d.nationality = "brasileiro(a)";

  const found = (Object.keys(EMPTY_CADASTRO) as (keyof Cadastro)[]).filter((k) => d[k] && !(k === "nationality" && d.nationality === "brasileiro(a)" && !/nacionalidade/i.test(text)));
  return { data: d, found };
}

/** Endereço numa linha só: "Rua X, 120, apto 3, Ponta Verde". */
export function fullAddress(d: Pick<Cadastro, "street" | "number" | "complement" | "district">) {
  return [d.street, d.number && (/^s\/?n$/i.test(d.number) ? "s/n" : d.number), d.complement, d.district].filter(Boolean).join(", ");
}

/** O que falta para fechar a venda. */
export function missingCadastro(d: Cadastro) {
  const miss: string[] = [];
  if (!d.name.trim()) miss.push("Nome");
  if (!digits(d.doc)) miss.push("CPF");
  else if (digits(d.doc).length === 11 ? !isValidCpf(d.doc) : !isValidCnpj(d.doc)) miss.push("CPF válido");
  if (digits(d.phone).length < 10) miss.push("WhatsApp");
  if (!d.street.trim()) miss.push("Endereço");
  if (!d.city.trim()) miss.push("Cidade");
  return miss;
}
