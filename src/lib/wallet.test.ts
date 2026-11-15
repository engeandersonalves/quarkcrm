import { test } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { defaultMoto } from "./moto-sale.ts";
import { googleWalletConfig, googleWalletLink } from "./wallet-google.ts";
import { walletCard } from "./wallet-pass.ts";

const contractor = { name: "QUARK", doc: "", address: "", city: "", state: "AL", cep: "", repName: "", repDoc: "", repRole: "", repNationality: "", repMarital: "" };
const company = { name: "QUARK ENERGIA LTDA", cnpj: "12345678000195", whatsapp: "82991831476", instagram: "quarkenergia", city: "Maceió" };

function sale() {
  const d = defaultMoto({ contractor, model: "cappuccino" });
  d.client.name = "Maria Aparecida Lima";
  d.client.doc = "52998224725";
  d.chassis = "qk25cap001";
  d.color = "Creme";
  d.date = "2026-11-10";
  d.delivery.date = "2026-11-12";
  return d;
}

test("wallet: frente e verso do cartão", () => {
  const c = walletCard(sale(), "0a1b2c3d-1111-2222-3333-444455556666", company, "https://x.app/cliente");
  assert.equal(c.primary.value, "Cappuccino");
  assert.equal(c.art, "cappuccino");
  assert.equal(c.secondary[0].value, "Maria Aparecida");
  assert.equal(c.secondary[1].value, "10/02/2027");
  assert.equal(c.auxiliary[0].value, "QK25CAP001");
  assert.ok(c.back.some((f) => f.label === "CPF" && !f.value.includes("529.982")));
  assert.ok(c.back.every((f) => f.value));
  assert.match(c.qr, /CPV-0A1B2C/);
});

test("wallet: link do Google assinado com a conta de serviço", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pk = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const cfg = googleWalletConfig({ GOOGLE_WALLET_ISSUER_ID: "3388000000012345678", GOOGLE_WALLET_SERVICE_ACCOUNT: Buffer.from(JSON.stringify({ client_email: "wallet@x.iam.gserviceaccount.com", private_key: pk })).toString("base64") });
  assert.ok(cfg);
  const url = googleWalletLink(walletCard(sale(), "0a1b2c3d-1111-2222-3333-444455556666", company, "https://x.app/cliente"), cfg!, "https://x.app");
  const jwt = url.replace("https://pay.google.com/gp/v/save/", "");
  const [h, p, s] = jwt.split(".");
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url")));
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(claims.typ, "savetowallet");
  const obj = claims.payload.genericObjects[0];
  assert.match(obj.id, /^3388000000012345678\.scooter_0a1b2c3d/);
  assert.equal(obj.heroImage.sourceUri.uri, "https://x.app/wallet/hero-cappuccino.png");
  assert.ok(obj.textModulesData.length <= 20);
  assert.equal(googleWalletConfig({}), null);
});
