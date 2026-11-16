// -----------------------------------------------------------------------------
// The integration end to end against the SDK's fake Gladys: devices, states,
// connection status, the "check" action, configuration changes and the
// container's own minute timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../src/app.js';
import { buildDevice } from '../src/device.js';
import { normalizeConfig } from '../src/config.js';
import { TEXT } from '../src/i18n.js';
import { createFakeApi, createWorld, featureId, last, NOW, TENNET_KEY } from './helpers/world.js';

const MINUTE = 60 * 1000;

test('Belgium: the states of the running and the previous quarter-hour', async () => {
  const { gladys } = await createWorld();
  assert.equal(last(gladys, 'be', 'price_mwh'), 176.88);
  assert.equal(last(gladys, 'be', 'price_kwh'), 0.17688);
  assert.equal(last(gladys, 'be', 'previous_price_mwh'), 195.05);
  assert.equal(last(gladys, 'be', 'system_imbalance'), 189);
  assert.equal(last(gladys, 'be', 'direction'), 'Surplus');
  // 15:15 UTC is 16:15 in Brussels.
  assert.equal(last(gladys, 'be', 'quarter_hour'), '16:15');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('the Netherlands: only with a key, an indicative price from TenneT', async () => {
  const without = await createWorld();
  assert.deepEqual(
    without.gladys.fake.discoveredDevices.map((d) => d.external_id),
    [without.gladys.externalIds('imbalance', 'be').device],
  );
  assert.equal(without.api.count('api.tennet.eu'), 0);

  const { gladys } = await createWorld({ config: { tennet_api_key: TENNET_KEY, language: 'en' } });
  assert.equal(gladys.fake.discoveredDevices.length, 2);
  assert.equal(last(gladys, 'nl', 'price_mwh'), -45.3);
  assert.equal(last(gladys, 'nl', 'price_kwh'), -0.0453);
  assert.equal(last(gladys, 'nl', 'previous_price_mwh'), 244.4);
  assert.equal(last(gladys, 'nl', 'direction'), 'Surplus');
  assert.equal(last(gladys, 'be', 'direction'), 'Surplus');
});

test('nothing is published for a device not added, everything once it is', async () => {
  const { gladys } = await createWorld({ created: false });
  assert.equal(gladys.fake.states.length, 0);
  const [device] = gladys.fake.discoveredDevices;
  await gladys.fake.deviceCreated(device);
  assert.equal(gladys.fake.states.length, device.features.length);
});

test('a new minute publishes only what changed', async () => {
  const world = await createWorld();
  const before = world.gladys.fake.states.length;
  world.clock.advance(MINUTE);
  await world.app.cycle();
  assert.equal(world.gladys.fake.states.length, before);
  world.api.minutes = structuredClone(world.api.minutes);
  world.api.minutes.results.unshift({
    datetime: '2026-11-16T15:19:00+00:00',
    quarterhour: '2026-11-16T15:15:00+00:00',
    systemimbalance: -120.4,
    imbalanceprice: 250.1,
  });
  world.clock.advance(MINUTE);
  await world.app.cycle();
  const added = world.gladys.fake.states.slice(before).map((s) => s.device_feature_external_id);
  const id = (key) => featureId(world.gladys, 'be', key);
  assert.deepEqual(
    added.sort(),
    [id('direction'), id('price_kwh'), id('price_mwh'), id('system_imbalance')].sort(),
  );
  assert.equal(last(world.gladys, 'be', 'direction'), 'Déficit');
});

test('a quarter-hour not published yet keeps the last states', async () => {
  // 15:30:20: Elia still has nothing for the 15:30 quarter-hour.
  const world = await createWorld({ at: '2026-11-16T15:30:20Z' });
  assert.equal(last(world.gladys, 'be', 'price_mwh'), undefined);
  // The 15:15 one is the previous quarter-hour now.
  assert.equal(last(world.gladys, 'be', 'previous_price_mwh'), 176.88);
});

test('the day of Elia is read once, then for each closed quarter-hour', async () => {
  const world = await createWorld();
  const days = () => world.api.requests.filter((r) => r.url.pathname.includes('/ods162/')).length;
  assert.equal(days(), 1);
  for (let i = 0; i < 10; i += 1) {
    world.clock.advance(MINUTE);
    await world.app.cycle();
  }
  // 15:29:30: the 15:15 quarter-hour is not closed yet.
  assert.equal(days(), 1);
  world.clock.advance(2 * MINUTE);
  await world.app.cycle();
  // 15:31:30: it is, and ods162 does not have it yet: asked, then every 2 min.
  assert.equal(days(), 2);
  world.clock.advance(MINUTE);
  await world.app.cycle();
  assert.equal(days(), 2);
  world.clock.advance(MINUTE);
  await world.app.cycle();
  assert.equal(days(), 3);
});

test('the connection status names what fails, in the four languages', async () => {
  const world = await createWorld({ config: { tennet_api_key: 'wrong' } });
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.deepEqual(world.gladys.fake.connectionStatus.message, TEXT.tennetKey);
  world.api.eliaDown = true;
  world.clock.advance(MINUTE);
  await world.app.cycle();
  const { message } = world.gladys.fake.connectionStatus;
  assert.equal(message.fr, `${TEXT.eliaFailed.fr} ${TEXT.tennetKey.fr}`);
  assert.deepEqual(Object.keys(message), ['en', 'fr', 'de', 'es']);

  const none = await createWorld({ config: { belgium: false } });
  assert.deepEqual(none.gladys.fake.connectionStatus, { connected: false, message: TEXT.noZone });
});

test('the check action: green when every zone answers, red otherwise', async () => {
  const world = await createWorld({ config: { tennet_api_key: TENNET_KEY } });
  const ok = await world.gladys.fake.action('check');
  assert.equal(ok.success, true, ok.error);
  assert.match(
    ok.data.message.fr,
    /^Belgique \(Elia\) : 176,88 €\/MWh à 16:15\. Pays-Bas \(TenneT\) : .45,30 €\/MWh à 16:15\.$/,
  );

  world.api.tennetDown = true;
  const failed = await world.gladys.fake.action('check');
  assert.equal(failed.success, false);
  assert.match(failed.error.fr, /L'API TenneT ne répond pas/);
  assert.match(failed.error.fr, /Belgique \(Elia\) : 176,88/);

  const none = await createWorld({ config: { belgium: false } });
  const nothing = await none.gladys.fake.action('check');
  assert.equal(nothing.success, false);
  assert.deepEqual(nothing.error, TEXT.noZone);
});

test('turning a zone off forgets it; another language renames nothing already added', async () => {
  const world = await createWorld({ config: { tennet_api_key: TENNET_KEY } });
  await world.gladys.fake.configUpdated({ belgium: false, tennet_api_key: TENNET_KEY });
  assert.deepEqual(
    world.gladys.fake.discoveredDevices.map((d) => d.external_id),
    [world.gladys.externalIds('imbalance', 'nl').device],
  );
  assert.equal(world.app.market.snapshot('be').current, null);
  await world.gladys.fake.configUpdated({ tennet_api_key: TENNET_KEY, language: 'de' });
  assert.equal(last(world.gladys, 'be', 'direction'), 'Überschuss');
  assert.equal(world.gladys.fake.discoveredDevices[0].name, 'Ausgleichspreis Belgien');
});

test('the container reads the prices on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse(NOW) });
  const api = createFakeApi();
  const gladys = createFakeGladys({ config: {} });
  gladys.fake.devices = [buildDevice(gladys, 'be', normalizeConfig())];
  const app = createApp(gladys, { fetch: api.fetch });
  await gladys.connect();
  const first = api.count('opendata.elia.be');
  for (let i = 0; i < 3; i += 1) {
    t.mock.timers.tick(MINUTE);
    for (let j = 0; j < 20; j += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  app.stop();
  assert.ok(api.count('opendata.elia.be') >= first + 3, `${api.count('opendata.elia.be')}`);
});

test('onPoll is a fallback: skipped while the timer runs', async () => {
  const world = await createWorld();
  const device = world.gladys.fake.discoveredDevices[0];
  const before = world.api.requests.length;
  await world.gladys.fake.poll(device);
  assert.equal(world.api.requests.length, before);
  world.clock.advance(5 * MINUTE);
  await world.gladys.fake.poll(device);
  assert.ok(world.api.requests.length > before);
});
