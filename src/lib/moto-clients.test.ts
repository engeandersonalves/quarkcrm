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

test("clientes: agrupa por CPF e prioriza garantia ativa", () => {
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
  assert.equal(list[0].name, "Maria Lima");
  assert.equal(list[0].sales.length, 2);
  assert.equal(list[0].stage, "garantia");
  assert.equal(list[0].warrantyLeft, 82);
  assert.equal(list[1].stage, "assinatura");
  assert.equal(matchClient(list[0], "cappuccino"), true);
  assert.equal(matchClient(list[0], "982.247"), true);
  assert.equal(matchClient(list[1], "maria"), false);
  assert.match(portalMessage("Maria Lima", "https://x/cliente"), /4 últimos dígitos/);
});
