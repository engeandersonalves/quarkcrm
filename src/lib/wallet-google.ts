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

/** Lê a configuração das variáveis de ambiente (JSON da conta de serviço puro ou em base64). */
export function googleWalletConfig(env: Record<string, string | undefined> = process.env): GoogleWalletConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim();
  // Aceita o JSON puro, em base64 ou colado entre aspas.
  const raw = env.GOOGLE_WALLET_SERVICE_ACCOUNT?.trim().replace(/^'([\s\S]*)'$/, "$1");
  if (!issuerId || !raw) return null;
  try {
    const json = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) return null;
    return { issuerId, clientEmail: json.client_email, privateKey: json.private_key };
  } catch {
    return null;
  }
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
  const hasId = !!env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const hasSa = !!env.GOOGLE_WALLET_SERVICE_ACCOUNT?.trim();
  const cfg = googleWalletConfig(env);
  if (!cfg) {
    const message = !hasId && !hasSa ? "As variáveis GOOGLE_WALLET_ISSUER_ID e GOOGLE_WALLET_SERVICE_ACCOUNT não estão na Vercel (ou falta o Redeploy)." : !hasId ? "Falta a variável GOOGLE_WALLET_ISSUER_ID na Vercel." : !hasSa ? "Falta a variável GOOGLE_WALLET_SERVICE_ACCOUNT na Vercel." : "O conteúdo de GOOGLE_WALLET_SERVICE_ACCOUNT não é o arquivo JSON da conta de serviço. Cole o arquivo inteiro, do { ao }.";
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
