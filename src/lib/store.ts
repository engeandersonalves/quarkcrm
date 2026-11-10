/**
 * Loja online (sem preços): catálogo, kits prontos e o "Monte seu sistema".
 * Tudo aqui é editável: nomes, potências, textos, garantias e perguntas.
 */

export type Place = "casa" | "comercio" | "rural";
export type Mount = "ceramico" | "fibrocimento" | "metalico" | "laje" | "solo" | "carport";
export type Grid = "mono" | "bi" | "tri";

export const MODULE_W = 610;
/** Área ocupada por placa (m²), já com espaço de manutenção. */
export const AREA_PER_MODULE = 2.9;
const PR = 0.8;
/** Consumo mínimo cobrado pela distribuidora (kWh) por tipo de ligação. */
export const MIN_KWH: Record<Grid, number> = { mono: 30, bi: 50, tri: 100 };

export const PLACES: { id: Place; label: string; short: string; text: string }[] = [
  { id: "casa", label: "Para sua casa", short: "Casa", text: "Conta menor todo mês e imóvel mais valorizado." },
  { id: "comercio", label: "Para seu negócio", short: "Comércio", text: "Energia vira custo fixo baixo e previsível." },
  { id: "rural", label: "Para o campo", short: "Rural", text: "Irrigação, ordenha e granja com energia do sol." },
];

export const MOUNTS: { id: Mount; label: string; text: string }[] = [
  { id: "ceramico", label: "Telha cerâmica", text: "Ganchos de inox entre as telhas, sem furar a telha." },
  { id: "fibrocimento", label: "Fibrocimento", text: "Fixação na madeira ou no metal da estrutura." },
  { id: "metalico", label: "Telhado metálico", text: "Mini trilhos direto na telha, com vedação." },
  { id: "laje", label: "Laje", text: "Triângulos com a inclinação ideal para o sol." },
  { id: "solo", label: "No solo", text: "Ideal para sítios, fazendas e terrenos amplos." },
  { id: "carport", label: "Garagem solar", text: "Cobre os carros e ainda gera energia." },
];

export interface Kit {
  id: string;
  place: Place;
  name: string;
  modules: number;
  /** Para quem é. */
  tag: string;
  /** Destaque do kit. */
  best?: boolean;
  offgrid?: boolean;
}

export const KITS: Kit[] = [
  { id: "casa-2", place: "casa", name: "Casa Compacta", modules: 4, tag: "Apartamento térreo ou casa pequena" },
  { id: "casa-3", place: "casa", name: "Casa Essencial", modules: 6, tag: "Família de 2 a 3 pessoas" },
  { id: "casa-5", place: "casa", name: "Casa Conforto", modules: 9, tag: "Família com ar-condicionado", best: true },
  { id: "casa-7", place: "casa", name: "Casa Premium", modules: 12, tag: "Casa grande, piscina e 2 ares" },
  { id: "casa-10", place: "casa", name: "Casa Total", modules: 16, tag: "Alto consumo ou carro elétrico" },
  { id: "com-12", place: "comercio", name: "Comércio Start", modules: 20, tag: "Loja, salão ou escritório" },
  { id: "com-18", place: "comercio", name: "Comércio Pro", modules: 30, tag: "Restaurante, padaria ou clínica", best: true },
  { id: "com-30", place: "comercio", name: "Comércio Plus", modules: 50, tag: "Mercado ou academia" },
  { id: "com-49", place: "comercio", name: "Empresa 50", modules: 80, tag: "Indústria leve e galpões" },
  { id: "com-75", place: "comercio", name: "Empresa 75", modules: 122, tag: "Grande consumo em baixa tensão" },
  { id: "rur-10", place: "rural", name: "Sítio", modules: 16, tag: "Casa sede e bomba d’água" },
  { id: "rur-24", place: "rural", name: "Fazenda", modules: 40, tag: "Ordenha, resfriador e irrigação", best: true },
  { id: "rur-49", place: "rural", name: "Agro 50", modules: 80, tag: "Granja, pivô ou agroindústria" },
  { id: "rur-off", place: "rural", name: "Off-grid com baterias", modules: 6, tag: "Onde não chega rede elétrica", offgrid: true },
];

