"use client";

import { Eraser, PenLine, Type } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  /** PNG da assinatura (fundo transparente) ou null se estiver vazia. */
  toDataUrl: () => string | null;
  isEmpty: () => boolean;
}

/**
 * Assinatura com o dedo, a caneta ou o mouse — ou digitada em letra cursiva.
 * Desenha em alta resolução e exporta um PNG recortado.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { name: string; scriptFont: string; onChange?: (empty: boolean) => void }>(function SignaturePad(
  { name, scriptFont, onChange },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number; t: number; w: number } | null>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [empty, setEmpty] = useState(true);
  const [typed, setTyped] = useState(name);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const setEmptyState = useCallback((v: boolean) => {
    setEmpty(v);
    onChangeRef.current?.(v);
  }, []);

  const ctx = () => canvas.current?.getContext("2d") ?? null;

  const resize = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#141033";
    g.fillStyle = "#141033";
  }, []);

  const clear = useCallback(() => {
    const c = canvas.current;
    const g = ctx();
    if (!c || !g) return;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.restore();
    setEmptyState(true);
  }, [setEmptyState]);

  useEffect(() => {
    resize();
    const onResize = () => {
      resize();
      setEmptyState(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resize, setEmptyState]);

  // Assinatura digitada: escreve o nome em letra cursiva.
  useEffect(() => {
    if (mode !== "type") return;
    let alive = true;
    const paint = async () => {
      try {
        await document.fonts.load(`64px ${scriptFont}`);
      } catch {
        /* usa a fonte disponível */
      }
      if (!alive) return;
      clear();
      const c = canvas.current;
      const g = ctx();
      const text = typed.trim();
      if (!c || !g || !text) return;
      const { width, height } = c.getBoundingClientRect();
      let size = 64;
      g.font = `${size}px ${scriptFont}`;
      while (g.measureText(text).width > width - 32 && size > 22) {
        size -= 2;
        g.font = `${size}px ${scriptFont}`;
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, width / 2, height / 2 + size * 0.08);
      setEmptyState(false);
    };
    paint();
    return () => {
      alive = false;
    };
  }, [mode, typed, scriptFont, clear, setEmptyState]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const down = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    e.preventDefault();
    canvas.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = { ...p, w: 2.6 };
    const g = ctx();
    if (g) {
      g.beginPath();
      g.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
      g.fill();
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const g = ctx();
    if (!g) return;
    const p = point(e);
    const l = last.current;
    const dist = Math.hypot(p.x - l.x, p.y - l.y);
    if (dist < 0.8) return;
    // Traço mais fino quando a mão corre, como uma caneta de verdade.
    const speed = dist / Math.max(p.t - l.t, 1);
    const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : null;
    const target = pressure != null ? 1.2 + pressure * 3 : Math.max(1.1, Math.min(3.4, 3.6 - speed * 1.4));
    const w = l.w + (target - l.w) * 0.35;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(l.x, l.y);
    g.quadraticCurveTo(l.x, l.y, (l.x + p.x) / 2, (l.y + p.y) / 2);
    g.lineTo(p.x, p.y);
    g.stroke();
    last.current = { ...p, w };
    if (empty) setEmptyState(false);
  };

  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => empty,
    toDataUrl: () => {
      const c = canvas.current;
      if (!c || empty) return null;
      const g = c.getContext("2d");
      if (!g) return null;
      // Recorta a área desenhada para um PNG leve.
      const { width, height } = c;
      const img = g.getImageData(0, 0, width, height).data;
      let minX = width,
        minY = height,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < height; y += 2)
        for (let x = 0; x < width; x += 2)
          if (img[(y * width + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
      if (maxX <= minX || maxY <= minY) return null;
      const pad = 12;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(width, maxX + pad);
      maxY = Math.min(height, maxY + pad);
      const scale = Math.min(1, 700 / (maxX - minX));
      const out = document.createElement("canvas");
      out.width = Math.round((maxX - minX) * scale);
      out.height = Math.round((maxY - minY) * scale);
      out.getContext("2d")!.drawImage(c, minX, minY, maxX - minX, maxY - minY, 0, 0, out.width, out.height);
      return out.toDataURL("image/png");
    },
  }));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-ink-100 p-1 text-[13px] font-semibold">
          <button type="button" onClick={() => setMode("draw")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${mode === "draw" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}>
            <PenLine className="h-3.5 w-3.5" /> Desenhar
          </button>
          <button type="button" onClick={() => setMode("type")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${mode === "type" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}>
            <Type className="h-3.5 w-3.5" /> Digitar
          </button>
        </div>
        {mode === "draw" && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
            <Eraser className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
      </div>
      {mode === "type" && (
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Digite seu nome"
          className="mb-2 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-[15px] outline-none focus:border-ink-400"
        />
      )}
      <div className="relative">
        <canvas
          ref={canvas}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className={`block h-44 w-full touch-none rounded-2xl bg-[linear-gradient(#fff,#fbfaff)] ring-1 ring-ink-200 ${mode === "draw" ? "cursor-crosshair" : ""}`}
          aria-label="Área para assinar"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-ink-300" />
        <span className="pointer-events-none absolute bottom-3 left-6 text-[11px] text-ink-400">✕ Assine sobre a linha</span>
        {empty && mode === "draw" && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-ink-300">Assine aqui com o dedo</span>
        )}
      </div>
    </div>
  );
});
