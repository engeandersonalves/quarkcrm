import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport, delta, rangeOf } from "./analytics.ts";

const now = new Date("2026-06-15T12:00:00Z");
const d = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
const lead = (id: string, status: string, createdDaysAgo: number, extra = {}) => ({ id, status, source: "Instagram", segment: "solar", created_at: d(createdDaysAgo), updated_at: d(createdDaysAgo / 2), owner_id: "u1", estimated_value: 10000, lost_reason: null, ...extra }) as never;
const prop = (lead_id: string, status: string, price: number, acceptedDaysAgo: number | null) =>
  ({ lead_id, status, final_price: price, profit_value: price * 0.2, created_at: d(40), accepted_at: acceptedDaysAgo == null ? null : d(acceptedDaysAgo), sent_at: d(39), viewed_at: d(38), created_by: "u1", power_kwp: 5 }) as never;

test("relatório: vendas, conversão, funil e comparação com o período anterior", () => {
  const leads = [lead("a", "ganho", 20), lead("b", "proposta", 10), lead("c", "perdido", 5, { lost_reason: "Preço" }), lead("d", "novo", 50)];
  const props = [prop("a", "aceita", 20000, 3), prop("b", "enviada", 15000, null), prop("d", "aceita", 10000, 45)];
  const r = buildReport(leads, props, [{ id: "u1", full_name: "Ana", email: null }], rangeOf("30d", now), now);
  assert.equal(r.cur.sold, 20000);
  assert.equal(r.prev.sold, 10000);
  assert.equal(r.cur.deals, 1);
  assert.equal(r.cur.newLeads, 3);
  assert.ok(Math.abs(r.cur.conversion - 1 / 3) < 1e-9);
  assert.equal(r.funnel[0].count, 3); // todos entram no funil
  assert.equal(r.funnel.find((f) => f.stage === "proposta")!.count, 2); // "a" (ganho) e "b"
  assert.equal(r.lostReasons[0].reason, "Preço");
  assert.equal(r.sellers[0].sold, 20000);
  assert.ok(r.forecast > 0 && r.forecast < r.pipeline);
  assert.equal(delta(20000, 10000), 1);
});
