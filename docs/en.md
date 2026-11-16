# Imbalance prices (Elia, TenneT)

## What it does

The imbalance price settles, for each quarter-hour, the gap between what the
electricity grid planned and what really happened. Some dynamic contracts in
Belgium and the Netherlands pass it on to their customers ("imbalance"
contracts, home batteries steered on it). This integration brings it into
Gladys in near real time:

- **Belgium**, from Elia Open Data: the price of the running quarter-hour,
  estimated minute by minute, and the final value of each closed one;
- **the Netherlands**, from the TenneT API: an indicative price computed from
  the balancing energy TenneT activates, every minute.

It only covers the imbalance price. For day-ahead prices (EPEX, ENTSO-E) or a
supplier's tariff, use the integrations made for them.

## Requirements

- Gladys 5.3.0 or later.
- Internet access from Gladys (opendata.elia.be, api.tennet.eu).
- For the Netherlands only: a free TenneT API key. Register on
  [developer.tennet.eu](https://developer.tennet.eu/register/), then create
  a key in your account. Belgium needs no account.

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Enter `https://github.com/guim31/gladys-imbalance-prices` and install.

## Configuration

- **Belgium (Elia)**: ticked by default.
- **TenneT API key (Netherlands)**: leave it empty to skip the Netherlands.
- **Language of the names**: the language of the feature names and of the
  imbalance direction, set when a device is added (French by default).

Then open the **Discovery** tab and add the devices: one per zone. The
**Read the prices now** action asks both sources at once and shows the price
of the running quarter-hour: use it to check a new TenneT key.

## Devices

Each zone is a device with these features:

| Feature                             | Meaning                                                              |
| ----------------------------------- | -------------------------------------------------------------------- |
| Quarter-hour price (€/MWh)          | price of the running quarter-hour, updated every minute              |
| Quarter-hour price (€/kWh)          | the same, divided by 1,000                                           |
| Previous quarter-hour price (€/MWh) | price of the quarter-hour just closed                                |
| System imbalance (MW)               | positive: the zone has a surplus; negative: it lacks power           |
| Imbalance direction                 | Surplus, Shortage or Balanced                                        |
| Current quarter-hour                | start of the running quarter-hour, Brussels/Amsterdam time ("14:15") |

Gladys has no €/MWh nor MW unit: the feature names carry them. A negative
price means that consuming during that quarter-hour is paid for.

## Scenes

Two triggers, under the **Integrations** category of the scene editor:

- **The imbalance price turns negative**: the estimated price of the running
  quarter-hour drops below 0 €/MWh.
- **The imbalance price rises above a threshold**: it rises above 100, 150,
  200, 300, 500 or 1,000 €/MWh.

Both can be limited to one zone (empty: both zones). Each fires when the price
crosses the line, at most once per quarter-hour, and not again while the price
stays on the same side. The following actions can read
`{{triggerEvent.data.price}}` (€/MWh), `price_kwh`, `zone` and
`quarter_hour`. To stop a device when the price goes back up, use the
device's own trigger ("Quarter-hour price (€/MWh) ≥ 0").

## Dashboard

The **Imbalance prices** widget shows, per zone, the price of the running
quarter-hour, the previous one, the system imbalance and the curve of the day
(which can be hidden in the widget settings).

## Data sources and limits

- **Elia**: datasets `ods161` (per minute) and `ods162` (per quarter-hour) of
  [Elia Open Data](https://opendata.elia.be), read once a minute, plus once
  per quarter-hour for the closed ones. The running value is an estimate on
  the minutes elapsed; the value of minute 14 is the published one. Elia
  marks these data "not validated": the settled price may still change.
- **TenneT**: "Balance Delta High Res" (`/latest`), read once a minute (fair
  use: 10 a minute at most). The price is computed like TenneT's regulation
  state: upward regulation only → highest upward price, downward only →
  lowest downward price, both → the price of the net direction, none → mid
  price. It is indicative: the settled price TenneT publishes later can
  differ. The curve of the day only starts when the integration starts.
- **Developed without a TenneT key: feedback welcome.** The Dutch part follows
  TenneT's API description; it could not be tested against the real API.
- Times follow the Brussels/Amsterdam clock, whatever the time zone of Gladys.

## Troubleshooting

- The integration is shown in error: its message says which source fails
  (Elia unreachable, TenneT key refused, TenneT unreachable). The last values
  stay on the devices.
- No value on a device: it must be added from the **Discovery** tab; the
  first values come within a minute.
- Logs: the integration page in Gladys; `LOG_LEVEL=debug` shows every read.

## Credits

Data: [Elia Open Data](https://opendata.elia.be) (Elia Transmission Belgium)
and the [TenneT API](https://developer.tennet.eu) (TenneT TSO B.V.). This
integration is not affiliated with Elia or TenneT.
