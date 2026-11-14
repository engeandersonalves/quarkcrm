"use client";

import { downloadPagesPdf, pdfFileSlug } from "@/components/bf/download-pdf";
import type { MotoData } from "@/lib/moto-sale";
import { shortNo } from "@/lib/moto-sale";
import { MotoCertificatePages, MotoQuotePages, type SaleCompany } from "./sale-docs";

type Progress = (done: number, total: number) => void;

/** Orçamento da scooter em PDF (2 páginas A4, visual preto da Quark Mobilidade). */
export function downloadMotoQuote(d: MotoData, c: SaleCompany, id: string | null, onProgress?: Progress) {
  return downloadPagesPdf(<MotoQuotePages d={d} c={c} id={id} />, `Orcamento-${d.modelName || "Scooter"}-${pdfFileSlug(d.client.name)}.pdf`, { onProgress });
}

/** Certificado de garantia em PDF (2 páginas A4, papel claro com selo). */
export function downloadMotoCertificate(d: MotoData, c: SaleCompany, id: string | null, signedAt?: string | null, onProgress?: Progress) {
  return downloadPagesPdf(<MotoCertificatePages d={d} c={c} id={id} signedAt={signedAt} />, `Certificado-de-garantia-${shortNo(id, "GAR")}-${pdfFileSlug(d.client.name)}.pdf`, {
    background: "#FBFAF4",
    onProgress,
  });
}
