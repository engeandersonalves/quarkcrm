/**
 * Modelo de dados do Simulador Solar (Quark Lab).
 *
 * Tudo aqui é JSON puro: um cenário pode ser salvo, exportado, comparado e
 * reproduzido exatamente (o clima é gerado com semente fixa).
 * Convenções: potência em kW, energia em kWh, tempo em horas, ângulos em graus.
 */

export type StorageTech =
  | "lfp"
  | "nmc"
  | "lead"
  | "sodium"
  | "flow"
  | "supercap"
  | "gravity"
  | "pumped"
  | "hydrogen";

export interface StorageUnit {
  id: string;
  name: string;
  tech: StorageTech;
  /** Capacidade nominal útil de projeto (kWh elétricos na saída). */
  capacityKWh: number;
  /** Potência máxima de carga (kW na entrada). */
  chargeKW: number;
  /** Potência máxima de descarga (kW na saída). */
  dischargeKW: number;
  /** Eficiência de carga (0–1). */
  etaCharge: number;
  /** Eficiência de descarga (0–1). */
  etaDischarge: number;
  /** Estado de carga mínimo permitido (0–1) — limita a profundidade de descarga. */
  socMin: number;
  socMax: number;
  /** Estado de carga no início da simulação (0–1). */
  socInitial: number;
  /** Autodescarga (% da energia armazenada por dia). */
  selfDischargePctDay: number;
  /** Ciclos equivalentes completos até o fim de vida. */
  cycleLife: number;
  /** Perda de capacidade por ano parado (calendário), %. */
  calendarFadePctYear: number;
  /** Custo de investimento (R$) — usado no LCOS. */
  capex: number;
  /** Prioridade na ordem de despacho (menor = primeiro). */
  priority: number;
  /** Parâmetros físicos opcionais usados só para exibir/derivar a capacidade. */
  physical?: { massT?: number; heightM?: number; volumeM3?: number; h2Kg?: number };
}

export type LoadKind = "profile" | "appliance" | "motor" | "pump" | "ev" | "waterheater" | "deferrable";

export interface LoadBase {
  id: string;
  name: string;
  kind: LoadKind;
  enabled: boolean;
}

/** Consumo de fundo de uma casa/comércio a partir de um perfil horário típico. */
export interface ProfileLoad extends LoadBase {
  kind: "profile";
  /** Consumo médio diário (kWh/dia). */
  dailyKWh: number;
  shape: "residencial" | "comercial" | "rural" | "industrial" | "plano";
  /** Variação aleatória (0–0.5). */
  noise: number;
  /** Fator de consumo no fim de semana. */
  weekendFactor: number;
}

/** Equipamento com horário fixo (ar-condicionado, chuveiro, geladeira…). */
export interface ApplianceLoad extends LoadBase {
  kind: "appliance";
  powerKW: number;
  start: number;
  end: number;
  /** Fração do tempo ligado dentro da janela (ciclo do compressor). */
  duty: number;
  days: "todos" | "uteis" | "fds";
}

/** Motor de indução trifásico/monofásico com rendimento e partida. */
export interface MotorLoad extends LoadBase {
  kind: "motor";
  /** Potência mecânica no eixo (kW). 1 cv ≈ 0,7355 kW. */
  shaftKW: number;
  /** Fator de carga (0–1.2). */
  loadFactor: number;
  efficiency: number;
  powerFactor: number;
  /** Corrente de partida / nominal (partida direta ≈ 6–8; inversor de frequência ≈ 1–1,5). */
  startMultiplier: number;
  start: number;
  end: number;
  days: "todos" | "uteis" | "fds";
  /** Se verdadeiro, o motor só roda com excedente solar (máquina "solar"). */
  solarOnly: boolean;
}

/** Bomba d'água: a caixa-d'água funciona como bateria hídrica. */
export interface PumpLoad extends LoadBase {
  kind: "pump";
  powerKW: number;
  /** Vazão (m³/h) e altura manométrica (m) — usados para calcular a água bombeada. */
  flowM3h: number;
  headM: number;
  /** Água necessária por dia (m³). */
  dailyM3: number;
  /** Janela em que pode bombear. */
  start: number;
  end: number;
}

