/**
 * Catálogo Quark Mobilidade · Black Friday (dados do PDF da campanha).
 * Para mudar preços, fichas ou textos, edite só este arquivo.
 */

export const CATALOG_ID = "mobilidade-black";
export const CATALOG_NAME = "Quark Mobilidade · Black Friday";
export const MOB_WHATSAPP = "5582991831476";
export const MOB_HOURS = "Atendimento de segunda a sexta, das 7h às 17h";

export type ModelId = "t1" | "cappuccino" | "mz";

export interface Scooter {
  id: ModelId;
  name: string;
  kicker: string;
  pitch: string;
  forWho: string;
  image: string;
  accent: string;
  specs: { label: string; value: string; sub: string; icon: "bolt" | "battery" | "route" | "brake" | "weight" | "lock" | "gear" | "shield" }[];
  table: Record<string, string>;
  installments: number;
  installment: number;
  cash: number;
  total: number;
}

export const SCOOTERS: Scooter[] = [
  {
    id: "t1",
    name: "T1",
    kicker: "A prática do dia a dia",
    pitch: "Cesto, garupa e 1.000W de força para trabalho, faculdade e mercado.",
    forWho: "trabalha, entrega ou estuda e quer economizar todo dia.",
    image: "/mob/t1.jpg",
    accent: "#F3E93B",
    specs: [
      { icon: "bolt", value: "1.000W", sub: "motor elétrico", label: "Motor" },
      { icon: "battery", value: "Lítio 64V 20Ah", sub: "dura anos", label: "Bateria" },
      { icon: "route", value: "50 km", sub: "de autonomia", label: "Autonomia" },
      { icon: "brake", value: "Hidráulico", sub: "freio dianteiro", label: "Freio" },
      { icon: "weight", value: "Até 150 kg", sub: "de carga", label: "Carga" },
      { icon: "lock", value: "NFC + alarme", sub: "segurança", label: "Segurança" },
    ],
    table: { Motor: "1.000W", Bateria: "Lítio 64V 20Ah", Autonomia: "50 km", Velocidade: "32 km/h", Recarga: "6 a 7 h", "Carga máx.": "150 kg", Freios: "Hidráulico + tambor", Destaque: "Cesto e garupa", Peso: "58 kg" },
    installments: 21,
    installment: 385,
    cash: 6799,
    total: 8085,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    kicker: "A clássica retrô",
    pitch: "Visual vintage, banco de couro e encosto. Charme com força de verdade.",
    forWho: "quer chegar com estilo e passear a dois com conforto.",
    image: "/mob/cappuccino.jpg",
    accent: "#E8D3B0",
    specs: [
      { icon: "bolt", value: "1.000W", sub: "motor elétrico", label: "Motor" },
      { icon: "battery", value: "Lítio 60V 20Ah", sub: "dura anos", label: "Bateria" },
      { icon: "route", value: "60 a 80 km", sub: "de autonomia", label: "Autonomia" },
      { icon: "gear", value: "3 marchas", sub: "de velocidade", label: "Marchas" },
      { icon: "weight", value: "Até 180 kg", sub: "de carga", label: "Carga" },
      { icon: "lock", value: "NFC + alarme", sub: "segurança", label: "Segurança" },
    ],
    table: { Motor: "1.000W", Bateria: "Lítio 60V 20Ah", Autonomia: "60 a 80 km", Velocidade: "32 km/h", Recarga: "~6 h", "Carga máx.": "180 kg", Freios: "Disco + tambor", Destaque: "3 marchas, retrô", Peso: "66 kg" },
    installments: 21,
    installment: 446,
    cash: 7499,
    total: 9366,
  },
  {
    id: "mz",
    name: "MZ",
    kicker: "A esportiva top de linha",
    pitch: "A maior autonomia da linha: 100 km por carga e freio hidráulico nas duas rodas.",
    forWho: "roda o dia inteiro e não quer se preocupar com bateria.",
    image: "/mob/mz.jpg",
    accent: "#FF8A3D",
    specs: [
      { icon: "bolt", value: "1.000W", sub: "motor elétrico", label: "Motor" },
      { icon: "battery", value: "Grafeno 72V", sub: "alta performance", label: "Bateria" },
      { icon: "route", value: "100 km", sub: "de autonomia", label: "Autonomia" },
      { icon: "brake", value: "Disco hidráulico", sub: "nas 2 rodas", label: "Freios" },
      { icon: "weight", value: "Até 185 kg", sub: "de carga", label: "Carga" },
      { icon: "shield", value: "Alarme", sub: "painel LED", label: "Segurança" },
    ],
    table: { Motor: "1.000W", Bateria: "Grafeno 72V", Autonomia: "100 km", Velocidade: "32 km/h", Recarga: "~6 h", "Carga máx.": "185 kg", Freios: "Hidráulico nas 2", Destaque: "Top de linha", Peso: "135 kg" },
    installments: 21,
    installment: 520,
    cash: 8799,
    total: 10920,
  },
];

