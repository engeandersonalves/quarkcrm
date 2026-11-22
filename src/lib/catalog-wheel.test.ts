import { test } from "node:test";
import assert from "node:assert/strict";
import { PRIZES, chances, drawPrize, prizeCode, spinAngle } from "./catalog-wheel.ts";

test("roleta: sorteio pelo peso cobre todos os prêmios e respeita as chances", () => {
  const count: Record<string, number> = {};
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const p = drawPrize((i + 0.5) / N);
    count[p.key] = (count[p.key] ?? 0) + 1;
  }
  for (const c of chances()) assert.ok(Math.abs((count[c.key] / N) * 100 - c.pct) < 0.2, `${c.key}: ${count[c.key]}`);
  assert.equal(drawPrize(0).key, PRIZES[0].key);
  assert.equal(drawPrize(0.9999999).key, PRIZES[PRIZES.length - 1].key);
  assert.equal(Math.round(chances().reduce((s, c) => s + c.pct, 0)), 100);
});

test("roleta: a animação para com o prêmio sorteado no ponteiro", () => {
  const slice = 360 / PRIZES.length;
  PRIZES.forEach((p, i) => {
    const a = spinAngle(p.key, 7);
    // centro da fatia i depois de girar `a` graus fica no topo (0°)
    assert.equal(((i * slice + slice / 2 + a) % 360 + 360) % 360, 0);
    assert.ok(a >= 7 * 360);
  });
});

test("roleta: código do cupom legível", () => {
  const c = prizeCode(new Uint8Array([0, 1, 2, 3, 31]));
  assert.match(c, /^QK-[A-HJ-NP-Z2-9]{5}$/);
});
