/**
 * Central da equipe: métricas por pessoa e linha do tempo de ações
 * (atividades, tarefas, leads e propostas) num período.
 */

export type Period = "hoje" | "7d" | "30d";

export interface TTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  due_at: string | null;
  done: boolean;
  done_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  lead_id: string | null;
  cadence?: string | null;
  lead?: { id: string; name: string } | null;
}
export interface TActivity {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_by: string | null;
  created_at: string;
  lead?: { id: string; name: string } | null;
}
export interface TLead {
  id: string;
  name: string;
  status: string;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  estimated_value: number | null;
}
export interface TProposal {
  id: string;
  number: number;
  lead_id: string;
  status: string;
  final_price: number;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  lead?: { id: string; name: string } | null;
}
export interface TXp {
  user_id: string;
  kind: string;
  points: number;
  created_at: string;
}
export interface TUsage {
  user_id: string;
  day: string;
  minutes: number;
  last_ping: string | null;
}
export interface TeamData {
  tasks: TTask[];
  activities: TActivity[];
  leads: TLead[];
  proposals: TProposal[];
  xp: TXp[];
  usage: TUsage[];
}

export const PERIOD_LABEL: Record<Period, string> = { hoje: "Hoje", "7d": "7 dias", "30d": "30 dias" };

export function periodStart(p: Period, now = new Date()) {
  const d = new Date(now);
  if (p === "hoje") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(d.getDate() - (p === "7d" ? 7 : 30));
  return d;
}

/** Dono da tarefa: responsável ou, sem responsável, quem criou. */
export const taskOwner = (t: Pick<TTask, "assigned_to" | "created_by">) => t.assigned_to ?? t.created_by;
export const leadOwner = (l: Pick<TLead, "owner_id" | "created_by">) => l.owner_id ?? l.created_by;

const OPEN = new Set(["novo", "contato", "visita", "proposta", "negociacao"]);
const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

export function taskBuckets(tasks: TTask[], uid: string | null, from: Date, now = new Date()) {
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const mine = uid ? tasks.filter((t) => taskOwner(t) === uid) : tasks;
  const late: TTask[] = [];
  const today: TTask[] = [];
  const upcoming: TTask[] = [];
  const done: TTask[] = [];
  for (const t of mine) {
    if (t.done) {
      if (ts(t.done_at) >= from.getTime()) done.push(t);
      continue;
    }
    const due = ts(t.due_at);
    if (Number.isFinite(due) && due < now.getTime()) late.push(t);
    else if (Number.isFinite(due) && due <= endToday.getTime()) today.push(t);
    else upcoming.push(t);
  }
  const byDue = (a: TTask, b: TTask) => (ts(a.due_at) || Infinity) - (ts(b.due_at) || Infinity);
  late.sort(byDue);
  today.sort(byDue);
  upcoming.sort(byDue);
  done.sort((a, b) => ts(b.done_at) - ts(a.done_at));
  return { late, today, upcoming, done };
}

export interface PersonStats {
  open: number;
  late: number;
  today: number;
  done: number;
  completion: number | null;
  actions: number;
  leads: number;
  openLeads: number;
  pipeline: number;
  proposals: number;
  sent: number;
  sales: number;
  xp: number;
  minutes: number;
  lastSeen: string | null;
}

export function personStats(uid: string, d: TeamData, from: Date, now = new Date()): PersonStats {
  const b = taskBuckets(d.tasks, uid, from, now);
  const after = (iso: string | null | undefined) => ts(iso) >= from.getTime();
  const fromDay = from.toISOString().slice(0, 10);
  const myLeads = d.leads.filter((l) => leadOwner(l) === uid);
  const open = myLeads.filter((l) => OPEN.has(l.status));
  const usage = d.usage.filter((u) => u.user_id === uid);
  const xp = d.xp.filter((x) => x.user_id === uid && after(x.created_at));
  const actions = d.activities.filter((a) => a.created_by === uid && after(a.created_at)).length;
  const lastSeen = usage.reduce<string | null>((m, u) => (u.last_ping && (!m || u.last_ping > m) ? u.last_ping : m), null);
  const due = b.done.length + b.late.length;
  return {
    open: b.late.length + b.today.length + b.upcoming.length,
    late: b.late.length,
    today: b.today.length,
    done: b.done.length,
    completion: due ? b.done.length / due : null,
    actions,
    leads: d.leads.filter((l) => l.created_by === uid && after(l.created_at)).length,
    openLeads: open.length,
    pipeline: open.reduce((s, l) => s + (l.estimated_value ?? 0), 0),
    proposals: d.proposals.filter((p) => p.created_by === uid && after(p.created_at)).length,
    sent: d.proposals.filter((p) => p.created_by === uid && after(p.sent_at)).length,
    sales: xp.filter((x) => x.kind === "venda" || x.kind === "aceite").length,
    xp: xp.reduce((s, x) => s + x.points, 0) + usage.filter((u) => u.day >= fromDay).reduce((s, u) => s + Math.floor(Math.min(u.minutes, 240) / 10), 0),
    minutes: usage.filter((u) => u.day >= fromDay).reduce((s, u) => s + u.minutes, 0),
    lastSeen,
  };
}

