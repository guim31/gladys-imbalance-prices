// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { TRIGGER } from '../src/triggers.js';
import { WIDGET } from '../src/widget.js';
import { createWorld } from './helpers/world.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('../package.json'));
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

test('the identity of the integration', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Imbalance prices');
  assert.deepEqual(manifest.categories, ['energy']);
  // Two public APIs on the internet, nothing on the LAN.
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.countries, ['BE', 'NL']);
  // countries needs 5.3.0; widgets and scene triggers 5.1.0.
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.equal(manifest.docker_image, `ghcr.io/guim31/gladys-imbalance-prices:${manifest.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-imbalance-prices/main/cover.png',
  );
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.dependencies['@gladysassistant/integration-sdk'], /^\^0\.16\./);
  assert.deepEqual(Object.keys(pkg.dependencies), ['@gladysassistant/integration-sdk']);
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('config_schema defaults are DEFAULT_CONFIG, and every config key is declared', () => {
  const fields = manifest.config_schema.filter((f) => f.type !== 'section');
  assert.deepEqual(keysOf(fields).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const field of fields) {
    if (field.type === 'secret') {
      assert.equal(field.default, undefined);
      assert.equal(DEFAULT_CONFIG[field.key], '');
    } else {
      assert.equal(field.default, DEFAULT_CONFIG[field.key], `default of ${field.key}`);
    }
    assert.equal(field.required, false, field.key);
  }
  const language = fields.find((f) => f.key === 'language');
  assert.deepEqual(
    language.options.map((o) => o.value),
    LANGUAGES,
  );
  const [intro] = manifest.config_schema;
  assert.equal(intro.type, 'section');
  assert.match(intro.description.en, /Not affiliated with Elia or TenneT/);
  for (const link of intro.links) {
    assert.match(link.url, /^https:\/\//);
  }
});

test('every manifest action has a handler', async () => {
  const { gladys } = await createWorld();
  assert.deepEqual(keysOf(manifest.actions), ['check']);
  const ack = await gladys.fake.action('check');
  assert.equal(ack.success, true, ack.error);
});

test('the declared widget is the one the code serves, with its setting', async () => {
  assert.deepEqual(keysOf(manifest.widgets), Object.values(WIDGET));
  assert.deepEqual(keysOf(manifest.widgets[0].settings), ['show_chart']);
  assert.equal(manifest.widgets[0].settings[0].default, true);
});

test('the scene triggers are the ones the code fires', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(TRIGGER).sort());
  for (const trigger of manifest.scene_triggers) {
    const zone = trigger.fields.find((f) => f.key === 'zone');
    // Empty zone = both: one event per zone, never two for one zone.
    assert.equal(zone.required, false);
    assert.deepEqual(
      zone.options.map((o) => o.value),
      ['be', 'nl'],
    );
  }
  // One event per threshold crossed: a threshold must be chosen.
  const threshold = manifest.scene_triggers
    .find((t) => t.key === TRIGGER.ABOVE)
    .fields.find((f) => f.key === 'threshold');
  assert.equal(threshold.required, true);
});

test('the documentation exists in the four languages, and in Dutch', async () => {
  for (const lang of ['en', 'fr', 'de', 'es', 'nl']) {
    const doc = await read(`../docs/${lang}.md`);
    assert.ok(doc.length >= 300, `docs/${lang}.md`);
    assert.match(doc, /Elia/);
    assert.match(doc, /TenneT/);
  }
});
