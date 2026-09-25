/**
 * Simulações da página de captura (usadas no navegador e, de novo, no servidor para o e-mail).
 * Premissas de mercado ficam aqui, em um só lugar, para ajuste fácil.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/* ------------------------------------------------ Carro elétrico × gasolina */

export const EV = {
  gasPrice: 6.29, // R$/L
  kwhPer100km: 17, // consumo médio de um elétrico
  co2KgPerLiter: 2.3, // emissão da gasolina
};

export function evCompare({ kmMonth, kmPerLiter, tariff = 0.95 }: { kmMonth: number; kmPerLiter: number; tariff?: number }) {
  const km = clamp(kmMonth, 100, 10000);
  const kml = clamp(kmPerLiter, 5, 25);
  const liters = km / kml;
  const gasMonth = liters * EV.gasPrice;
  const evMonth = (km / 100) * EV.kwhPer100km * tariff;
  const savingMonth = gasMonth - evMonth;
  return {
    km,
    gasMonth,
    evMonth,
    savingMonth,
    savingYear: savingMonth * 12,
    saving5y: savingMonth * 60,
    perKmGas: gasMonth / km,
    perKmEv: evMonth / km,
    times: evMonth > 0 ? gasMonth / evMonth : 0,
    co2TonsYear: (liters * 12 * EV.co2KgPerLiter) / 1000,
  };
}

/* ------------------------------------------------------------ Eletroposto */

export const STATION = {
  kwhPerSession: 30, // energia média por recarga rápida
  pricePerKwh: 2.19, // preço de venda ao motorista (R$/kWh)
  energyCost: 0.95, // custo da energia comprada (R$/kWh), sem solar
  feesPct: 10, // app de pagamento, manutenção e seguro (% da receita)
  operatingHours: 16,
  crossBuyRate: 0.6, // motoristas que consomem no local enquanto carregam
  /** Investimento de referência por potência (equipamento DC + infraestrutura), em R$. */
  invest: { 40: 60000, 60: 80000, 80: 100000 } as Record<number, number>,
};

export const POWERS = [40, 60, 80];

export const BUSINESSES = [
  { id: "posto", label: "Posto de combustível", ticket: 35 },
  { id: "restaurante", label: "Restaurante ou café", ticket: 60 },
  { id: "shopping", label: "Shopping ou estacionamento", ticket: 90 },
  { id: "hotel", label: "Hotel ou pousada", ticket: 150 },
  { id: "mercado", label: "Supermercado", ticket: 120 },
  { id: "outro", label: "Outro negócio", ticket: 50 },
] as const;
export type BusinessId = (typeof BUSINESSES)[number]["id"];

export function stationCapacity(power: number) {
  return Math.floor((power * 0.85 * STATION.operatingHours) / STATION.kwhPerSession);
}

export function stationSim({ power, sessionsDay, business }: { power: number; sessionsDay: number; business: string }) {
  const p = POWERS.includes(power) ? power : 60;
  const capacity = stationCapacity(p);
  const sessions = clamp(Math.round(sessionsDay), 1, capacity);
  const sessionsMonth = sessions * 30;
  const kwhMonth = sessionsMonth * STATION.kwhPerSession;
  const revenue = kwhMonth * STATION.pricePerKwh;
  const energyCost = kwhMonth * STATION.energyCost;
  const fees = (revenue * STATION.feesPct) / 100;
  const net = revenue - energyCost - fees;
  const ticket = BUSINESSES.find((b) => b.id === business)?.ticket ?? 50;
  const crossSell = sessionsMonth * STATION.crossBuyRate * ticket;
  const invest = STATION.invest[p];
  return {
    power: p,
    capacity,
    sessions,
    sessionsMonth,
    kwhMonth,
    revenue,
    energyCost,
    fees,
    net,
    crossSell,
    ticket,
    invest,
    paybackMonths: net > 0 ? invest / net : 0,
    net5y: net * 60 - invest,
  };
}

/* ------------------------------------------------ Limpeza e manutenção */

export const CLEANING = [
  { id: "menos6", label: "Menos de 6 meses", loss: 0.03 },
  { id: "6a12", label: "6 a 12 meses", loss: 0.07 },
  { id: "mais1ano", label: "Mais de 1 ano", loss: 0.12 },
  { id: "nunca", label: "Nunca limpei", loss: 0.18 },
] as const;

export function maintenanceSim({ kwp, last, tariff = 0.95, sunHours = 5.2 }: { kwp: number; last: string; tariff?: number; sunHours?: number }) {
  const size = clamp(kwp, 1, 5000);
  const lossPct = CLEANING.find((c) => c.id === last)?.loss ?? 0.12;
  const genMonth = size * sunHours * 30 * 0.8;
  const lossKwh = genMonth * lossPct;
  const lossMonth = lossKwh * tariff;
  return { kwp: size, lossPct, efficiency: 1 - lossPct, genMonth, lossKwh, lossMonth, lossYear: lossMonth * 12, loss5y: lossMonth * 60 };
}

/* ------------------------------------------------------ Gestão energética */

export const MANAGEMENT = [
  { id: "titularidade", label: "Troca de titularidade", text: "Conta no nome certo para homologar, financiar e aproveitar os créditos." },
  { id: "rateio", label: "Rateio de créditos", text: "Distribua a energia gerada entre casa, empresa e outros imóveis." },
  { id: "gestao", label: "Gestão da conta de energia", text: "Acompanhamos geração, créditos e cobranças todo mês, sem você se preocupar." },
  { id: "revisao", label: "Revisão de tarifa e cobranças", text: "Encontramos cobranças indevidas e a modalidade tarifária mais barata." },
] as const;
