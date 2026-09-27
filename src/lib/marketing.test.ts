import assert from "node:assert/strict";
import { test } from "node:test";
import { fitContain, fitCover, formatOf, isClaudeLink, isPrivateHost } from "./marketing.ts";

test("formato pelo tamanho da arte", () => {
  assert.equal(formatOf(1080, 1920), "story");
  assert.equal(formatOf(1080, 1350), "feed");
  assert.equal(formatOf(1080, 1080), "square");
  assert.equal(formatOf(1920, 1080), "landscape");
  assert.equal(formatOf(1000, 1500), "other");
  assert.equal(formatOf(null, 100), "other");
});

test("encaixe inteiro e preenchimento", () => {
  assert.deepEqual(fitContain(1080, 1080, 1080, 1920), { x: 0, y: 420, w: 1080, h: 1080 });
  assert.deepEqual(fitContain(2000, 1000, 1080, 1920), { x: 0, y: 690, w: 1080, h: 540 });
  const c = fitCover(1080, 1080, 1080, 1920);
  assert.equal(c.h, 1920);
  assert.ok(c.w >= 1080);
});

test("links do Claude e endereços internos", () => {
  assert.ok(isClaudeLink("https://claude.ai/public/artifacts/abc"));
  assert.ok(isClaudeLink("https://claude.com/design/x"));
  assert.ok(!isClaudeLink("https://i.imgur.com/x.png"));
  for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1"]) assert.ok(isPrivateHost(h), h);
  for (const h of ["i.imgur.com", "8.8.8.8", "172.32.0.1"]) assert.ok(!isPrivateHost(h), h);
});
