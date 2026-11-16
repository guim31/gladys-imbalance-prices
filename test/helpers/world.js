// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, fake Elia and TenneT APIs
// serving the fixtures, and a settable clock, with the integration wired on
// top through createApp — the very wiring index.js uses.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';
import { buildDevice } from '../../src/device.js';
import { enabledZones, normalizeConfig } from '../../src/config.js';

// LOG_LEVEL=debug npm test shows the logs.
process.env.LOG_LEVEL ??= 'silent';

export const fixture = (path) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8'));

export const FIXTURES = {
  minutes: fixture('elia/minutes.json'),
  today: fixture('elia/today.json'),
  dayNegative: fixture('elia/day-negative.json'),
  eliaError: fixture('elia/error-400.json'),
  tennet: fixture('tennet/latest.json'),
  tennet401: fixture('tennet/error-401.json'),
  tennet429: fixture('tennet/error-429.json'),
};

/** 16 November 2026, 16:19:30 in Brussels: the minute after the fixtures. */
export const NOW = '2026-11-16T15:19:30Z';
export const TENNET_KEY = 'test-tennet-key-0123456789';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Fake Elia and TenneT. `api.minutes`, `api.today` and `api.tennet` are the
 * bodies served; `api.eliaDown` / `api.tennetDown` make a host unreachable,
 * `api.eliaStatus` / `api.tennetStatus` answer an error status.
 */
export function createFakeApi() {
  const api = {
    minutes: FIXTURES.minutes,
    today: FIXTURES.today,
    tennet: FIXTURES.tennet,
    eliaDown: false,
    tennetDown: false,
    eliaStatus: 200,
    tennetStatus: 200,
    requests: [],
    async fetch(url, init) {
      const parsed = new URL(url);
      api.requests.push({ url: parsed, headers: init?.headers ?? {} });
      if (parsed.hostname === 'opendata.elia.be') {
        if (api.eliaDown) {
          throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
        }
        if (api.eliaStatus !== 200) {
          return json(api.eliaStatus, FIXTURES.eliaError);
        }
        if (parsed.pathname.includes('/ods161/')) {
          return json(200, api.minutes);
        }
        const from = Date.parse(parsed.searchParams.get('where').match(/"(.+)"/)[1]);
        const results = api.today.results.filter((r) => Date.parse(r.datetime) >= from);
        return json(200, { total_count: results.length, results });
      }
      if (parsed.hostname === 'api.tennet.eu') {
        if (api.tennetDown) {
          throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
        }
        if (init?.headers?.apikey !== TENNET_KEY) {
          return json(401, FIXTURES.tennet401);
        }
        if (api.tennetStatus === 429) {
          return json(429, FIXTURES.tennet429);
        }
        return json(api.tennetStatus, api.tennet);
      }
      throw new Error(`unexpected request to ${parsed.hostname}`);
    },
    count(host) {
      return api.requests.filter((r) => r.url.hostname === host).length;
    },
  };
  return api;
}

/** A clock the test moves by hand. */
export function createClock(iso = NOW) {
  let current = Date.parse(iso);
  return {
    now: () => current,
    set(next) {
      current = Date.parse(next);
    },
    advance(ms) {
      current += ms;
    },
  };
}

/**
 * An answer of ods161 for given quarter-hours: `[[isoStart, price, mw], ...]`,
 * each as its minute-14 record (or the minute `at` for the running one).
 */
export function eliaMinutes(quarters) {
  const results = quarters.map(([start, price, mw, minute = 14]) => ({
    datetime: new Date(Date.parse(start) + minute * 60000).toISOString(),
    quarterhour: start,
    systemimbalance: mw,
    imbalanceprice: price,
  }));
  return { total_count: results.length, results: results.reverse() };
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {boolean} [options.created] the user already added the devices
 * @param {string} [options.at] the clock, ISO
 * @param {boolean} [options.connect]
 */
export async function createWorld({ config = {}, created = true, at = NOW, connect = true } = {}) {
  const api = createFakeApi();
  const clock = createClock(at);
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, { fetch: api.fetch, now: clock.now, timers: false });
  if (created) {
    const normalized = normalizeConfig(config);
    gladys.fake.devices = enabledZones(normalized).map((zone) =>
      buildDevice(gladys, zone, normalized),
    );
  }
  if (connect) {
    await gladys.connect();
  }
  return { gladys, api, clock, app };
}

/** External id of a feature of a zone device. */
export const featureId = (gladys, zone, key) => gladys.externalIds('imbalance', zone).feature(key);

/** The last state of a feature: a number, or the text of a text feature. */
export function last(gladys, zone, key) {
  const id = featureId(gladys, zone, key);
  const state = gladys.fake.states.filter((s) => s.device_feature_external_id === id).at(-1);
  return state === undefined ? undefined : (state.text ?? state.state);
}
