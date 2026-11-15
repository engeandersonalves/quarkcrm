/**
 * Google Wallet: link "Salvar no Google Wallet" com um JWT assinado pela conta de
 * serviço (RS256). A classe e o objeto vão dentro do próprio JWT, sem chamar a API.
 */
import { createSign } from "node:crypto";
import type { WalletCard } from "./wallet-pass.ts";

export interface GoogleWalletConfig {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");
const safeId = (v: string) => v.replace(/[^A-Za-z0-9._-]/g, "_");

type Env = Record<string, string | undefined>;

/** Nomes aceitos (o oficial primeiro); variações comuns de quem cadastra na mão também valem. */
const ISSUER_KEYS = /^(GOOGLE_)?(WALLET_)?ISS?U(E|I)R?D?_?ID$|ISSUER/i;
const ACCOUNT_KEYS = /(WALLET|GOOGLE).*(SERVICE|ACCOUNT|CREDENTIAL|JSON|KEY)/i;

const unquote = (v: string) => v.trim().replace(/^'([\s\S]*)'$/, "$1").replace(/^"(\{[\s\S]*\})"$/, "$1");

/** Lê o JSON da conta de serviço: puro, em base64, entre aspas ou com quebras de linha coladas. */
export function parseServiceAccount(value: string | undefined): { clientEmail: string; privateKey: string } | null {
  if (!value?.trim()) return null;
  let raw = unquote(value);
  if (!raw.startsWith("{")) {
    try {
      raw = Buffer.from(raw, "base64").toString("utf8").trim();
    } catch {
      return null;
    }
  }
  try {
    const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (j.client_email && j.private_key) return { clientEmail: j.client_email, privateKey: j.private_key };
  } catch {
    /* JSON com quebras de linha reais dentro da chave: lê os campos direto */
  }
  const email = raw.match(/"client_email"\s*:\s*"([^"]+)"/)?.[1];
  const key = raw.match(/"private_key"\s*:\s*"(-----BEGIN[\s\S]*?-----END PRIVATE KEY-----(?:\\n|\n)?)"/)?.[1];
  return email && key ? { clientEmail: email, privateKey: key.replace(/\\n/g, "\n") } : null;
}

/** Número do emissor: 19 dígitos (aceita espaços, pontos ou texto junto, como "Issuer ID: 3388…"). */
export function issuerOf(v: string | undefined) {
  if (!v) return "";
  const run = v.match(/\d{15,25}/)?.[0];
  if (run) return run;
  const all = v.replace(/\D/g, "");
  return !/BCR2DN/i.test(v) && all.length >= 15 && all.length <= 25 ? all : "";
}

/** Descreve (sem revelar segredo) o que foi colado no lugar do Issuer ID. */
function issuerHint(v: string | undefined) {
  const t = (v ?? "").trim();
  if (!t) return "a variável está vazia";
  if (/BCR2DN/i.test(t)) return `o valor começa com "${t.slice(0, 6)}…", que é o ID do perfil da empresa, não o Issuer ID`;
  if (/^https?:/i.test(t)) return "o valor é um endereço (link), não o número";
  const d = t.replace(/\D/g, "");
  if (d.length && d.length < 15) return `o valor tem só ${d.length} dígitos (o Issuer ID tem 19)`;
  if (d.length > 25) return `o valor tem ${d.length} dígitos (o Issuer ID tem 19)`;
  return `o valor colado (${t.length} caracteres) não é o número de 19 dígitos`;
}

/** Variáveis de ambiente relacionadas ao Wallet (só os nomes, para o diagnóstico). */
export function walletEnvNames(env: Env = process.env) {
  return Object.keys(env).filter((k) => /WALLET|ISSUER/i.test(k) && env[k]?.trim()).sort();
}

