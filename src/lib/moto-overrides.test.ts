import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOverrides, emptyCustomer, portalPin } from "./moto-overrides.ts";
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
