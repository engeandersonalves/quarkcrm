"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Rastreamento detalhado do link público: abertura, seções lidas (elementos com
 * data-track="id"), tempo de leitura por seção e cliques. A equipe logada é ignorada no servidor.
 */
export function useProposalTracking(token: string | null) {
  const current = useRef<string>("capa");
  const active = useRef(Date.now());

  const send = useCallback(
    (kind: "open" | "section" | "time" | "click", detail = "", value = 0) => {
      if (!token) return;
      const device = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches ? "celular" : "computador";
      fetch(`/api/public/proposal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "event", kind, detail, value, device }),
        keepalive: true,
      }).catch(() => {});
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    send("open");
    const seen = new Set<string>();
    const ratios = new Map<string, number>();
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-track]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.track!;
          // Fração da tela ocupada pela seção
          const share = e.intersectionRect.height / Math.max(1, window.innerHeight);
          ratios.set(id, e.isIntersecting ? share : 0);
          if (e.isIntersecting && share >= 0.35 && !seen.has(id)) {
            seen.add(id);
            send("section", id);
          }
        }
        let best = current.current;
        let max = 0;
        for (const [id, r] of ratios) if (r > max) [best, max] = [id, r];
        current.current = best;
      },
      { threshold: [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1] },
    );
    els.forEach((el) => io.observe(el));

    const bump = () => (active.current = Date.now());
    const evs = ["scroll", "pointermove", "pointerdown", "keydown", "touchstart"] as const;
    evs.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    // A cada 15 s com a aba visível e alguém mexendo no último minuto, soma tempo de leitura
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - active.current < 60_000) send("time", current.current, 15);
    }, 15_000);

    return () => {
      io.disconnect();
      clearInterval(tick);
      evs.forEach((ev) => window.removeEventListener(ev, bump));
    };
  }, [token, send]);

  return { click: (what: string) => send("click", what) };
}
