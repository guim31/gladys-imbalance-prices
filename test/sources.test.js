// -----------------------------------------------------------------------------
// The Elia and TenneT clients, on the recorded Elia answers and the TenneT
// fixture built from its OpenAPI description. No network.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEliaClient } from '../src/elia.js';
import { createTennetClient, quarterFromPoints } from '../src/tennet.js';
import { createFakeApi, FIXTURES, TENNET_KEY } from './helpers/world.js';

const iso = (ms) => new Date(ms).toISOString();

test('Elia: the last 30 minutes give the running quarter-hour and the one before', async () => {
  const api = createFakeApi();
  const quarters = await createEliaClient({ fetch: api.fetch }).minutes();
  assert.deepEqual(
    quarters.map((q) => [iso(q.start), q.price, q.imbalance]),
    [
      ['2026-11-16T14:45:00.000Z', 189.003, 93.161],
      ['2026-11-16T15:00:00.000Z', 195.048, 206.47],
      ['2026-11-16T15:15:00.000Z', 176.884, 189.316],
    ],
  );
  const url = api.requests[0].url;
  assert.match(url.pathname, /\/ods161\/records$/);
  assert.equal(url.searchParams.get('order_by'), 'datetime desc');
});

test('Elia: the minute 14 of a quarter-hour is its published value', async () => {
  const api = createFakeApi();
  const minutes = await createEliaClient({ fetch: api.fetch }).minutes();
  const day = await createEliaClient({ fetch: api.fetch }).quarters(0);
  const closed = day.find((q) => q.start === Date.parse('2026-11-16T15:00:00Z'));
  assert.equal(minutes[1].price, closed.price);
  assert.equal(minutes[1].imbalance, closed.imbalance);
});

test('Elia: the quarter-hours of the day since a date', async () => {
  const api = createFakeApi();
  const quarters = await createEliaClient({ fetch: api.fetch }).quarters(
    Date.parse('2026-11-15T23:00:00Z'),
  );
  assert.equal(quarters.length, 65);
  assert.match(api.requests[0].url.searchParams.get('where'), /datetime >= "2026-11-15T23:00/);
});

test('Elia: a day of history holds its negative prices', async () => {
  const api = createFakeApi();
  api.today = FIXTURES.dayNegative;
  const quarters = await createEliaClient({ fetch: api.fetch }).quarters(0);
  assert.equal(quarters.length, 96);
  const negative = quarters.filter((q) => q.price < 0);
  assert.ok(negative.length >= 3);
  assert.equal(Math.min(...negative.map((q) => q.price)), -15000);
  // A negative price comes with a surplus.
  assert.ok(negative.every((q) => q.imbalance > 0));
});

test('Elia: errors are SourceErrors without URL', async () => {
  const api = createFakeApi();
  const elia = createEliaClient({ fetch: api.fetch });
  api.eliaStatus = 400;
  await assert.rejects(elia.minutes(), { name: 'SourceError', message: 'Elia answered HTTP 400' });
  api.eliaStatus = 200;
  api.eliaDown = true;
  await assert.rejects(elia.minutes(), { message: 'Elia unreachable (ENOTFOUND)' });
  const odd = createEliaClient({ fetch: async () => new Response('<html>', { status: 200 }) });
  await assert.rejects(odd.minutes(), { message: 'Elia answered something that is not JSON' });
});

test('TenneT: the key goes in the apikey header, the points become quarter-hours', async () => {
  const api = createFakeApi();
  const quarters = await createTennetClient({ fetch: api.fetch }).latest(TENNET_KEY);
  assert.equal(api.requests[0].headers.apikey, TENNET_KEY);
  assert.deepEqual(
    quarters.map((q) => [iso(q.start), q.price, q.state, q.partial]),
    [
      ['2026-11-16T14:45:00.000Z', 212.4, 2, true],
      ['2026-11-16T15:00:00.000Z', 244.4, 2, false],
      ['2026-11-16T15:15:00.000Z', -45.3, 2, false],
    ],
  );
  assert.ok(quarters[1].imbalance < 0, 'upward regulation: shortage');
  assert.ok(quarters[2].imbalance > 0, 'downward regulation: surplus');
});

test('TenneT: refused key, rate limit, no data, outage', async () => {
  const api = createFakeApi();
  const tennet = createTennetClient({ fetch: api.fetch });
  await assert.rejects(tennet.latest('wrong'), { auth: true, message: /refused the API key/ });
  api.tennetStatus = 429;
  await assert.rejects(tennet.latest(TENNET_KEY), { rateLimited: true });
  api.tennetStatus = 200;
  api.tennet = { error: 'No data found' };
  assert.deepEqual(await tennet.latest(TENNET_KEY), []);
  api.tennetDown = true;
  await assert.rejects(tennet.latest(TENNET_KEY), { message: 'TenneT unreachable (ECONNRESET)' });
});

test('TenneT: the price follows the regulation state', () => {
  const point = (up, down, prices) => ({
    power_afrr_in: String(up),
    power_afrr_out: String(down),
    power_mfrrda_in: null,
    max_upw_regulation_price: prices.up ?? null,
    min_downw_regulation_price: prices.down ?? null,
    mid_price: prices.mid ?? null,
  });
  // Upward only: the highest upward price.
  const up = quarterFromPoints([
    point(50, 0, { up: '120.5', mid: '80' }),
    point(90, 0, { up: '150.25', mid: '81' }),
  ]);
  assert.deepEqual(up, { price: 150.25, imbalance: -70, state: 1 });
  // Downward only: the lowest downward price.
  const down = quarterFromPoints([
    point(0, 40, { down: '10', mid: '60' }),
    point(0, 60, { down: '-25.5', mid: '60' }),
  ]);
  assert.deepEqual(down, { price: -25.5, imbalance: 50, state: -1 });
  // Nothing activated: the mid price.
  assert.deepEqual(quarterFromPoints([point(0, 0, { mid: '72.1' })]), {
    price: 72.1,
    imbalance: 0,
    state: 0,
  });
  assert.equal(quarterFromPoints([]), null);
  assert.equal(quarterFromPoints([point(0, 0, {})]), null);
});
