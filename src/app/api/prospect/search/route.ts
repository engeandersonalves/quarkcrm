import { NextResponse } from "next/server";
import { googleToProspect, nicheOf, osmToProspect, overpassQuery, type Prospect } from "@/lib/prospect";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const UA = "QuarkCRM/1.0 (prospeccao; contato via app)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/** Cidade/bairro → coordenadas (OpenStreetMap Nominatim). */
async function geocode(q: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  const data = res?.ok ? ((await res.json().catch(() => [])) as { lat: string; lon: string; display_name: string }[]) : [];
  return data[0] ? { lat: Number(data[0].lat), lon: Number(data[0].lon), label: data[0].display_name } : null;
}

async function searchOsm(nicheId: string, lat: number, lon: number, radiusM: number) {
  const niche = nicheOf(nicheId)!;
  const body = new URLSearchParams({ data: overpassQuery(niche, lat, lon, radiusM) });
  for (const endpoint of OVERPASS) {
    const res = await fetch(endpoint, { method: "POST", body, headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (!res?.ok) continue;
    const json = (await res.json().catch(() => null)) as { elements?: Parameters<typeof osmToProspect>[0][] } | null;
    if (!json?.elements) continue;
    return json.elements.map((e) => osmToProspect(e, niche.id)).filter((p): p is Prospect => !!p);
  }
  throw new Error("O OpenStreetMap não respondeu agora. Tente de novo em instantes ou diminua o raio.");
}

async function searchGoogle(key: string, nicheId: string, region: string, lat: number, lon: number, radiusM: number) {
  const niche = nicheOf(nicheId)!;
  const fields = [
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
  const out: Prospect[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
      body: JSON.stringify({
        textQuery: `${niche.google} em ${region || "região"}`,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
        pageToken,
        locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: Math.min(50000, radiusM) } },
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!res?.ok) {
      if (page === 0) throw new Error(`Google Places recusou a busca (${res?.status ?? "sem resposta"}). Confira a chave GOOGLE_MAPS_API_KEY na Vercel.`);
      break;
    }
    const json = (await res.json()) as { places?: Parameters<typeof googleToProspect>[0][]; nextPageToken?: string };
    out.push(...(json.places ?? []).map((p) => googleToProspect(p, niche.id)).filter((p): p is Prospect => !!p));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Busca comércios de um nicho numa região (OpenStreetMap grátis ou Google Places, se configurado). */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { region?: string; lat?: number; lon?: number; radiusKm?: number; niche?: string };
  const niche = nicheOf(body.niche);
  if (!niche) return NextResponse.json({ error: "Escolha um nicho" }, { status: 400 });
  const radiusM = Math.min(15, Math.max(0.5, Number(body.radiusKm) || 3)) * 1000;
  const region = String(body.region ?? "").trim().slice(0, 120);

  let center = Number.isFinite(body.lat) && Number.isFinite(body.lon) ? { lat: Number(body.lat), lon: Number(body.lon), label: region || "Sua localização" } : null;
  if (!center) {
    if (!region) return NextResponse.json({ error: "Informe a cidade ou o bairro" }, { status: 400 });
    center = await geocode(region);
    if (!center) return NextResponse.json({ error: `Não encontrei “${region}”. Tente “bairro, cidade”.` }, { status: 404 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  try {
    const results = key ? await searchGoogle(key, niche.id, region || center.label, center.lat, center.lon, radiusM) : await searchOsm(niche.id, center.lat, center.lon, radiusM);
    return NextResponse.json({ ok: true, provider: key ? "google" : "osm", center, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na busca" }, { status: 502 });
  }
}
