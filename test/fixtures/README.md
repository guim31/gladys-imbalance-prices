# Test fixtures

- `elia/`: real answers of the Elia Open Data API (public data, no key),
  saved on 16 November 2026 around 15:19 UTC: `minutes.json` (dataset
  `ods161`, the last 30 minutes), `today.json` (`ods162`, the quarter-hours of
  16 November so far), `day-negative.json` (`ods134`, 6 April 2026, a day with
  negative prices down to -15,000 €/MWh) and `error-400.json` (a malformed
  query).
- `tennet/`: **built by hand** from the OpenAPI description of TenneT's
  "Balance Delta High Res" API (`/publications/v1/balance-delta-high-res/latest`)
  and its error schemas. The API needs a personal key: no real answer could be
  recorded for this repository.
- `gladys-feature-table.json`: the category/type couples, units and poll
  frequencies the Gladys core knows (see its `source`).
