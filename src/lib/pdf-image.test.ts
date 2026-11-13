import { test } from "node:test";
import assert from "node:assert/strict";
import { jpegPagesToPdf } from "./pdf-image.ts";

test("PDF de várias páginas: estrutura e tabela xref válidas", () => {
  const fake = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegPagesToPdf([
    { jpeg: fake, width: 1588, height: 2246 },
    { jpeg: fake, width: 1588, height: 2246 },
    { jpeg: fake, width: 1588, height: 2246 },
  ]);
  const text = new TextDecoder("latin1").decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 3/);
  assert.match(text, /\/Kids \[3 0 R 6 0 R 9 0 R\]/);
  // cada entrada da xref aponta para o início de "n 0 obj"
  const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
  const rows = text.slice(xrefAt).split("\n").slice(3, 3 + 11);
  rows.forEach((r, i) => assert.equal(text.slice(Number(r.slice(0, 10)), Number(r.slice(0, 10)) + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
});
