/**
 * Fotos fixas dos equipamentos, usadas no pré-orçamento (story) e nas propostas.
 * Quando preenchidas, têm prioridade sobre as fotos dos kits e das Configurações.
 */
export const FIXED_MODULE_IMAGE = "https://allever.vteximg.com.br/arquivos/ids/309379/03820645.png?v=639210985026930000";
/** Marca do inversor da foto fixa (preenche o campo quando estiver vazio). */
export const FIXED_INVERTER_BRAND = "Sungrow";
export const FIXED_INVERTER_IMAGE = "https://br.sungrowpower.com/upload/6383252987764629807241080.png";

/** Domínios de imagem servidos pelo nosso próprio endereço (evita bloqueio ao gerar PNG/PDF). */
export const PROXY_IMAGE_HOSTS = ["vteximg.com.br", "vtexassets.com", "sungrowpower.com"];

export function isProxyHost(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && PROXY_IMAGE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Endereço para usar no <img>: imagens de lojas externas passam pelo proxy do app. */
export function productImg(url: string | null | undefined) {
  if (!url) return "";
  return isProxyHost(url) ? `/api/img?u=${encodeURIComponent(url)}` : url;
}

export const moduleImageOf = (...fallbacks: (string | null | undefined)[]) => FIXED_MODULE_IMAGE || fallbacks.find(Boolean) || "";
export const inverterImageOf = (...fallbacks: (string | null | undefined)[]) => FIXED_INVERTER_IMAGE || fallbacks.find(Boolean) || "";