export const kitKwp = (modules: number) => Math.round(((modules * MODULE_W) / 1000) * 100) / 100;
export const monthlyKwh = (kwp: number, sunHours = 5.2) => Math.round(kwp * sunHours * 30 * PR);
export const areaOf = (modules: number) => Math.ceil(modules * AREA_PER_MODULE);

/** O que vem em todo kit (didático para o cliente). */
export const KIT_INCLUDES = [
  { t: "Placas solares", d: `Módulos de ${MODULE_W} W de alta eficiência` },
  { t: "Inversor", d: "Transforma a energia do sol na energia da sua casa" },
  { t: "Estrutura", d: "Feita para o seu tipo de telhado ou solo" },
  { t: "Cabos e proteções", d: "Cabo solar, conectores MC4, DPS e disjuntores" },
  { t: "Projeto e homologação", d: "Cuidamos de toda a papelada com a distribuidora" },
  { t: "Instalação", d: "Equipe própria, com segurança e acabamento" },
  { t: "Monitoramento", d: "Acompanhe a geração pelo celular" },
];

export interface Sizing {
  kwh: number;
  kwp: number;
  modules: number;
  area: number;
  generation: number;
  /** Economia estimada por mês (R$), a partir da própria conta. */
  saving: number;
  savingPct: number;
  trees: number;
  co2Kg: number;
  kit: Kit | null;
}

/** Dimensiona o sistema a partir da conta de luz (R$) ou do consumo (kWh). */
export function sizeSystem({ bill, kwh, grid = "bi", place = "casa", tariff = 0.95, sunHours = 5.2 }: { bill?: number; kwh?: number; grid?: Grid; place?: Place; tariff?: number; sunHours?: number }): Sizing {
  const t = tariff > 0 ? tariff : 0.95;
  const consumption = Math.max(0, kwh && kwh > 0 ? kwh : (bill ?? 0) / t);
  const target = Math.max(0, consumption - MIN_KWH[grid]);
  const kwpNeed = target / (Math.max(3, sunHours) * 30 * PR);
  const modules = target > 0 ? Math.max(2, Math.ceil((kwpNeed * 1000) / MODULE_W)) : 0;
  const kwp = kitKwp(modules);
  const generation = monthlyKwh(kwp, sunHours);
  const billNow = consumption * t;
  const saving = Math.max(0, Math.min(billNow, generation * t));
  const savingPct = billNow > 0 ? Math.min(95, Math.round((saving / billNow) * 100)) : 0;
  const co2Kg = Math.round(generation * 12 * 0.0817 * 10) / 10; // fator médio do SIN (kg CO₂/kWh)
  const candidates = KITS.filter((k) => k.place === place && !k.offgrid);
  const kit = modules ? (candidates.find((k) => k.modules >= modules) ?? candidates[candidates.length - 1] ?? null) : null;
  return { kwh: Math.round(consumption), kwp, modules, area: areaOf(modules), generation, saving: Math.round(saving), savingPct, trees: Math.round(co2Kg / 22), co2Kg, kit };
}

/* ------------------------------------------------------------- eletropostos */

export interface Charger {
  id: string;
  name: string;
  power: number;
  kind: "AC" | "DC";
  where: string;
  grid: string;
  /** Horas para carregar 50 kWh (carro médio). */
  hours: number;
  features: string[];
}

export const CHARGERS: Charger[] = [
  { id: "wb-7", name: "Wallbox Casa 7 kW", power: 7.4, kind: "AC", where: "Garagem de casa", grid: "Monofásico 220 V", hours: 50 / 7.4, features: ["App no celular", "Agendamento noturno", "Cabo tipo 2"] },
  { id: "wb-11", name: "Wallbox 11 kW", power: 11, kind: "AC", where: "Casa trifásica e condomínios", grid: "Trifásico 380 V", hours: 50 / 11, features: ["Controle por usuário", "Medição de consumo", "Uso externo IP65"] },
  { id: "wb-22", name: "Eletroposto 22 kW", power: 22, kind: "AC", where: "Empresas, hotéis e shoppings", grid: "Trifásico 380 V", hours: 50 / 22, features: ["2 carros ao mesmo tempo", "Cobrança por app", "Gestão remota"] },
  { id: "dc-60", name: "Carregador rápido DC 60 kW", power: 60, kind: "DC", where: "Postos, rodovias e frotas", grid: "Média tensão / trifásico", hours: 50 / 60, features: ["De 20% a 80% em ~30 min", "CCS2", "Pagamento integrado"] },
];

