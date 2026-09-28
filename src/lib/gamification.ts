/**
 * Gamificação: níveis, pontos e conquistas.
 * Os pontos são concedidos pelo banco (gatilhos em supabase/schema.sql); aqui ficam os
 * valores para exibição, os níveis e as frases de cada conquista.
 */

export type XpKind = "lead" | "followup" | "tarefa" | "proposta" | "envio" | "venda" | "aceite";

export const XP_TABLE: { kind: XpKind; points: number; label: string; hint: string }[] = [
  { kind: "lead", points: 10, label: "Lead cadastrado", hint: "Cada cliente novo no funil" },
  { kind: "followup", points: 5, label: "Follow-up registrado", hint: "Ligação, WhatsApp, visita ou e-mail no histórico (1 por cliente a cada 30 min)" },
  { kind: "tarefa", points: 5, label: "Tarefa concluída", hint: "Tarefas ligadas a um cliente" },
  { kind: "proposta", points: 15, label: "Orçamento criado", hint: "Solar ou S.A.V.E" },
  { kind: "envio", points: 10, label: "Proposta enviada", hint: "Ao compartilhar o link com o cliente" },
  { kind: "venda", points: 100, label: "Venda fechada", hint: "Lead movido para “Fechado”" },
  { kind: "aceite", points: 150, label: "Proposta aceita online", hint: "Quando o cliente aceita pelo link" },
];
export const USAGE_RULE = "1 XP a cada 10 minutos de app em uso (até 4 h por dia)";

export interface Level {
  n: number;
  title: string;
  min: number;
  motto: string;
}

/** Do estagiário ao dono do mundo. */
export const LEVELS: Level[] = [
  { n: 1, title: "Estagiário", min: 0, motto: "Todo império começa com a primeira ligação." },
  { n: 2, title: "Corretor", min: 100, motto: "Você aprendeu a falar. Agora aprenda a fechar." },
  { n: 3, title: "Closer", min: 300, motto: "Café é para quem fecha." },
  { n: 4, title: "Tubarão", min: 700, motto: "Sente o cheiro de oportunidade de longe." },
  { n: 5, title: "Lobo", min: 1500, motto: "O pregão é seu território." },
  { n: 6, title: "Chefão", min: 3000, motto: "Faz ofertas que ninguém consegue recusar." },
  { n: 7, title: "Dono do Mundo", min: 6000, motto: "O mundo é seu." },
];

export function levelOf(xp: number) {
  let i = 0;
  while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1].min) i++;
  const level = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  const progress = next ? (xp - level.min) / (next.min - level.min) : 1;
  return { level, next, progress: Math.max(0, Math.min(1, progress)), toNext: next ? next.min - xp : 0 };
}

export interface Stats {
  total_xp: number;
  leads: number;
  followups: number;
  proposals: number;
  sent: number;
  sales: number;
  minutes: number;
  active_days: number;
}

export type BadgeTier = "bronze" | "prata" | "ouro" | "lenda";

export interface Badge {
  id: string;
  title: string;
  text: string;
  icon: string;
  tier?: BadgeTier;
  done: (s: Stats) => boolean;
  progress: (s: Stats) => [number, number];
}

const goal = (id: string, title: string, text: string, icon: string, tier: BadgeTier, key: keyof Stats, n: number): Badge => ({
  id,
  title,
  text,
  icon,
  tier,
  done: (s) => s[key] >= n,
  progress: (s) => [Math.min(s[key], n), n],
});

