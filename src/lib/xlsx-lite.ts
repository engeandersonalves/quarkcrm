/**
 * Leitor mínimo de .xlsx no navegador (sem bibliotecas): abre o ZIP,
 * descompacta com DecompressionStream e lê a primeira planilha.
 */
async function inflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function entries(buf: Uint8Array) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Arquivo .xlsx inválido.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, { method: number; size: number; offset: number }>();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    out.set(dec.decode(buf.subarray(p + 46, p + 46 + nameLen)), { method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = async (name: string) => {
    const e = out.get(name);
    if (!e) return null;
    const nameLen = view.getUint16(e.offset + 26, true);
    const extraLen = view.getUint16(e.offset + 28, true);
    const start = e.offset + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + e.size);
    const bytes = e.method === 0 ? raw : await inflate(raw);
    return new TextDecoder().decode(bytes);
  };
  return { names: [...out.keys()], read };
}

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export async function readXlsx(file: Blob): Promise<string[][]> {
  const zip = entries(new Uint8Array(await file.arrayBuffer()));
  const parser = new DOMParser();
  const sharedXml = await zip.read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...parser.parseFromString(sharedXml, "application/xml").getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("")) : [];
  const sheetName = zip.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!sheetName) throw new Error("Nenhuma planilha encontrada no arquivo.");
  const doc = parser.parseFromString((await zip.read(sheetName))!, "application/xml");
  const table: string[][] = [];
  for (const row of [...doc.getElementsByTagName("row")]) {
    const cells: string[] = [];
    for (const c of [...row.getElementsByTagName("c")]) {
      const idx = colIndex(c.getAttribute("r") ?? "A");
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      cells[idx] = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? [...c.getElementsByTagName("t")].map((x) => x.textContent ?? "").join("") : v;
    }
    table.push(Array.from(cells, (x) => x ?? ""));
  }
  return table;
}
