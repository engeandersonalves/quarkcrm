import { test } from "node:test";
import assert from "node:assert/strict";
import { groupClients, matchClient, portalMessage } from "./moto-clients.ts";
import { defaultMoto, motoTotal } from "./moto-sale.ts";

const contractor = { name: "QUARK", doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };
const sale = (id: string, status: "rascunho" | "enviado" | "assinado", over: (d: ReturnType<typeof defaultMoto>) => void) => {
  const d = defaultMoto({ contractor, model: "cappuccino" });
  d.client.name = "Maria Lima";
  d.client.doc = "529.982.247-25";
  d.client.phone = "82999887766";
  d.date = "2026-11-10";
  d.delivery.date = "2026-11-12";
  over(d);
  return { id, status, data: d, created_at: "2026-11-10T10:00:00Z", updated_at: "2026-11-10T10:00:00Z", completed_at: status === "assinado" ? "2026-11-10T12:00:00Z" : null };
};

test("clientes: agrupa por CPF e ordena por prioridade", () => {
  const list = groupClients(
    [
      sale("a", "assinado", () => {}),
      sale("b", "rascunho", (d) => (d.client.doc = "52998224725")),
      sale("c", "enviado", (d) => {
        d.client.name = "João";
        d.client.doc = "";
        d.client.phone = "(82) 98877-6655";
      }),
    ],
    motoTotal,
    new Date("2026-11-20T12:00:00Z"),
  );
  assert.equal(list.length, 2);
  // Link do contrato gerado já conta como venda fechada (cliente em garantia).
  const joao = list.find((c) => c.name === "João")!;
  assert.equal(joao.stage, "garantia");
  const maria = list.find((c) => c.name === "Maria Lima")!;
  assert.equal(maria.name, "Maria Lima");
  assert.equal(maria.sales.length, 2);
  assert.equal(maria.stage, "garantia");
  assert.equal(maria.warrantyLeft, 82);
  assert.equal(matchClient(maria, "cappuccino"), true);
  assert.equal(matchClient(maria, "982.247"), true);
  assert.equal(matchClient(joao, "maria"), false);
  assert.match(portalMessage("Maria Lima", "https://x/cliente"), /4 últimos dígitos/);
});
