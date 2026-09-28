import assert from "node:assert/strict";
import { test } from "node:test";
import { NICHES, mergeProspects, OVERPASS_MIRRORS, geocodeRegion, runOverpass, searchOsm, estimateConsumption, extractContacts, googleHoursPerWeek, googleToProspect, instagramHandle, nicheFromTags, osmHoursPerWeek, osmToProspect, overpassQuery, prospectScore, tileOf } from "./prospect.ts";

test("lê horários do OpenStreetMap", () => {
  assert.equal(osmHoursPerWeek("24/7"), 168);
  assert.equal(osmHoursPerWeek("Mo-Fr 08:00-18:00"), 50);
  assert.equal(osmHoursPerWeek("Mo-Fr 08:00-12:00,14:00-18:00; Sa 08:00-12:00"), 44);
  assert.equal(osmHoursPerWeek("Mo-Su 18:00-02:00"), 56);
  assert.equal(osmHoursPerWeek("Mo-Sa 07:00-22:00; Su off"), 90);
  assert.equal(osmHoursPerWeek("08:00-20:00"), 84);
  assert.equal(osmHoursPerWeek("sob consulta"), null);
  assert.equal(osmHoursPerWeek(null), null);
});

test("lê horários do Google Places", () => {
  const weekdays = [1, 2, 3, 4, 5].map((day) => ({ open: { day, hour: 8, minute: 0 }, close: { day, hour: 18, minute: 0 } }));
  assert.equal(googleHoursPerWeek(weekdays), 50);
  assert.equal(googleHoursPerWeek([{ open: { day: 0, hour: 0, minute: 0 } }]), 168);
  assert.equal(googleHoursPerWeek([]), null);
});

test("nicho pelas tags e consumo pelo horário e porte", () => {
  assert.equal(nicheFromTags({ shop: "bakery" })?.id, "padaria");
  assert.equal(nicheFromTags({ amenity: "fuel" })?.id, "posto");
  assert.equal(nicheFromTags({ shop: "unknown" }), null);
  const padaria = NICHES.find((n) => n.id === "padaria")!;
  const normal = estimateConsumption(padaria, 60, "M");
  assert.equal(normal.kwh, 3500);
  assert.ok(estimateConsumption(padaria, 168, "M").kwh > normal.kwh * 2);
  assert.ok(estimateConsumption(padaria, 60, "G").kwh > normal.kwh);
  assert.ok(estimateConsumption(padaria, null, "P").kwh < normal.kwh);
  assert.ok(normal.min < normal.kwh && normal.max > normal.kwh);
});

test("potencial da abordagem", () => {
  assert.equal(prospectScore(9000, { phone: "82", email: "a@b.c" }).tier, "quente");
  assert.equal(prospectScore(800, {}).tier, "frio");
});

test("tile do satélite", () => {
  const t = tileOf(0, 0, 1);
  assert.equal(t.x, 1);
  assert.ok(Math.abs(t.y - 1) < 1e-9);
});

