import "server-only";
import { BUSINESSES, CLEANING, MANAGEMENT, POWERS, evCompare, maintenanceSim, stationSim } from "./capture-sims";
import type { EmailCustom } from "./client-email";
import { brl, fmtNum } from "./pricing";

/** Parâmetros da simulação enviados pela página, sempre validados antes de usar. */
export function sanitizeSim(raw: unknown) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, min: number, max: number, def: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;
  };
  const services = Array.isArray(r.services) ? r.services.filter((s): s is string => typeof s === "string" && MANAGEMENT.some((m) => m.id === s)) : [];
  return {
    km: n(r.km, 100, 10000, 1500),
    kml: n(r.kml, 5, 25, 10),
    business: BUSINESSES.some((b) => b.id === r.business) ? String(r.business) : "outro",
    power: POWERS.includes(Number(r.power)) ? Number(r.power) : 60,
    sessions: n(r.sessions, 1, 100, 10),
    kwp: n(r.kwp, 1, 5000, 10),
    last: CLEANING.some((c) => c.id === r.last) ? String(r.last) : "mais1ano",
    services,
  };
}

export function captureEmailContent(segment: string, sim: ReturnType<typeof sanitizeSim>, tariff: number, sunHours: number): EmailCustom | null {
  if (segment === "save") {
    const ev = evCompare({ kmMonth: sim.km, kmPerLiter: sim.kml, tariff });
    return {
      subject: `Carro elétrico: economia de ${brl(ev.savingMonth, 0)} por mês ⚡`,
      kicker: "Seu estudo de carro elétrico",
      headline: `rodando elétrico você economiza ${brl(ev.savingMonth, 0)} por mês.`,
      intro: `Rodando ${fmtNum(sim.km)} km por mês, comparamos o seu carro a gasolina (${sim.kml} km/L) com um elétrico carregando em casa.`,
      stats: [
        ["Gasolina por mês", brl(ev.gasMonth, 0), `${brl(ev.perKmGas, 2)} por km`],
        ["Elétrico por mês", brl(ev.evMonth, 0), `${brl(ev.perKmEv, 2)} por km`],
        ["Em 5 anos", brl(ev.saving5y, 0), "de economia"],
        ["CO₂ evitado", `${fmtNum(ev.co2TonsYear, 1)} t/ano`, "menos poluição"],
      ],
      reasons: [
        ["Carregador instalado com segurança", "Circuito dedicado, DR, DPS e botão de emergência, conforme a NBR 5410."],
        ["Recarga da noite para o dia", "O carro amanhece pronto, sem filas em eletropostos."],
        ["Some energia solar", "Com placas em casa, a recarga sai praticamente de graça."],
      ],
      payments: true,
      note: "Estimativa com gasolina a R$ 6,29/L e consumo elétrico de 17 kWh a cada 100 km.",
      topic: "do carro elétrico",
    };
  }
  if (segment === "eletroposto") {
    const s = stationSim({ power: sim.power, sessionsDay: sim.sessions, business: sim.business });
    const biz = BUSINESSES.find((b) => b.id === sim.business)?.label ?? "seu negócio";
    return {
      subject: `Seu eletroposto: potencial de ${brl(s.net + s.crossSell, 0)} por mês 🔌`,
      kicker: "Estudo de eletroposto",
      headline: `seu eletroposto pode movimentar ${brl(s.net + s.crossSell, 0)} por mês.`,
      intro: `Simulamos um carregador rápido de ${s.power} kW em ${biz.toLowerCase()}, com ${s.sessions} recargas por dia.`,
      stats: [
        ["Lucro com recargas", `${brl(s.net, 0)}/mês`, `${fmtNum(s.kwhMonth)} kWh vendidos`],
        ["Venda cruzada", `${brl(s.crossSell, 0)}/mês`, "consumo enquanto carregam"],
        ["Retorno estimado", s.paybackMonths ? `${fmtNum(s.paybackMonths)} meses` : "—", `investimento de referência ${brl(s.invest, 0)}`],
        ["Recargas por mês", fmtNum(s.sessionsMonth), `até ${s.capacity} por dia`],
      ],
      reasons: [
        ["Projeto completo", "Estudo de viabilidade, adequação elétrica, instalação e homologação."],
        ["Mais clientes na porta", "Motoristas de elétricos escolhem onde parar pelo app de recarga."],
        ["Energia solar para ampliar a margem", "Com geração própria, o custo por kWh vendido despenca."],
      ],
      payments: true,
      note: "Estimativa com recarga média de 30 kWh, venda a R$ 2,19/kWh, energia a R$ 0,95/kWh e 10% de taxas. O estudo de viabilidade considera o seu local.",
      topic: "do eletroposto",
    };
  }
  if (segment === "manutencao") {
    const m = maintenanceSim({ kwp: sim.kwp, last: sim.last, tariff, sunHours });
    return {
      subject: `Sua usina pode estar perdendo ${brl(m.lossMonth, 0)} por mês ☀️`,
      kicker: "Diagnóstico da sua usina",
      headline: `sua usina pode estar deixando de gerar ${brl(m.lossMonth, 0)} por mês.`,
      intro: `Para uma usina de ${fmtNum(sim.kwp)} kWp com a última limpeza em "${CLEANING.find((c) => c.id === sim.last)?.label.toLowerCase()}", estimamos a energia que a sujeira está bloqueando.`,
      stats: [
        ["Eficiência estimada", `${Math.round(m.efficiency * 100)}%`, "hoje"],
        ["Energia perdida", `${fmtNum(m.lossKwh)} kWh/mês`, "que você paga à distribuidora"],
        ["Perda por ano", brl(m.lossYear, 0), "sem limpeza"],
        ["Em 5 anos", brl(m.loss5y, 0), "que podem voltar para você"],
      ],
      reasons: [
        ["Limpeza técnica", "Produtos e equipamentos que não riscam nem danificam os módulos."],
        ["Inspeção completa", "Conexões, inversor, string box e pontos quentes com termografia."],
        ["Garantia preservada", "Relatório técnico que comprova a manutenção exigida pelos fabricantes."],
      ],
      payments: false,
      note: "Estimativa a partir do tamanho da usina e do tempo desde a última limpeza. O diagnóstico no local confirma os números.",
      topic: "de manutenção da usina",
    };
  }
  if (segment === "gestao") {
    const list = MANAGEMENT.filter((m) => sim.services.includes(m.id));
    const items = list.length ? list : MANAGEMENT;
    return {
      subject: "Gestão energética: sua energia no controle 📊",
      kicker: "Gestão energética",
      headline: "a gente cuida da sua energia junto à distribuidora.",
      intro: "Recebemos o seu pedido. Veja o que resolvemos para você:",
      stats: [],
      reasons: items.map((m) => [m.label, m.text] as [string, string]),
      payments: false,
      note: "Você recebeu este e-mail porque pediu atendimento em nosso site.",
      topic: "de gestão energética",
    };
  }
  return null;
}
