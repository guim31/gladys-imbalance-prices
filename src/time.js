// -----------------------------------------------------------------------------
// The market clock. Elia and TenneT settle the imbalance per quarter-hour, and
// Belgium and the Netherlands share one clock (Europe/Brussels =
// Europe/Amsterdam): "today" and the times shown are on it, whatever the time
// zone of the Gladys host. Quarter-hours are UTC multiples of 15 minutes (the
// offsets of the zone are whole hours).
// -----------------------------------------------------------------------------

export const MARKET_TIMEZONE = 'Europe/Brussels';
export const MINUTE = 60 * 1000;
export const QUARTER = 15 * MINUTE;

/** Start of the quarter-hour holding `ms`, in ms. */
export const quarterStart = (ms) => Math.floor(ms / QUARTER) * QUARTER;

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: MARKET_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parts(ms) {
  const out = {};
  for (const { type, value } of partsFormat.formatToParts(new Date(ms))) {
    out[type] = Number(value);
  }
  return out;
}

/** Offset of the market clock from UTC at `ms`, in ms. */
function offset(ms) {
  const p = parts(ms);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** "HH:MM" on the market clock. */
export function marketTime(ms) {
  const p = parts(ms);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** UTC ms of the market midnight that starts the day holding `ms`. */
export function marketDayStart(ms) {
  const p = parts(ms);
  const midnight = Date.UTC(p.year, p.month - 1, p.day);
  // Twice: the offset at midnight may differ from the offset at `ms` (DST).
  return midnight - offset(midnight - offset(midnight));
}
