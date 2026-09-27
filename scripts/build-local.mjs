// Gera local/projeto-3d.html: o Estúdio 3D inteiro num único arquivo, para abrir direto no navegador.
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const r = (p) => path.join(root, p);

const js = await build({
  entryPoints: [r("local/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  write: false,
  legalComments: "none",
  tsconfig: r("tsconfig.json"),
  alias: { "next/navigation": r("local/next-navigation-shim.ts") },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});

const cssSrc = await readFile(r("src/app/globals.css"), "utf8");
const css = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(cssSrc, { from: r("src/app/globals.css") });

const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Projeto 3D — Quark Energia</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
<style>:root{--font-jakarta:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--font-sora:"Sora",var(--font-jakarta)}</style>
<style>${css.css}</style>
</head>
<body class="min-h-dvh font-sans">
<div id="root"></div>
<script>${code}</script>
</body>
</html>
`;
await writeFile(r("local/projeto-3d.html"), html);
console.log(`local/projeto-3d.html — ${(html.length / 1024 / 1024).toFixed(2)} MB`);
