// -----------------------------------------------------------------------------
// Reads the real APIs with the integration's own clients (network, not part of
// `npm test`):
//
//   node scripts/probe.mjs                         Elia only
//   TENNET_API_KEY=... node scripts/probe.mjs      Elia and TenneT
//   node scripts/probe.mjs 2026-04-06              an Elia day (history, ods134)
// -----------------------------------------------------------------------------

import { createEliaClient } from '../src/elia.js';
import { createTennetClient } from '../src/tennet.js';
import { marketDayStart, marketTime } from '../src/time.js';

const show = (quarters) =>
  quarters
    .map(
      (q) =>
        `  ${marketTime(q.start)}  ${q.price.toFixed(2).padStart(10)} €/MWh  ${Math.round(q.imbalance ?? 0)} MW`,
    )
    .join('\n');

const day = process.argv[2];
if (day) {
  // The history dataset (one day late), the same shape as ods162.
  const from = marketDayStart(Date.parse(`${day}T12:00:00Z`));
  const url = new URL('https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods134/records');
  url.searchParams.set('limit', '100');
  url.searchParams.set('order_by', 'datetime asc');
  url.searchParams.set('select', 'datetime,systemimbalance,imbalanceprice');
  url.searchParams.set(
    'where',
    `datetime >= "${new Date(from).toISOString()}" and datetime < "${new Date(from + 86400000).toISOString()}"`,
  );
  const { results } = await (await fetch(url)).json();
  const prices = results.map((r) => r.imbalanceprice);
  const negative = results.filter((r) => r.imbalanceprice < 0).length;
  console.log(
    `Elia ${day}: ${results.length} quarter-hours, min ${Math.min(...prices)} €/MWh, ` +
      `max ${Math.max(...prices)} €/MWh, ${negative} negative`,
  );
  process.exit(0);
}

const elia = createEliaClient();
console.log('Elia, last 30 minutes (ods161):');
console.log(show(await elia.minutes()));
const today = await elia.quarters(marketDayStart(Date.now()));
console.log(`Elia, ${today.length} closed quarter-hours today (ods162), the last three:`);
console.log(show(today.slice(-3)));

if (process.env.TENNET_API_KEY) {
  console.log('TenneT, last 30 minutes (balance delta, indicative):');
  console.log(show(await createTennetClient().latest(process.env.TENNET_API_KEY)));
} else {
  console.log('TenneT: set TENNET_API_KEY to read it.');
}
