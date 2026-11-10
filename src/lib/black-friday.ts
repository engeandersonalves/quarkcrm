/**
 * Black Friday Quark — tudo o que a landing mostra fica aqui.
 * Para mudar datas, kits, preços, motos ou textos, edite só este arquivo.
 */

/** Horário de Brasília (UTC−3). */
export const BF_START = "2026-11-13T00:00:00-03:00";
export const BF_END = "2026-11-27T23:59:59-03:00";
export const BF_LABEL = "13 a 27 de novembro";

/** WhatsApp usado quando a empresa não tiver um em Configurações. */
export const BF_WHATSAPP = "5582991831476";
export const BF_INSTAGRAM = "@quarkenergia";

export type BfPhase = "antes" | "durante" | "encerrada";

/** Em que momento da campanha estamos e para quando a contagem regressiva aponta. */
export function bfPhase(now = Date.now(), start = BF_START, end = BF_END): { phase: BfPhase; target: number | null } {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now < s) return { phase: "antes", target: s };
  if (now <= e) return { phase: "durante", target: e };
  return { phase: "encerrada", target: null };
}

/** Dias, horas, minutos e segundos que faltam. */
export function timeLeft(target: number, now = Date.now()) {
  const ms = Math.max(0, target - now);
  return { d: Math.floor(ms / 86400000), h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60, done: ms === 0 };
}

export type BfCategory = "solar" | "wallbox" | "moto";

export interface SolarKit {
  id: string;
  kwh: number;
  kwp: number;
  /** Parcela no cartão e número de vezes. */
  installments: number;
  installment: number;
  cash: number;
  inverter: "a" | "b";
  highlight?: string;
}

/** Tabela da Black Friday (mesmos valores das artes da campanha). */
export const SOLAR_KITS: SolarKit[] = [
  { id: "kit-500", kwh: 500, kwp: 4.06, installments: 21, installment: 557, cash: 8990, inverter: "a" },
  { id: "kit-700", kwh: 700, kwp: 5.54, installments: 21, installment: 742, cash: 11980, inverter: "b", highlight: "Mais procurado" },
  { id: "kit-800", kwh: 800, kwp: 6.15, installments: 21, installment: 804, cash: 12990, inverter: "a" },
  { id: "kit-1000", kwh: 1000, kwp: 7.99, installments: 21, installment: 959, cash: 15490, inverter: "b" },
  { id: "kit-1200", kwh: 1200, kwp: 9.22, installments: 21, installment: 1107, cash: 17880, inverter: "a" },
  { id: "kit-1500", kwh: 1500, kwp: 11.07, installments: 21, installment: 1268, cash: 20490, inverter: "b", highlight: "Melhor custo por kWh" },
  { id: "kit-2000", kwh: 2000, kwp: 16.6, installments: 21, installment: 1795, cash: 28990, inverter: "a" },
];

export const SOLAR_INCLUDED = ["Kit fotovoltaico completo", "Projeto de engenharia e homologação", "Instalação em até 30 dias", "Equipamentos com certificação", "Monitoramento remoto pelo app"];

export const SOLAR_SPECS = [
  { value: "610 a 700 W", label: "módulos bifaciais" },
  { value: "até 22,65%", label: "de eficiência" },
  { value: "15 anos", label: "de garantia nos módulos" },
  { value: "10 anos", label: "de garantia no inversor" },
];

export interface Wallbox {
  id: string;
  name: string;
  power: string;
  grid: string;
  /** Horas para 50 kWh (carro médio), só para comparar. */
  hours: number;
}

export const WALLBOXES: Wallbox[] = [
  { id: "wb-7", name: "Wallbox 7 kW", power: "7 kW", grid: "Monofásico", hours: 7 },
  { id: "wb-22", name: "Wallbox 22 kW", power: "22 kW", grid: "Trifásico", hours: 2.3 },
];

export const WALLBOX_INCLUDED = ["Visita técnica e análise do quadro", "Wallbox indicado para o seu carro", "Instalação conforme a ABNT NBR 17019", "Testes e orientação de uso", "Responsável técnico do começo ao fim"];

export interface Moto {
  id: string;
  name: string;
  image: string;
  power: string;
  battery: string;
  range: string;
  speed: string;
  charge: string;
  highlight: string;
}

/** Fichas das artes da campanha. Confira antes de publicar: as artes marcavam como ilustrativas. */
export const MOTOS: Moto[] = [
  { id: "moto-retro", name: "Retrô", image: "/bf/moto-retro.png", power: "1.000 W", battery: "Lítio 60 V", range: "até 50 km", speed: "até 32 km/h", charge: "6 h na tomada comum", highlight: "Banco de couro e visual clássico" },
  { id: "moto-urbana", name: "Urbana", image: "/bf/moto-urbana.png", power: "800 W", battery: "Lítio 48 V", range: "até 40 km", speed: "até 32 km/h", charge: "6 h na tomada comum", highlight: "Cesto e garupa para o dia a dia" },
];

export const CONDITIONS = [
  { big: "72x", text: "no financiamento, sem entrada" },
  { big: "120 dias", text: "para pagar a 1ª parcela" },
  { big: "21x", text: "no cartão, até em mais de um" },
  { big: "30 dias", text: "para o sistema estar instalado" },
];

export const BF_FAQ = [
  { q: "Até quando vale a Black Friday?", a: `As condições valem de ${BF_LABEL} ou enquanto houver equipamentos da tabela em estoque.` },
  { q: "Os valores dos kits já incluem instalação?", a: "Sim. Os kits incluem equipamentos, projeto de engenharia, homologação na distribuidora e instalação em até 30 dias após a assinatura do contrato." },
  { q: "Como funciona o financiamento sem entrada?", a: "Você pode parcelar em até 72x sem entrada e começar a pagar em até 120 dias. Sujeito a análise de crédito." },
  { q: "Em quanto tempo o sistema fica pronto?", a: "Instalamos em até 30 dias contados da assinatura do contrato. A vistoria e a ligação seguem os prazos da distribuidora." },
  { q: "Preciso de wallbox para carregar o carro?", a: "Na tomada comum o carregamento é lento e pode sobrecarregar a instalação. O wallbox carrega com segurança e muito mais rápido, com circuito dedicado e proteções." },
  { q: "Moto elétrica precisa de habilitação?", a: "Modelos de até 32 km/h e 1.000 W seguem as regras de autopropelidos do Contran. Nosso consultor explica as exigências de cada modelo." },
];

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const num = (v: number, d = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Mensagem pronta para o WhatsApp a partir do que o cliente escolheu. */
export function bfMessage(items: string[], name?: string) {
  const list = items.length ? items.map((i) => `• ${i}`).join("\n") : "• Quero conhecer as ofertas";
  return `Olá! Vim pela página da Black Friday Quark${name ? ` e meu nome é ${name.trim()}` : ""}.\n\nTenho interesse em:\n${list}`;
}

/** Segmento do lead no CRM. */
export function bfSegment(cats: BfCategory[]): "solar" | "save" | "ambos" {
  const solar = cats.includes("solar");
  const ev = cats.includes("wallbox");
  if (solar && ev) return "ambos";
  if (ev) return "save";
  return "solar";
}
