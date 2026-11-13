import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionText, parseCommission } from "./referral.ts";

const norm = (s: string) => s.replace(/\s/g, " ");

test("comissão escolhida por quem indica: % ou R$", () => {
  assert.equal(parseCommission("percent", "2,5"), 2.5);
  assert.equal(parseCommission("percent", "150"), null);
  assert.equal(parseCommission("fixed", "1.500"), 1500);
  assert.equal(parseCommission("fixed", "300,50"), 300.5);
  assert.equal(parseCommission("fixed", ""), null);
  assert.equal(parseCommission("fixed", "-3"), null);
  assert.equal(norm(commissionText("fixed", 300)), "R$ 300");
  assert.equal(commissionText("percent", 2.5), "2,5% do valor do projeto");
});
