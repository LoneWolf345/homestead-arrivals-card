/* homestead-arrivals-card — "The Arrivals Desk": a travel article for a newsprint Home Assistant
 * dashboard that prints only the day before and the day of a visitor's flight. Reads a
 * flight-window binary sensor (a trigger template mirroring the Visitors calendar: flights +
 * stays in its attributes), the hourly forecast for the sky at wheels-down, and the house's
 * guest switches. Read-only: tap → more-info. Companion to homestead-pool-card,
 * homestead-motoring-card, homestead-waterworks-card and homestead-month-card. */
const HAC_VERSION = "2026.9.5";
const INK = "#3a2d1f", PAPER = "#f3e7d3", TAN = "#a3876a", BROWN = "#7a6248",
  TERRA = "#c65f38", DOT = "#cfb894", GREEN = "#2f7f6f", PLUM = "#6f4f9a";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CARRIERS = { WN: "Southwest", DL: "Delta", AA: "American", UA: "United", AS: "Alaska", F9: "Frontier", NK: "Spirit", B6: "JetBlue", G4: "Allegiant", SY: "Sun Country", HA: "Hawaiian", AC: "Air Canada", BA: "British Airways", WS: "WestJet" };
const CARRIER_WORDS = ["Southwest", "Delta", "American", "United", "Alaska", "Frontier", "Spirit", "JetBlue", "Allegiant", "Sun Country", "Hawaiian", "Air Canada", "British Airways", "WestJet", "Lufthansa", "Aeromexico", "Volaris"];
const AIRPORTS = { PHX: "Sky Harbor", AZA: "Mesa Gateway", TUS: "Tucson", LAS: "Las Vegas", LAX: "Los Angeles", SAN: "San Diego", DEN: "Denver", SLC: "Salt Lake", SEA: "Seattle", ORD: "O'Hare", DFW: "Dallas–Fort Worth", ATL: "Atlanta", MSP: "Minneapolis", DTW: "Detroit", BOS: "Boston", JFK: "Kennedy", EWR: "Newark", IAH: "Houston", MCO: "Orlando", SFO: "San Francisco", SJC: "San Jose", OAK: "Oakland", PDX: "Portland", BNA: "Nashville", STL: "St. Louis", MCI: "Kansas City", OMA: "Omaha", ABQ: "Albuquerque", SMF: "Sacramento", ONT: "Ontario", BUR: "Burbank", SNA: "Orange County", MDW: "Midway", DCA: "Reagan National", IAD: "Dulles", CLT: "Charlotte", PHL: "Philadelphia", MSY: "New Orleans", AUS: "Austin", HOU: "Hobby", DAL: "Love Field", YYZ: "Toronto", YVR: "Vancouver", YYC: "Calgary" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bad = (s) => s == null || s === "" || s === "unknown" || s === "unavailable";
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const ap = (h) => (h >= 12 ? "PM" : "AM");
const hh = (h) => h % 12 || 12;
const clock = (d) => (d ? `${hh(d.getHours())}:${pad2(d.getMinutes())} ${ap(d.getHours())}` : "—");
const short = (d) => (d ? `${hh(d.getHours())}${d.getMinutes() ? ":" + pad2(d.getMinutes()) : ""} ${ap(d.getHours())}` : "—");
const monDay = (d) => `${MON3[d.getMonth()]} ${d.getDate()}`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const dateOnly = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };

/* Read one calendar flight into the desk's shorthand. Titles are whatever the family typed,
 * so everything here is best-effort: "Arrive · Southwest 1234 · PHX 3:10 PM",
 * "Grandma lands WN1234 PHX", "Depart AA 88 Sky Harbor" all parse. */
