// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on the devices built from the real Elia
// fixtures (and the TenneT ones), in every configuration and every
// feature-name language, and on the states they publish.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorld, TENNET_KEY } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const both = { tennet_api_key: TENNET_KEY };
const scenarios = [
  { label: 'defaults (Belgium, French names)', config: {}, devices: 1 },
  { label: 'Belgium and the Netherlands', config: both, devices: 2 },
  { label: 'the Netherlands only', config: { ...both, belgium: false }, devices: 1 },
  { label: 'English names', config: { ...both, language: 'en' }, devices: 2 },
  { label: 'German names', config: { ...both, language: 'de' }, devices: 2 },
  { label: 'Spanish names', config: { ...both, language: 'es' }, devices: 2 },
];

for (const scenario of scenarios) {
  test(`the discovered device follows the Gladys rules (${scenario.label})`, async () => {
    const { gladys } = await createWorld({ config: scenario.config });
    const devices = gladys.fake.discoveredDevices;
    assert.equal(devices.length, scenario.devices);
    assert.equal(new Set(devices.map((d) => d.external_id)).size, devices.length);

    for (const device of devices) {
      const where = device.name;

      // should_poll: true if and only if poll_frequency is provided, in ms.
      if (device.poll_frequency === undefined) {
        assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
      } else {
        assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
        assert.ok(
          table.poll_frequencies_ms.includes(device.poll_frequency),
          `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
        );
      }

      assert.ok(device.features.length > 0, `${where}: no feature`);
      const externalIds = new Set();
      const names = new Set();
      for (const feature of device.features) {
        const at = `${where} / ${feature.name}`;
        const pair = table.pairs[`${feature.category}/${feature.type}`];
        assert.ok(pair, `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`);
        assert.ok(
          pair.label_en && pair.label_fr && pair.icon,
          `${at}: couple without label or icon`,
        );

        assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
        assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
        assert.ok(
          Number.isFinite(feature.min) && Number.isFinite(feature.max),
          `${at}: finite min/max`,
        );
        assert.ok(feature.min <= feature.max, `${at}: min > max`);
        assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
        assert.equal(
          typeof feature.has_feedback,
          'boolean',
          `${at}: has_feedback must be a boolean`,
        );
        if (feature.unit !== undefined) {
          assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
          const allowed = table.units_by_category[feature.category];
          if (allowed) {
            assert.ok(
              allowed.includes(feature.unit),
              `${at}: ${feature.unit} not a ${feature.category} unit`,
            );
          }
        }

        assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
        externalIds.add(feature.external_id);
        assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
        names.add(feature.name);
      }
    }
  });
}

test('every published state fits its feature', async () => {
  const { gladys } = await createWorld({ config: { tennet_api_key: TENNET_KEY } });
  const features = new Map(
    gladys.fake.discoveredDevices.flatMap((d) => d.features).map((f) => [f.external_id, f]),
  );
  assert.equal(gladys.fake.states.length, features.size);
  for (const state of gladys.fake.states) {
    const feature = features.get(state.device_feature_external_id);
    assert.ok(feature, `state for an unknown feature ${state.device_feature_external_id}`);
    if (feature.category === 'text') {
      // A text feature receives { text }, never empty.
      assert.equal(typeof state.text, 'string');
      assert.ok(state.text.length > 0);
    } else {
      assert.equal(typeof state.state, 'number');
      assert.ok(
        state.state >= feature.min && state.state <= feature.max,
        `${feature.name}: ${state.state}`,
      );
    }
  }
});
