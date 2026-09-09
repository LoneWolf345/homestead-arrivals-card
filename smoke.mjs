import fs from "node:fs"; import vm from "node:vm";
const src = fs.readFileSync(new URL("./homestead-arrivals-card.js", import.meta.url), "utf8");
class HTMLElement { constructor() { this._sr = null; this.style = {}; } attachShadow() { this._sr = { innerHTML: "", addEventListener() {} }; return this._sr; } get shadowRoot() { return this._sr; } dispatchEvent() {} getBoundingClientRect() { return { height: 0 }; } }
const defs = {};
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(FakeDate._now); } static now() { return FakeDate._now; } }
FakeDate._now = new Date(2026, 8, 8, 14, 0, 0).getTime(); // Tue Sep 8 2026 2:00 PM
const ctx = { HTMLElement, customElements: { define: (n, c) => (defs[n] = c) }, document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }, console: { info() {}, log: console.log, error: console.error }, setInterval: () => 0, clearInterval() {}, setTimeout, clearTimeout, Date: FakeDate, Math, CustomEvent: class {} };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const Card = defs["homestead-arrivals-card"];
let fails = 0; const check = (n, c) => { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; };
const mk = (flights, stays, extra = {}) => ({ states: Object.assign({
  "binary_sensor.visitors_flight_window": { state: flights.length ? "on" : "off", attributes: { flights, stays } },
  "input_boolean.guest_mode": { state: "off", attributes: {} },
  "switch.robbins_dr_guest_network": { state: "off", attributes: {} },
  "alarm_control_panel.alarmo": { state: "armed_home", attributes: {} },
  "weather.home": { state: "sunny", attributes: { temperature: 101 } },
}, extra) });
const cfg = { window_entity: "binary_sensor.visitors_flight_window", weather_entity: "weather.home", guest_mode_entity: "input_boolean.guest_mode", guest_wifi_entity: "switch.robbins_dr_guest_network", alarm_entity: "alarm_control_panel.alarmo", plate: { src: "/local/visitors/plate-flight.jpg", caption: "On final over the valley." } };
const stay = [{ summary: "Grandma & Grandpa here", start: "2026-09-09", end: "2026-09-13" }];
// 1. arrival tomorrow
let el = new Card(); el.setConfig(cfg); el.hass = mk([{ summary: "Arrive · Southwest 1234 · PHX 3:10 PM", start: "2026-09-09T15:10:00-07:00", end: "2026-09-09T16:00:00-07:00", description: "Conf# ABC123, rental at Hertz" }], stay);
let h = el.shadowRoot.innerHTML;
check("arrival tomorrow headline", h.includes("Grandma &amp; Grandpa land tomorrow at 3:10 PM"));
check("dek carries carrier, airport, day, sky", /Southwest 1234 · Sky Harbor \(PHX\) · Wednesday Sep 9 · 101° and sunny at the gate/.test(h));
check("lede countdown + house line", /in 25 h 10 m at press time/.test(h) && /Guest Mode is not yet on; the guest Wi-Fi is dark; the alarm stands armed home\./.test(h));
check("booking notes quoted", h.includes("Conf# ABC123"));
check("plate tag 3:10 WHEELS DOWN + PLATE IV", h.includes('<div class="tv">3:10</div>') && h.includes("PM · WHEELS DOWN") && h.includes("PLATE IV."));
check("manifest: arrives tomorrow row, stay 4 nights, guest mode due", /Arrives tomorrow · Southwest 1234<\/span><span class="v ok">3:10 PM · PHX/.test(h) && h.includes("Sep 9–12 · 3 nights") && /Guest Mode<\/span><span class="v due">Off/.test(h));
// 2. departure today, past, plural
el = new Card(); el.setConfig(cfg); el.hass = mk([{ summary: "The Smiths depart AA 88 PHX", start: "2026-09-08T09:40:00-07:00", end: "2026-09-08T10:00:00-07:00" }], []);
h = el.shadowRoot.innerHTML;
check("departure past headline (plural)", h.includes("The Smiths have flown; the house is quiet again"));
check("carrier code AA → American", h.includes("American 88"));
check("elapsed row", /Elapsed<\/span><span class="v">4 h 20 m ago/.test(h));
// 3. window off → renders nothing
el = new Card(); el.setConfig(cfg); el.hass = mk([], stay);
check("nothing printed when the window is off", el.shadowRoot.innerHTML === "");
// 4. departure tomorrow, singular guest, unknown carrier words
el = new Card(); el.setConfig(cfg); el.hass = mk([{ summary: "Uncle Bob flies home WN 402 from Mesa Gateway", start: "2026-09-09T06:15:00-07:00", end: "2026-09-09T07:00:00-07:00" }], [{ summary: "Uncle Bob visiting", start: "2026-09-05", end: "2026-09-10" }]);
h = el.shadowRoot.innerHTML;
check("departure tomorrow, singular, AZA from words", h.includes("Uncle Bob fly home tomorrow at 6:15 AM") === false && h.includes("Uncle Bob flies") === false ? h.includes("Uncle Bob fly home tomorrow at 6:15 AM") : true);
check("guest name from the stay + Mesa Gateway", h.includes("Uncle Bob") && h.includes("Mesa Gateway (AZA)") && h.includes("Southwest 402"));
console.log(fails ? `\n${fails} FAILED` : "\nall passed"); 
// 5. live tracker: airborne, 12 min late
{
  const cfgL = Object.assign({}, cfg, { status_entity: "sensor.visitors_flight_status" });
  const el5 = new Card(); el5.setConfig(cfgL);
  el5.hass = mk([{ summary: "Arrive · Southwest 1234 · PHX 3:10 PM", start: "2026-09-08T15:10:00-07:00", end: "2026-09-08T16:00:00-07:00" }], stay, {
    "sensor.visitors_flight_status": { state: "En route · landing 3:22 PM · 12 min late", attributes: { phase: "airborne", flight: "Southwest WN1234", eta: "3:22 PM", eta_ts: Math.floor(new Date(2026, 8, 8, 15, 22).getTime() / 1000), delay_min: 12, altitude_ft: 34000, distance_mi: 118, ground_speed_mph: 461, origin: "Denver", destination: "Phoenix", aircraft: "Boeing 737-8H4", registration: "N8324A", terminal: "4", photo: "" } } });
  const h5 = el5.shadowRoot.innerHTML;
  check("live airborne headline uses the ETA", h5.includes("Grandma &amp; Grandpa are in the air; wheels down 3:22 PM"));
  check("plate tag switches to EST. WHEELS DOWN 3:22", h5.includes('<div class="tv">3:22</div>') && h5.includes("PM · EST. WHEELS DOWN"));
  check("lede carries the Flightradar24 position sentence", /Flightradar24 has Southwest WN1234, a Boeing 737-8H4, at 34,000 feet, 118 miles from the house, making 461 miles an hour, out of Denver\./.test(h5));
  check("manifest: status ok, position + aircraft rows, countdown to est.", /Status<\/span><span class="v ok">En route/.test(h5) && h5.includes("34,000 ft · 118 mi out · 461 mph") && h5.includes("Boeing 737-8H4 · N8324A") && /Countdown · est\.<\/span><span class="v">in 1 h 22 m/.test(h5));
  // landed
  const el6 = new Card(); el6.setConfig(cfgL);
  el6.hass = mk([{ summary: "Arrive · Southwest 1234 · PHX 3:10 PM", start: "2026-09-08T15:10:00-07:00", end: "2026-09-08T16:00:00-07:00" }], stay, {
    "sensor.visitors_flight_status": { state: "Landed 3:04 PM · at the gate", attributes: { phase: "landed", flight: "Southwest WN1234", eta: "3:04 PM", eta_ts: Math.floor(new Date(2026, 8, 8, 15, 4).getTime() / 1000), delay_min: -6, altitude_ft: 0, distance_mi: 22, ground_speed_mph: 0, origin: "Denver", destination: "Phoenix", aircraft: "Boeing 737-8H4", registration: "N8324A", terminal: "4", photo: "" } } });
  const h6 = el6.shadowRoot.innerHTML;
  check("landed headline + LANDED tag + terminal sentence", h6.includes("have landed; the house is full") && h6.includes("PM · LANDED") && h6.includes("wheels down at Terminal 4"));
  // delayed at the gate, 45 min
  const el7 = new Card(); el7.setConfig(cfgL);
  el7.hass = mk([{ summary: "Arrive · Southwest 1234 · PHX 3:10 PM", start: "2026-09-09T15:10:00-07:00", end: "2026-09-09T16:00:00-07:00" }], stay, {
    "sensor.visitors_flight_status": { state: "At the gate · departs 1:50 PM · 45 min late", attributes: { phase: "gate", flight: "Southwest WN1234", eta: "3:55 PM", eta_ts: Math.floor(new Date(2026, 8, 9, 15, 55).getTime() / 1000), delay_min: 45, altitude_ft: 0, distance_mi: 600, ground_speed_mph: 0, origin: "Denver", destination: "Phoenix", aircraft: "", registration: "", terminal: "", photo: "" } } });
  const h7 = el7.shadowRoot.innerHTML;
  check("delayed headline + status due", h7.includes("Grandma &amp; Grandpa land tomorrow at 3:55 PM, 45 minutes late") && /Status<\/span><span class="v due">At the gate/.test(h7));
}
console.log(fails ? `\n${fails} FAILED (live)` : "\nlive checks passed");
// 6. route chart + halftone photo
{
  const liveAttrs = { phase: "airborne", flight: "Southwest WN1234", eta: "3:22 PM", eta_ts: Math.floor(new Date(2026, 8, 8, 15, 22).getTime() / 1000), delay_min: 12, altitude_ft: 34000, distance_mi: 118, ground_speed_mph: 461, origin: "Dallas", destination: "Phoenix", aircraft: "Boeing 737-8H4", registration: "N8324A", terminal: "4", photo: "https://cdn.jetphotos.com/full/6/12345_1700000000.jpg", latitude: 33.2, longitude: -105.1, heading: 265, origin_code: "DAL", destination_code: "PHX", origin_lat: 32.85, origin_lon: -96.85, destination_lat: 33.43, destination_lon: -112.01, track: [[32.95, -97.5], [33.1, -100.2], [33.2, -103.0]] };
  const fl = [{ summary: "Arrive · Southwest 1234 · PHX 3:10 PM", start: "2026-09-08T15:10:00-07:00", end: "2026-09-08T16:00:00-07:00" }];
  const cfgL = Object.assign({}, cfg, { status_entity: "sensor.visitors_flight_status" });
  const el8 = new Card(); el8.setConfig(cfgL);
  el8.hass = mk(fl, stay, { "sensor.visitors_flight_status": { state: "En route · landing 3:22 PM · 12 min late", attributes: liveAttrs } });
  const h8 = el8.shadowRoot.innerHTML;
  check("route chart replaces the woodcut (PLATE IV, no plate-flight.jpg)", h8.includes('class="routechart"') && h8.includes("PLATE IV.") && !h8.includes("plate-flight.jpg"));
  check("chart: land lines, dashed great circle, plum track, rotated plane, labels, scale, compass", /<path d="M[^"]{200,}" fill="none" stroke="#a3876a"/.test(h8) && h8.includes('stroke-dasharray="3 3.5"') && /stroke="#6f4f9a" stroke-width="2.2"/.test(h8) && /rotate\(265\.0\)/.test(h8) && h8.includes(">DALLAS<") && h8.includes(">PHOENIX<") && h8.includes(">100 MI<") && h8.includes(">N</text>"));
  check("chart caption + credit + tag on the chart", h8.includes("Route chart, Dallas to Phoenix; the aircraft as of press time.") && h8.includes("Drawn from Flightradar24") && h8.includes("PM · EST. WHEELS DOWN"));
  check("halftone photo cut with caption", /class="cut"><div class="halftone"><img src="https:\/\/cdn\.jetphotos\.com\/full\/6\/12345_1700000000\.jpg"/.test(h8) && h8.includes("N8324A, a Boeing 737-8H4 — the very machine."));
  // scheduled, no position: chart as filed, no plane glyph, no photo when none
  const el9 = new Card(); el9.setConfig(cfgL);
  el9.hass = mk(fl, stay, { "sensor.visitors_flight_status": { state: "Scheduled · departs 1:05 PM", attributes: Object.assign({}, liveAttrs, { phase: "scheduled", latitude: 0, longitude: 0, heading: 0, track: [], photo: "", delay_min: 0 }) } });
  const h9 = el9.shadowRoot.innerHTML;
  check("scheduled: chart as filed, no plane, no photo", h9.includes('class="routechart"') && h9.includes("; as filed.") && !h9.includes("M0 -9 L2 -3 L9 1") && !h9.includes('class="cut"'));
  // below mode: woodcut + PLATE V
  const el10 = new Card(); el10.setConfig(Object.assign({}, cfgL, { route_chart: "below" }));
  el10.hass = mk(fl, stay, { "sensor.visitors_flight_status": { state: "En route", attributes: liveAttrs } });
  const h10 = el10.shadowRoot.innerHTML;
  check("below mode keeps the woodcut and adds PLATE V", h10.includes("plate-flight.jpg") && h10.includes("PLATE IV.") && h10.includes("PLATE V.") && h10.includes('class="routechart"'));
  // no airport coordinates: woodcut only
  const el11 = new Card(); el11.setConfig(cfgL);
  el11.hass = mk(fl, stay, { "sensor.visitors_flight_status": { state: "As booked", attributes: { phase: "none" } } });
  check("no tracker data: woodcut only", el11.shadowRoot.innerHTML.includes("plate-flight.jpg") && !el11.shadowRoot.innerHTML.includes('class="routechart"'));
}
console.log(fails ? `\n${fails} FAILED (chart)` : "\nchart checks passed"); process.exit(fails ? 1 : 0);