export type FeedKind = "atividade" | "tarefa" | "lead" | "proposta" | "envio";
export interface FeedItem {
  id: string;
  at: string;
  user: string | null;
  kind: FeedKind;
  type: string;
  text: string;
  leadId: string | null;
  leadName: string | null;
}

/** Linha do tempo unificada (mais recentes primeiro). */
export function buildFeed(d: TeamData, from: Date, uid: string | null, stageLabel: (s: string) => string = (s) => s): FeedItem[] {
  const after = (iso: string | null | undefined) => ts(iso) >= from.getTime();
  const who = (u: string | null) => !uid || u === uid;
  const leadName = new Map(d.leads.map((l) => [l.id, l.name]));
  const out: FeedItem[] = [];
  for (const a of d.activities) {
    if (!after(a.created_at) || !who(a.created_by)) continue;
    let text = a.content;
    if (a.type === "etapa") {
      const [f, t] = a.content.split("→");
      text = `Moveu de ${stageLabel(f?.trim())} para ${stageLabel(t?.trim())}`;
    }
    out.push({ id: `a-${a.id}`, at: a.created_at, user: a.created_by, kind: "atividade", type: a.type, text, leadId: a.lead_id, leadName: a.lead?.name ?? leadName.get(a.lead_id) ?? null });
  }
  for (const t of d.tasks) {
    if (!t.done || !after(t.done_at) || !who(taskOwner(t))) continue;
    out.push({ id: `t-${t.id}`, at: t.done_at!, user: taskOwner(t), kind: "tarefa", type: t.type, text: `Concluiu: ${t.title}`, leadId: t.lead_id, leadName: t.lead?.name ?? (t.lead_id ? (leadName.get(t.lead_id) ?? null) : null) });
  }
  for (const l of d.leads) {
    if (!after(l.created_at) || !who(l.created_by)) continue;
    out.push({ id: `l-${l.id}`, at: l.created_at, user: l.created_by, kind: "lead", type: "lead", text: "Cadastrou um novo lead", leadId: l.id, leadName: l.name });
  }
  for (const p of d.proposals) {
    const name = p.lead?.name ?? leadName.get(p.lead_id) ?? null;
    if (after(p.created_at) && who(p.created_by)) out.push({ id: `p-${p.id}`, at: p.created_at, user: p.created_by, kind: "proposta", type: "proposta", text: `Criou a proposta #${p.number}`, leadId: p.lead_id, leadName: name });
    if (p.sent_at && after(p.sent_at) && who(p.created_by)) out.push({ id: `s-${p.id}`, at: p.sent_at, user: p.created_by, kind: "envio", type: "envio", text: `Enviou a proposta #${p.number}`, leadId: p.lead_id, leadName: name });
  }
  return out.sort((a, b) => ts(b.at) - ts(a.at));
}

/** Presença: online (≤ 5 min), hoje, ou há quanto tempo. */
export function presence(lastSeen: string | null, now = new Date()) {
  if (!lastSeen) return { online: false, label: "Ainda não usou o app" };
  const min = Math.round((now.getTime() - ts(lastSeen)) / 60000);
  if (min <= 5) return { online: true, label: "Online agora" };
  if (min < 60) return { online: false, label: `Visto há ${min} min` };
  if (min < 60 * 24) return { online: false, label: `Visto há ${Math.round(min / 60)} h` };
  const days = Math.round(min / 1440);
  return { online: false, label: `Visto há ${days} dia${days > 1 ? "s" : ""}` };
}
