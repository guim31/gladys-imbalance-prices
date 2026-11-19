// -----------------------------------------------------------------------------
// One device per zone: Belgium (Elia) and the Netherlands (TenneT).
//
// External ids are built on the zone ("be", "nl"), the only identity the
// prices have. Feature keys are forever, like the ids built on them.
//
// Every feature is a read-only sensor. Prices use `currency/decimal` in euros
// (Gladys has no €/MWh unit: the name carries it); the system imbalance is a
// `counter-sensor/integer` in MW (Gladys has no MW unit either), positive for
// a surplus, so a scene can test "imbalance < -300"; its direction and the
// running quarter-hour ("14:15", market clock) are `text/text`.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { DEVICE_NAMES, DIRECTIONS, NAMES } from './i18n.js';
import { marketTime } from './time.js';

const DEVICE_TYPE = 'imbalance';

export const FEATURE = {
  PRICE_MWH: 'price_mwh',
  PRICE_KWH: 'price_kwh',
  PREVIOUS_PRICE_MWH: 'previous_price_mwh',
  SYSTEM_IMBALANCE: 'system_imbalance',
  DIRECTION: 'direction',
  QUARTER_HOUR: 'quarter_hour',
};

const MODELS = { be: 'Elia Open Data', nl: 'TenneT Balance Delta' };

// Display bounds only (the core never applies them): Elia's imbalance price
// went down to -15,000 €/MWh on 6 April 2026; the system imbalance stays
// within a few GW.
const PRICE_MWH_BOUNDS = { min: -15000, max: 15000 };
const PRICE_KWH_BOUNDS = { min: -15, max: 15 };
const IMBALANCE_BOUNDS = { min: -5000, max: 5000 };
// text/text: min and max are NOT NULL in the core (422 on "Add to Gladys").
const TEXT_BOUNDS = { min: 0, max: 0 };

export const roundMwh = (value) => Math.round(value * 100) / 100;
export const toKwh = (value) => Math.round(value * 100) / 100000;

/**
 * @param {object} gladys
 * @param {string} zone
 */
export function deviceIds(gladys, zone) {
  return gladys.externalIds(DEVICE_TYPE, zone);
}

/**
 * @param {object} gladys
 * @param {string} zone
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildDevice(gladys, zone, config) {
  const ids = deviceIds(gladys, zone);
  const names = NAMES[config.language] ?? NAMES.en;
  const sensor = (key, category, type, bounds, extra = {}) => ({
    name: names[key],
    external_id: ids.feature(key),
    category,
    type,
    ...bounds,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    ...extra,
  });
  const price = (key, bounds) =>
    sensor(key, DEVICE_FEATURE_CATEGORIES.CURRENCY, DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL, bounds, {
      unit: DEVICE_FEATURE_UNITS.EURO,
    });
  const text = (key) =>
    sensor(key, DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, TEXT_BOUNDS, {
      keep_history: false,
    });

  return {
    name: (DEVICE_NAMES[config.language] ?? DEVICE_NAMES.en)[zone],
    external_id: ids.device,
    model: MODELS[zone],
    // Polled once a minute by the core when it does (Gladys#3198: often not):
    // the container's own timer does the work, onPoll is the fallback.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: [
      price(FEATURE.PRICE_MWH, PRICE_MWH_BOUNDS),
      price(FEATURE.PRICE_KWH, PRICE_KWH_BOUNDS),
      price(FEATURE.PREVIOUS_PRICE_MWH, PRICE_MWH_BOUNDS),
      sensor(
        FEATURE.SYSTEM_IMBALANCE,
        DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        IMBALANCE_BOUNDS,
      ),
      text(FEATURE.DIRECTION),
      text(FEATURE.QUARTER_HOUR),
    ],
  };
}

/** "surplus", "deficit" or "balanced" for an imbalance in MW. */
export function direction(imbalance) {
  const mw = Math.round(imbalance);
  return mw > 0 ? 'surplus' : mw < 0 ? 'deficit' : 'balanced';
}

/**
 * The states of a zone. What the snapshot does not know (the running
 * quarter-hour not published yet) is left out: the feature keeps its last
 * state rather than receiving a made-up one.
 * @param {object} gladys
 * @param {ReturnType<ReturnType<import('./market.js').createMarket>['snapshot']>} snapshot
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildStates(gladys, snapshot, config) {
  const ids = deviceIds(gladys, snapshot.zone);
  const states = [];
  const number = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), state: value });
  const text = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), text: value });

  const { current, previous } = snapshot;
  if (current) {
    number(FEATURE.PRICE_MWH, roundMwh(current.price));
    number(FEATURE.PRICE_KWH, toKwh(current.price));
    text(FEATURE.QUARTER_HOUR, marketTime(current.start));
    if (current.imbalance !== null) {
      number(FEATURE.SYSTEM_IMBALANCE, Math.round(current.imbalance));
      const names = DIRECTIONS[config.language] ?? DIRECTIONS.en;
      text(FEATURE.DIRECTION, names[direction(current.imbalance)]);
    }
  }
  if (previous) {
    number(FEATURE.PREVIOUS_PRICE_MWH, roundMwh(previous.price));
  }
  return states;
}
