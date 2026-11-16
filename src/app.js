// -----------------------------------------------------------------------------
// The integration: registers every SDK handler on a GladysIntegration (or the
// SDK's fake Gladys in the tests) and runs the refresh cycle, so index.js stays
// a few lines and the tests drive the very same wiring.
//
// One cycle a minute, on the container's own timer, 20 s past the minute
// (Elia publishes a minute about a minute later; the core's onPoll is only a
// fallback, Gladys#3198):
//   1. read each zone followed (Elia, TenneT);
//   2. publish the states of the devices the user added — only the values
//      that changed, plus a heartbeat (the SDK deduplicates);
//   3. fire the scene triggers the running price crosses.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { enabledZones, normalizeConfig, ZONE } from './config.js';
import { buildDevice, buildStates, deviceIds } from './device.js';
import { ActionFailure } from './errors.js';
import { MESSAGES, TEXT } from './i18n.js';
import { createIssueLog } from './issues.js';
import { createMarket } from './market.js';
import { MINUTE, marketTime } from './time.js';
import { createTriggerWatch } from './triggers.js';
import { buildPricesContent, WIDGET } from './widget.js';

const logger = createLogger({ name: 'imbalance-prices' });

// A value that does not change is sent again every 6 hours: without a recent
// value, Gladys shows "no recent value".
export const HEARTBEAT_MS = 6 * 60 * MINUTE;
// The core's onPoll runs a cycle only when the timer missed one.
const POLL_FALLBACK_MS = 90 * 1000;
const TIMER_OFFSET_MS = 20 * 1000;
const SOURCE = { [ZONE.BE]: 'Elia', [ZONE.NL]: 'TenneT' };

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the minute timer
 */