/* ---------------------------------------------------------------- motos */

export interface Moto {
  id: string;
  name: string;
  kind: string;
  powerW: number;
  speed: number;
  range: number;
  charge: string;
  license: string;
  highlight: string;
}

export const MOTOS: Moto[] = [
  { id: "m-urb", name: "Urbana 1000", kind: "Autopropelido", powerW: 1000, speed: 32, range: 50, charge: "6 a 8 h na tomada", license: "Sem CNH e sem placa*", highlight: "Para o dia a dia no bairro" },
  { id: "m-city", name: "City 2000", kind: "Scooter", powerW: 2000, speed: 50, range: 70, charge: "6 h na tomada", license: "CNH A ou ACC", highlight: "Trabalho e faculdade", },
  { id: "m-sport", name: "Sport 3000", kind: "Moto", powerW: 3000, speed: 75, range: 90, charge: "Bateria removível", license: "CNH A", highlight: "Mais potência e autonomia" },
  { id: "m-cargo", name: "Cargo 3000", kind: "Moto de entregas", powerW: 3000, speed: 60, range: 100, charge: "Troca rápida de bateria", license: "CNH A", highlight: "Baú para delivery e frotas" },
];

/* ------------------------------------------------------- material elétrico */

export const MATERIALS: { id: string; name: string; text: string }[] = [
  { id: "cabos", name: "Cabos", text: "Cabo solar, flexível e de alumínio" },
  { id: "disjuntores", name: "Disjuntores", text: "Mono, bi, tri e caixa moldada" },
  { id: "dps", name: "DPS", text: "Proteção contra surtos CA e CC" },
  { id: "quadros", name: "Quadros e string box", text: "Montados e certificados" },
  { id: "conectores", name: "Conectores", text: "MC4, terminais e emendas" },
  { id: "aterramento", name: "Aterramento", text: "Hastes, cabos e conectores" },
  { id: "eletrodutos", name: "Eletrodutos", text: "Corrugados, rígidos e eletrocalhas" },
  { id: "iluminacao", name: "Iluminação LED", text: "Refletores, painéis e solar" },
];

/* --------------------------------------------------------------- serviços */

export const SERVICES: { id: string; name: string; text: string }[] = [
  { id: "projeto", name: "Projeto sob medida", text: "Estudo da sua conta, do telhado e da sombra para gerar o máximo." },
  { id: "homologacao", name: "Homologação", text: "Toda a papelada com a distribuidora até a troca do medidor." },
  { id: "limpeza", name: "Limpeza e manutenção", text: "Placas limpas geram até 25% a mais. Revisão elétrica completa." },
  { id: "monitoramento", name: "Monitoramento", text: "Acompanhamos sua usina e avisamos se algo sair do normal." },
  { id: "ampliacao", name: "Ampliação de sistema", text: "Seu consumo cresceu? Aumentamos sua usina sem perder garantia." },
  { id: "condominio", name: "Eletroposto em condomínio", text: "Projeto com medição individual e rateio por morador." },
  { id: "gestao", name: "Gestão de créditos", text: "Use a energia de uma usina em outros imóveis seus." },
  { id: "laudo", name: "Laudos e vistorias", text: "Termografia, aterramento e laudo técnico com ART." },
];

/* ----------------------------------------------- benefícios, garantias e FAQ */

export const BENEFITS = [
  { id: "economia", t: "Até 95% de economia", d: "Você passa a pagar praticamente só a taxa mínima da distribuidora." },
  { id: "retorno", t: "Se paga sozinho", d: "O investimento costuma voltar em 3 a 5 anos. Depois, é lucro por mais de 20 anos." },
  { id: "protecao", t: "Livre dos aumentos", d: "A conta de luz sobe todo ano. A energia do seu telhado, não." },
  { id: "valorizacao", t: "Imóvel valorizado", d: "Casas e salas com energia solar vendem e alugam melhor." },
  { id: "manutencao", t: "Quase sem manutenção", d: "Sem peças móveis. Basta uma limpeza e revisão periódica." },
  { id: "planeta", t: "Energia limpa", d: "Menos CO₂ no ar: cada sistema equivale a dezenas de árvores." },
];

