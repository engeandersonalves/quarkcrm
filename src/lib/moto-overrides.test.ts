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
