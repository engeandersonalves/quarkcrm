import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFeed, periodStart, personStats, presence, taskBuckets, type TeamData } from "./team.ts";

const now = new Date("2026-09-28T15:00:00");
const iso = (s: string) => new Date(s).toISOString();
const data: TeamData = {
  tasks: [
    { id: "1", title: "Ligar", type: "ligacao", priority: "alta", due_at: iso("2026-09-27T10:00:00"), done: false, done_at: null, assigned_to: "a", created_by: "b", lead_id: "L1" },
    { id: "2", title: "Zap", type: "whatsapp", priority: "media", due_at: iso("2026-09-28T18:00:00"), done: false, done_at: null, assigned_to: null, created_by: "a", lead_id: null },
    { id: "3", title: "Visita", type: "visita", priority: "media", due_at: iso("2026-09-30T10:00:00"), done: false, done_at: null, assigned_to: "a", created_by: "a", lead_id: null },
    { id: "4", title: "Feita", type: "tarefa", priority: "baixa", due_at: null, done: true, done_at: iso("2026-09-28T09:00:00"), assigned_to: "a", created_by: "a", lead_id: "L1" },
    { id: "5", title: "Da Bia", type: "tarefa", priority: "baixa", due_at: iso("2026-09-20T09:00:00"), done: false, done_at: null, assigned_to: "b", created_by: "a", lead_id: null },
  ],
  activities: [
    { id: "x", lead_id: "L1", type: "etapa", content: "novo→contato", created_by: "a", created_at: iso("2026-09-28T11:00:00") },
    { id: "y", lead_id: "L1", type: "nota", content: "antiga", created_by: "a", created_at: iso("2026-08-01T11:00:00") },
  ],
  leads: [{ id: "L1", name: "Padaria Boa", status: "contato", owner_id: "a", created_by: "a", created_at: iso("2026-09-28T08:00:00"), updated_at: iso("2026-09-28T11:00:00"), estimated_value: 20000 }],
  proposals: [{ id: "p", number: 7, lead_id: "L1", status: "enviada", final_price: 20000, created_by: "a", created_at: iso("2026-09-28T12:00:00"), sent_at: iso("2026-09-28T12:30:00") }],
  xp: [{ user_id: "a", kind: "venda", points: 100, created_at: iso("2026-09-28T13:00:00") }],
  usage: [{ user_id: "a", day: "2026-09-28", minutes: 95, last_ping: iso("2026-09-28T14:58:00") }],
};

test("tarefas por pessoa: atrasadas, hoje, próximas e concluídas", () => {
  const b = taskBuckets(data.tasks, "a", periodStart("hoje", now), now);
  assert.deepEqual(b.late.map((t) => t.id), ["1"]);
  assert.deepEqual(b.today.map((t) => t.id), ["2"]);
  assert.deepEqual(b.upcoming.map((t) => t.id), ["3"]);
  assert.deepEqual(b.done.map((t) => t.id), ["4"]);
  assert.equal(taskBuckets(data.tasks, null, periodStart("hoje", now), now).late.length, 2);
});

test("métricas da pessoa", () => {
  const s = personStats("a", data, periodStart("hoje", now), now);
  assert.equal(s.open, 3);
  assert.equal(s.late, 1);
  assert.equal(s.done, 1);
  assert.equal(s.completion, 0.5);
  assert.equal(s.actions, 1);
  assert.equal(s.leads, 1);
  assert.equal(s.pipeline, 20000);
  assert.equal(s.sent, 1);
  assert.equal(s.sales, 1);
  assert.equal(s.xp, 109);
  assert.equal(s.minutes, 95);
});

test("linha do tempo em ordem e só do período", () => {
  const f = buildFeed(data, periodStart("hoje", now), "a", (s) => s.toUpperCase());
  assert.deepEqual(f.map((i) => i.kind), ["envio", "proposta", "atividade", "tarefa", "lead"]);
  assert.equal(f[2].text, "Moveu de NOVO para CONTATO");
  assert.equal(f[2].leadName, "Padaria Boa");
  assert.equal(buildFeed(data, periodStart("hoje", now), "b").length, 0);
});

test("presença", () => {
  assert.equal(presence(iso("2026-09-28T14:58:00"), now).online, true);
  assert.equal(presence(iso("2026-09-28T12:00:00"), now).label, "Visto há 3 h");
  assert.equal(presence(null, now).label, "Ainda não usou o app");
});
