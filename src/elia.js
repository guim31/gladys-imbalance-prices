// -----------------------------------------------------------------------------
// Elia Open Data (Belgium), public and without key.
//
//   ods161  "Imbalance prices per minute (Near real-time)": one record a
//           minute, `quarterhour` + the price and system imbalance of that
//           quarter-hour computed on the minutes elapsed so far; the record of
//           minute 14 is the value of the whole quarter-hour. About a minute
//           late.
//   ods162  "Imbalance prices per quarter-hour (Near real-time)": the
//           quarter-hours of the current day, published when they close.
//
// The system imbalance is in MW, positive when the zone has a surplus. The
// datasets ods046/ods047 stop in May 2024; ods133/ods134 hold the history
// since then (one day late), not needed here.
// -----------------------------------------------------------------------------

import { SourceError, networkReason } from './errors.js';

const BASE = 'https://opendata.elia.be/api/explore/v2.1/catalog/datasets';
export const DATASET = { MINUTES: 'ods161', QUARTERS: 'ods162' };
const FIELDS = 'datetime,systemimbalance,imbalanceprice';

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 */
export function createEliaClient({ fetch = globalThis.fetch, timeoutMs = 10000 } = {}) {
  async function get(dataset, params) {
    const url = new URL(`${BASE}/${dataset}/records`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    let response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new SourceError(`Elia unreachable (${networkReason(err)})`);
    }
    if (!response.ok) {
      throw new SourceError(`Elia answered HTTP ${response.status}`, {
        rateLimited: response.status === 429,
      });
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new SourceError('Elia answered something that is not JSON');
    }
    if (!Array.isArray(body?.results)) {
      throw new SourceError('Elia answered an unexpected body');
    }
    return body.results;
  }

  return {
    /**
     * The last 30 minutes, one entry per quarter-hour (its latest minute),
     * oldest first.
     * @returns {Promise<Array<{ start: number, price: number, imbalance: number|null, minute: number }>>}
     */
    async minutes() {
      const records = await get(DATASET.MINUTES, {
        limit: 30,
        order_by: 'datetime desc',
        select: `quarterhour,${FIELDS}`,
      });
      const quarters = new Map();
      for (const record of records) {
        const start = Date.parse(record.quarterhour);
        const minute = Date.parse(record.datetime);
        const price = finite(record.imbalanceprice);
        if (!Number.isFinite(start) || !Number.isFinite(minute) || price === null) {
          continue;
        }
        const known = quarters.get(start);
        if (!known || minute > known.minute) {
          quarters.set(start, {
            start,
            price,
            imbalance: finite(record.systemimbalance),
            minute,
          });
        }
      }
      return [...quarters.values()].sort((a, b) => a.start - b.start);
    },

    /**
     * The closed quarter-hours since `fromMs`, oldest first.
     * @param {number} fromMs
     * @returns {Promise<Array<{ start: number, price: number, imbalance: number|null }>>}
     */
    async quarters(fromMs) {
      const records = await get(DATASET.QUARTERS, {
        limit: 100,
        order_by: 'datetime asc',
        where: `datetime >= "${new Date(fromMs).toISOString()}"`,
        select: FIELDS,
      });
      return records
        .map((record) => ({
          start: Date.parse(record.datetime),
          price: finite(record.imbalanceprice),
          imbalance: finite(record.systemimbalance),
        }))
        .filter((quarter) => Number.isFinite(quarter.start) && quarter.price !== null);
    },
  };
}
