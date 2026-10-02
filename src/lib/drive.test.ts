import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryFromHints, categoryOf, driveFolderId, fmtDuration, groupCarousels, kindOf, parseEmbeddedFolder, prettyName } from "./drive.ts";

test("lê o ID da pasta em qualquer formato de link", () => {
  assert.equal(driveFolderId("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWx?usp=sharing"), "1AbCdEfGhIjKlMnOpQrStUvWx");
  assert.equal(driveFolderId("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWx"), "1AbCdEfGhIjKlMnOpQrStUvWx");
  assert.equal(driveFolderId("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWx"), "1AbCdEfGhIjKlMnOpQrStUvWx");
  assert.equal(driveFolderId("1AbCdEfGhIjKlMnOpQrStUvWx"), "1AbCdEfGhIjKlMnOpQrStUvWx");
  assert.equal(driveFolderId("https://google.com"), null);
});

test("tipo e categoria", () => {
  assert.equal(kindOf("reel.MP4"), "video");
  assert.equal(kindOf("x", "image/png"), "image");
  assert.equal(kindOf("catalogo.pdf"), "other");
  assert.equal(categoryFromHints("arte.png", "Stories/Natal"), "story");
  assert.equal(categoryFromHints("arte.png", "Carrosséis/Promo"), "carrossel");
  assert.equal(categoryFromHints("Reels obra", ""), "reels");
  const base = { folder: "", name: "arte.png", kind: "image" as const };
  assert.equal(categoryOf({ ...base, width: 1080, height: 1920 }), "story");
  assert.equal(categoryOf({ ...base, width: 1080, height: 1350 }), "post");
  assert.equal(categoryOf({ ...base, width: 1080, height: 1080 }), "post");
  assert.equal(categoryOf({ ...base, width: 1920, height: 1080 }), "capa");
  assert.equal(categoryOf({ ...base, width: 1920, height: 1080, folder: "Stories" }), "story");
  assert.equal(categoryOf({ ...base, kind: "video", name: "obra.mp4", width: null, height: null }), "reels");
  assert.equal(categoryOf({ ...base, kind: "other", name: "a.pdf", width: null, height: null }), "outros");
  assert.equal(prettyName("story_oferta-natal.png"), "Story oferta natal");
  assert.equal(fmtDuration(65000), "1:05");
});

test("lê a página pública da pasta", () => {
  const html = `<html><head><title>Marketing Quark - Google Drive</title></head><body>
    <div class="flip-entry" id="entry-1aaaaaaaaaaaaaaaaaaaa" tabindex="0" role="link"><div class="flip-entry-info">
      <a href="https://drive.google.com/drive/folders/1aaaaaaaaaaaaaaaaaaaa" target="_blank"><div class="flip-entry-thumb"></div>
      <div class="flip-entry-title">Stories</div></a></div></div>
    <div class="flip-entry" id="entry-1bbbbbbbbbbbbbbbbbbbb" tabindex="0" role="link"><div class="flip-entry-info">
      <a href="https://drive.google.com/file/d/1bbbbbbbbbbbbbbbbbbbb/view?usp=drive_web" target="_blank"><div class="flip-entry-thumb"><img src="x"></div>
      <div class="flip-entry-title">Post &amp; oferta.png</div></a></div></div>
  </body></html>`;
  const r = parseEmbeddedFolder(html);
  assert.equal(r.title, "Marketing Quark");
  assert.deepEqual(r.entries, [
    { id: "1aaaaaaaaaaaaaaaaaaaa", name: "Stories", isFolder: true },
    { id: "1bbbbbbbbbbbbbbbbbbbb", name: "Post & oferta.png", isFolder: false },
  ]);
});

test("carrosséis agrupados por subpasta e em ordem", () => {
  const g = groupCarousels([
    { folderId: "a", folder: "Carrossel/Natal", name: "2.png" },
    { folderId: "a", folder: "Carrossel/Natal", name: "10.png" },
    { folderId: "b", folder: "Carrossel/Obra", name: "1.png" },
    { folderId: "a", folder: "Carrossel/Natal", name: "1.png" },
  ]);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].map((x) => x.name), ["1.png", "2.png", "10.png"]);
});
