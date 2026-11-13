import { test } from "node:test";
import assert from "node:assert/strict";
import { rewardLabel as raw, sanitizeReferral } from "./referral.ts";

const rewardLabel = (r: Parameters<typeof raw>[0]) => raw(r)?.replace(/\s/g, " ") ?? null;

test("recompensa de indicação: % e valor fixo", () => {
  assert.equal(
    rewardLabel(sanitizeReferral({ kind: "fixed", value: 300 })),
    "R$ 300",
  );
  assert.equal(
    rewardLabel(sanitizeReferral({ kind: "percent", value: "2,5" })),
    "2,5%",
  );
  assert.equal(
    rewardLabel(sanitizeReferral({ kind: "percent", value: 250 })),
    "100%",
  );
  assert.equal(
    rewardLabel(sanitizeReferral({ kind: "fixed", value: -5 })),
    null,
  );
  assert.equal(rewardLabel(sanitizeReferral(null)), null);
  assert.equal(
    sanitizeReferral({ kind: "fixed", value: 100, note: "  ao fechar  " }).note,
    "ao fechar",
  );
});