export const BADGES: Badge[] = [
  goal("primeiro-lead", "Primeira ficha", "Cadastre o seu primeiro lead", "🎯", "bronze", "leads", 1),
  goal("dez-leads", "Rede aberta", "10 leads cadastrados", "🕸️", "bronze", "leads", 10),
  goal("maquina", "Máquina de leads", "50 leads cadastrados", "🧲", "prata", "leads", 50),
  goal("cacador", "Caçador de oportunidades", "150 leads cadastrados", "🏹", "ouro", "leads", 150),
  goal("aquecendo", "Aquecendo", "10 follow-ups registrados", "🔥", "bronze", "followups", 10),
  goal("implacavel", "Follow-up implacável", "100 follow-ups", "📞", "prata", "followups", 100),
  goal("metralhadora", "Metralhadora", "500 follow-ups", "💬", "ouro", "followups", 500),
  goal("primeira-proposta", "Primeira proposta", "Envie a sua primeira proposta", "📨", "bronze", "sent", 1),
  goal("caneta", "Me venda esta caneta", "Envie 10 propostas", "🖊️", "prata", "sent", 10),
  goal("fabrica", "Fábrica de propostas", "Envie 50 propostas", "🏭", "ouro", "sent", 50),
  goal("primeiro-sangue", "Primeiro contrato", "Feche a sua primeira venda", "🥂", "bronze", "sales", 1),
  goal("mao-de-ouro", "Mão de ouro", "5 vendas fechadas", "🤝", "prata", "sales", 5),
  goal("cafe", "Café é para quem fecha", "10 vendas fechadas", "☕", "ouro", "sales", 10),
  goal("lenda", "Lenda do solar", "30 vendas fechadas", "🏆", "lenda", "sales", 30),
  goal("presenca", "Presença", "5 dias de app em uso", "📅", "bronze", "active_days", 5),
  goal("pregao", "Dono do pregão", "20 dias de app em uso", "📈", "prata", "active_days", 20),
  goal("inabalavel", "Inabalável", "60 dias de app em uso", "🗿", "ouro", "active_days", 60),
  goal("foco", "Foco total", "10 horas de app em uso", "⏱️", "prata", "minutes", 600),
  goal("tubarao", "Tubarão", "Chegue a 700 XP", "🦈", "prata", "total_xp", 700),
  goal("lobo", "Lobo", "Chegue a 1.500 XP", "🐺", "ouro", "total_xp", 1500),
  goal("imperio", "Império", "Chegue a 6.000 XP", "👑", "lenda", "total_xp", 6000),
];

export const TIER_STYLE: Record<BadgeTier, { label: string; ring: string; bg: string; text: string }> = {
  bronze: { label: "Bronze", ring: "ring-amber-700/30", bg: "from-amber-100 via-orange-50 to-amber-200", text: "text-amber-800" },
  prata: { label: "Prata", ring: "ring-slate-400/40", bg: "from-slate-100 via-white to-slate-200", text: "text-slate-700" },
  ouro: { label: "Ouro", ring: "ring-yellow-500/50", bg: "from-yellow-100 via-amber-50 to-yellow-300", text: "text-yellow-800" },
  lenda: { label: "Lenda", ring: "ring-[#9BD373]/60", bg: "from-[#F3EA3B] via-[#9BD373] to-[#6CC690]", text: "text-[#1C1234]" },
};

/** Frases curtas que aparecem a cada conquista. */
export const REWARD_LINES: Record<XpKind, string[]> = {
  lead: ["Mais um na mesa. Agora faça ele dizer sim.", "Lead no funil é dinheiro esperando você.", "Quem liga primeiro, fecha primeiro.", "Ficha na mão. Hora da primeira ligação."],
  followup: ["A venda mora no 5º contato.", "Persistência é o que separa amador de profissional.", "Contato feito. Fortuna favorece os audazes.", "Quem não é visto não é lembrado."],
  tarefa: ["Disciplina é liberdade.", "Agenda em dia, comissão em dia.", "Feito é melhor que perfeito.", "Um passo mais perto do contrato."],
  proposta: ["Proposta pronta. Agora ela precisa chegar no cliente.", "Números na mesa. Deixe o valor falar.", "Mais uma bala na agulha."],
  envio: ["Proposta na mão do cliente. Ligue em 30 minutos.", "Me venda esta caneta — e você acabou de vender.", "Enviou? Agora acompanhe até o sim."],
  venda: ["O mundo é seu.", "Contrato fechado. Próximo!", "Café é para quem fecha — e hoje o café é seu."],
  aceite: ["O cliente disse sim pelo link.", "Aceite online. Isso é jogo de campeão."],
};

export function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m} min`;
}
