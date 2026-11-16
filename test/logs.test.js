// -----------------------------------------------------------------------------
// Quiet logs: nothing at info for a normal cycle, a repeated failure written
// once (and its recovery once), and nothing secret in them.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TENNET_KEY } from './helpers/world.js';

/** Capture what the SDK logger writes (console.log / console.error). */
function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => lines.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}

const MINUTE = 60 * 1000;
const both = { tennet_api_key: TENNET_KEY };

test('a day of normal cycles writes nothing at info', async (t) => {
  const world = await createWorld({ config: both });
  const lines = captureLogs(t);
  for (let i = 0; i < 24 * 60; i += 1) {
    world.clock.advance(MINUTE);
    await world.app.cycle();
  }
  await world.gladys.fake.widgetGet('prices');
  await world.gladys.fake.poll(world.gladys.fake.discoveredDevices[0]);
  assert.ok(world.api.count('opendata.elia.be') >= 24 * 60);
  assert.ok(world.api.count('api.tennet.eu') >= 24 * 60);
  assert.deepEqual(lines, []);
});

test('the startup says each source answers, once', async (t) => {
  const lines = captureLogs(t);
  await createWorld({ config: both });
  assert.deepEqual(
    lines.map((line) => line.replace(/^.*\[INFO\] \[imbalance-prices\] /, '')),
    ['Elia reachable', 'TenneT reachable'],
  );
});

test('an outage is one warning, its end one info line', async (t) => {
  const world = await createWorld();
  const lines = captureLogs(t);
  world.api.eliaDown = true;
  for (let i = 0; i < 60; i += 1) {
    world.clock.advance(MINUTE);
    await world.app.cycle();
  }
  world.api.eliaDown = false;
  for (let i = 0; i < 10; i += 1) {
    world.clock.advance(MINUTE);
    await world.app.cycle();
  }
  assert.equal(lines.length, 2, lines.join('\n'));
  assert.match(lines[0], /\[WARN\].*Elia refresh failed \(Elia unreachable \(ENOTFOUND\)\)/);
  assert.match(lines[1], /\[INFO\].*Elia answers again/);
});

test('a user action is one info line', async (t) => {
  const world = await createWorld();
  const lines = captureLogs(t);
  await world.gladys.fake.action('check');
  await world.gladys.fake.configUpdated({ language: 'de' });
  assert.equal(lines.length, 2, lines.join('\n'));
});

test('nothing secret in the logs, even in debug', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await createWorld({ config: { tennet_api_key: 'wrong-but-secret-key' } });
  world.api.tennetDown = true;
  world.clock.advance(MINUTE);
  await world.app.cycle();
  await world.gladys.fake.action('check');
  await world.gladys.fake.configUpdated(both);
  assert.ok(lines.length > 3);
  const all = lines.join('\n');
  assert.doesNotMatch(all, /fake-integration-token/);
  assert.doesNotMatch(all, /wrong-but-secret-key/);
  assert.doesNotMatch(all, new RegExp(TENNET_KEY));
  assert.doesNotMatch(all, /https?:\/\//);
});
