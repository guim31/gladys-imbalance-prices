# Imbalance prices for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that follows the **quarter-hour imbalance prices** of the Belgian (Elia) and
Dutch (TenneT) transmission system operators in near real time — the price
some dynamic contracts and home batteries in Belgium and the Netherlands are
settled or steered on.

Not affiliated with Elia or TenneT.

## Features

- One device per zone, Belgium and the Netherlands: price of the running
  quarter-hour (€/MWh and €/kWh), price of the previous one, system imbalance
  (MW, positive = surplus), its direction and the running quarter-hour.
- Scene triggers: the price turns negative; the price rises above a threshold
  (100 to 1,000 €/MWh), at most once per quarter-hour.
- A dashboard widget: the price of each zone, the previous quarter-hour, the
  imbalance and the curve of the day.
- An action, **Read the prices now**, to check both sources (and a TenneT key).
- Texts in English, French, German and Spanish; documentation also in Dutch.

Only the imbalance price: for day-ahead prices see the EPEX Spot or ENTSO-E
integrations of the store.

## Requirements

- Gladys 5.3.0 or later, with internet access.
- Belgium: nothing (Elia Open Data is public).
- The Netherlands: a free personal API key from
  [developer.tennet.eu](https://developer.tennet.eu/register/).

## Installation

In Gladys, **Integrations → Install from GitHub**, then enter
`https://github.com/guim31/gladys-imbalance-prices`. The user documentation is
in [`docs/`](docs/en.md) ([fr](docs/fr.md), [de](docs/de.md),
[es](docs/es.md), [nl](docs/nl.md)).

## How it works

Every minute, on its own timer, the container reads:

- Elia Open Data `ods161` (imbalance price per minute, near real time): the
  running quarter-hour, estimated on the minutes elapsed, and the one before;
  and `ods162` (per quarter-hour) for the closed quarter-hours of the day;
- TenneT "Balance Delta High Res" `/latest` (12-second points of the last
  30 minutes): an indicative price per quarter-hour, computed like TenneT's
  regulation state (highest upward price, lowest downward price, or mid price).

It publishes only the values that changed (plus a heartbeat every 6 hours) and
fires the scene triggers when the running price crosses a line.

## Limitations

- **Developed without a TenneT key: feedback welcome.** The Dutch part follows
  TenneT's OpenAPI description and could not be tested against the real API;
  its price is indicative, the settled price published later can differ.
- Elia's near-real-time values are "not validated" and about a minute late.
- The Dutch curve of the day starts when the integration starts (TenneT's
  history endpoint allows 8 requests a day: not used).
- Times follow the Brussels/Amsterdam clock.

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys and fake APIs
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .     # store validator
node scripts/probe.mjs                              # the real Elia API (network)
TENNET_API_KEY=... node scripts/probe.mjs           # and TenneT
node scripts/probe.mjs 2026-04-06                   # an Elia day of history
```

See [`CLAUDE.md`](CLAUDE.md) for the architecture and the project rules.

## Credits

- Data: [Elia Open Data](https://opendata.elia.be) (Elia Transmission Belgium)
  and the [TenneT API](https://developer.tennet.eu) (TenneT TSO B.V.). The
  fixtures in `test/fixtures/elia/` are real answers of Elia's API; the TenneT
  ones are built from its OpenAPI description (see
  [`test/fixtures/README.md`](test/fixtures/README.md)).
- Structure, triggers and widget follow
  [gladys-pvpc](https://github.com/guim31/gladys-pvpc).
- Cover: a home-made pictogram (scales and a lightning bolt), no third-party
  logo.

## License

[Apache-2.0](LICENSE). Elia and TenneT are names of their owners; this project
is not affiliated with them.