/** Lê a configuração das variáveis de ambiente. */
export function googleWalletConfig(env: Env = process.env): GoogleWalletConfig | null {
  const names = walletEnvNames(env);
  const issuerKey = env.GOOGLE_WALLET_ISSUER_ID?.trim() ? "GOOGLE_WALLET_ISSUER_ID" : names.find((k) => ISSUER_KEYS.test(k) && issuerOf(env[k]));
  const issuerId = issuerKey ? issuerOf(env[issuerKey]) : "";
  const accountKeys = ["GOOGLE_WALLET_SERVICE_ACCOUNT", ...Object.keys(env).filter((k) => k !== "GOOGLE_WALLET_SERVICE_ACCOUNT" && ACCOUNT_KEYS.test(k))];
  let sa: ReturnType<typeof parseServiceAccount> = null;
  for (const k of accountKeys) {
    sa = parseServiceAccount(env[k]);
    if (sa) break;
  }
  if (!issuerId || !sa) return null;
  return { issuerId, clientEmail: sa.clientEmail, privateKey: sa.privateKey };
}

export function googleWalletObjects(card: WalletCard, cfg: Pick<GoogleWalletConfig, "issuerId">, origin: string) {
  const classId = `${cfg.issuerId}.quark_mobilidade_scooter`;
  const objectId = `${cfg.issuerId}.${safeId(`scooter_${card.serial}`)}`;
  const text = (h: string, b: string, id: string) => ({ header: h, body: b, id });
  return {
    genericClasses: [{ id: classId }],
    genericObjects: [
      {
        id: objectId,
        classId,
        state: "ACTIVE",
        hexBackgroundColor: "#0B1A12",
        logo: { sourceUri: { uri: `${origin}/wallet/icon@3x.png` }, contentDescription: { defaultValue: { language: "pt-BR", value: "Quark Mobilidade" } } },
        cardTitle: { defaultValue: { language: "pt-BR", value: "Quark Mobilidade" } },
        subheader: { defaultValue: { language: "pt-BR", value: "Scooter elétrica" } },
        header: { defaultValue: { language: "pt-BR", value: [card.model, card.color].filter(Boolean).join(" · ") } },
        heroImage: { sourceUri: { uri: `${origin}/wallet/hero-${card.art}.png` }, contentDescription: { defaultValue: { language: "pt-BR", value: card.model } } },
        textModulesData: [
          ...card.secondary.map((f) => text(f.label, f.value, f.key)),
          ...card.auxiliary.map((f) => text(f.label, f.value, f.key)),
          ...card.back.map((f) => text(f.label, f.value, `b_${f.key}`)),
        ].slice(0, 20),
        barcode: { type: "QR_CODE", value: card.qr, alternateText: card.number },
        linksModuleData: { uris: [{ uri: `${origin}/cliente`, description: "Área do cliente: manual, garantia e comprovante", id: "portal" }] },
      },
    ],
  };
}

/** Link para salvar o cartão no Google Wallet. */
export function googleWalletLink(card: WalletCard, cfg: GoogleWalletConfig, origin: string, now = Date.now()) {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: cfg.clientEmail, aud: "google", typ: "savetowallet", iat: Math.floor(now / 1000), origins: [origin], payload: googleWalletObjects(card, cfg, origin) };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(cfg.privateKey.replace(/\\n/g, "\n"));
  return `https://pay.google.com/gp/v/save/${unsigned}.${b64url(sig)}`;
}

export type WalletCheck =
  | { ok: true; issuerName: string; serviceEmail: string; issuerId: string }
  | { ok: false; step: "config" | "token" | "issuer"; message: string; serviceEmail?: string; issuerId?: string };

/**
 * Verifica a configuração de verdade: pega um token com a conta de serviço e lê o
 * emissor (Issuer ID). Nunca devolve a chave, só o e-mail da conta e o resultado.
 */
