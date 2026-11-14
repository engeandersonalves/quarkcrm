/**
 * Venda de scooter elétrica (Quark Mobilidade): dados da venda, totais e textos
 * usados no orçamento, no contrato de compra e venda e no certificado de garantia.
 */
import type { Contractor, Party } from "./documents.ts";
import { SCOOTERS, type ModelId } from "./catalog-mobilidade.ts";
import { fullAddress, type Cadastro } from "./cadastro-parser.ts";
import { installmentValue, type MotoProduct } from "./moto-products.ts";

export type MotoPayMethod = "pix" | "cartao" | "entrada" | "personalizado";

export interface MotoItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export interface MotoSpecs {
  power: string;
  battery: string;
  range: string;
  speed: string;
  load: string;
  brakes: string;
  recharge: string;
  weight: string;
}

export interface MotoData {
  contractor: Contractor;
  client: Party;
  model: ModelId | "outro";
  modelName: string;
  color: string;
  year: number;
  qty: number;
  /** Identificação do veículo: vai no contrato e no certificado. */
  chassis: string;
  motorNo: string;
  batteryNo: string;
  chargerNo: string;
  specs: MotoSpecs;
  /** Foto do modelo cadastrado (quando vem do catálogo do CRM). */
  photo?: string;
  /** Preço unitário da scooter (à vista). */
  price: number;
  accessories: MotoItem[];
  discount: number;
  freight: number;
  payment: {
    method: MotoPayMethod;
    installments: number;
    /** Valor de cada parcela no cartão (com os encargos da operadora). */
    installmentValue: number;
    entry: number;
    balanceWhen: string;
    multipleCards: boolean;
    custom: string;
  };
  delivery: { mode: "retirada" | "entrega"; address: string; date: string };
  warrantyDays: number;
  /** Descontinuado: a Quark não oferece revisão gratuita (mantido só para vendas antigas). */
  freeRevision: boolean;
  quoteValidityDays: number;
  quoteNotes: string;
  lateFee: number;
  interest: number;
  forum: string;
  forumState: string;
  extraClauses: string;
  witnesses: { name: string; doc: string }[];
  contractorSignature: string;
  place: string;
  date: string;
}

/* ---------------------------------------------------------------- catálogo */

export const MOTO_COLORS: Record<ModelId | "outro", string[]> = {
  t1: ["Branca", "Preta", "Prata"],
  cappuccino: ["Creme", "Branca", "Verde menta"],
  mz: ["Cinza e laranja", "Preta", "Branca"],
  outro: [],
};

/** Acessórios sugeridos (preço editável na venda). */
export const MOTO_ACCESSORIES: { name: string; price: number }[] = [
  { name: "Capacete", price: 150 },
  { name: "Baú traseiro", price: 220 },
  { name: "Cadeado antifurto em U", price: 90 },
  { name: "Capa protetora", price: 110 },
  { name: "Carregador extra", price: 380 },
  { name: "Retrovisores extras", price: 60 },
];

const specLookup = (id: ModelId, label: string) => SCOOTERS.find((s) => s.id === id)?.table?.[label] ?? "";

/** Especificações do modelo do catálogo (ficam salvas na venda e podem ser ajustadas). */
export function specsOf(id: ModelId): MotoSpecs {
  return {
    power: specLookup(id, "Motor") || "1.000W",
    battery: specLookup(id, "Bateria"),
    range: specLookup(id, "Autonomia"),
    speed: specLookup(id, "Velocidade") || "32 km/h",
    load: specLookup(id, "Carga máx."),
    brakes: specLookup(id, "Freios"),
    recharge: specLookup(id, "Recarga"),
    weight: specLookup(id, "Peso"),
  };
}

export const emptySpecs = (): MotoSpecs => ({ power: "1.000W", battery: "", range: "", speed: "32 km/h", load: "", brakes: "", recharge: "", weight: "" });

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayIso = () => iso(new Date());

export const newItem = (p: Partial<MotoItem> = {}): MotoItem => ({ id: Math.random().toString(36).slice(2, 10), name: "", qty: 1, price: 0, ...p });

/** Aplica um modelo do catálogo: nome, cor, ficha técnica e preços da Black. */
export function applyModel(d: MotoData, id: ModelId | "outro"): MotoData {
  if (id === "outro") return { ...d, model: "outro", modelName: d.model === "outro" ? d.modelName : "", specs: d.model === "outro" ? d.specs : emptySpecs() };
  const s = SCOOTERS.find((x) => x.id === id)!;
  return {
    ...d,
    model: id,
    modelName: s.name,
    color: MOTO_COLORS[id][0],
    specs: specsOf(id),
    price: s.cash,
    payment: { ...d.payment, installments: s.installments, installmentValue: s.installment },
  };
}