/** Carro elétrico: carregamento burro (chegou, carregou) ou inteligente (espera o sol). */
export interface EVLoad extends LoadBase {
  kind: "ev";
  chargerKW: number;
  dailyKWh: number;
  /** Hora em que o carro fica disponível e em que precisa estar pronto. */
  plugIn: number;
  plugOut: number;
  smart: boolean;
  /** Dias em que o carro fica em casa durante o dia (senão só à noite). */
  daysHome: "todos" | "uteis" | "fds";
}

/** Aquecedor de água elétrico (boiler) = bateria térmica. */
export interface WaterHeaterLoad extends LoadBase {
  kind: "waterheater";
  tankLiters: number;
  heaterKW: number;
  /** Temperaturas (°C) da rede, mínima de conforto e máxima do tanque. */
  coldC: number;
  minC: number;
  maxC: number;
  /** Água quente consumida por dia (litros a 40 °C). */
  dailyLiters: number;
  /** Perdas térmicas (kWh/dia com o tanque cheio a quente). */
  lossKWhDay: number;
  /** Aquece com excedente solar (desviador). */
  diverter: boolean;
}

/** Carga deslocável genérica: máquina de lavar, dessalinizador, fábrica de gelo, mineração… */
export interface DeferrableLoad extends LoadBase {
  kind: "deferrable";
  powerKW: number;
  dailyKWh: number;
  start: number;
  end: number;
  /** Se precisa completar a energia do dia (senão só roda com sobra). */
  mustComplete: boolean;
}

export type Load = ProfileLoad | ApplianceLoad | MotorLoad | PumpLoad | EVLoad | WaterHeaterLoad | DeferrableLoad;

export type GridMode = "on-grid" | "zero-grid" | "export-limit" | "off-grid";

export type EventKind =
  /** Operador proíbe/limita a injeção (corte de GD, curtailment). */
  | "curtailment"
  /** Operador manda desligar o inversor (desconexão remota da GD). */
  | "gd-trip"
  /** Falta de energia da concessionária (apagão). */
  | "outage";

export interface GridEvent {
  id: string;
  kind: EventKind;
  start: number;
  end: number;
  days: "todos" | "uteis" | "fds" | "domingos";
  /** Probabilidade de o evento ocorrer num dia elegível (0–1). */
  probability: number;
  /** Para curtailment: fração da injeção ainda permitida (0 = zero injeção). */
  exportFraction: number;
  /** Só a partir de certos meses (1–12). Vazio = ano todo. */
  months: number[];
}

export type Strategy = "autoconsumo" | "anti-corte" | "cargas-primeiro" | "injetar-primeiro" | "tarifa-branca" | "reserva-backup" | "peak-shaving";

export interface Scenario {
  id: string;
  name: string;
  description: string;
  site: {
    cityId: string;
    lat: number;
    lon: number;
    /** Fuso horário (h) — Brasília = −3. */
    tz: number;
    /** Albedo do solo (0–1). */
    albedo: number;
  };
  sim: {
    startDay: number; // dia do ano 1–365
    days: number;
    stepMin: 5 | 10 | 15 | 30 | 60;
    seed: number;
    /** Multiplicador da nebulosidade (1 = clima típico, 0 = céu sempre limpo). */
    cloudiness: number;
  };
  pv: {
    kWp: number;
    tilt: number;
    /** Azimute (0 = Norte, 90 = Leste, 180 = Sul, 270 = Oeste). */
    azimuth: number;
    /** Coeficiente de temperatura da potência (%/°C, negativo). */
    tempCoeff: number;
    noct: number;
    /** Perdas de sujeira, cabos, descasamento etc. (%). */
    lossesPct: number;
    /** Idade do sistema (anos) e degradação anual (%). */
    ageYears: number;
    degradationPctYear: number;
    bifacial: boolean;
  };
  inverter: {
    acKW: number;
    /** Eficiência máxima (0–1). */
    etaMax: number;
    /** Consumo próprio em vazio (W). */
    tareW: number;
    /** Híbrido com saída de backup (EPS): consegue ilhar quando a rede cai. */
    backup: boolean;
    /** Potência de surto (kW) por alguns segundos — partida de motores. */
    surgeKW: number;
  };
  storage: StorageUnit[];
  loads: Load[];
  grid: {
    mode: GridMode;
    exportLimitKW: number;
    importLimitKW: number;
    /** Permite carregar baterias pela rede (arbitragem). */
    gridCharge: boolean;
    /** Horário de carga pela rede (início/fim). */
    gridChargeStart: number;
    gridChargeEnd: number;
    events: GridEvent[];
  };
  generator: {
    enabled: boolean;
    kW: number;
    /** Liga quando o SOC médio das baterias cai abaixo disso. */
    startSoc: number;
    litersPerKWh: number;
    fuelPrice: number;
  };
  control: {
    strategy: Strategy;
    /** Reserva mínima de SOC guardada para apagões (0–1). */
    backupReserve: number;
    /** Limite de demanda da rede para peak shaving (kW). */
    peakLimitKW: number;
  };
  tariff: {
    /** Tarifa cheia com impostos (R$/kWh). */
    price: number;
    /** Parcela do fio B (R$/kWh). */
    fioB: number;
    /** Ano de referência da Lei 14.300 (define % do fio B). */
    year: number;
    branca: boolean;
    /** Tarifa branca: multiplicadores de ponta/intermediário/fora ponta em relação a `price`. */
    peakMult: number;
    midMult: number;
    offMult: number;
    peakStart: number;
    peakEnd: number;
    /** Emissão da rede (kg CO₂/kWh). */
    co2: number;
  };
}

