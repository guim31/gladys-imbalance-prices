// -----------------------------------------------------------------------------
// Integration configuration, from the `config_schema` of the manifest:
// defaults and normalization, so the rest of the code never deals with
// `undefined` or unknown values.
// -----------------------------------------------------------------------------

/** The languages every text carries, in this order. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const ZONE = { BE: 'be', NL: 'nl' };

// MUST match the `default` values of the manifest (test/manifest.test.js).
// The TenneT key has none: the Netherlands are off until one is entered.
export const DEFAULT_CONFIG = {
  belgium: true,
  tennet_api_key: '',
  language: 'fr',
};

/** @param {Record<string, unknown>} [raw] config returned by the SDK */
export function normalizeConfig(raw = {}) {
  const belgium = raw.belgium ?? DEFAULT_CONFIG.belgium;
  return {
    belgium: belgium === true || belgium === 'true',
    tennet_api_key: typeof raw.tennet_api_key === 'string' ? raw.tennet_api_key.trim() : '',
    language: LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_CONFIG.language,
  };
}

/** The zones to follow: Belgium when ticked, the Netherlands with a key. */
export function enabledZones(config) {
  const zones = [];
  if (config.belgium) {
    zones.push(ZONE.BE);
  }
  if (config.tennet_api_key) {
    zones.push(ZONE.NL);
  }
  return zones;
}