export const WARRANTIES = [
  { id: "modulos", t: "Placas solares", years: 12, d: "contra defeitos de fabricação", extra: "e de 25 a 30 anos de performance garantida (mínimo de 80% da potência)" },
  { id: "inversor", t: "Inversor", years: 10, d: "de garantia do fabricante", extra: "com extensão disponível em alguns modelos" },
  { id: "estrutura", t: "Estrutura", years: 12, d: "contra corrosão", extra: "alumínio e aço inox de alta resistência" },
  { id: "instalacao", t: "Instalação", years: 1, d: "de garantia da nossa equipe", extra: "com suporte técnico e acompanhamento" },
];

export const STEPS = [
  { t: "Cotação", d: "Você escolhe e nosso consultor responde rapidinho." },
  { t: "Visita técnica", d: "Avaliamos o telhado, a sombra e o quadro de energia." },
  { t: "Projeto e homologação", d: "Desenhamos o sistema e aprovamos na distribuidora." },
  { t: "Instalação", d: "Em geral de 1 a 3 dias para residências." },
  { t: "Sol gerando economia", d: "Medidor trocado, app configurado e conta menor." },
];

export const FAQ = [
  { q: "Funciona em dia nublado ou à noite?", a: "Em dias nublados o sistema gera menos, mas continua gerando. À noite você usa os créditos da energia que sobrou durante o dia, que ficam guardados na distribuidora por até 5 anos." },
  { q: "Preciso trocar o meu telhado?", a: "Na maioria dos casos, não. Avaliamos o telhado na visita técnica e usamos a estrutura certa para cada tipo: cerâmico, fibrocimento, metálico, laje ou solo." },
  { q: "Quanto tempo leva para começar a economizar?", a: "A instalação leva poucos dias. A homologação na distribuidora costuma levar de 30 a 60 dias, e cuidamos de tudo para você." },
  { q: "E a Lei 14.300 (taxação do sol)?", a: "A lei trouxe uma cobrança gradual sobre parte da energia injetada (Fio B). Mesmo assim, a energia solar continua sendo um dos melhores investimentos: a economia segue muito alta e já está nos nossos cálculos." },
  { q: "Dá para financiar?", a: "Sim. Trabalhamos com financiamento solar e cartão. Em muitos casos, a parcela fica menor que a economia na conta." },
  { q: "Precisa de manutenção?", a: "Pouca: limpeza das placas e uma revisão elétrica periódica. Oferecemos planos de manutenção e monitoramento." },
  { q: "Moto elétrica precisa de CNH?", a: "Depende da categoria. Autopropelidos de até 32 km/h e 1000 W dispensam CNH e placa; ciclomotores e motos exigem habilitação e emplacamento, conforme as regras do Contran. O consultor explica cada modelo." },
  { q: "Posso carregar o carro com energia solar?", a: "Pode! Somamos o consumo do carregador no projeto e o sol abastece o seu carro. Quilômetro rodado muito mais barato." },
];

export type CartKind = "kit" | "custom" | "charger" | "moto" | "material" | "service";
export interface CartItem {
  key: string;
  kind: CartKind;
  title: string;
  detail: string;
}

export const KIND_LABEL: Record<CartKind, string> = {
  kit: "Kit solar",
  custom: "Sistema sob medida",
  charger: "Eletroposto",
  moto: "Moto elétrica",
  material: "Material elétrico",
  service: "Serviço",
};

/** Segmento do lead conforme o que o cliente pediu. */
export function segmentOf(items: CartItem[]): "solar" | "eletroposto" | "manutencao" | "ambos" {
  const has = (k: CartKind) => items.some((i) => i.kind === k);
  const solar = has("kit") || has("custom");
  if (has("charger") && solar) return "ambos";
  if (has("charger")) return "eletroposto";
  if (!solar && items.length && items.every((i) => i.kind === "service" && /limpeza|monitoramento|laudo/.test(i.key))) return "manutencao";
  return "solar";
}

/** Resumo do pedido para o lead e para o WhatsApp (até 2000 caracteres). */
export function quoteSummary(items: CartItem[], extra?: string) {
  const lines = items.map((i) => `• ${KIND_LABEL[i.kind]}: ${i.title}${i.detail ? ` (${i.detail})` : ""}`);
  return [`Pedido de cotação pela loja online (${items.length} ${items.length === 1 ? "item" : "itens"}):`, ...lines, extra ? `\nObservação: ${extra}` : ""].join("\n").trim().slice(0, 1990);
}

export const fmt = (v: number, d = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