export function defaultMoto(opts: { client?: Partial<Party>; contractor: Contractor; signature?: string; place?: string; model?: ModelId }): MotoData {
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + 3);
  const base: MotoData = {
    contractor: opts.contractor,
    client: {
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
      ...opts.client,
    },
    model: "t1",
    modelName: "",
    color: "",
    year: new Date().getFullYear(),
    qty: 1,
    chassis: "",
    motorNo: "",
    batteryNo: "",
    chargerNo: "",
    specs: emptySpecs(),
    price: 0,
    accessories: [newItem({ name: "Capacete", price: 0 })],
    discount: 0,
    freight: 0,
    payment: { method: "cartao", installments: 21, installmentValue: 0, entry: 0, balanceWhen: "na entrega da scooter", multipleCards: true, custom: "" },
    delivery: { mode: "entrega", address: "", date: iso(delivery) },
    warrantyDays: 90,
    freeRevision: false,
    quoteValidityDays: 7,
    quoteNotes: "",
    lateFee: 2,
    interest: 1,
    forum: "Maceió",
    forumState: "Alagoas",
    extraClauses: "",
    witnesses: [
      { name: "", doc: "" },
      { name: "", doc: "" },
    ],
    contractorSignature: opts.signature ?? "",
    place: opts.place ?? "Maceió/AL",
    date: todayIso(),
  };
  return applyModel(base, opts.model ?? "t1");
}

/* ---------------------------------------------------------------- contas */

export const accessoriesTotal = (d: Pick<MotoData, "accessories">) => d.accessories.reduce((t, a) => t + (Number(a.qty) || 0) * (Number(a.price) || 0), 0);

/** Valor da venda à vista: scooter(s) + acessórios + frete − desconto. */
export function motoTotal(d: Pick<MotoData, "price" | "qty" | "accessories" | "discount" | "freight">) {
  const v = (Number(d.price) || 0) * Math.max(1, Number(d.qty) || 1) + accessoriesTotal(d) + (Number(d.freight) || 0) - (Number(d.discount) || 0);
  return Math.max(0, Math.round(v * 100) / 100);
}

/** Total pago no cartão (parcelas × valor da parcela). */
export const cardTotal = (d: Pick<MotoData, "payment">) => Math.round((Number(d.payment.installments) || 0) * (Number(d.payment.installmentValue) || 0) * 100) / 100;

/** Valor que vale no contrato: o total do cartão quando parcelado, senão o total à vista. */
export function contractValue(d: MotoData) {
  return d.payment.method === "cartao" && cardTotal(d) > 0 ? cardTotal(d) : motoTotal(d);
}

export const vehicleName = (d: Pick<MotoData, "modelName" | "model">) => `Scooter elétrica ${d.modelName.trim() || (d.model !== "outro" ? SCOOTERS.find((s) => s.id === d.model)?.name : "") || ""}`.trim();

/** Data em que a garantia termina (entrega + prazo). */
export function warrantyEnd(d: Pick<MotoData, "delivery" | "warrantyDays" | "date">) {
  const start = d.delivery.date || d.date;
  if (!start) return "";
  const dt = new Date(`${start}T12:00:00`);
  dt.setDate(dt.getDate() + Math.max(0, Number(d.warrantyDays) || 0));
  return iso(dt);
}

/** Garantia em vigor hoje? (a partir da entrega até o fim do prazo). */
export function warrantyActive(d: Pick<MotoData, "delivery" | "warrantyDays" | "date">, now = new Date()) {
  const end = warrantyEnd(d);
  if (!end) return false;
  const start = d.delivery.date || d.date;
  const today = iso(now);
  return start <= today && today <= end;
}

/** Número curto do documento (orçamento e certificado). */
export const shortNo = (id: string | null | undefined, prefix: string) => `${prefix}-${(id ?? "").replace(/-/g, "").slice(0, 6).toUpperCase() || "RASCUNHO"}`;

/* ---------------------------------------------------------------- garantia */

export const WARRANTY_COVERS = [
  "Motor elétrico (hub motor) e seus rolamentos",
  "Controlador eletrônico e chicote elétrico",
  "Bateria: defeitos de fabricação das células e do BMS",
  "Carregador original",
  "Painel, faróis, lanternas e setas (defeitos de fabricação)",
  "Quadro, garfo e soldas estruturais",
  "Sistema de alarme e chave de presença (NFC), quando houver",
];

