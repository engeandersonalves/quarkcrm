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
  const raw = env.GOOGLE_WALLET_SERVICE_ACCOUNT?.trim();
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
