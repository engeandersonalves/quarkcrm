import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateHost } from "./marketing";

/** Endereço público e seguro? (http/https, sem IP interno — inclusive depois de resolver o DNS). */
export async function safeUrl(raw: string, allowHttp = false) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!(u.protocol === "https:" || (allowHttp && u.protocol === "http:")) || isPrivateHost(u.hostname)) return null;
  try {
    const addrs = await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateHost(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

/** Busca seguindo até 3 redirecionamentos, validando cada destino (proteção contra SSRF). */
export async function safeFetch(raw: string, init: RequestInit & { allowHttp?: boolean; timeoutMs?: number } = {}) {
  const { allowHttp, timeoutMs = 12000, ...rest } = init;
  let target = await safeUrl(raw, allowHttp);
  for (let hop = 0; target && hop < 4; hop++) {
    const res = await fetch(target, { ...rest, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
    if (!res) return null;
    if (res.status < 300 || res.status >= 400) return { res, url: target };
    const next = res.headers.get("location");
    target = next ? await safeUrl(new URL(next, target).toString(), allowHttp) : null;
  }
  return null;
}
