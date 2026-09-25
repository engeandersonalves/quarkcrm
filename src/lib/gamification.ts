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

export interface Badge {
  id: string;
  title: string;
  text: string;
  icon: string;
  done: (s: Stats) => boolean;
  progress: (s: Stats) => [number, number];
}

export const BADGES: Badge[] = [
  { id: "primeiro-lead", title: "Primeira ficha", text: "Cadastre o seu primeiro lead", icon: "🎯", done: (s) => s.leads >= 1, progress: (s) => [s.leads, 1] },
  { id: "maquina", title: "Máquina de leads", text: "50 leads cadastrados", icon: "🧲", done: (s) => s.leads >= 50, progress: (s) => [s.leads, 50] },
  { id: "implacavel", title: "Follow-up implacável", text: "100 follow-ups", icon: "📞", done: (s) => s.followups >= 100, progress: (s) => [s.followups, 100] },
  { id: "caneta", title: "Me venda esta caneta", text: "Envie 10 propostas", icon: "🖊️", done: (s) => s.sent >= 10, progress: (s) => [s.sent, 10] },
  { id: "primeiro-sangue", title: "Primeiro contrato", text: "Feche a sua primeira venda", icon: "🥂", done: (s) => s.sales >= 1, progress: (s) => [s.sales, 1] },
  { id: "cafe", title: "Café é para quem fecha", text: "10 vendas fechadas", icon: "☕", done: (s) => s.sales >= 10, progress: (s) => [s.sales, 10] },
  { id: "pregao", title: "Dono do pregão", text: "20 dias de app em uso", icon: "📈", done: (s) => s.active_days >= 20, progress: (s) => [s.active_days, 20] },
  { id: "imperio", title: "Império", text: "Chegue a 6.000 XP", icon: "👑", done: (s) => s.total_xp >= 6000, progress: (s) => [s.total_xp, 6000] },
];

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
