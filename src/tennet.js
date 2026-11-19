// -----------------------------------------------------------------------------
// TenneT (the Netherlands): "Balance Delta High Res" of the TenneT API
// (api.tennet.eu), which needs a free personal key from
// https://developer.tennet.eu (header `apikey`).
//
// `/latest` returns the last 30 minutes in 12-second points: the balancing
// power activated upward (`*_in`) and downward (`*_out`), in MW, and the
// highest upward, lowest downward and mid prices of the bids activated, in
// €/MWh. Fair use: 10 requests a minute at most; this integration asks once
// a minute. The settled imbalance prices (another API, 25 requests a day) come
// later: what is computed here is an indicative price.
//
// Per quarter-hour, like TenneT's regulation state: upward only (state 1) →
// the highest upward price; downward only (-1) → the lowest downward price;
// none (0) → the mid price; both (2) → the price of the net direction. The
// system imbalance is the mean of (downward - upward): positive = surplus, the
// sign Elia uses.
// -----------------------------------------------------------------------------

import { SourceError, networkReason } from './errors.js';
import { quarterStart } from './time.js';

const POINT_MS = 12 * 1000;
const LATEST_URL = 'https://api.tennet.eu/publications/v1/balance-delta-high-res/latest';
const UPWARD = [
  'power_afrr_in',
  'power_igcc_in',
  'power_mfrrda_in',
  'power_picasso_in',
  'power_mari_in',
];
const DOWNWARD = [
  'power_afrr_out',
  'power_igcc_out',
  'power_mfrrda_out',
  'power_picasso_out',
  'power_mari_out',
];

/** A number of the API (sent as a string, sometimes null). */
function num(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const sum = (point, keys) => keys.reduce((total, key) => total + (num(point[key]) ?? 0), 0);

/**
 * The indicative price and imbalance of one quarter-hour from its points.
 * @param {Array<object>} points
 * @returns {{ price: number, imbalance: number, state: number } | null}
 */
export function quarterFromPoints(points) {
  if (points.length === 0) {
    return null;
  }
  let upward = false;
  let downward = false;
  let net = 0;
  let maxUp = null;
  let minDown = null;
  let mid = null;
  for (const point of points) {
    const up = sum(point, UPWARD);
    const down = sum(point, DOWNWARD);
    upward ||= up > 0;
    downward ||= down > 0;
    net += down - up;
    const upPrice = num(point.max_upw_regulation_price);
    const downPrice = num(point.min_downw_regulation_price);
    if (upPrice !== null) {
      maxUp = maxUp === null ? upPrice : Math.max(maxUp, upPrice);
    }
    if (downPrice !== null) {
      minDown = minDown === null ? downPrice : Math.min(minDown, downPrice);
    }
    mid = num(point.mid_price) ?? mid;
  }
  const imbalance = net / points.length;
  let state = 0;
  if (upward && downward) {
    state = 2;
  } else if (upward) {
    state = 1;
  } else if (downward) {
    state = -1;
  }
  const short = state === 1 || (state === 2 && imbalance < 0);
  const long = state === -1 || (state === 2 && imbalance >= 0);
  const price = (short ? maxUp : long ? minDown : null) ?? mid;
  return price === null ? null : { price, imbalance, state };
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 */
export function createTennetClient({ fetch = globalThis.fetch, timeoutMs = 10000 } = {}) {
  return {
    /**
     * The quarter-hours of the last 30 minutes, oldest first.
     * @param {string} apiKey
     * @returns {Promise<Array<{ start: number, price: number, imbalance: number, state: number, minute: number, partial: boolean }>>}
     */
    async latest(apiKey) {
      let response;
      try {
        response = await fetch(LATEST_URL, {
          headers: { Accept: 'application/json', apikey: apiKey },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new SourceError(`TenneT unreachable (${networkReason(err)})`);
      }
      if (response.status === 401 || response.status === 403) {
        throw new SourceError(`TenneT refused the API key (HTTP ${response.status})`, {
          auth: true,
        });
      }
      if (!response.ok) {
        throw new SourceError(`TenneT answered HTTP ${response.status}`, {
          rateLimited: response.status === 429,
        });
      }
      let body;
      try {
        body = await response.json();
      } catch {
        throw new SourceError('TenneT answered something that is not JSON');
      }
      if (body?.error) {
        // "No data found": nothing published in the window.
        return [];
      }
      const series = body?.Response?.TimeSeries;
      if (!Array.isArray(series)) {
        throw new SourceError('TenneT answered an unexpected body');
      }
      const byQuarter = new Map();
      for (const period of series.flatMap((s) => s.Period ?? [])) {
        for (const point of period.points ?? []) {
          const at = Date.parse(point.timeInterval_start);
          if (!Number.isFinite(at)) {
            continue;
          }
          const start = quarterStart(at);
          if (!byQuarter.has(start)) {
            byQuarter.set(start, []);
          }
          byQuarter.get(start).push({ ...point, at });
        }
      }
      const quarters = [];
      const oldest = Math.min(...byQuarter.keys());
      for (const [start, points] of byQuarter) {
        const quarter = quarterFromPoints(points);
        if (quarter) {
          const ats = points.map((p) => p.at);
          quarters.push({
            start,
            ...quarter,
            minute: Math.max(...ats),
            // The window began after this quarter-hour did: its value is
            // computed on part of it only.
            partial: start === oldest && Math.min(...ats) - start >= POINT_MS,
          });
        }
      }
      return quarters.sort((a, b) => a.start - b.start);
    },
  };
}
