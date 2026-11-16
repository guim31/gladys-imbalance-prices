// -----------------------------------------------------------------------------
// Scene triggers: a crossing fires once per quarter-hour, never on the first
// value nor after a gap, one event per threshold crossed; and the events carry
// exactly what the manifest declares.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTriggerWatch, THRESHOLDS, TRIGGER } from '../src/triggers.js';
import { createWorld, eliaMinutes, TENNET_KEY } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const MINUTE = 60 * 1000;
const Q = Date.parse('2026-04-06T10:00:00Z');

test('turning negative fires once per quarter-hour, not while it hovers', () => {
  const watch = createTriggerWatch();
  const at = (minutes) => Q + minutes * MINUTE;
  assert.deepEqual(watch.evaluate('be', { start: Q, price: 12 }, at(1)), []);
  const [event] = watch.evaluate('be', { start: Q, price: -3.456 }, at(2));
  assert.equal(event.key, TRIGGER.NEGATIVE);
  assert.deepEqual(event.data, {
    zone: 'be',
    price: -3.46,
    price_kwh: -0.00346,
    quarter_hour: '12:00',
  });
  assert.deepEqual(watch.evaluate('be', { start: Q, price: 4 }, at(3)), []);
  assert.deepEqual(watch.evaluate('be', { start: Q, price: -1 }, at(4)), [], 'same quarter-hour');
  // Still negative in the next quarter-hour: no new start.
  assert.deepEqual(watch.evaluate('be', { start: Q + 15 * MINUTE, price: -8 }, at(16)), []);
  // Back above 0, then below again in a later quarter-hour: a new start.
  watch.evaluate('be', { start: Q + 30 * MINUTE, price: 20 }, at(31));
  assert.equal(watch.evaluate('be', { start: Q + 30 * MINUTE, price: -2 }, at(32)).length, 1);
});

test('the first value, or a value after a gap, fires nothing', () => {
  const watch = createTriggerWatch();
  assert.deepEqual(watch.evaluate('nl', { start: Q, price: -50 }, Q), []);
  watch.evaluate('nl', { start: Q, price: 50 }, Q + MINUTE);
  assert.deepEqual(
    watch.evaluate('nl', { start: Q + 30 * MINUTE, price: -50 }, Q + 30 * MINUTE),
    [],
  );
});

test('one event per threshold crossed, zones apart', () => {
  const watch = createTriggerWatch();
  watch.evaluate('be', { start: Q, price: 90 }, Q);
  watch.evaluate('nl', { start: Q, price: 400 }, Q);
  const events = watch.evaluate('be', { start: Q, price: 320 }, Q + MINUTE);
  assert.deepEqual(
    events.map((e) => [e.key, e.data.threshold]),
    [
      [TRIGGER.ABOVE, '100'],
      [TRIGGER.ABOVE, '150'],
      [TRIGGER.ABOVE, '200'],
      [TRIGGER.ABOVE, '300'],
    ],
  );
  // Exactly on the threshold is not above it.
  assert.deepEqual(watch.evaluate('nl', { start: Q, price: 500 }, Q + MINUTE), []);
});

test('the day of 6 April 2026 replayed: the drop to -15,000 €/MWh fires the trigger', async () => {
  // Elia's real quarter-hours: 26.5 €/MWh at 11:45 UTC, -15,000 at 12:00.
  const world = await createWorld({ at: '2026-04-06T11:59:30Z', connect: false });
  world.api.minutes = eliaMinutes([['2026-04-06T11:45:00Z', 26.5, 180, 13]]);
  world.api.today = { results: [] };
  await world.gladys.connect();
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  world.api.minutes = eliaMinutes([
    ['2026-04-06T11:45:00Z', 26.5, 180],
    ['2026-04-06T12:00:00Z', -15000, 787.795, 0],
  ]);
  world.clock.set('2026-04-06T12:01:20Z');
  await world.app.cycle();
  const events = world.gladys.fake.sceneEvents;
  assert.deepEqual(
    events.map((e) => e.key),
    [TRIGGER.NEGATIVE],
  );
  assert.equal(events[0].data.price, -15000);
  assert.equal(events[0].data.quarter_hour, '14:00');
});

test('the events carry exactly the declared fields and variables', async () => {
  const world = await createWorld({ config: { tennet_api_key: TENNET_KEY } });
  // Belgium jumps to 600 €/MWh, the Netherlands are negative already.
  world.api.tennet = structuredClone(world.api.tennet);
  for (const point of world.api.tennet.Response.TimeSeries[0].Period[0].points) {
    if (point.timeInterval_start >= '2026-11-16T15:15') {
      point.min_downw_regulation_price = '45.00';
    }
  }
  world.clock.advance(MINUTE);
  await world.app.cycle();
  world.api.minutes = eliaMinutes([['2026-11-16T15:15:00Z', 600, -900, 5]]);
  world.api.tennet = (await createWorld()).api.tennet;
  world.clock.advance(MINUTE);
  await world.app.cycle();
  const events = world.gladys.fake.sceneEvents;
  assert.deepEqual([...new Set(events.map((e) => e.key))].sort(), Object.values(TRIGGER).sort());
  // 176.88 → 600 €/MWh: above 200, 300 and 500.
  assert.equal(events.filter((e) => e.key === TRIGGER.ABOVE).length, 3);
  for (const event of events) {
    const trigger = manifest.scene_triggers.find((t) => t.key === event.key);
    const declared = new Set([...trigger.fields, ...trigger.variables].map((f) => f.key));
    assert.deepEqual(Object.keys(event.data).sort(), [...declared].sort(), event.key);
    for (const variable of trigger.variables) {
      assert.equal(typeof event.data[variable.key], variable.type, variable.key);
    }
  }
  assert.deepEqual(
    manifest.scene_triggers
      .find((t) => t.key === TRIGGER.ABOVE)
      .fields.find((f) => f.key === 'threshold')
      .options.map((o) => o.value),
    THRESHOLDS,
  );
});
