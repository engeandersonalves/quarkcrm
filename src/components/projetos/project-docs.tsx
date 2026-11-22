"use client";

/**
 * Documentos do projeto: Excel do formulário preenchido, PDF do formulário, memorial
 * técnico em PDF e a pasta completa (os 7 itens em um PDF só, com índice).
 */
import { formCells, PROJECT_ITEMS, type ProjectData, type ProjectFiles } from "@/lib/solar-project";
import { projectFileBytes } from "@/lib/solar-project-db";
import { fillXlsx } from "@/lib/xlsx-fill";
import type { MemorialImages } from "./memorial-pdf";

export const today = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

const slug = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "cliente";

export const docName = (d: ProjectData, what: string, ext: string) => `${what}-${slug(d.client.name.split(" ").slice(0, 3).join(" "))}.${ext}`;

/** Formulário oficial da distribuidora preenchido (.xlsx). */
export async function formXlsx(d: ProjectData): Promise<Blob> {
  const res = await fetch("/projeto/formulario-grupo-b.xlsx", { cache: "no-store" });
  if (!res.ok) throw new Error("Modelo do formulário não encontrado");
  const out = fillXlsx(new Uint8Array(await res.arrayBuffer()), formCells(d), { activeSheet: "1" });
  return new Blob([out.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function formPdf(d: ProjectData, files?: ProjectFiles, date = today()): Promise<Blob> {
  const [{ pagesPdf }, { FormPages }] = await Promise.all([import("@/components/bf/download-pdf"), import("./form-pdf")]);
  const attached = files ? ["formulario", "memorial", ...PROJECT_ITEMS.filter((i) => !i.auto && files[i.key]).map((i) => i.key)] : undefined;
  return pagesPdf(<FormPages d={d} date={date} attached={attached} />, { background: "#FFFFFF" });
}

export async function memorialPdf(d: ProjectData, images: MemorialImages, date = today(), onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const [{ pagesPdf }, { MemorialPages }] = await Promise.all([import("@/components/bf/download-pdf"), import("./memorial-pdf")]);
  return pagesPdf(<MemorialPages d={d} images={images} date={date} />, { background: "#FFFFFF", onProgress });
}

const toDataUrl = (bytes: Uint8Array, type: string) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(new Blob([bytes.buffer as ArrayBuffer], { type }));
  });

/** Imagens do memorial (localização, caixa, CRESESB, assinatura) como data URL. */
export async function memorialImages(files: ProjectFiles): Promise<MemorialImages> {
  const out: MemorialImages = {};
  for (const k of ["localizacao", "caixa", "cresesb", "assinatura"] as const) {
    const f = files[k];
    if (!f || !f.type.startsWith("image/")) continue;
    try {
      out[k] = await toDataUrl(await projectFileBytes(f.path), f.type);
    } catch {
      /* sem a imagem: o memorial sai com o espaço indicado */
    }
  }
  return out;
}

/**
 * Pasta completa: índice + os 7 itens na ordem da distribuidora. PDFs entram com todas as
 * páginas; fotos (RG, diagramas) viram uma página A4 cada. Devolve o PDF e o que faltou.
 */
export async function projectPackage(d: ProjectData, files: ProjectFiles, generated: { formulario: Blob; memorial: Blob }): Promise<{ pdf: Blob; missing: string[] }> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const out = await PDFDocument.create();
  out.setTitle(`Projeto fotovoltaico - ${d.client.name}`);
  out.setCreator("Quark CRM");
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const A4: [number, number] = [595.28, 841.89];
  const index = out.addPage(A4);
  const missing: string[] = [];
  const starts: { n: number; title: string; page: number | null }[] = [];

  const addImage = async (bytes: Uint8Array, type: string) => {
    const img = type.includes("png") ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const page = out.addPage(A4);
    const m = 36;
    const scale = Math.min((A4[0] - m * 2) / img.width, (A4[1] - m * 2) / img.height, 1.5);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
  };
  const addPdf = async (bytes: Uint8Array) => {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  };

  for (const item of PROJECT_ITEMS) {
    const first = out.getPageCount() + 1;
    try {
      if (item.key === "formulario") await addPdf(new Uint8Array(await generated.formulario.arrayBuffer()));
      else if (item.key === "memorial") await addPdf(new Uint8Array(await generated.memorial.arrayBuffer()));
      else {
        const f = files[item.key];
        if (!f) {
          missing.push(item.title);
          starts.push({ n: item.n, title: item.title, page: null });
          continue;
        }
        const bytes = await projectFileBytes(f.path);
        if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) await addPdf(bytes);
        else if (/image\/(png|jpe?g)/.test(f.type)) await addImage(bytes, f.type);
        else {
          missing.push(`${item.title} (formato ${f.type || "desconhecido"}: envie PDF, JPG ou PNG)`);
          starts.push({ n: item.n, title: item.title, page: null });
          continue;
        }
      }
      starts.push({ n: item.n, title: item.title, page: first });
    } catch {
      missing.push(`${item.title} (não foi possível ler o arquivo)`);
      starts.push({ n: item.n, title: item.title, page: null });
    }
  }

  // Índice (fonte padrão do PDF: só caracteres latinos)
  const safe = (v: string) => v.normalize("NFC").replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u00B7]/g, "");
  const ink = rgb(0.08, 0.13, 0.1);
  const green = rgb(0.12, 0.48, 0.27);
  const gray = rgb(0.45, 0.5, 0.47);
  index.drawRectangle({ x: 0, y: A4[1] - 8, width: A4[0], height: 8, color: rgb(0.31, 0.76, 0.54) });
  index.drawText("PROJETO DE MICROGERAÇÃO DISTRIBUÍDA", { x: 56, y: 760, size: 10, font: bold, color: green });
  index.drawText("Pasta para a distribuidora", { x: 56, y: 732, size: 24, font: bold, color: ink });
  const sub = [d.client.name.toUpperCase(), d.uc.account ? `Conta contrato ${d.uc.account}` : "", [d.client.city, d.client.state].filter(Boolean).join("/")].filter(Boolean).join("  ·  ");
  index.drawText(safe(sub).slice(0, 95), { x: 56, y: 708, size: 10.5, font, color: gray });
  let y = 650;
  for (const s of starts) {
    index.drawText(String(s.n).padStart(2, "0"), { x: 56, y, size: 13, font: bold, color: green });
    index.drawText(s.title, { x: 90, y, size: 13, font: bold, color: ink });
    const right = s.page ? `página ${s.page}` : "não anexado";
    const w = font.widthOfTextAtSize(right, 11);
    index.drawText(right, { x: A4[0] - 56 - w, y, size: 11, font, color: s.page ? ink : rgb(0.7, 0.2, 0.15) });
    index.drawLine({ start: { x: 56, y: y - 12 }, end: { x: A4[0] - 56, y: y - 12 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.86) });
    y -= 40;
  }
  index.drawText(safe(`Responsável técnico: ${d.rt.name}${d.rt.register ? ` · Registro ${d.rt.register}` : ""}`).slice(0, 100), { x: 56, y: 90, size: 10, font, color: gray });
  index.drawText(`Gerado em ${today()} pelo Quark CRM`, { x: 56, y: 72, size: 9, font, color: gray });

  const bytes = await out.save();
  return { pdf: new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }), missing };
}
