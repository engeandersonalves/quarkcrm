import "server-only";
import type { WalletCard } from "./wallet-pass";

/**
 * Apple Wallet (.pkpass) assinado com o certificado "Pass Type ID" da conta Apple
 * Developer. Os certificados ficam só nas variáveis de ambiente da Vercel (PEM em base64).
 */
export interface AppleWalletConfig {
  passTypeId: string;
  teamId: string;
  wwdr: string;
  signerCert: string;
  signerKey: string;
  passphrase?: string;
}

const pem = (v: string) => (v.includes("-----BEGIN") ? v : Buffer.from(v, "base64").toString("utf8"));

export function appleWalletConfig(env: Record<string, string | undefined> = process.env): AppleWalletConfig | null {
  const passTypeId = env.APPLE_WALLET_PASS_TYPE_ID?.trim();
  const teamId = env.APPLE_WALLET_TEAM_ID?.trim();
  const cert = env.APPLE_WALLET_CERT?.trim();
  const key = env.APPLE_WALLET_KEY?.trim();
  const wwdr = env.APPLE_WALLET_WWDR?.trim();
  if (!passTypeId || !teamId || !cert || !key || !wwdr) return null;
  try {
    return { passTypeId, teamId, wwdr: pem(wwdr), signerCert: pem(cert), signerKey: pem(key), passphrase: env.APPLE_WALLET_KEY_PASSPHRASE || undefined };
  } catch {
    return null;
  }
}

const field = (f: { key: string; label: string; value: string }) => ({ key: f.key, label: f.label, value: f.value });

/** Monta e assina o cartão. As imagens vêm do próprio site (public/wallet). */
export async function applePass(card: WalletCard, cfg: AppleWalletConfig, origin: string, company: string): Promise<Buffer> {
  const { PKPass } = await import("passkit-generator");
  const names = ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png"];
  const strips = ["", "@2x", "@3x"].map((s) => [`strip${s}.png`, `strip-${card.art}${s}.png`] as const);
  const files: Record<string, Buffer> = {};
  await Promise.all([
    ...names.map(async (n) => {
      const r = await fetch(`${origin}/wallet/${n}`);
      if (r.ok) files[n] = Buffer.from(await r.arrayBuffer());
    }),
    ...strips.map(async ([n, src]) => {
      const r = await fetch(`${origin}/wallet/${src}`);
      if (r.ok) files[n] = Buffer.from(await r.arrayBuffer());
    }),
  ]);
  if (!files["icon.png"]) throw new Error("Imagens do cartão indisponíveis");

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: card.serial,
    organizationName: company || "Quark Mobilidade",
    description: `Cartão da scooter ${card.model}`,
    logoText: "Mobilidade",
    backgroundColor: "rgb(11,26,18)",
    foregroundColor: "rgb(255,255,255)",
    labelColor: "rgb(228,240,74)",
    sharingProhibited: true,
    storeCard: {
      primaryFields: [field(card.primary)],
      secondaryFields: card.secondary.map(field),
      auxiliaryFields: card.auxiliary.map(field),
      backFields: card.back.map(field),
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: card.qr, messageEncoding: "iso-8859-1", altText: card.number }],
  };
  files["pass.json"] = Buffer.from(JSON.stringify(passJson));

  const pass = new PKPass(files, { wwdr: cfg.wwdr, signerCert: cfg.signerCert, signerKey: cfg.signerKey, signerKeyPassphrase: cfg.passphrase });
  return pass.getAsBuffer();
}
