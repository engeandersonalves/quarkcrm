/**
 * Gera dist/quark-lab.html: o simulador inteiro num único arquivo HTML
 * (JS e CSS embutidos). Abre com dois cliques, sem servidor — e é o mesmo
 * arquivo publicado como artifact no Claude.
 *   npm run build:single
 */
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const js = await build({
  entryPoints: [resolve(root, "src/single/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"' },
  tsconfig: resolve(root, "tsconfig.json"),
});

const cssIn = await readFile(resolve(root, "src/app/globals.css"), "utf8");
const css = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(cssIn, { from: resolve(root, "src/app/globals.css") });

const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<title>Quark Lab</title>
<meta name="description" content="Simulador de sistemas solares com baterias, cargas flexíveis, zero grid, cortes de geração distribuída e apagões.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap">
<style>:root{--font-jakarta:"Plus Jakarta Sans";--font-sora:"Sora";color-scheme:light}html,body{background:#f7f6fa}
${css.css}</style>
<div id="quark-lab"></div>
<script>${code}</script>
`;
await mkdir(resolve(root, "dist"), { recursive: true });
// versão para abrir direto no navegador (documento completo)
const doc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">${html}</body></html>`;
await writeFile(resolve(root, "dist/quark-lab.html"), doc);
// versão para publicar como artifact no Claude (o Claude adiciona o esqueleto do documento)
await writeFile(resolve(root, "dist/artifact.html"), html);
console.log(`dist/quark-lab.html — ${(doc.length / 1024).toFixed(0)} KB`);
