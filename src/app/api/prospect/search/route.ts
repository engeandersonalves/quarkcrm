import { NextResponse } from "next/server";
import { NICHES, distanceKm, geocodeRegion, googleToProspect, nicheOf, searchOsm, type Prospect } from "@/lib/prospect";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const UA = { "User-Agent": "QuarkCRM/1.0 (prospeccao; contato via app)", "Accept-Language": "pt-BR" };

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "nextPageToken",
].join(",");

/** Divide a área em quadrantes (grade n×n) e descarta os que ficam fora do círculo. */
function grid(lat: number, lon: number, radiusM: number, n: number) {
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const cells: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } }[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const la0 = lat - dLat + (2 * dLat * i) / n;
      const lo0 = lon - dLon + (2 * dLon * j) / n;
      const la1 = la0 + (2 * dLat) / n;
      const lo1 = lo0 + (2 * dLon) / n;
      const cy = ((la0 + la1) / 2 - lat) * 111320;
      const cx = ((lo0 + lo1) / 2 - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
      const halfDiag = Math.hypot(dLat, dLon) * 111320 / n;
      if (Math.hypot(cx, cy) - halfDiag > radiusM) continue;
      cells.push({ low: { latitude: la0, longitude: lo0 }, high: { latitude: la1, longitude: lo1 } });
    }
  return cells;
}

/**
 * Motor Google Places: vários termos por nicho × quadrantes da área × até 3 páginas,
 * em paralelo e sem repetir lugares. Traz telefone, site, nota e horário.
 */
async function searchGoogle(key: string, nicheId: string, lat: number, lon: number, radiusM: number, turbo: boolean) {
  const started = Date.now();
  const niches = nicheId === "todos" ? NICHES.filter((n) => n.id !== "todos" && n.id !== "igreja") : [nicheOf(nicheId)!];
  const pairs = niches.flatMap((n) => (nicheId === "todos" ? n.google.slice(0, turbo ? 2 : 1) : n.google.slice(0, turbo ? 6 : 3)).map((term) => ({ niche: n.id, term })));
  const size = (radiusM <= 2000 ? 1 : radiusM <= 5000 ? 2 : radiusM <= 10000 ? 3 : 4) + (turbo && nicheId !== "todos" ? 1 : 0);
  const cells = grid(lat, lon, radiusM, nicheId === "todos" ? Math.min(size, 2) : size);
  const jobs = pairs.flatMap((p) => cells.map((cell) => ({ ...p, cell })));
  const found = new Map<string, Prospect>();
  let requests = 0;
  let failures = 0;
  let firstError = 0;

  const run = async (job: (typeof jobs)[number]) => {
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      if (Date.now() - started > 38000) return;
      requests++;
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
        body: JSON.stringify({ textQuery: job.term, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, pageToken, locationRestriction: { rectangle: job.cell } }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!res?.ok) {
        failures++;
        firstError ||= res?.status ?? -1;
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { places?: Parameters<typeof googleToProspect>[0][]; nextPageToken?: string };
      for (const place of json.places ?? []) {
        const p = googleToProspect(place, job.niche);
        if (p && !found.has(p.id) && distanceKm({ lat, lon }, p) <= (radiusM / 1000) * 1.05) found.set(p.id, p);
      }
      pageToken = json.nextPageToken;
      if (!pageToken) return;
    }
  };

  // Até 8 buscas ao mesmo tempo.
  const queue = [...jobs];
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length) await run(queue.shift()!);
  }));
  if (!found.size && failures) throw new Error(`Google Places recusou a busca (${firstError}). Confira a chave GOOGLE_MAPS_API_KEY e se a Places API (New) está ativada.`);
  return { results: [...found.values()], requests };
}

/** O app faz a busca no OpenStreetMap direto do aparelho; aqui só diz se o Google está ligado. */
export async function GET() {
  return NextResponse.json({ google: !!process.env.GOOGLE_MAPS_API_KEY?.trim() });
}

/** Busca comércios de um nicho numa região (OpenStreetMap grátis ou Google Places, se configurado). */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { region?: string; lat?: number; lon?: number; radiusKm?: number; niche?: string; turbo?: boolean; engine?: "google" | "osm" };
  const niche = nicheOf(body.niche);
  if (!niche) return NextResponse.json({ error: "Escolha um nicho" }, { status: 400 });
  const radiusM = Math.min(25, Math.max(0.5, Number(body.radiusKm) || 3)) * 1000;
  const region = String(body.region ?? "").trim().slice(0, 120);

  let center = Number.isFinite(body.lat) && Number.isFinite(body.lon) ? { lat: Number(body.lat), lon: Number(body.lon), label: region || "Sua localização" } : null;
  if (!center) {
    if (!region) return NextResponse.json({ error: "Informe a cidade ou o bairro" }, { status: 400 });
    try {
      center = await geocodeRegion(region, { headers: UA });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao localizar a região" }, { status: 502 });
    }
    if (!center) return NextResponse.json({ error: `Não encontrei “${region}”. Tente “bairro, cidade”.` }, { status: 404 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const useGoogle = !!key && body.engine !== "osm";
  try {
    if (useGoogle) {
      const g = await searchGoogle(key!, niche.id, center.lat, center.lon, radiusM, !!body.turbo);
      return NextResponse.json({ ok: true, provider: "google", center, results: g.results, requests: g.requests });
    }
    const results = await searchOsm(niche.id, center, radiusM, { headers: UA, timeoutMs: 40000 });
    return NextResponse.json({ ok: true, provider: "osm", center, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na busca" }, { status: 502 });
  }
}