function parseFlight(ev, now) {
  const sum = String(ev.summary || "");
  const start = ev.start ? new Date(ev.start) : null;
  const kind = /depart|leav|fly (out|home)|flies (out|home)|outbound|take[ -]?off|wheels up/i.test(sum) ? "departure"
    : /arriv|land|inbound|wheels down|fly in|flies in|come|coming/i.test(sum) ? "arrival" : "flight";
  let carrier = "", num = "";
  const m1 = sum.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/);
  const m2 = sum.match(new RegExp(`\\b(${CARRIER_WORDS.join("|")})(?: Airlines| Air Lines| Airways)?\\s*#?\\s*(\\d{2,4})?`, "i"));
  if (m2) { carrier = CARRIER_WORDS.find((w) => w.toLowerCase() === m2[1].toLowerCase()) || m2[1]; num = m2[2] || ""; }
  if (m1 && (CARRIERS[m1[1]] || !carrier)) { if (!carrier) carrier = CARRIERS[m1[1]] || m1[1]; if (!num) num = m1[2]; }
  if (!num) { const m3 = sum.match(/(?:flight|#)\s*(\d{2,4})\b/i); if (m3) num = m3[1]; }
  let apt = "", aptName = "";
  const codes = sum.match(/\b[A-Z]{3}\b/g) || [];
  const code = codes.find((c) => AIRPORTS[c]) || codes.find((c) => !CARRIERS[c] && !/^(THE|AND|FOR|VIA|OUT|PM|AM)$/.test(c)) || "";
  if (code) { apt = code; aptName = AIRPORTS[code] || code; }
  else { const m4 = sum.match(/sky harbor|mesa gateway|gateway/i); if (m4) { apt = /sky/i.test(m4[0]) ? "PHX" : "AZA"; aptName = AIRPORTS[apt]; } }
  const day = start ? (ymd(start) === ymd(now) ? "today" : ymd(start) === ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) ? "tomorrow" : "") : "";
  return { sum, start, kind, carrier, num, apt, aptName, day, description: ev.description || "", location: ev.location || "", past: start ? start.getTime() < now.getTime() : false };
}

function guestsFrom(stays, flights, fallback) {
  const clean = (s) => { const g = String(s || "").replace(/\b(visitors?|guests?|visit(ing)?|stay(ing)?|here|in town|with us|are|is)\b/gi, " ").replace(/[:·—-]+/g, " ").replace(/\s+/g, " ").trim(); return /^the$/i.test(g) ? "" : g; };
  for (const s of stays || []) { const g = clean(s.summary); if (g.length > 1) return g; }
  for (const f of flights || []) {
    const m = String(f.summary || "").match(/^(.+?)\s+(arriv|land|depart|leav|fl(y|ies)|come|coming|inbound|outbound)/i);
    if (m) { const g = clean(m[1]); if (g.length > 1 && !/^(arrive|depart|flight)$/i.test(g)) return g; }
  }
  return fallback || "Our visitors";
}
const plural = (g) => /&|\+|\b(and|family|folks|parents|grandparents|kids|cousins|everyone)\b/i.test(g) || (/s$/i.test(g.trim()) && !/^(grandma|grandpa|mom|dad|uncle|aunt|chris|james|thomas|lucas|nicholas|louis|charles|marcus|jesus)$/i.test(g.trim()));

function countdown(d, now) {
  const ms = d.getTime() - now.getTime(), a = Math.abs(ms), h = Math.floor(a / 3600000), m = Math.round((a % 3600000) / 60000);
  const txt = h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${h} h${m ? " " + m + " m" : ""}` : `${Math.max(1, m)} min`;
  return ms >= 0 ? `in ${txt}` : `${txt} ago`;
}

class HomesteadArrivalsCard extends HTMLElement {
  static getStubConfig() { return { window_entity: "binary_sensor.visitors_flight_window", weather_entity: "weather.home" }; }

  setConfig(config) {
    if (!config || !config.window_entity) throw new Error("homestead-arrivals-card: set window_entity (the flight-window binary sensor)");
    const c = Object.assign({
      title: "THE ARRIVALS DESK", kicker: "TRAVEL & VISITORS",
      weather_entity: "", guest_mode_entity: "", guest_wifi_entity: "", alarm_entity: "", status_entity: "",
      guests: "", drive_minutes: 40, leave_hours: 2,
      plate: "", plate_number: "IV", plate_credit: "Engraving after a photograph", tag_position: "br",
      column_rule: false, footer: "",
    }, config);
    if (c.plate && typeof c.plate === "string") c.plate = { src: c.plate, caption: "" };
    this._cfg = c;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._sig = null; this._fc = null;
    this._render();
  }
  set hass(hass) { this._hass = hass; this._subscribe(); this._render(); }
  getCardSize() { return 8; }
  connectedCallback() {
    this._tick = setInterval(() => this._render(), 60000);
    if (!this._tapBound) { this._tapBound = true; this.shadowRoot.addEventListener("click", (e) => { const t = e.target.closest("[data-entity]"); if (t && t.dataset.entity) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: t.dataset.entity } })); }); }
  }
  disconnectedCallback() { clearInterval(this._tick); this._dropSub(); }
  _dropSub() { if (this._unsub) { try { this._unsub(); } catch (e) { /* gone */ } } this._unsub = null; this._subKey = null; }
  _subscribe() {
    const ent = this._cfg.weather_entity, conn = this._hass && this._hass.connection;
    if (!ent || !conn || !conn.subscribeMessage || this._subKey === ent) return;
    this._subKey = ent;
    try {
      conn.subscribeMessage((m) => { this._fc = (m && m.forecast) || []; this._sig = null; this._render(); },
        { type: "weather/subscribe_forecast", entity_id: ent, forecast_type: "hourly" })
        .then((u) => { this._unsub = u; }).catch(() => { this._subKey = null; });
    } catch (e) { this._subKey = null; }
  }

  _skyAt(d) {
    const w = this._hass && this._cfg.weather_entity ? this._hass.states[this._cfg.weather_entity] : null;
    let temp = null, cond = "";
    if (d && this._fc && this._fc.length) {
      const t = d.getTime();
      const h = this._fc.find((x) => { const s = Date.parse(x.datetime); return s <= t && t < s + 3600000; }) || (t < Date.parse(this._fc[0].datetime) ? this._fc[0] : null);
      if (h) { temp = h.temperature; cond = h.condition || ""; }
    }
    if (temp == null && w) { temp = w.attributes.temperature; cond = w.state; }
    if (temp == null) return null;
    const words = { sunny: "sunny", "clear-night": "clear", partlycloudy: "partly cloudy", cloudy: "cloudy", rainy: "rainy", pouring: "pouring", lightning: "stormy", "lightning-rainy": "stormy", windy: "windy", "windy-variant": "windy", fog: "foggy", hail: "hailing", snowy: "snowy", exceptional: "unsettled" };
    return { temp: Math.round(temp), cond: words[cond] || cond || "" };
  }

  _render() {
    if (!this._hass || !this._cfg) return;
    const c = this._cfg, st = this._hass.states, now = new Date();
    const win = st[c.window_entity];
    const flightsRaw = (win && win.attributes && Array.isArray(win.attributes.flights)) ? win.attributes.flights : [];
    const stays = (win && win.attributes && Array.isArray(win.attributes.stays)) ? win.attributes.stays : [];
    const flights = flightsRaw.map((f) => parseFlight(f, now)).filter((f) => f.start && (f.day === "today" || f.day === "tomorrow")).sort((a, b) => a.start - b.start);
    if (!win || win.state !== "on" || !flights.length) { if (this._sig !== "") { this._sig = ""; this.shadowRoot.innerHTML = ""; this.style.minHeight = ""; } return; }

    // the flight the article is about: the next one to come, else the latest gone
    const lead = flights.find((f) => !f.past) || flights[flights.length - 1];
    const G = guestsFrom(stays, flightsRaw, c.guests), pl = plural(G);
    const are = pl ? "are" : "is", have = pl ? "have" : "has";
    const t = short(lead.start), when = lead.day, dayName = DAYS[lead.start.getDay()];
    const fl = [lead.carrier, lead.num].filter(Boolean).join(" ");
    const flText = fl ? (lead.carrier ? `${lead.carrier} ${lead.num}`.trim() : `flight ${lead.num}`) : "the flight";
    const aptText = lead.aptName ? `${lead.aptName}${lead.apt && lead.aptName !== lead.apt ? ` (${lead.apt})` : ""}` : "the airport";
    const sky = this._skyAt(lead.start);
    const gm = c.guest_mode_entity ? st[c.guest_mode_entity] : null, wifi = c.guest_wifi_entity ? st[c.guest_wifi_entity] : null, al = c.alarm_entity ? st[c.alarm_entity] : null;
    const status = c.status_entity && st[c.status_entity] && !bad(st[c.status_entity].state) ? st[c.status_entity].state : "";
    // live tracker (Flightradar24 via the status sensor's attributes); null until it has the flight
    const sa = (c.status_entity && st[c.status_entity] && st[c.status_entity].attributes) || {};
    const live = sa.phase && sa.phase !== "none" ? sa : null;
    const delay = live ? Number(sa.delay_min) || 0 : 0;
    const etaD = live && Number(sa.eta_ts) ? new Date(Number(sa.eta_ts) * 1000) : null;
    const etaT = etaD ? short(etaD) : (sa.eta || "");
    const lateTxt = delay >= 15 ? `, running ${delay} minutes late` : delay <= -10 ? `, running ${-delay} minutes early` : "";
    const stay = stays.length ? stays.map((s) => { const a = dateOnly(s.start), b = dateOnly(s.end); b.setDate(b.getDate() - 1); const nights = Math.max(1, Math.round((b - a) / 86400000)); return { a, b, nights, sum: s.summary }; })[0] : null;

    // headline
    let head;
    if (live && lead.kind !== "departure" && (live.phase === "airborne" || live.phase === "taxiing")) head = `${G} ${are} in the air; wheels down ${etaT || "soon"}${lateTxt}`;
    else if (live && lead.kind !== "departure" && live.phase === "landed") head = `${G} ${have} landed; the house is full`;
    else if (live && lead.kind !== "departure" && delay >= 15 && etaT) head = `${G} land ${when} at ${etaT}, ${delay} minutes late`;
    else if (live && lead.kind === "departure" && (live.phase === "airborne" || live.phase === "taxiing")) head = `${G} ${are} away; wheels up from ${aptText}`;
    else if (live && lead.kind === "departure" && live.phase === "landed") head = `${G} ${have} landed${live.destination ? " at " + live.destination : ""}; the house is quiet again`;
    else if (lead.kind === "departure") head = lead.past ? `${G} ${have} flown; the house is quiet again` : when === "tomorrow" ? `${G} fly home tomorrow at ${t}` : `${G} fly out at ${t} today`;
    else if (lead.kind === "arrival") head = lead.past ? `${G} ${have} landed; the house is full` : when === "tomorrow" ? `${G} land tomorrow at ${t}` : `${G} land today at ${t}`;
    else head = lead.past ? `${G} ${have} flown` : `${G} fly ${when} at ${t}`;

    // dek
    const dekBits = [flText !== "the flight" ? flText : null, lead.aptName ? aptText : null, `${dayName} ${monDay(lead.start)}`, sky ? `${sky.temp}° and ${sky.cond} at the gate` : null].filter(Boolean);
    const dek = dekBits.join(" · ");

    // lede
    const house = [
      gm ? `Guest Mode ${gm.state === "on" ? "is on" : "is not yet on"}` : null,
      wifi ? `the guest Wi-Fi ${wifi.state === "on" ? "is lit" : "is dark"}` : null,
      al ? `the alarm stands ${String(al.state).replace(/_/g, " ")}` : null,
    ].filter(Boolean);
    const houseLine = house.length ? cap(house.join("; ")) + "." : "";
    let lede;
    if (lead.kind === "departure") {
      lede = lead.past
        ? `${G} ${pl ? "were" : "was"} booked out of ${aptText} on ${flText} at ${t}${when === "today" ? " this " + (lead.start.getHours() < 12 ? "morning" : lead.start.getHours() < 17 ? "afternoon" : "evening") : ""}; the desk has no report of a missed connection. ${houseLine} The guest bed stands stripped, or ought to.`
        : `${G} ${are} booked home on ${flText} out of ${aptText} at ${t} ${when}, ${countdown(lead.start, now)} at press time. The desk recommends leaving the house ${c.leave_hours} hours ahead, sooner if the 202 misbehaves${sky ? `, into a ${sky.cond} ${sky.temp}° at the curb` : ""}. ${houseLine}`;
    } else {
      lede = lead.past
        ? `${G} landed at ${aptText} at ${t}${when === "today" ? "" : " " + when}; allowing the usual ${c.drive_minutes} minutes from the curb, the desk expects the doorbell${lead.start.getTime() + c.drive_minutes * 60000 < now.getTime() ? " has already rung" : " shortly"}. ${houseLine}`
        : `The travel desk reports ${G} ${when} aboard ${flText}, due into ${aptText} at ${t}, ${countdown(lead.start, now)} at press time${sky ? `, under a ${sky.cond} sky of ${sky.temp} degrees` : ""}. ${houseLine} The guest bed is the household's own affair.`;
    }
    if (lead.description) lede += ` The booking notes read: "${lead.description.replace(/\s+/g, " ").trim().slice(0, 140)}".`;
    if (live) {
      const who = live.flight || "the aircraft";
      if (live.phase === "airborne") {
        const alt = Number(sa.altitude_ft) || 0, spd = Number(sa.ground_speed_mph) || 0, dist = Number(sa.distance_mi) || 0;
        const bits = [alt > 0 ? `at ${alt.toLocaleString()} feet` : "", dist > 0 ? `${dist} miles from the house` : "", spd > 0 ? `making ${spd} miles an hour` : ""].filter(Boolean);
        lede += ` Flightradar24 has ${who}${live.aircraft ? `, a ${live.aircraft},` : ""}${bits.length ? " " + bits.join(", ") : " in the air"}${live.origin ? `, out of ${live.origin}` : ""}.`;
      }
      else if (live.phase === "landed") lede += ` Flightradar24 shows wheels down${live.terminal ? ` at Terminal ${live.terminal}` : ""}${live.aircraft ? `; the aircraft was a ${live.aircraft}` : ""}.`;
      else if (live.phase === "taxiing") lede += ` Flightradar24 has ${who} on the ground and moving.`;
      else lede += ` Flightradar24 lists it as ${String(status || "scheduled").toLowerCase()}.`;
    }

    // plate
    let plate = "";
    if (c.plate && c.plate.src) {
      const pos = ["br", "bl", "tr", "tl"].includes(c.tag_position) ? c.tag_position : "br";
      const tagD = etaD && lead.kind !== "departure" ? etaD : lead.start;
      const tl = lead.kind === "departure" ? `${ap(lead.start.getHours())} · WHEELS UP` : live && live.phase === "landed" ? `${ap(tagD.getHours())} · LANDED` : etaD ? `${ap(tagD.getHours())} · EST. WHEELS DOWN` : `${ap(lead.start.getHours())} · WHEELS DOWN`;
      plate = `<div class="fig" data-entity="${esc(c.status_entity || c.window_entity)}"><img src="${esc(c.plate.src)}" alt=""><div class="tag ${pos}"><div class="tv">${esc(`${hh(tagD.getHours())}:${pad2(tagD.getMinutes())}`)}</div><div class="tl">${esc(tl)}</div></div></div>
      <div class="plate"><span><b>PLATE ${esc(c.plate_number)}.</b> <i>${esc(c.plate.caption || "")}</i></span><span class="r"><i>${esc(c.plate_credit)}</i></span></div>`;
    }

    // manifest
    const rows = [];
    for (const f of flights) {
      const k = `${f.kind === "departure" ? "Departs" : f.kind === "arrival" ? "Arrives" : "Flies"} ${f.day}${f.carrier || f.num ? " · " + [f.carrier, f.num].filter(Boolean).join(" ") : ""}`;
      rows.push({ k, v: `${short(f.start)}${f.apt ? " · " + f.apt : ""}`, cls: f === lead && !f.past ? "ok" : "", e: c.window_entity });
    }
    rows.push({ k: "Status", v: status ? cap(status) : "As booked", cls: delay >= 15 || /delay|cancel|divert/i.test(status) ? "due" : live && (live.phase === "airborne" || live.phase === "landed") ? "ok" : "", e: c.status_entity || c.window_entity });
    if (live && live.phase === "airborne") {
      const alt = Number(sa.altitude_ft) || 0, spd = Number(sa.ground_speed_mph) || 0, dist = Number(sa.distance_mi) || 0;
      const pos = [alt > 0 ? `${alt.toLocaleString()} ft` : "", dist > 0 ? `${dist} mi out` : "", spd > 0 ? `${spd} mph` : ""].filter(Boolean).join(" · ");
      if (pos) rows.push({ k: "Position", v: pos, cls: "", e: c.status_entity });
    }
    if (live && live.aircraft) rows.push({ k: "Aircraft", v: `${live.aircraft}${live.registration ? " · " + live.registration : ""}`, cls: "", e: c.status_entity });
    const cdRef = etaD && lead.kind !== "departure" ? etaD : lead.start;
    const cdPast = live && live.phase === "landed" ? true : cdRef.getTime() < now.getTime();
    rows.push({ k: cdPast ? "Elapsed" : etaD ? "Countdown · est." : "Countdown", v: countdown(cdRef, now), cls: "", e: c.status_entity || c.window_entity });
    if (stay) rows.push({ k: "The stay", v: `${monDay(stay.a)}${stay.b.getTime() === stay.a.getTime() ? "" : "–" + (stay.b.getMonth() === stay.a.getMonth() ? stay.b.getDate() : monDay(stay.b))} · ${stay.nights} night${stay.nights === 1 ? "" : "s"}`, cls: "", e: c.window_entity });
    if (gm) rows.push({ k: "Guest Mode", v: gm.state === "on" ? "On" : "Off", cls: gm.state === "on" ? "ok" : (lead.kind !== "departure" && !lead.past ? "due" : ""), e: c.guest_mode_entity });
    if (wifi) rows.push({ k: "Guest Wi-Fi", v: wifi.state === "on" ? "Lit" : "Dark", cls: wifi.state === "on" ? "ok" : "", e: c.guest_wifi_entity });
    if (al) rows.push({ k: "Alarm", v: cap(String(al.state).replace(/_/g, " ")), cls: "", e: c.alarm_entity });
    const manifest = `<div class="sub"><span class="subn">The manifest</span><span class="subr">FROM THE VISITORS' CALENDAR</span></div>
      ${rows.map((r) => `<div class="row" data-entity="${esc(r.e || "")}"><span class="k">${esc(r.k)}</span><span class="v${r.cls ? " " + r.cls : ""}">${esc(r.v)}</span></div>`).join("")}`;

    const body = `<div class="sect"><span>${esc(c.title)}</span><span class="sectr">${esc(c.kicker)}</span></div>
      <h2 class="hed" data-entity="${esc(c.window_entity)}">${esc(head)}</h2>
      <div class="dek">${esc(dek)}</div>
      ${plate}
      <p class="lede">${esc(lede)}</p>
      ${manifest}
      <div class="foot">${esc(c.footer || (c.status_entity ? "Times are as booked until the aircraft moves; positions and estimates by Flightradar24." : "Times are as booked. The desk holds no opinion on delays until a status sensor is hired."))}</div>`;
    if (body === this._sig) return;
    this._sig = body;
    this._pin();
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><div class="wrap"><div class="card">${body}</div></div>`;
    this._unpin();
  }

  _pin() { try { const h = Math.round(this.getBoundingClientRect().height); if (h > 0) this.style.minHeight = Math.max(h, parseFloat(this.style.minHeight) || 0) + "px"; } catch (e) { /* not in a document */ } }
  _unpin() { setTimeout(() => { this.style.minHeight = ""; }, 0); }

  _css() {
    const c = this._cfg;
    return `
  :host { display: block; }
  * { box-sizing: border-box; }
  .wrap { container-type: inline-size; position: relative; }
  .wrap::before { content: ""; position: absolute; top: 0; bottom: 0; left: calc(-1 * var(--almanac-gutter, 16px)); width: 1px; background: ${c.column_rule ? "var(--almanac-column-rule, #2b2118)" : "transparent"}; }
  .card { --px: max(0.5px, 0.1923cqw); background: var(--almanac-paper, ${PAPER}); color: ${INK}; border-radius: var(--ha-card-border-radius, 14px); box-shadow: var(--ha-card-box-shadow, 0 4px 16px rgba(0,0,0,.18)); overflow: hidden; font-family: Archivo, 'Segoe UI', sans-serif; padding: calc(22*var(--px)) calc(24*var(--px)) calc(18*var(--px)); }
  .sect { display: flex; justify-content: space-between; align-items: baseline; font-size: max(8px, calc(10*var(--px))); font-weight: 700; letter-spacing: calc(3*var(--px)); color: ${TAN}; border-bottom: 1.5px solid ${INK}; padding-bottom: calc(5*var(--px)); }
  .sectr { letter-spacing: calc(1*var(--px)); color: ${PLUM}; }
  .hed { font-family: Fraunces, Georgia, serif; font-size: max(15px, calc(21*var(--px))); font-weight: 700; line-height: 1.15; margin: calc(12*var(--px)) 0 calc(4*var(--px)); text-wrap: balance; cursor: pointer; }
  .dek { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: max(10px, calc(12.5*var(--px))); color: ${BROWN}; margin-bottom: calc(10*var(--px)); }
  .fig { position: relative; width: 100%; aspect-ratio: 456 / 194; overflow: hidden; cursor: pointer; }
  .fig img { display: block; width: 100%; height: 100%; object-fit: cover; mix-blend-mode: multiply; }
  .tag { position: absolute; background: #f6efdc; border: 1.5px solid ${INK}; box-shadow: 0 0 0 3px #f6efdc; padding: calc(4*var(--px)) calc(9*var(--px)) calc(5*var(--px)); text-align: center; transform: rotate(-1.5deg); }
  .tag.br { right: calc(12*var(--px)); bottom: calc(12*var(--px)); } .tag.bl { left: calc(12*var(--px)); bottom: calc(12*var(--px)); } .tag.tr { right: calc(12*var(--px)); top: calc(12*var(--px)); } .tag.tl { left: calc(12*var(--px)); top: calc(12*var(--px)); }
  .tv { font-family: Fraunces, Georgia, serif; font-weight: 900; font-size: max(12px, calc(16*var(--px))); line-height: 1; }
  .tl { font-size: max(6px, calc(6.5*var(--px))); font-weight: 700; letter-spacing: calc(1.2*var(--px)); color: ${BROWN}; margin-top: 3px; border-top: 1px solid ${DOT}; padding-top: 3px; white-space: nowrap; }
  .plate { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-top: calc(6*var(--px)); font-family: Fraunces, Georgia, serif; font-size: max(8px, calc(10*var(--px))); color: ${BROWN}; }
  .plate b { font-weight: 700; letter-spacing: 1.5px; font-family: Archivo, sans-serif; font-size: max(7px, calc(8*var(--px))); color: ${TAN}; }
  .plate i { font-style: italic; } .plate .r { white-space: nowrap; }
  .lede { font-family: Fraunces, Georgia, serif; font-size: max(10px, calc(12.5*var(--px))); line-height: 1.45; margin: calc(10*var(--px)) 0 0; }
  .lede::first-letter { font-size: 2.7em; font-weight: 900; float: left; line-height: .82; padding: 4px 6px 0 0; color: ${PLUM}; }
  .sub { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; column-gap: calc(12*var(--px)); row-gap: 2px; margin-top: calc(14*var(--px)); padding-bottom: 3px; border-bottom: 1px solid ${INK}; }
  .subn { font-family: Fraunces, Georgia, serif; font-size: max(10px, calc(12.5*var(--px))); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .subr { font-size: max(7px, calc(9*var(--px))); font-weight: 700; letter-spacing: 1.5px; color: ${TAN}; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: calc(10*var(--px)); padding: calc(6*var(--px)) 0; border-bottom: 1px dotted ${DOT}; cursor: pointer; }
  .row:last-child { border-bottom: none; }
  .k { font-size: max(9px, calc(11.5*var(--px))); color: ${BROWN}; white-space: nowrap; }
  .v { font-family: Fraunces, Georgia, serif; font-size: max(10px, calc(13*var(--px))); font-weight: 600; text-align: right; } .v.due { color: ${TERRA}; } .v.ok { color: ${GREEN}; }
  .foot { font-size: max(7px, calc(9*var(--px))); letter-spacing: .3px; color: ${TAN}; margin-top: calc(12*var(--px)); line-height: 1.5; }`;
  }
}

if (!document.getElementById("hwc-font") && !document.getElementById("hpc-font") && !document.getElementById("hac-font")) {
  const l = document.createElement("link");
  l.id = "hac-font"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400&family=Archivo:wght@400;600;700&display=swap";
  document.head.appendChild(l);
}
customElements.define("homestead-arrivals-card", HomesteadArrivalsCard);
console.info(`%c HOMESTEAD-ARRIVALS-CARD %c ${HAC_VERSION} `, "background:#3a2d1f;color:#f3e7d3;font-weight:700", "background:#6f4f9a;color:#fff;font-weight:700");
window.customCards = window.customCards || [];
window.customCards.push({ type: "homestead-arrivals-card", name: "Homestead Arrivals Card", description: "A newsprint travel article that prints only the day before and the day of a visitor's flight: headline, woodcut plate, drop-cap lede, and the manifest (flights, countdown, stay, guest mode, guest Wi-Fi, alarm).", preview: true, documentationURL: "https://github.com/LoneWolf345/homestead-arrivals-card" });
