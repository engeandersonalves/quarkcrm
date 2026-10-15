import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Credenciais dos inversores: AES-256-GCM no servidor. A chave vem de
 * MONITORING_SECRET (opcional, recomendado) ou é derivada da service role
 * do Supabase — nunca vai para o navegador nem fica em texto puro no banco.
 */
function key(secret?: string) {
  const base = secret ?? process.env.MONITORING_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY (ou MONITORING_SECRET) na Vercel para guardar as conexões.");
  return createHash("sha256").update(`quark-monitoring:${base.trim()}`).digest();
}

export function sealCredentials(data: Record<string, string>, secret?: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function openCredentials(sealed: string, secret?: string): Record<string, string> {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Credenciais em formato inválido.");
  const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8"));
}