export const WARRANTY_EXCLUDES = [
  "Desgaste natural: pneus, câmaras, pastilhas e lonas de freio, manetes, cabos, borrachas e lâmpadas",
  "Quedas, colisões, acidentes, vandalismo, furto ou roubo",
  "Submersão, água em excesso, lavagem com jato de alta pressão ou chuva intensa com alagamento",
  "Recarga com carregador que não seja o original ou em tomada sem aterramento ou fora da tensão indicada",
  "Excesso de carga acima do limite do modelo ou transporte de mais de um passageiro quando não permitido",
  "Alterações, adaptações, aumento de potência ou violação de lacres feitas por terceiros",
  "Bateria descarregada por longos períodos (mais de 30 dias sem recarga)",
  "Uso em competições, aluguel ou serviço de entregas sem acordo prévio",
];

export const CARE_TIPS = [
  "Recarregue com o carregador original, em tomada aterrada, de preferência à sombra e em local ventilado.",
  "Não deixe a bateria zerar: recarregue ao chegar a 20%. Se for guardar, deixe entre 50% e 80% e recarregue a cada 30 dias.",
  "Calibre os pneus toda semana conforme a pressão indicada no pneu.",
  "Limpe com pano úmido. Não use jato de alta pressão e não deixe a scooter em água acumulada.",
  "Respeite a carga máxima e use capacete. Acenda os faróis à noite e em dias de chuva.",
];

/** Revisões recomendadas (por conta do proprietário; a Quark não oferece revisão gratuita). */
export function revisionPlan(d: Pick<MotoData, "warrantyDays">) {
  return [
    { when: "30 dias ou 300 km", what: "Reaperto geral, freios, folgas, sistema elétrico e saúde da bateria" },
    { when: `${d.warrantyDays} dias`, what: "Revisão de fim da garantia: diagnóstico do motor, controlador e bateria" },
    { when: "A cada 6 meses", what: "Revisão completa do sistema elétrico, rolamentos e suspensão" },
  ];
}

/** Preenche a venda com o cadastro organizado (aba Cadastro). */
export function applyCadastro(d: MotoData, c: Cadastro): MotoData {
  const address = fullAddress(c);
  let next: MotoData = {
    ...d,
    client: {
      ...d.client,
      kind: c.doc.replace(/\D/g, "").length > 11 ? "pj" : "pf",
      name: c.name || d.client.name,
      doc: c.doc.replace(/\D/g, "") || d.client.doc,
      rg: c.rg || d.client.rg,
      nationality: c.nationality || d.client.nationality,
      marital: c.marital || d.client.marital,
      profession: c.profession || d.client.profession,
      address: address || d.client.address,
      city: c.city || d.client.city,
      state: c.state || d.client.state,
      cep: c.cep.replace(/\D/g, "") || d.client.cep,
      email: c.email || d.client.email,
      phone: c.phone || d.client.phone,
    },
    chassis: c.chassis || d.chassis,
    motorNo: c.motorNo || d.motorNo,
    batteryNo: c.batteryNo || d.batteryNo,
  };
  if (c.model && c.model !== next.model) next = applyModel(next, c.model);
  if (c.color) next = { ...next, color: c.color };
  if (address) next = { ...next, delivery: { ...next.delivery, address: [address, c.city && `${c.city}/${c.state || "AL"}`].filter(Boolean).join(", ") } };
  const pay = c.payment.toLowerCase();
  if (pay) {
    const n = pay.match(/(\d{1,2})\s*x/);
    if (/pix|[àa] vista|dinheiro/.test(pay)) next = { ...next, payment: { ...next.payment, method: "pix" } };
    else if (/entrada/.test(pay)) next = { ...next, payment: { ...next.payment, method: "entrada" } };
    else if (n || /cart[aã]o|cr[eé]dito/.test(pay)) next = { ...next, payment: { ...next.payment, method: "cartao", installments: n ? Number(n[1]) : next.payment.installments } };
    else next = { ...next, payment: { ...next.payment, method: "personalizado", custom: c.payment } };
  }
  return next;
}

/** Aplica um modelo cadastrado no CRM: nome, cor, foto, ficha técnica, preço e parcela (Tabela Price). */
export function applyProduct(d: MotoData, p: MotoProduct): MotoData {
  const s = p.specs;
  return {
    ...d,
    model: p.slug,
    modelName: p.name,
    color: p.colors[0] ?? d.color,
    photo: p.photo || undefined,
    specs: { power: s.power, battery: s.battery, range: s.range, speed: s.speed, load: s.load, brakes: s.brakes, recharge: s.recharge, weight: s.weight },
    price: p.price,
    payment: { ...d.payment, installments: p.installments, installmentValue: installmentValue(p.price, p.installments, p.rate) },
  };
}

/** Foto da scooter da venda (modelo cadastrado ou do catálogo de lançamento). */
export const motoPhoto = (d: Pick<MotoData, "photo" | "model">) =>
  d.photo || ({ t1: "/mob/t1-perfil.webp", cappuccino: "/mob/cappuccino-estudio.png", mz: "/mob/mz-perfil.webp" } as Record<string, string>)[d.model] || "/mob/cmp-scooter.webp";
