/**
 * Preenche células de uma planilha .xlsx existente mexendo só no XML das células:
 * formatação, células mescladas, listas de seleção, fórmulas, comentários e imagens
 * do modelo da distribuidora ficam exatamente como estão.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";

export type CellValue = string | number | null;
/** { "nome da guia": { "C10": "Fulano", "D7": 695 } } */
export type SheetValues = Record<string, Record<string, CellValue>>;

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "AB12" → [28, 12] (coluna a partir de 1). */
export function cellPos(ref: string): [number, number] {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) throw new Error(`Célula inválida: ${ref}`);
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return [col, Number(m[2])];
}

/** Monta o XML de uma célula preservando o estilo (s="…"). */
function cellXml(ref: string, style: string | null, value: CellValue) {
  const s = style ? ` s="${style}"` : "";
  if (value == null || value === "") return `<c r="${ref}"${s}/>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  const text = String(value);
  const space = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : "";
  return `<c r="${ref}"${s} t="inlineStr"><is><t${space}>${esc(text)}</t></is></c>`;
}

/** Troca (ou cria) o valor de uma célula no XML da guia. */
export function setCellInSheet(xml: string, ref: string, value: CellValue): string {
  // "P7!" = pode substituir a fórmula do modelo por um valor.
  const force = ref.endsWith("!");
  ref = ref.replace(/!$/, "").toUpperCase();
  const [col, rowNo] = cellPos(ref);
  // Célula existente: <c r="X" .../> ou <c r="X" ...>...</c>
  const cellRe = new RegExp(`<c r="${ref}"(\\s[^>]*?)?(/>|>([\\s\\S]*?)</c>)`);
  const m = cellRe.exec(xml);
  if (m) {
    const attrs = m[1] ?? "";
    if (!force && /<f[ >]/.test(m[3] ?? "")) return xml; // não sobrescreve fórmula
    const style = /\ss="(\d+)"/.exec(attrs)?.[1] ?? null;
    return xml.slice(0, m.index) + cellXml(ref, style, value) + xml.slice(m.index + m[0].length);
  }
  // Linha existente: insere a célula na ordem das colunas.
  const rowRe = new RegExp(`<row r="${rowNo}"(\\s[^>]*?)?(/>|>([\\s\\S]*?)</row>)`);
  const r = rowRe.exec(xml);
  const cell = cellXml(ref, null, value);
  if (r) {
    if (r[2] === "/>") {
      const open = `<row r="${rowNo}"${r[1] ?? ""}>`;
      return xml.slice(0, r.index) + open + cell + "</row>" + xml.slice(r.index + r[0].length);
    }
    const inner = r[3] ?? "";
    const cells = [...inner.matchAll(/<c r="([A-Z]+)\d+"/g)];
    const after = cells.find((c) => cellPos(`${c[1]}1`)[0] > col);
    const innerStart = r.index + r[0].indexOf(">") + 1;
    const at = after ? innerStart + (after.index ?? 0) : innerStart + inner.length;
    return xml.slice(0, at) + cell + xml.slice(at);
  }
  // Sem a linha: cria na ordem.
  const rows = [...xml.matchAll(/<row r="(\d+)"/g)];
  const next = rows.find((x) => Number(x[1]) > rowNo);
  const rowXml = `<row r="${rowNo}">${cell}</row>`;
  if (next) return xml.slice(0, next.index) + rowXml + xml.slice(next.index);
  return xml.replace("</sheetData>", `${rowXml}</sheetData>`).replace("<sheetData/>", `<sheetData>${rowXml}</sheetData>`);
}

/** Tira os resultados guardados das fórmulas para o Excel recalcular tudo ao abrir. */
export function dropCachedFormulaValues(xml: string) {
  return xml.replace(/(<c\b[^>]*>)(\s*<f[\s\S]*?(?:<\/f>|\/>))\s*<v>[\s\S]*?<\/v>/g, "$1$2");
}

/** Mapa nome da guia → caminho do XML dentro do arquivo. */
export function sheetPaths(files: Record<string, Uint8Array>): Record<string, string> {
  const wb = strFromU8(files["xl/workbook.xml"]);
  const rels = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const target: Record<string, string> = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1];
    const t = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) target[id] = t.startsWith("/") ? t.slice(1) : `xl/${t}`;
  }
  const out: Record<string, string> = {};
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /name="([^"]+)"/.exec(m[0])?.[1];
    const id = /r:id="([^"]+)"/.exec(m[0])?.[1];
    if (name && id && target[id]) out[name.replace(/&amp;/g, "&")] = target[id];
  }
  return out;
}

/**
 * Preenche o modelo e devolve o novo .xlsx. As fórmulas recalculam ao abrir
 * (fullCalcOnLoad) e a guia aberta passa a ser `activeSheet`, se informada.
 */
export function fillXlsx(template: Uint8Array, values: SheetValues, opts: { activeSheet?: string } = {}): Uint8Array {
  const files = unzipSync(template);
  const paths = sheetPaths(files);
  for (const [sheet, cells] of Object.entries(values)) {
    const path = paths[sheet];
    if (!path) throw new Error(`Guia "${sheet}" não existe no modelo`);
    let xml = strFromU8(files[path]);
    const relsPath = path.replace(/([^/]+)$/, "_rels/$1.rels");
    let rels = files[relsPath] ? strFromU8(files[relsPath]) : "";
    for (const [ref, v] of Object.entries(cells)) {
      xml = setCellInSheet(xml, ref, v);
      // Link antigo da célula (ex.: mailto do e-mail do modelo) sai junto.
      const link = new RegExp(`<hyperlink\\b[^>]*\\bref="${ref.replace(/!$/, "").toUpperCase()}"[^>]*/>`).exec(xml);
      if (link) {
        const rid = /r:id="([^"]+)"/.exec(link[0])?.[1];
        xml = xml.replace(link[0], "");
        if (rid && rels) rels = rels.replace(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*/>`), "");
      }
    }
    xml = xml.replace(/<hyperlinks>\s*<\/hyperlinks>/, "");
    files[path] = strToU8(xml);
    if (rels) files[relsPath] = strToU8(rels);
  }
  // Textos do modelo que nenhuma célula usa mais (dados antigos) ficam em branco.
  if (files["xl/sharedStrings.xml"]) {
    const used = new Set<number>();
    for (const path of Object.values(paths)) for (const m of strFromU8(files[path]).matchAll(/<c\b[^>]*\bt="s"[^>]*>\s*<v>(\d+)<\/v>/g)) used.add(Number(m[1]));
    let i = -1;
    files["xl/sharedStrings.xml"] = strToU8(strFromU8(files["xl/sharedStrings.xml"]).replace(/<si>[\s\S]*?<\/si>|<si\/>/g, (si) => (used.has(++i) ? si : "<si><t></t></si>")));
  }
  // Todas as guias recalculam (inclusive as que só têm fórmulas apontando para as preenchidas).
  for (const path of Object.values(paths)) files[path] = strToU8(dropCachedFormulaValues(strFromU8(files[path])));
  delete files["xl/calcChain.xml"];
  files["xl/_rels/workbook.xml.rels"] = strToU8(strFromU8(files["xl/_rels/workbook.xml.rels"]).replace(/<Relationship\b[^>]*calcChain[^>]*\/>/g, ""));
  if (files["[Content_Types].xml"]) files["[Content_Types].xml"] = strToU8(strFromU8(files["[Content_Types].xml"]).replace(/<Override\b[^>]*calcChain[^>]*\/>/g, ""));
  let wb = strFromU8(files["xl/workbook.xml"]);
  wb = /<calcPr\b/.test(wb) ? wb.replace(/<calcPr\b([^>]*?)\/>/, (_, a: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`) : wb.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
  // Sem o caminho da pasta de quem salvou o modelo.
  wb = wb.replace(/<mc:AlternateContent\b[\s\S]*?absPath[\s\S]*?<\/mc:AlternateContent>/, "");
  if (opts.activeSheet) {
    const names = [...wb.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map((m) => m[1]);
    const idx = names.indexOf(opts.activeSheet);
    if (idx >= 0) {
      wb = wb.replace(/activeTab="\d+"/, `activeTab="${idx}"`);
      if (!/activeTab=/.test(wb)) wb = wb.replace("<workbookView", `<workbookView activeTab="${idx}"`);
      for (const [name, path] of Object.entries(paths)) {
        let x = strFromU8(files[path]).replace(/\stabSelected="1"/g, "");
        if (name === opts.activeSheet) x = x.replace(/<sheetView\b/, '<sheetView tabSelected="1"');
        files[path] = strToU8(x);
      }
    }
  }
  files["xl/workbook.xml"] = strToU8(wb);
  if (files["docProps/core.xml"]) files["docProps/core.xml"] = strToU8(strFromU8(files["docProps/core.xml"]).replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/, "<cp:lastModifiedBy>Quark CRM</cp:lastModifiedBy>").replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, "<dc:creator>Quark CRM</dc:creator>"));
  const out: Zippable = {};
  for (const [k, v] of Object.entries(files)) out[k] = [v, { level: 6 }];
  return zipSync(out);
}
