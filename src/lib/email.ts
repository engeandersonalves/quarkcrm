import "server-only";

/**
 * Envio de e-mails via Resend (https://resend.com) usando a API HTTP.
 * Variáveis: RESEND_API_KEY, EMAIL_FROM (ex.: "Quark CRM <alertas@seudominio.com.br>").
 * Sem RESEND_API_KEY os envios são ignorados silenciosamente.
 */
export async function sendEmail({ to, subject, html }: { to: string[]; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  const recipients = [...new Set(to.map((t) => t.trim().toLowerCase()).filter((t) => /.+@.+\..+/.test(t)))];
  if (!key || !recipients.length) return { skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Quark CRM <onboarding@resend.dev>", to: recipients, subject, html }),
  });
  if (!res.ok) {
    console.error("[email] falha no envio", res.status, await res.text().catch(() => ""));
    return { error: res.status };
  }
  return { ok: true };
}

export function recipientsFrom(settingsNotify: string | null | undefined, ...extra: (string | null | undefined)[]) {
  const envList = (process.env.NOTIFY_EMAILS ?? "").split(/[,;\s]+/);
  const settingsList = (settingsNotify ?? "").split(/[,;\s]+/);
  return [...envList, ...settingsList, ...extra].filter((e): e is string => !!e && e.includes("@"));
}

export function appUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Template de e-mail transacional com a identidade visual do app. */
export function emailTemplate({
  eyebrow,
  title,
  intro,
  rows,
  cta,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  rows?: [string, string | number | null | undefined][];
  cta?: { label: string; url: string };
}) {
  const rowsHtml = (rows ?? [])
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;color:#64748b;font-size:13px;border-bottom:1px solid #eef1f5;width:40%">${esc(k)}</td><td style="padding:10px 0;color:#0c1220;font-size:14px;font-weight:600;border-bottom:1px solid #eef1f5">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f0eff5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(12,18,32,.08)">
      <tr><td style="background:#1c1234;padding:28px 32px">
        <div style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#f3ea3b,#9bd373,#6cc690);text-align:center;line-height:36px;font-size:18px">⚡</div>
        <p style="margin:18px 0 0;color:#f3ea3b;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">${esc(eyebrow)}</p>
        <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;line-height:1.3">${esc(title)}</h1>
      </td></tr>
      <tr><td style="padding:28px 32px">
        ${intro ? `<p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.6">${esc(intro)}</p>` : ""}
        ${rowsHtml ? `<table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>` : ""}
        ${
          cta
            ? `<a href="${esc(cta.url)}" style="display:inline-block;margin-top:24px;background:#1c1234;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">${esc(cta.label)} →</a>`
            : ""
        }
      </td></tr>
    </table>
    <p style="color:#94a3b8;font-size:11px;margin-top:16px">Quark CRM · alerta automático</p>
  </td></tr></table></body></html>`;
}
