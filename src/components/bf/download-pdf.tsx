"use client";

import { createRoot } from "react-dom/client";
import type { PublicProposal } from "@/components/proposal/document";
import { dataUrlToBytes, jpegPagesToPdf } from "@/lib/pdf-image";
import { PDF_PAGE_H, PDF_PAGE_W, ProposalPdfPages } from "./proposal-pdf";

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const slug = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "cliente";

const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const loads = (src: string) =>
  fetch(src, { mode: "cors", cache: "force-cache" })
    .then((r) => r.ok && (r.headers.get("content-type") ?? "").startsWith("image/"))
    .catch(() => false);

/**
 * Toda imagem precisa carregar para entrar no PDF. A que falha (link quebrado, outro site
 * sem permissão) vira a foto padrão do equipamento ou some, em vez de travar o PDF.
 */
async function ensureImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:")) return;
      if (!(await loads(new URL(src, location.href).href))) img.src = img.dataset.fallback ?? BLANK;
      if (img.complete && img.naturalWidth) return;
      await new Promise<void>((done) => {
        img.addEventListener("load", () => done(), { once: true });
        img.addEventListener("error", () => {
          img.src = BLANK;
          done();
        }, { once: true });
        setTimeout(done, 6000);
      });
    }),
  );
}

/**
 * Monta a proposta em páginas A4 fora da tela, fotografa cada página e baixa um PDF.
 * Tudo no navegador: não abre o link nem a caixa de impressão.
 */
export async function downloadProposalPdf(
  data: PublicProposal,
  onProgress?: (done: number, total: number) => void,
) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PDF_PAGE_W}px;pointer-events:none;z-index:-1;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(<ProposalPdfPages data={data} />);
    for (let i = 0; i < 50 && !host.querySelector("[data-pdf-page]"); i++)
      await wait(40);
    await ensureImages(host);
    await (document.fonts?.ready ?? Promise.resolve());
    await wait(120);

    const { toJpeg, toPng } = await import("html-to-image");
    const pages = Array.from(
      host.querySelectorAll<HTMLElement>("[data-pdf-page]"),
    );
    const opts = {
      pixelRatio: 2,
      width: PDF_PAGE_W,
      height: PDF_PAGE_H,
      backgroundColor: "#050706",
      imagePlaceholder: BLANK,
    };
    // O 1º desenho no Safari às vezes sai sem imagens: um aquecimento resolve.
    await toPng(pages[0], { ...opts, pixelRatio: 0.3 }).catch(() => null);
    const shots: { jpeg: Uint8Array; width: number; height: number }[] = [];
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i, pages.length);
      const url = await toJpeg(pages[i], { ...opts, quality: 0.9 });
      shots.push({
        jpeg: dataUrlToBytes(url),
        width: PDF_PAGE_W * 2,
        height: PDF_PAGE_H * 2,
      });
    }
    onProgress?.(pages.length, pages.length);

    const blob = new Blob([jpegPagesToPdf(shots).buffer as ArrayBuffer], {
      type: "application/pdf",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `Proposta-${data.proposal.number}-${slug(data.lead.name)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } finally {
    root.unmount();
    host.remove();
  }
}