export function createApp(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  const market = createMarket({ fetch: options.fetch, now });
  const issues = createIssueLog(logger);
  const watch = createTriggerWatch();
  const timers = options.timers ?? true;

  let config = normalizeConfig();
  let timer = null;
  let stopped = false;
  let running = null;
  let lastCycleAt = null;
  let lastStatus = null;
  let initialized = false;
  // Per zone: the last failure (a SourceError), null when it answers.
  const failures = new Map();
  const announced = new Set();

  const created = (zone) =>
    (gladys.devices ?? []).some((device) => device.external_id === deviceIds(gladys, zone).device);

  async function setStatus(connected, message) {
    const key = JSON.stringify([connected, message ?? null]);
    if (key === lastStatus) {
      return;
    }
    try {
      await gladys.setConnectionStatus(connected, message);
      lastStatus = key;
    } catch (err) {
      // Sent again on the next cycle.
      logger.debug(`Connection status not sent (${err.message})`);
    }
  }

  /** The connection status says what fails, in the four languages. */
  async function updateStatus() {
    const zones = enabledZones(config);
    if (zones.length === 0) {
      await setStatus(false, TEXT.noZone);
      return;
    }
    const problems = zones
      .filter((zone) => failures.get(zone))
      .map((zone) => {
        if (zone === ZONE.BE) {
          return TEXT.eliaFailed;
        }
        return failures.get(zone).auth ? TEXT.tennetKey : TEXT.tennetFailed;
      });
    if (problems.length === 0) {
      await setStatus(true);
    } else {
      await setStatus(false, MESSAGES.join(problems));
    }
  }

  /** Nudge the open dashboards; dropped silently while disconnected. */
  function refreshWidget() {
    try {
      gladys.requestWidgetRefresh(WIDGET.PRICES);
    } catch (err) {
      logger.debug(`Widget refresh not sent (${err.message})`);
    }
  }

  /** Read one zone; returns true when a value changed. */
  async function refreshZone(zone) {
    const source = SOURCE[zone];
    try {
      const changed = await market.refresh(zone, config);
      failures.set(zone, null);
      if (!announced.has(zone)) {
        announced.add(zone);
        logger.info(`${source} reachable`);
      }
      issues.ok(zone, `${source} answers again`);
      return changed;
    } catch (err) {
      failures.set(zone, err);
      issues.fail(zone, `${source} refresh failed (${err.message}), last values kept`);
      return false;
    }
  }

  async function publishStates(zone) {
    if (!created(zone)) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(
        buildStates(gladys, market.snapshot(zone), config),
        { heartbeat: HEARTBEAT_MS },
      );
      if (count > 0) {
        logger.debug(`${zone}: ${count} state(s) published`);
      }
      issues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      issues.fail('states', `Publishing the states failed (${err.message})`);
    }
  }

  async function fireSceneEvents(zone) {
    const { current, at } = market.snapshot(zone);
    if (!current) {
      return;
    }
    for (const event of watch.evaluate(zone, current, at)) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        logger.debug(`Scene event ${event.key} (${zone}, ${event.data.price} €/MWh)`);
        issues.ok('scene', 'Scene events accepted by Gladys again');
      } catch (err) {
        issues.fail('scene', `Firing the scene event ${event.key} failed (${err.message})`);
      }
    }
  }

  async function runCycle() {
    lastCycleAt = now();
    let changed = false;
    const zones = enabledZones(config);
    for (const zone of zones) {
      changed = (await refreshZone(zone)) || changed;
    }
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: nothing published');
      return;
    }
    await updateStatus();
    for (const zone of zones) {
      await publishStates(zone);
      await fireSceneEvents(zone);
    }
    if (changed) {
      refreshWidget();
    }
  }

  /** One cycle at a time: a second caller waits for the one in progress. */
  async function cycle() {
    if (running) {
      return running;
    }
    running = runCycle();
    try {
      return await running;
    } finally {
      running = null;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    const delay = MINUTE - ((now() - TIMER_OFFSET_MS) % MINUTE);
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Refresh cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, delay);
  }

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(
      enabledZones(config).map((zone) => buildDevice(gladys, zone, config)),
    );
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    logger.debug('onScanRequest -> publishing the devices');
    await publishDevices();
  });

  gladys.onPoll(async () => {
    if (!initialized) {
      return;
    }
    if (lastCycleAt !== null && now() - lastCycleAt < POLL_FALLBACK_MS) {
      logger.debug('onPoll skipped: the timer is running');
      return;
    }
    await cycle();
  });

  // A device was just added: the SDK forgot what it had published (Gladys
  // drops the states of a feature that did not exist yet), send it all now.
  const onDeviceChange = async () => {
    for (const zone of enabledZones(config)) {
      await publishStates(zone);
    }
    refreshWidget();
  };
  gladys.onDeviceCreated(onDeviceChange);
  gladys.onDeviceUpdated(onDeviceChange);
  gladys.onDeviceDeleted(async () => refreshWidget());

  gladys.onAction('check', async () => {
    logger.info('Action check <- reading the sources now');
    const zones = enabledZones(config);
    if (zones.length === 0) {
      throw new ActionFailure(TEXT.noZone);
    }
    await running?.catch(() => {});
    await cycle();
    const results = zones.map((zone) => {
      const failure = failures.get(zone);
      if (failure) {
        const error =
          zone === ZONE.BE ? TEXT.eliaFailed : failure.auth ? TEXT.tennetKey : TEXT.tennetFailed;
        return { zone, error };
      }
      const { current } = market.snapshot(zone);
      return current ? { zone, price: current.price, time: marketTime(current.start) } : { zone };
    });
    const message = MESSAGES.checked(results);
    if (results.some((result) => result.error)) {
      throw new ActionFailure(message);
    }
    return message;
  });

  gladys.onWidgetGet(WIDGET.PRICES, async ({ language, settings }) =>
    buildPricesContent({
      snapshots: enabledZones(config).map((zone) => market.snapshot(zone)),
      language,
      settings,
    }),
  );

  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration updated');
    const before = enabledZones(config);
    config = normalizeConfig(newConfig);
    for (const zone of before) {
      if (!enabledZones(config).includes(zone)) {
        market.clear(zone);
        watch.forget(zone);
        failures.delete(zone);
      }
    }
    // Another language: the direction text changes; send everything again.
    gladys.forgetPublishedStates();
    await publishDevices();
    await cycle();
    refreshWidget();
  });

  gladys.on('connected', async () => {
    try {
      // Whatever was shown before the connection dropped, say it again.
      lastStatus = null;
      config = normalizeConfig(await gladys.getConfig());
      initialized = true;
      await publishDevices();
      stopped = false;
      schedule();
      await cycle();
      // The nudges sent while the socket was down were dropped.
      refreshWidget();
    } catch (err) {
      logger.error(`Post-connection initialization failed (${err.message})`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  return {
    market,
    cycle,
    get config() {
      return config;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
