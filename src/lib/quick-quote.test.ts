import assert from "node:assert/strict";
import { test } from "node:test";
import { jpegToPdf } from "./pdf-image.ts";
import { DEFAULT_QUICK, inverterFor, modulesFor, quickQuote } from "./quick-quote.ts";

test("dimensiona placas e inversor pelo consumo", () => {
  assert.equal(modulesFor(0, 610, 5), 0);
  assert.equal(modulesFor(100, 610, 5), 4); // mínimo de 4 placas
  const n = modulesFor(600, 610, 5); // 600 / (5*30*0,8) = 5 kWp → 9 placas de 610 W
  assert.equal(n, 9);
  assert.equal(inverterFor(5.49), 5);
  assert.equal(inverterFor(8.5), 7);
  assert.equal(inverterFor(0), 0);
});

test("preço por Wp, à vista com desconto e parcelas", () => {
  const q = quickQuote({ ...DEFAULT_QUICK, consumptionKwh: 600, sunHours: 5, priceMode: "wp", price: 3, cashDiscountPct: 10, financingRate: 1.5, financingMonths: 60, cardInstallments: 12, cardRate: 2 });
  assert.equal(q.modules, 9);
  assert.ok(Math.abs(q.kwp - 5.49) < 1e-9);
  assert.ok(Math.abs(q.price - 16470) < 1e-6);
  assert.ok(Math.abs(q.cashPrice - 14823) < 1e-6);
  assert.ok(q.financing > q.price / 60 && q.card > q.price / 12);
  assert.ok(q.monthlySavings > 0 && q.billAfter < q.billBefore);
  assert.ok(q.paybackYears > 0 && q.paybackYears < 10);
});

test("valores manuais têm prioridade sobre o automático", () => {
  const q = quickQuote({ ...DEFAULT_QUICK, consumptionKwh: 600, modules: 12, inverterKw: 8, priceMode: "total", price: 20000 });
  assert.equal(q.modules, 12);
  assert.equal(q.inverterKw, 8);
  assert.equal(q.price, 20000);
  assert.equal(q.paybackYears > 0, true);
  // Sem preço: sem parcelas nem retorno.
  const free = quickQuote({ ...DEFAULT_QUICK, price: 0 });
  assert.equal(free.financing, 0);
  assert.equal(free.paybackYears, 0);
});

test("PDF com imagem: estrutura e tabela xref corretas", () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegToPdf(fakeJpeg, 1080, 1350);
  const text = new TextDecoder("latin1").decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.match(text, /\/MediaBox \[0 0 595 744\]/);
  const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
  assert.equal(text.slice(xrefAt, xrefAt + 4), "xref");
  // Cada deslocamento da tabela aponta para "N 0 obj" (contando bytes).
  const entries = [...text.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  entries.forEach((off, i) => assert.equal(new TextDecoder("latin1").decode(pdf.slice(off, off + 7)), `${i + 1} 0 obj`));
});
