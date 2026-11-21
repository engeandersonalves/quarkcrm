/**
 * Materiais de divulgação para os vendedores parceiros (área /vendedor).
 * Artes em 1080×1920 (stories e status do WhatsApp) e o catálogo completo em PDF.
 * Para trocar uma campanha, substitua os arquivos em public/mob/materiais e ajuste esta lista.
 */

export interface SellerArt {
  src: string;
  label: string;
  /** Modelo da arte (entra na legenda ao enviar). */
  model?: string;
}

export interface SellerArtGroup {
  title: string;
  tagline: string;
  arts: SellerArt[];
}

export const SELLER_CAMPAIGN = {
  name: "Black Friday",
  /** Último dia da campanha (yyyy-mm-dd): depois disso a área avisa para conferir os preços. */
  until: "2026-11-27",
  catalog: { src: "/mob/materiais/catalogo-quark-mobilidade-5-modelos.pdf", file: "Catalogo-Quark-Mobilidade-5-Modelos.pdf", pages: 10, size: "6,9 MB" },
};

/** Páginas do catálogo de 5 modelos, uma arte por página. */
export const SELLER_ARTS: SellerArtGroup[] = [
  {
    title: "Modelos",
    tagline: "Ficha, preço e parcela de cada scooter",
    arts: [
      { src: "/mob/materiais/a2.jpg", label: "A2", model: "A2" },
      { src: "/mob/materiais/t1.jpg", label: "T1", model: "T1" },
      { src: "/mob/materiais/city.jpg", label: "City", model: "City" },
      { src: "/mob/materiais/cappuccino.jpg", label: "Cappuccino", model: "Cappuccino" },
      { src: "/mob/materiais/mz.jpg", label: "MZ", model: "MZ" },
    ],
  },
  {
    title: "Divulgação",
    tagline: "Capa, comparativo e por que a Quark",
    arts: [
      { src: "/mob/materiais/capa.jpg", label: "Capa · 5 modelos" },
      { src: "/mob/materiais/comparativo.jpg", label: "Comparativo" },
      { src: "/mob/materiais/rotina.jpg", label: "Livre do trânsito" },
      { src: "/mob/materiais/forca.jpg", label: "Mais força" },
      { src: "/mob/materiais/quem-somos.jpg", label: "Quem somos" },
    ],
  },
];

/** A campanha já acabou? (compara só a data, no fuso de Maceió). */
export function campaignEnded(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(now);
  return today > SELLER_CAMPAIGN.until;
}
