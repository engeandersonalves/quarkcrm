/**
 * Materiais de divulgação para os vendedores parceiros (área /vendedor).
 * Artes em 1080×1920 (stories e status do WhatsApp) e o catálogo completo em PDF.
 * Para trocar uma campanha, substitua os arquivos em public/mob/materiais e ajuste esta lista.
 */

export interface SellerArt {
  src: string;
  label: string;
}

export interface SellerModelArts {
  model: string;
  tagline: string;
  arts: SellerArt[];
}

export const SELLER_CAMPAIGN = {
  name: "Black Friday",
  /** Último dia da campanha (yyyy-mm-dd): depois disso a área avisa para conferir os preços. */
  until: "2026-11-27",
  catalog: { src: "/mob/materiais/catalogo-quark-mobilidade.pdf", file: "Catalogo-Quark-Mobilidade.pdf", pages: 8, size: "5,7 MB" },
};

export const SELLER_ARTS: SellerModelArts[] = [
  { model: "City", tagline: "A estilosa de pneu largo", arts: [{ src: "/mob/materiais/city-capa.jpg", label: "Capa" }, { src: "/mob/materiais/city-ficha.jpg", label: "Ficha técnica" }] },
  { model: "Cappuccino", tagline: "A clássica retrô", arts: [{ src: "/mob/materiais/cappuccino-capa.jpg", label: "Capa" }, { src: "/mob/materiais/cappuccino-ficha.jpg", label: "Ficha técnica" }] },
  { model: "T1", tagline: "A prática do dia a dia", arts: [{ src: "/mob/materiais/t1-capa.jpg", label: "Capa" }, { src: "/mob/materiais/t1-ficha.jpg", label: "Ficha técnica" }] },
  { model: "MZ", tagline: "A esportiva top de linha", arts: [{ src: "/mob/materiais/mz-capa.jpg", label: "Capa" }, { src: "/mob/materiais/mz-ficha.jpg", label: "Ficha técnica" }] },
];

/** A campanha já acabou? (compara só a data, no fuso de Maceió). */
export function campaignEnded(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(now);
  return today > SELLER_CAMPAIGN.until;
}
