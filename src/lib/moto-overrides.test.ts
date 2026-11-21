import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOverrides, buildModelFix, emptyCustomer, portalPin } from "./moto-overrides.ts";
import { documentBlocks } from "./documents.ts";
import { seedProducts } from "./moto-products.ts";
import { defaultMoto } from "./moto-sale.ts";

const contractor = { name: "Q", doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };

test("ficha: atualizações valem por cima do contrato, sem apagar o que não mudou", () => {
  const d = defaultMoto({ contractor });
  d.chassis = "ORIG";
  d.motorNo = "M1";
  d.client.phone = "82999887766";
  d.client.city = "Maceió";
  const e = applyOverrides(d, { document_id: "x", chassis: "NOVO", motor_no: "  ", battery_no: null, charger_no: null, delivery_date: "2026-12-01" }, { ...emptyCustomer("doc:1"), phone: "82911112222" });
  assert.equal(e.chassis, "NOVO");
  assert.equal(e.motorNo, "M1");
  assert.equal(e.delivery.date, "2026-12-01");
  assert.equal(e.client.phone, "82911112222");
  assert.equal(e.client.city, "Maceió");
  assert.equal(d.chassis, "ORIG");
  assert.equal(applyOverrides(d, null, null), d);
  assert.equal(portalPin("(82) 9 1111-2222"), "2222");
});

test("transferência: o novo dono substitui o comprador e a ficha dele vale por cima", () => {
  const d = defaultMoto({ contractor });
  d.client.name = "Maria Lima";
  d.client.doc = "52998224725";
  d.client.address = "Rua da Maria, 1";
  d.client.phone = "82999887766";
  const info = { document_id: "x", chassis: null, motor_no: null, battery_no: null, charger_no: null, delivery_date: null, owner: { name: "João Pereira", doc: "11144477735", phone: "82988881234", city: "Maceió" }, transferred_at: "2026-11-20T10:00:00Z" };
  const e = applyOverrides(d, info, { ...emptyCustomer("doc:11144477735"), email: "joao@x.com" });
  assert.equal(e.client.name, "João Pereira");
  assert.equal(e.client.doc, "11144477735");
  assert.equal(e.client.address, "");
  assert.equal(e.client.email, "joao@x.com");
  assert.equal(e.transferredAt, "2026-11-20T10:00:00Z");
  assert.equal(portalPin(e.client.phone), "1234");
  // Sem dono novo, nada muda no comprador.
  assert.equal(applyOverrides(d, { ...info, owner: null }, null).client.name, "Maria Lima");
});

test("modelo corrigido sem reassinar: vale por cima, preço igual e contrato com nota de correção", () => {
  const d = defaultMoto({ contractor, model: "t1" });
  d.color = "Branca";
  const a2 = seedProducts().find((p) => p.slug === "a2")!;
  const fix = buildModelFix(d, a2, "Bege", "2026-11-21T02:00:00Z");
  assert.equal(fix.from, "Scooter elétrica T1 (Branca)");
  const info = { document_id: "x", chassis: null, motor_no: null, battery_no: null, charger_no: null, delivery_date: null, model_fix: fix };
  const v = applyOverrides(d, info);
  assert.equal(v.model, "a2");
  assert.equal(v.modelName, "A2");
  assert.equal(v.color, "Bege");
  assert.equal(v.specs.battery, "Lítio");
  assert.equal(v.specs.range, "");
  assert.equal(v.price, d.price);
  assert.deepEqual(v.payment, d.payment);
  assert.equal(d.model, "t1", "o contrato original não muda");
  const note = documentBlocks("moto", v).map((b) => b.text).join("\n");
  assert.match(note, /Nota de correção/);
  assert.match(note, /Em 20\/11\/2026, a VENDEDORA corrigiu .*"Scooter elétrica T1 \(Branca\)", leia-se "Scooter elétrica A2 \(Bege\)"/);
  assert.doesNotMatch(documentBlocks("moto", d).map((b) => b.text).join("\n"), /Nota de correção/);
  assert.equal(applyOverrides(d, { ...info, model_fix: null }).model, "t1");
});
