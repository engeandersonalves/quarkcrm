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
  assert.equal(c.qr, "https://x.app/verificar/0a1b2c3d-1111-2222-3333-444455556666");
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
  assert.match(obj.id, /^3388000000012345678\.scooter_v2_0a1b2c3d/);
  const cls = claims.payload.genericClasses[0];
  const rows = cls.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos;
  assert.equal(rows.length, 2);
  const ids = obj.textModulesData.map((t: { id: string }) => t.id);
  for (const r of rows) for (const side of ["startItem", "endItem"]) assert.ok(ids.includes(r.twoItems[side].firstValue.fields[0].fieldPath.match(/'(.+)'/)[1]));
  assert.equal(obj.header.defaultValue.value, "Cappuccino");
  assert.equal(obj.logo.sourceUri.uri, "https://x.app/wallet/logo-google.png");
  assert.ok(obj.linksModuleData.uris.some((u: { uri: string }) => u.uri.startsWith("https://wa.me/5582991831476")));
  assert.equal(obj.heroImage.sourceUri.uri, "https://x.app/wallet/hero-cappuccino.png");
  assert.ok(obj.textModulesData.length <= 20);
  assert.equal(googleWalletConfig({}), null);
});

test("wallet: verificação das credenciais do Google", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: "wallet@x.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
  const env = { GOOGLE_WALLET_ISSUER_ID: "3388000000012345678", GOOGLE_WALLET_SERVICE_ACCOUNT: sa };
  const { checkGoogleWallet } = await import("./wallet-google.ts");
  const fake = (issuerStatus: number) =>
    (async (url: string | URL | Request) => {
      if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
      return new Response(issuerStatus === 200 ? JSON.stringify({ name: "Quark" }) : "{}", { status: issuerStatus });
    }) as typeof fetch;
  const ok = await checkGoogleWallet(env, fake(200));
  assert.equal(ok.ok, true);
  const denied = await checkGoogleWallet(env, fake(403));
  assert.equal(denied.ok, false);
  assert.match(!denied.ok ? denied.message : "", /convide wallet@x/);
  const missing = await checkGoogleWallet({}, fake(200));
  assert.match(!missing.ok ? missing.message : "", /não encontrou as variáveis/);
  const quoted = await checkGoogleWallet({ ...env, GOOGLE_WALLET_SERVICE_ACCOUNT: `'${sa}'` }, fake(200));
  assert.equal(quoted.ok, true);
});

test("wallet: aceita nomes e formatos diferentes das variáveis", async () => {
  const { googleWalletConfig, parseServiceAccount, walletEnvNames } = await import("./wallet-google.ts");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const json = JSON.stringify({ type: "service_account", client_email: "w@x.iam.gserviceaccount.com", private_key: pem }, null, 2);
  // Chave com quebras de linha reais (JSON inválido) ainda é lida.
  const broken = json.replace(/\\n/g, "\n");
  assert.equal(parseServiceAccount(broken)?.clientEmail, "w@x.iam.gserviceaccount.com");
  assert.match(parseServiceAccount(broken)?.privateKey ?? "", /-----END PRIVATE KEY-----/);
  const cfg = googleWalletConfig({ GOOGLE_WALLET_ISSUID_ID: "Issuer ID: 3388000000022123456", GOOGLE_WALLET_SERVICE: json });
  assert.equal(cfg?.issuerId, "3388000000022123456");
  assert.equal(cfg?.clientEmail, "w@x.iam.gserviceaccount.com");
  assert.deepEqual(walletEnvNames({ GOOGLE_WALLET_SERVICE: "x", OTHER: "y", GOOGLE_WALLET_ISSUER_ID: "" }), ["GOOGLE_WALLET_SERVICE"]);
});

test("wallet: Issuer ID errado gera mensagem clara", async () => {
  const { checkGoogleWallet, issuerOf } = await import("./wallet-google.ts");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = JSON.stringify({ client_id: "112233445566778899001", client_email: "w@x.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
  const bad = await checkGoogleWallet({ GOOGLE_WALLET_ISSUER_ID: "BCR2DN4TX7ABCDEF", GOOGLE_WALLET_SERVICE_ACCOUNT: sa });
  assert.match(!bad.ok ? bad.message : "", /ID do perfil da empresa/);
  const short = await checkGoogleWallet({ GOOGLE_WALLET_ISSUER_ID: "123456789", GOOGLE_WALLET_SERVICE_ACCOUNT: sa });
  assert.match(!short.ok ? short.message : "", /só 9 dígitos/);
  assert.equal(issuerOf("3388 0000 0002 2123 456"), "3388000000022123456");
  assert.equal(issuerOf("3388.0000.0002.2123.456"), "3388000000022123456");
  assert.equal(issuerOf("BCR2DN4TX7ABCDEF"), "");
});
