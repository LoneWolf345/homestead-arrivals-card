# Homestead Arrivals Card

**The Arrivals Desk** — a travel article for a newsprint Home Assistant dashboard that prints only the day before and the day of a visitor's flight. Companion to the [Almanac Weather Card](https://github.com/LoneWolf345/almanac-weather-card), the [Month Card](https://github.com/LoneWolf345/homestead-month-card) and the rest of the Homestead Times cards.

**What it prints**

- **A headline** written from the calendar: *Grandma & Grandpa land tomorrow at 3:10 PM*, *The Smiths fly home today at 9:40 AM*, *…have landed; the house is full*.
- **A dek** with the carrier and flight number, the airport, the day, and the sky at the gate from your weather entity's hourly forecast.
- **A woodcut plate** (optional) with a pasted tag carrying the wheels-down or wheels-up time.
- **A drop-cap lede**: countdown at press time, the drive from the curb, and the state of the house — Guest Mode, guest Wi-Fi, alarm — plus any booking notes from the event description.
- **The manifest**: every flight in the window, status (an optional flight-status sensor, else *As booked*), countdown, the stay's dates and nights, and the guest switches. Tap any row for more-info.

**Where the data comes from.** The card reads one binary sensor whose attributes carry the flights and the stay. A trigger-based template sensor does the calendar work so the card needs no round-trip; on the Homestead it mirrors a local calendar named **Visitors**: all-day events are stays, timed events whose title mentions a flight / arrival / departure / landing / airport are flights.

```yaml
# configuration.yaml (template:)
- trigger:
    - platform: time_pattern
      minutes: "/15"
    - platform: state
      entity_id: calendar.visitors
    - platform: homeassistant
      event: start
  action:
    - variables:
        d0: "{{ now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat() }}"
    - service: calendar.get_events
      target: { entity_id: calendar.visitors }
      data: { start_date_time: "{{ d0 }}", duration: { hours: 48 } }
      response_variable: ev
    - variables:
        evs: "{{ ev['calendar.visitors']['events'] if ev is defined and 'calendar.visitors' in ev else [] }}"
        flights: "{{ evs | selectattr('start','search','T') | selectattr('summary','search','flight|arriv|depart|land|take|airport', True) | list }}"
        stays: "{{ evs | rejectattr('start','search','T') | list }}"
  binary_sensor:
    - name: "Visitors Flight Window"
      unique_id: visitors_flight_window
      state: "{{ flights | count > 0 }}"
      attributes: { flights: "{{ flights }}", stays: "{{ stays }}" }
```

Flight titles are parsed best-effort: `Arrive · Southwest 1234 · PHX 3:10 PM`, `Grandma lands WN1234 PHX`, `Depart AA 88 Sky Harbor` all work. Guests are named from the stay event (*Grandma & Grandpa here* → Grandma & Grandpa).

## Installation (HACS)

1. HACS → Custom repositories → add this repo, category **Dashboard**
2. Install **Homestead Arrivals Card**
3. Add the card with a visibility condition so the section drops it entirely outside the flight window:

```yaml
type: custom:homestead-arrivals-card
window_entity: binary_sensor.visitors_flight_window
weather_entity: weather.home
guest_mode_entity: input_boolean.guest_mode
guest_wifi_entity: switch.robbins_dr_guest_network
alarm_entity: alarm_control_panel.alarmo
plate:
  src: /local/visitors/plate-flight.jpg
  caption: On final over the valley, the household's air corridor.
visibility:
  - condition: state
    entity: binary_sensor.visitors_flight_window
    state: "on"
```

## Options

| Key | Default | Notes |
|---|---|---|
| `window_entity` | required | Binary sensor with `flights` and `stays` attributes (see above) |
| `weather_entity` | — | Hourly forecast for the sky at the gate |
| `guest_mode_entity`, `guest_wifi_entity`, `alarm_entity` | — | House rows in the manifest and the lede |
| `status_entity` | — | Optional flight-status sensor; its state prints in the Status row (delays go terracotta) |
| `guests` | from the stay | Override the guests' name |
| `drive_minutes`, `leave_hours` | 40, 2 | Curb-to-door drive and leave-ahead advice |
| `plate` | — | `{src, caption}`; `plate_number` (IV), `plate_credit`, `tag_position` (br/bl/tr/tl) |
| `title`, `kicker`, `footer` | house copy | Section header and agate |
| `column_rule` | false | Draw the newspaper gutter rule on the left |
