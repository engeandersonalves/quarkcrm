import assert from "node:assert/strict";
import { test } from "node:test";
import { NICHES, estimateConsumption, extractContacts, googleHoursPerWeek, googleToProspect, instagramHandle, nicheFromTags, osmHoursPerWeek, osmToProspect, overpassQuery, prospectScore, tileOf } from "./prospect.ts";

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
  assert.match(overpassQuery(NICHES[1], -9.6, -35.7, 3000), /nwr\["shop"="bakery"\]\["name"\]\(around:3000/);
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