/** Série temporal da simulação: um vetor por grandeza, um valor por passo. */
export interface SimSeries {
  t: Float64Array; // hora desde o início
  doy: Int16Array;
  hour: Float32Array;
  ghi: Float32Array; // W/m²
  poa: Float32Array; // W/m²
  tAmb: Float32Array;
  tCell: Float32Array;
  pvAvail: Float32Array; // kW AC que o sol permitiria
  pvUsed: Float32Array;
  curtailed: Float32Array;
  loadFixed: Float32Array; // cargas não deslocáveis pedidas
  loadFlex: Float32Array; // cargas flexíveis atendidas
  unserved: Float32Array;
  gridImport: Float32Array;
  gridExport: Float32Array;
  gen: Float32Array;
  storagePower: Float32Array[]; // + carga / − descarga (kW no barramento)
  soc: Float32Array[]; // 0–1
  waterTemp: Float32Array; // °C do boiler (NaN se não houver)
  price: Float32Array;
  flags: Uint8Array; // bit0 curtailment, bit1 gd-trip, bit2 outage, bit3 gerador
}

export interface StorageResult {
  id: string;
  name: string;
  tech: StorageTech;
  chargedKWh: number;
  dischargedKWh: number;
  lossesKWh: number;
  cycles: number;
  roundTrip: number;
  fadePct: number;
  lifeYears: number;
  lcos: number; // R$/kWh entregue
}

export interface SimKPIs {
  hours: number;
  pvAvailKWh: number;
  pvUsedKWh: number;
  curtailedKWh: number;
  curtailedPct: number;
  /** Energia que seria perdida no evento de corte sem armazenamento/flexibilidade, e o quanto foi salvo. */
  eventCurtailAvailKWh: number;
  eventRecoveredKWh: number;
  loadKWh: number;
  loadServedKWh: number;
  unservedKWh: number;
  /** Horas com carga não atendida. */
  lossOfLoadHours: number;
  importKWh: number;
  exportKWh: number;
  genKWh: number;
  fuelL: number;
  /** Autoconsumo = FV usada localmente / FV produzida. */
  selfConsumption: number;
  /** Autossuficiência = carga atendida sem rede / carga total. */
  selfSufficiency: number;
  peakImportKW: number;
  peakExportKW: number;
  specificYield: number; // kWh/kWp no período
  performanceRatio: number;
  storage: StorageResult[];
  waterM3: number;
  loadEnergy: { id: string; name: string; kind: LoadKind; kWh: number; solarKWh: number }[];
  motorSurgeViolations: number;
  hotWaterShortfallL: number;
  evShortfallKWh: number;
  costBaseline: number; // R$ sem sistema
  costWith: number; // R$ com sistema
  savings: number;
  savingsYear: number;
  creditsLeftKWh: number;
  co2AvoidedKg: number;
  energyBalanceError: number;
}

export interface SimResult {
  scenario: Scenario;
  series: SimSeries;
  kpis: SimKPIs;
  daily: DailyRow[];
  warnings: string[];
  ms: number;
}

export interface DailyRow {
  day: number; // índice
  doy: number;
  label: string;
  pvAvail: number;
  pvUsed: number;
  curtailed: number;
  load: number;
  import: number;
  export: number;
  unserved: number;
  gen: number;
  events: number;
}
