// -----------------------------------------------------------------------------
// What is known of each zone: its quarter-hours of the market day (and the
// last one of the day before), from Elia (Belgium) or TenneT (the
// Netherlands).
//
// Belgium: each refresh reads the last 30 minutes per minute (ods161: the
// running quarter-hour and the one before), and the closed quarter-hours of
// the day (ods162) when one is missing — at startup, then about once per
// quarter-hour. A value of ods162 is final and never replaced by a running one.
// The Netherlands: the last 30 minutes of TenneT, the earlier quarter-hours of
// the day kept from the previous reads (memory only).
// -----------------------------------------------------------------------------

import { ZONE } from './config.js';
import { createEliaClient } from './elia.js';
import { createTennetClient } from './tennet.js';
import { MINUTE, QUARTER, marketDayStart, quarterStart } from './time.js';

// ods162 is asked again for a missing closed quarter-hour at most this often.
export const DAY_RETRY_MS = 2 * MINUTE;

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 */
export function createMarket({ fetch, now = () => Date.now() } = {}) {
  const elia = createEliaClient({ fetch });
  const tennet = createTennetClient({ fetch });
  const newZone = () => ({
    quarters: new Map(),
    lastSuccessAt: null,
    dayLoaded: null,
    dayAskedAt: null,
  });
  const zones = { [ZONE.BE]: newZone(), [ZONE.NL]: newZone() };

  /** Store quarter-hours; returns true when a value changed. */
  function store(zone, list, final) {
    let changed = false;
    for (const quarter of list) {
      const known = zone.quarters.get(quarter.start);
      // A quarter-hour TenneT's window cuts at its start is worth nothing.
      if (quarter.partial || (known?.final && !final)) {
        continue;
      }
      if (known?.price !== quarter.price || known?.imbalance !== quarter.imbalance) {
        changed = true;
      }
      zone.quarters.set(quarter.start, {
        start: quarter.start,
        price: quarter.price,
        imbalance: quarter.imbalance ?? null,
        final,
      });
    }
    return changed;
  }

  function prune(zone, at) {
    const keepFrom = marketDayStart(at) - QUARTER;
    for (const start of zone.quarters.keys()) {
      if (start < keepFrom) {
        zone.quarters.delete(start);
      }
    }
  }

  async function refreshBelgium() {
    const at = now();
    const zone = zones[ZONE.BE];
    let changed = store(zone, await elia.minutes(), false);
    const day = marketDayStart(at);
    const lastClosed = quarterStart(at) - QUARTER;
    const missing = !zone.quarters.get(lastClosed)?.final;
    if (
      zone.dayLoaded !== day ||
      (missing && (zone.dayAskedAt === null || at - zone.dayAskedAt >= DAY_RETRY_MS))
    ) {
      zone.dayAskedAt = at;
      const from = zone.dayLoaded === day ? lastClosed - QUARTER : day - QUARTER;
      changed = store(zone, await elia.quarters(from), true) || changed;
      zone.dayLoaded = day;
    }
    zone.lastSuccessAt = at;
    prune(zone, at);
    return changed;
  }

  async function refreshNetherlands(apiKey) {
    const at = now();
    const zone = zones[ZONE.NL];
    const changed = store(zone, await tennet.latest(apiKey), false);
    zone.lastSuccessAt = at;
    prune(zone, at);
    return changed;
  }

  return {
    /**
     * Read one zone; throws a SourceError when its source fails.
     * @param {string} zone
     * @param {ReturnType<import('./config.js').normalizeConfig>} config
     * @returns {Promise<boolean>} a value changed
     */
    refresh(zone, config) {
      return zone === ZONE.BE ? refreshBelgium() : refreshNetherlands(config.tennet_api_key);
    },

    /** Forget a zone (the user turned it off). */
    clear(zone) {
      zones[zone] = newZone();
    },

    /** @param {string} zone */
    snapshot(zone) {
      const at = now();
      const { quarters, lastSuccessAt } = zones[zone];
      const start = quarterStart(at);
      const dayStart = marketDayStart(at);
      return {
        zone,
        at,
        current: quarters.get(start) ?? null,
        previous: quarters.get(start - QUARTER) ?? null,
        today: [...quarters.values()]
          .filter((quarter) => quarter.start >= dayStart && quarter.start <= start)
          .sort((a, b) => a.start - b.start),
        lastSuccessAt,
      };
    },
  };
}
