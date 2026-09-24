"use client";

import { useEffect } from "react";

/** Abre um item pedido pela busca global (?id=… na URL ou evento, se a tela já estava aberta). */
export function useAbrirItem(abrir: (id: string) => boolean) {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id && abrir(id)) history.replaceState(null, "", window.location.pathname);
    const h = (e: Event) => abrir((e as CustomEvent<string>).detail) && history.replaceState(null, "", window.location.pathname);
    window.addEventListener("quark:abrir", h);
    return () => window.removeEventListener("quark:abrir", h);
  }, [abrir]);
}
