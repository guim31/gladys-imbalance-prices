// -----------------------------------------------------------------------------
// Scene triggers (manifest `scene_triggers`, Gladys 5.1+).
//
// A state can say "the price is negative"; a trigger says "it just went
// negative": the moment to start a boiler or a charger once, rather than a
// scene re-run on every new state.
//
//   price_negative_started  the price of the running quarter-hour drops
//                           below 0 €/MWh (it was at or above 0);
//   price_above_started     it rises above a threshold (it was at or below).
//
// The price watched is the running estimate, read every minute: a crossing
// fires at most once per zone, trigger, threshold and quarter-hour, so a price
// hovering around the line cannot run a scene every minute. A crossing needs
// a value read less than LAST_VALUE_MAX_AGE before: after a restart or an
// outage, the first value fires nothing (it is not known what came before).
//
// The core filters scene events on equality only: the scene author picks the
// threshold in a required select, and one event goes out per threshold
// crossed (from 90 to 320 €/MWh: "100", "150", "200" and "300").
// -----------------------------------------------------------------------------

import { roundMwh, toKwh } from './device.js';
import { MINUTE, marketTime, quarterStart } from './time.js';

export const TRIGGER = {
  NEGATIVE: 'price_negative_started',
  ABOVE: 'price_above_started',
};

/** €/MWh, as declared in the manifest options. */
export const THRESHOLDS = ['100', '150', '200', '300', '500', '1000'];

export const LAST_VALUE_MAX_AGE = 20 * MINUTE;

export function createTriggerWatch() {
  const last = new Map();
  const fired = new Set();

  return {
    /**
     * The events to fire for the running quarter-hour of a zone.
     * @param {string} zone
     * @param {{ start: number, price: number }} quarter
     * @param {number} at
     * @returns {Array<{ key: string, data: object }>}
     */
    evaluate(zone, quarter, at) {
      const before = last.get(zone);
      last.set(zone, { price: quarter.price, at });
      // Forget the quarter-hours gone.
      for (const id of fired) {
        if (Number(id.split(':').at(-1)) < quarterStart(at) - 15 * MINUTE) {
          fired.delete(id);
        }
      }
      if (!before || at - before.at > LAST_VALUE_MAX_AGE) {
        return [];
      }
      const data = {
        zone,
        price: roundMwh(quarter.price),
        price_kwh: toKwh(quarter.price),
        quarter_hour: marketTime(quarter.start),
      };
      const events = [];
      const fire = (key, extra = {}, tag = '') => {
        const id = `${zone}:${key}:${tag}:${quarter.start}`;
        if (!fired.has(id)) {
          fired.add(id);
          events.push({ key, data: { ...data, ...extra } });
        }
      };
      if (before.price >= 0 && quarter.price < 0) {
        fire(TRIGGER.NEGATIVE);
      }
      for (const threshold of THRESHOLDS) {
        const value = Number(threshold);
        if (before.price <= value && quarter.price > value) {
          fire(TRIGGER.ABOVE, { threshold }, threshold);
        }
      }
      return events;
    },

    /** Forget a zone (turned off). */
    forget(zone) {
      last.delete(zone);
    },
  };
}
