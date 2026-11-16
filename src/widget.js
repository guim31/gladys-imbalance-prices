// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): the imbalance prices of
// the zones followed.
//
// Inline values, not device-bound tiles: the widget works before the devices
// are added, and shows "€/MWh" where a device tile could only say "€".
// Within the core budget (8 components, 2 texts):
//   caption   what the price is (the running estimate)
//   values    one tile per zone: the price of the running quarter-hour
//   chart     the quarter-hours of the day, one line per zone (setting
//             `show_chart`)
//   status    per zone: the previous quarter-hour, the system imbalance
// -----------------------------------------------------------------------------

import { WIDGET_CHART_TYPES, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { direction, roundMwh } from './device.js';
import { DIRECTIONS, formatPrice, pick, TEXT, ZONE_LABELS } from './i18n.js';
import { marketTime } from './time.js';

export const WIDGET = { PRICES: 'prices' };

const priceColor = (price) =>
  price < 0 ? WIDGET_COLORS.SUCCESS : price > 300 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.INFO;

/**
 * @param {object} options
 * @param {Array<ReturnType<ReturnType<import('./market.js').createMarket>['snapshot']>>} options.snapshots
 * @param {string} options.language the user's language, sent by the core
 * @param {{ show_chart?: boolean }} [options.settings]
 */
export function buildPricesContent({ snapshots, language, settings = {} }) {
  const t = (text) => pick(text, language);
  const known = snapshots.filter((s) => s.current || s.previous || s.today.length > 0);
  // The data change every minute (about 20 s after it).
  const ttl_seconds = 60;

  if (known.length === 0) {
    return { ttl_seconds, components: [{ type: 'text', variant: 'body', text: t(TEXT.noData) }] };
  }

  const components = [{ type: 'text', variant: 'caption', text: t(TEXT.caption) }];
  for (const snapshot of known) {
    if (snapshot.current) {
      components.push({
        type: 'value',
        // ≤ 24 characters: the time of the quarter-hour goes in the status.
        label: t(ZONE_LABELS[snapshot.zone]),
        value: roundMwh(snapshot.current.price),
        unit: '€/MWh',
        icon: 'zap',
        color: priceColor(snapshot.current.price),
      });
    }
  }

  if (settings.show_chart !== false) {
    const series = known
      .filter((s) => s.today.length > 0)
      .map((s) => ({
        name: t(ZONE_LABELS[s.zone]),
        points: s.today.map((q) => ({ t: new Date(q.start).toISOString(), v: roundMwh(q.price) })),
      }));
    if (series.length > 0) {
      components.push({
        type: 'chart',
        chart_type: WIDGET_CHART_TYPES.STEPLINE,
        unit: '€/MWh',
        series,
        now_marker: true,
      });
    }
  }

  const items = [];
  const directions = DIRECTIONS[language] ?? DIRECTIONS.en;
  for (const snapshot of known) {
    const zone = snapshot.zone.toUpperCase();
    const { previous, current } = snapshot;
    if (previous) {
      items.push({
        label: `${zone} · ${t(TEXT.previous)} ${marketTime(previous.start)}`,
        value: `${formatPrice(previous.price, language)} €/MWh`,
        icon: 'clock',
        color: priceColor(previous.price),
      });
    }
    if (current && current.imbalance !== null) {
      const mw = Math.round(current.imbalance);
      items.push({
        label: `${zone} · ${t(TEXT.imbalance)} ${marketTime(current.start)}`,
        value: `${mw > 0 ? '+' : ''}${mw} MW (${directions[direction(current.imbalance)]})`,
        icon: 'activity',
        color: WIDGET_COLORS.NEUTRAL,
      });
    }
  }
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }

  return { ttl_seconds, components };
}