export async function checkGoogleWallet(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<WalletCheck> {
  const cfg = googleWalletConfig(env);
  if (!cfg) {
    const names = walletEnvNames(env);
    const found = names.length ? ` Variáveis encontradas: ${names.join(", ")}.` : " Nenhuma variável com WALLET ou ISSUER foi encontrada neste deploy.";
    const issuerKeys = names.filter((k) => /ISSU/i.test(k));
    const issuer = issuerKeys.some((k) => issuerOf(env[k]));
    const account = !!parseServiceAccount(env.GOOGLE_WALLET_SERVICE_ACCOUNT) || Object.keys(env).some((k) => /WALLET/i.test(k) && ACCOUNT_KEYS.test(k) && parseServiceAccount(env[k]));
    const where = env.VERCEL_ENV ? ` (ambiente: ${env.VERCEL_ENV})` : "";
    const message = !names.length
      ? `O app não encontrou as variáveis do Google Wallet${where}. Confira se foram salvas marcando "Production" e se você fez o Redeploy depois.${found}`
      : !issuer
        ? issuerKeys.length
          ? `O Issuer ID está errado: ${issuerHint(env[issuerKeys[0]])}. Em pay.google.com/business/console → Google Wallet API, copie o número de 19 dígitos que começa com 3388 e troque o valor de ${issuerKeys[0]} na Vercel (depois faça o Redeploy).${found}`
          : `Não achei o Issuer ID (um número com 19 dígitos que começa com 3388). Crie GOOGLE_WALLET_ISSUER_ID com esse número.${found}`
        : !account
          ? `Não consegui ler o JSON da conta de serviço. Crie GOOGLE_WALLET_SERVICE_ACCOUNT e cole o arquivo .json inteiro, do { ao }.${found}`
          : `Configuração incompleta: confira o Issuer ID e o JSON da conta de serviço.${found}`;
    return { ok: false, step: "config", message };
  }
  if (!/^\d{10,25}$/.test(cfg.issuerId)) return { ok: false, step: "config", message: "O Issuer ID deve ter só números (ex.: 3388000000022…). Confira GOOGLE_WALLET_ISSUER_ID.", serviceEmail: cfg.clientEmail };

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: cfg.clientEmail, scope: "https://www.googleapis.com/auth/wallet_object.issuer", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 600 }));
  let assertion: string;
  try {
    assertion = `${header}.${claims}.${b64url(createSign("RSA-SHA256").update(`${header}.${claims}`).sign(cfg.privateKey.replace(/\\n/g, "\n")))}`;
  } catch {
    return { ok: false, step: "config", message: "A chave privada do JSON está incompleta. Cole o arquivo inteiro de novo na Vercel.", serviceEmail: cfg.clientEmail };
  }
  const tok = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  }).catch(() => null);
  const tj = tok ? ((await tok.json().catch(() => ({}))) as { access_token?: string; error_description?: string }) : {};
  if (!tj.access_token)
    return { ok: false, step: "token", message: `O Google recusou a conta de serviço${tj.error_description ? ` (${tj.error_description})` : ""}. A chave pode ter sido apagada: gere uma nova em Contas de serviço → Chaves e troque na Vercel.`, serviceEmail: cfg.clientEmail, issuerId: cfg.issuerId };

  const res = await fetcher(`https://walletobjects.googleapis.com/walletobjects/v1/issuer/${cfg.issuerId}`, { headers: { Authorization: `Bearer ${tj.access_token}` } }).catch(() => null);
  if (res?.ok) {
    const j = (await res.json().catch(() => ({}))) as { name?: string };
    return { ok: true, issuerName: j.name ?? "", serviceEmail: cfg.clientEmail, issuerId: cfg.issuerId };
  }
  const status = res?.status ?? 0;
  const message =
    status === 403 && (await res?.clone().text().catch(() => ""))?.includes("SERVICE_DISABLED")
      ? "A Google Wallet API não está ativada no projeto do Google Cloud. Ative em APIs e serviços → Biblioteca → Google Wallet API."
      : status === 404
        ? "Esse Issuer ID não foi encontrado. Copie de novo o número em pay.google.com/business/console → Google Wallet API."
        : status === 403 || status === 401
          ? `A conta de serviço não tem acesso a esse emissor. No Pay & Wallet Console → Usuários, convide ${cfg.clientEmail} como Desenvolvedor.`
          : `O Google respondeu com erro ${status || "de conexão"}. Tente de novo em alguns minutos.`;
  return { ok: false, step: "issuer", message, serviceEmail: cfg.clientEmail, issuerId: cfg.issuerId };
}
