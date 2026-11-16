// -----------------------------------------------------------------------------
// The dashboard widget: valid for the core, within its budget, localized, and
// its optional chart can be hidden.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createWorld, TENNET_KEY } from './helpers/world.js';

async function get(gladys, language = 'fr', settings = {}) {
  const ack = await gladys.fake.widgetGet('prices', { language, settings });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  return ack.data.content;
}

test('both zones: tiles, the day curve and the status, within the core budget', async () => {
  const { gladys } = await createWorld({ config: { tennet_api_key: TENNET_KEY } });
  const content = await get(gladys, 'en');
  assert.ok(content.components.length <= 8);
  assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text', 'value', 'value', 'chart', 'status'],
  );
  const [, be, nl, chart, status] = content.components;
  assert.equal(be.label, 'Belgium (Elia)');
  assert.equal(be.value, 176.88);
  assert.equal(nl.value, -45.3);
  // Belgium: the 65 closed quarter-hours of the day and the running one;
  // the Netherlands: what the last 30 minutes hold whole.
  assert.deepEqual(
    chart.series.map((s) => s.points.length),
    [66, 2],
  );
  assert.deepEqual(
    status.items.map((i) => `${i.label}: ${i.value}`),
    [
      'BE · Previous 16:00: 195.05 €/MWh',
      'BE · Imbalance 16:15: +189 MW (Surplus)',
      'NL · Previous 16:00: 244.40 €/MWh',
      'NL · Imbalance 16:15: +231 MW (Surplus)',
    ],
  );
});

test('the chart can be hidden, the texts follow the user language', async () => {
  const { gladys } = await createWorld();
  const content = await get(gladys, 'de', { show_chart: false });
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text', 'value', 'status'],
  );
  assert.equal(content.components[1].label, 'Belgien (Elia)');
  assert.equal(content.components[2].items[0].value, '195,05 €/MWh');
});

test('nothing known yet: one line that says where to look', async () => {
  const world = await createWorld({ connect: false });
  world.api.eliaDown = true;
  await world.gladys.connect();
  const content = await get(world.gladys, 'fr');
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text'],
  );
  assert.match(content.components[0].text, /vérifiez la configuration/);
});
