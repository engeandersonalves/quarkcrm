/** Formatos de post a partir das dimensões da arte. */
export type AssetFormat = "story" | "feed" | "square" | "landscape" | "other";

export const FORMAT_LABEL: Record<AssetFormat, string> = {
  story: "Story 9:16",
  feed: "Feed 4:5",
  square: "Quadrado 1:1",
  landscape: "Paisagem",
  other: "Outro",
};

export function formatOf(width?: number | null, height?: number | null): AssetFormat {
  if (!width || !height) return "other";
  const r = height / width;
  if (r >= 1.65 && r <= 1.9) return "story";
  if (r >= 1.2 && r <= 1.3) return "feed";
  if (r >= 0.95 && r <= 1.05) return "square";
  if (r < 0.95) return "landscape";
  return "other";
}

/** Tamanhos de exportação prontos para o Instagram. */
export const EXPORT_SIZES = {
  story: { w: 1080, h: 1920, label: "Story / Status (1080×1920)" },
  feed: { w: 1080, h: 1350, label: "Feed (1080×1350)" },
  square: { w: 1080, h: 1080, label: "Quadrado (1080×1080)" },
} as const;

/** Onde desenhar a arte dentro do quadro de destino: inteira e centralizada (contain). */
export function fitContain(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return { x: Math.round((dstW - w) / 2), y: Math.round((dstH - h) / 2), w, h };
}

/** Preenche o quadro todo (cover), usado no fundo desfocado. */
export function fitCover(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return { x: Math.round((dstW - w) / 2), y: Math.round((dstH - h) / 2), w, h };
}

/** Links do Claude precisam de login: a imagem tem que ser baixada ou copiada. */
export const isClaudeLink = (url: string) => /(^|\.)claude\.(ai|com)\//i.test(url.replace(/^https?:\/\//, "").replace(/^www\./, "")) || /claude\.ai|claude\.com|claudeusercontent/i.test(url);

export const HASHTAGS = ["#energiasolar", "#energiafotovoltaica", "#economia", "#sustentabilidade", "#maceio", "#alagoas", "#contadeluz", "#quarkenergia"];

/** Endereços internos nunca são buscados pelo servidor (proteção contra SSRF). */
export function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (/^(0|10|127)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
  if (h === "::1" || h === "::" || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h) || /^::ffff:/.test(h)) return true;
  return false;
}
