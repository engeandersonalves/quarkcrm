import { test } from "node:test";
import assert from "node:assert/strict";
import { saleStage, todos, warrantyOf, type BoardDoc } from "./moto-board.ts";
import { groupClients } from "./moto-clients.ts";
import { defaultMoto, motoTotal } from "./moto-sale.ts";

const contractor = { name: "QUARK", doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };
const NOW = new Date("2026-11-20T12:00:00Z");
function doc(id: string, status: BoardDoc["status"], signed: string | null, over: (d: ReturnType<typeof defaultMoto>) => void = () => {}): BoardDoc {
  const d = defaultMoto({ contractor, model: "cappuccino" });
  d.client.name = "Maria Lima";
  d.client.doc = "52998224725";
  d.client.phone = "82999887766";
  d.date = "2026-11-10";
  d.delivery.date = "2026-11-12";
  d.chassis = "QK1";
  over(d);
  return { id, status, data: d, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z", completed_at: null, signers: [{ role: "comprador", signed_at: signed, selfie_at: signed }, { role: "testemunha1", signed_at: null }] };
}

test("board: comprador assinou = vendida, mesmo com testemunha pendente", () => {
  assert.equal(saleStage(doc("a", "enviado", "2026-11-10T12:00:00Z")), "vendida");
  // Link gerado já conta como vendida; a assinatura pendente é só um aviso.
  assert.equal(saleStage(doc("b", "enviado", null)), "vendida");
  assert.equal(saleStage(doc("c", "rascunho", null)), "orcamento");
});

test("board: garantia ativa, a partir da entrega e encerrada", () => {
  const d = doc("a", "assinado", "x").data as ReturnType<typeof defaultMoto>;
  assert.deepEqual([warrantyOf(d, NOW).state, warrantyOf(d, NOW).left], ["ativa", 82]);
  d.delivery.date = "2026-12-01";
  assert.equal(warrantyOf(d, NOW).state, "entrega");
  d.delivery = { mode: "retirada", address: "", date: "" };
  d.date = "2026-01-01";
  assert.equal(warrantyOf(d, NOW).state, "encerrada");
});

test("board: pendências e clientes", () => {
  const list = [
    doc("a", "enviado", "2026-11-10T12:00:00Z", (d) => (d.chassis = "")),
    doc("b", "enviado", null, (d) => {
      d.client.doc = "11144477735";
      d.client.name = "Carlos";
    }),
    doc("c", "rascunho", null),
    doc("d", "rascunho", null),
  ];
  const t = todos(list, NOW);
  assert.deepEqual(
    t.map((x) => x.kind),
    ["assinatura", "chassi", "parado", "parado"],
  );
  const g = groupClients(list, motoTotal, NOW);
  assert.equal(g.length, 2);
  const maria = g.find((c) => c.name === "Maria Lima")!;
  assert.equal(maria.stage, "garantia");
  assert.equal(maria.bought, 1);
  assert.deepEqual(maria.sales.map((s) => s.id).slice(0, 1), ["a"]);
});

test("board: entrega em casa sem data = garantia começa na entrega", () => {
  const d = doc("a", "assinado", "x", (m) => (m.delivery = { mode: "entrega", address: "", date: "" })).data as ReturnType<typeof defaultMoto>;
  assert.equal(warrantyOf(d, NOW).state, "entrega");
});
