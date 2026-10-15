"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "quark-theme";

/** Tema do app (escuro por padrão), lembrado neste aparelho. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "light") setTheme("light");
    } catch {
      /* navegação privada */
    }
  }, []);
  const toggle = useCallback(
    () =>
      setTheme((t) => {
        const next = t === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(KEY, next);
        } catch {
          /* navegação privada */
        }
        return next;
      }),
    [],
  );
  return [theme, toggle];
}