export const TABLE_ROWS = ["Motor", "Bateria", "Autonomia", "Velocidade", "Recarga", "Carga máx.", "Freios", "Destaque", "Peso"];

export const VERSUS = [
  { label: "Bateria", quark: "Lítio ou grafeno", common: "Menor, às vezes chumbo" },
  { label: "Subidas", quark: "Sobe com folga", common: "Perde força" },
  { label: "Freios", quark: "Disco / hidráulico", common: "Básicos" },
  { label: "Pós-venda", quark: "Garantia + suporte local", common: "Sem assistência" },
  { label: "Entrega", quark: "Montada na sua casa", common: "Na caixa, monte você" },
];

export const SERVICES = [
  { title: "Energia solar", text: "on grid, off grid e híbridos" },
  { title: "Projeto e homologação", text: "aprovado na distribuidora" },
  { title: "Manutenção e pós-venda", text: "créditos, rateio, titularidade" },
  { title: "Wallbox e S.A.V.E", text: "recarga do carro em casa" },
  { title: "Eletroposto", text: "nova renda para o seu negócio" },
  { title: "Quark Mobilidade", text: "scooters 1.000W com garantia" },
];

/** Custo de uma carga na tomada (bateria da T1: 1,28 kWh). */
export const chargeCost = (tariff = 1.1, kwh = 1.28) => tariff * kwh;

/**
 * Economia mensal estimada trocando a gasolina pela scooter.
 * gasolina: R$/litro; kmL: consumo da moto/carro a gasolina; km por dia; dias rodados por mês.
 */
export function fuelSavings({ kmDay, days = 22, fuel = 6.3, kmL = 35, tariff = 1.1, kmPerCharge = 50, kwh = 1.28 }: { kmDay: number; days?: number; fuel?: number; kmL?: number; tariff?: number; kmPerCharge?: number; kwh?: number }) {
  const km = Math.max(0, kmDay) * days;
  const gas = (km / Math.max(1, kmL)) * fuel;
  const electric = (km / Math.max(1, kmPerCharge)) * kwh * tariff;
  return { km, gas, electric, saved: Math.max(0, gas - electric), year: Math.max(0, gas - electric) * 12 };
}

/** Quiz "qual combina com você": devolve o modelo indicado. */
export function recommend(a: { use?: "trabalho" | "passeio" | "longo"; km?: "curto" | "medio" | "longo"; style?: "pratico" | "classico" | "esportivo" }): ModelId {
  const score: Record<ModelId, number> = { t1: 0, cappuccino: 0, mz: 0 };
  if (a.use === "trabalho") score.t1 += 2;
  if (a.use === "passeio") score.cappuccino += 2;
  if (a.use === "longo") score.mz += 2;
  if (a.km === "curto") score.t1 += 1;
  if (a.km === "medio") score.cappuccino += 1;
  if (a.km === "longo") score.mz += 2;
  if (a.style === "pratico") score.t1 += 1;
  if (a.style === "classico") score.cappuccino += 2;
  if (a.style === "esportivo") score.mz += 1;
  return (Object.entries(score).sort((x, y) => y[1] - x[1])[0][0] as ModelId) ?? "t1";
}

export const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