test("converte OpenStreetMap e Google Places", () => {
  const osm = osmToProspect({
    type: "node",
    id: 7,
    lat: -9.65,
    lon: -35.71,
    tags: { name: "Padaria Boa", shop: "bakery", phone: "+55 82 3333-4444;+55 82 99999-0000", "contact:instagram": "https://instagram.com/padariaboa", opening_hours: "Mo-Su 06:00-21:00", "addr:street": "Rua A", "addr:housenumber": "10", "addr:suburb": "Ponta Verde" },
  })!;
  assert.equal(osm.niche, "padaria");
  assert.equal(osm.phone, "+55 82 3333-4444");
  assert.equal(osm.instagram, "padariaboa");
  assert.equal(osm.address, "Rua A, 10 · Ponta Verde");
  assert.equal(osm.hoursWeek, 105);
  assert.equal(osmToProspect({ type: "node", id: 8, lat: 1, lon: 1, tags: { shop: "bakery" } }), null);
  const g = googleToProspect({ id: "abc", displayName: { text: "Academia X" }, location: { latitude: -9.6, longitude: -35.7 }, nationalPhoneNumber: "(82) 3333-0000", rating: 4.7, userRatingCount: 120, formattedAddress: "Av. B, 50 - Jatiúca, Maceió - AL" }, "academia")!;
  assert.equal(g.name, "Academia X");
  assert.equal(g.rating, 4.7);
  assert.equal(g.niche, "academia");
  const padaria = NICHES.find((n) => n.id === "padaria")!;
  assert.match(overpassQuery(padaria, -9.6, -35.7, 3000), /nwr\["shop"~"\^\(bakery\|pastry\|confectionery\)\$"\]\["name"\]\(around:3000/);
  const todos = overpassQuery(NICHES.find((n) => n.id === "todos")!, -9.6, -35.7, 3000);
  assert.match(todos, /"amenity"~"\^\([a-z_|]*restaurant/);
  assert.match(todos, /timeout:50/);
});

test("extrai contatos de um site", () => {
  const html = `<a href="mailto:contato@padariaboa.com.br">contato@padariaboa.com.br</a>
    <a href="https://www.instagram.com/padariaboa/">IG</a> <a href="https://instagram.com/p/xyz">post</a>
    <a href="https://facebook.com/padariaboa.oficial">FB</a> <a href="https://wa.me/5582999998888">Zap</a>
    <img src="logo@2x.png"> <a href="tel:+55 82 3333-4444">ligue</a> financeiro&#64;padariaboa.com.br`;
  const c = extractContacts(html);
  assert.deepEqual(c.emails, ["contato@padariaboa.com.br", "financeiro@padariaboa.com.br"]);
  assert.equal(c.instagram, "padariaboa");
  assert.equal(c.facebook, "padariaboa.oficial");
  assert.equal(c.whatsapp, "5582999998888");
  assert.equal(c.phones[0], "+55 82 3333-4444");
  assert.equal(instagramHandle("@padariaboa"), "padariaboa");
  assert.equal(instagramHandle("https://instagram.com/padaria.boa"), "padaria.boa");
});

test("Overpass: usa o primeiro espelho que responder", async () => {
  const real = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    if (url === OVERPASS_MIRRORS[0]) return new Response("busy", { status: 429 });
    if (url === OVERPASS_MIRRORS[1]) return new Response(JSON.stringify({ elements: [{ type: "node", id: 1, lat: 1, lon: 1, tags: { name: "A", shop: "bakery" } }, { type: "way", id: 2, center: { lat: 1, lon: 1 }, tags: { name: "A", shop: "bakery" } }] }));
    return new Promise(() => {});
  }) as typeof fetch;
  try {
    const els = await runOverpass("q", { timeoutMs: 2000 });
    assert.equal(els.length, 2);
    assert.equal(calls.length, OVERPASS_MIRRORS.length);
    // ponto e prédio do mesmo comércio viram um só
    const list = await searchOsm("padaria", { lat: 1, lon: 1, label: "x" }, 1000, { timeoutMs: 2000 });
    assert.equal(list.length, 1);
  } finally {
    globalThis.fetch = real;
  }
});

test("Overpass: erro claro quando todos falham", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 504 })) as typeof fetch;
  try {
    await assert.rejects(runOverpass("q", { timeoutMs: 500 }), /congestionado/);
  } finally {
    globalThis.fetch = real;
  }
});

test("geocodificação cai para o Photon", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.includes("nominatim")) return new Response("", { status: 403 });
    return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-35.7, -9.6] }, properties: { name: "Jatiúca", city: "Maceió", state: "Alagoas" } }] }));
  }) as typeof fetch;
  try {
    const g = await geocodeRegion("Jatiúca, Maceió");
    assert.deepEqual(g, { lat: -9.6, lon: -35.7, label: "Jatiúca, Maceió, Alagoas" });
    globalThis.fetch = (async () => new Response("[]")) as unknown as typeof fetch;
    assert.equal(await geocodeRegion("zzzz"), null);
  } finally {
    globalThis.fetch = real;
  }
});

test("junta Google e OpenStreetMap sem repetir", () => {
  const base = { source: "osm" as const, niche: "padaria", address: null, city: null, email: null, website: null, instagram: null, facebook: null, whatsapp: null, hours: null, hoursWeek: null, rating: null, reviews: null, mapsUrl: null };
  const g = [{ ...base, id: "g1", source: "google" as const, name: "Padaria Boa Vista", lat: -9.65, lon: -35.71, phone: "(82) 3333-4444" }];
  const o = [
    { ...base, id: "o1", name: "Padaria Boa Vista", lat: -9.6505, lon: -35.7102, phone: null, instagram: "padariaboavista", hoursWeek: 90 },
    { ...base, id: "o2", name: "Outra", lat: -9.66, lon: -35.72, phone: "+55 82 3333-4444" },
    { ...base, id: "o3", name: "Mercado Novo", lat: -9.7, lon: -35.8, phone: null },
  ];
  const m = mergeProspects(g, o);
  assert.equal(m.length, 2);
  assert.equal(m[0].instagram, "padariaboavista");
  assert.equal(m[0].hoursWeek, 90);
  assert.equal(m[1].id, "o3");
});
