// -----------------------------------------------------------------------------
// Every text the integration shows, in the four languages of the Gladys
// interface (en, fr, de, es). German says "du", Spanish says "usted", like
// the rest of guim31's integrations. Brands (Elia, TenneT) are not translated.
//
//   - NAMES / DEVICE_NAMES / DIRECTIONS : by language, frozen when the user
//                                         adds a device (config `language`);
//   - ZONE_LABELS, TEXT                 : fixed four-language texts;
//   - MESSAGES                          : texts built from values.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages.
// -----------------------------------------------------------------------------

/** Feature names, by language then feature key (≤ 40 characters). */
export const NAMES = {
  en: {
    price_mwh: 'Quarter-hour price (€/MWh)',
    price_kwh: 'Quarter-hour price (€/kWh)',
    previous_price_mwh: 'Previous quarter-hour price (€/MWh)',
    system_imbalance: 'System imbalance (MW)',
    direction: 'Imbalance direction',
    quarter_hour: 'Current quarter-hour',
  },
  fr: {
    price_mwh: "Prix du quart d'heure (€/MWh)",
    price_kwh: "Prix du quart d'heure (€/kWh)",
    previous_price_mwh: "Prix quart d'heure précédent (€/MWh)",
    system_imbalance: 'Déséquilibre du système (MW)',
    direction: 'Sens du déséquilibre',
    quarter_hour: "Quart d'heure en cours",
  },
  de: {
    price_mwh: 'Viertelstundenpreis (€/MWh)',
    price_kwh: 'Viertelstundenpreis (€/kWh)',
    previous_price_mwh: 'Preis vorige Viertelstunde (€/MWh)',
    system_imbalance: 'Systemungleichgewicht (MW)',
    direction: 'Richtung des Ungleichgewichts',
    quarter_hour: 'Aktuelle Viertelstunde',
  },
  es: {
    price_mwh: 'Precio del cuarto de hora (€/MWh)',
    price_kwh: 'Precio del cuarto de hora (€/kWh)',
    previous_price_mwh: 'Precio cuarto de hora anterior (€/MWh)',
    system_imbalance: 'Desequilibrio del sistema (MW)',
    direction: 'Sentido del desequilibrio',
    quarter_hour: 'Cuarto de hora actual',
  },
};

/** Device names, by language then zone (≤ 40 characters). */
export const DEVICE_NAMES = {
  en: { be: 'Imbalance price Belgium', nl: 'Imbalance price Netherlands' },
  fr: { be: 'Prix de déséquilibre Belgique', nl: 'Prix de déséquilibre Pays-Bas' },
  de: { be: 'Ausgleichspreis Belgien', nl: 'Ausgleichspreis Niederlande' },
  es: { be: 'Precio de desvío Bélgica', nl: 'Precio de desvío Países Bajos' },
};

/** The state of the "direction" text feature, by language. */
export const DIRECTIONS = {
  en: { surplus: 'Surplus', deficit: 'Shortage', balanced: 'Balanced' },
  fr: { surplus: 'Surplus', deficit: 'Déficit', balanced: 'Équilibre' },
  de: { surplus: 'Überschuss', deficit: 'Defizit', balanced: 'Ausgeglichen' },
  es: { surplus: 'Excedente', deficit: 'Déficit', balanced: 'Equilibrio' },
};

export const ZONE_LABELS = {
  be: { en: 'Belgium (Elia)', fr: 'Belgique (Elia)', de: 'Belgien (Elia)', es: 'Bélgica (Elia)' },
  nl: {
    en: 'Netherlands (TenneT)',
    fr: 'Pays-Bas (TenneT)',
    de: 'Niederlande (TenneT)',
    es: 'Países Bajos (TenneT)',
  },
};

export const TEXT = {
  caption: {
    en: 'Imbalance price of the running quarter-hour, estimated minute by minute',
    fr: "Prix de déséquilibre du quart d'heure en cours, estimé minute par minute",
    de: 'Ausgleichsenergiepreis der laufenden Viertelstunde, minütlich geschätzt',
    es: 'Precio de desvío del cuarto de hora en curso, estimado minuto a minuto',
  },
  noData: {
    en: 'No imbalance price yet: check the configuration of the integration.',
    fr: "Pas encore de prix de déséquilibre : vérifiez la configuration de l'intégration.",
    de: 'Noch kein Ausgleichsenergiepreis: Prüfe die Konfiguration der Integration.',
    es: 'Todavía no hay precio de desvío: compruebe la configuración de la integración.',
  },
  previous: { en: 'Previous', fr: 'Précédent', de: 'Vorherige', es: 'Anterior' },
  imbalance: { en: 'Imbalance', fr: 'Déséquilibre', de: 'Ungleichgewicht', es: 'Desequilibrio' },
  noZone: {
    en: 'No zone to follow: tick Belgium or enter a TenneT API key.',
    fr: 'Aucune zone suivie : cochez la Belgique ou saisissez une clé API TenneT.',
    de: 'Keine Zone ausgewählt: Wähle Belgien oder gib einen TenneT-API-Schlüssel ein.',
    es: 'Ninguna zona seguida: marque Bélgica o introduzca una clave API de TenneT.',
  },
  eliaFailed: {
    en: 'Elia Open Data does not answer: Belgian prices are not updated.',
    fr: 'Elia Open Data ne répond pas : les prix belges ne sont plus à jour.',
    de: 'Elia Open Data antwortet nicht: Die belgischen Preise werden nicht aktualisiert.',
    es: 'Elia Open Data no responde: los precios belgas no se actualizan.',
  },
  tennetKey: {
    en: 'TenneT refuses the API key: check it in the configuration.',
    fr: 'TenneT refuse la clé API : vérifiez-la dans la configuration.',
    de: 'TenneT lehnt den API-Schlüssel ab: Prüfe ihn in der Konfiguration.',
    es: 'TenneT rechaza la clave API: compruébela en la configuración.',
  },
  tennetFailed: {
    en: 'The TenneT API does not answer: Dutch prices are not updated.',
    fr: "L'API TenneT ne répond pas : les prix néerlandais ne sont plus à jour.",
    de: 'Die TenneT-API antwortet nicht: Die niederländischen Preise werden nicht aktualisiert.',
    es: 'La API de TenneT no responde: los precios neerlandeses no se actualizan.',
  },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
    de: 'Die Integration konnte nicht starten: Sieh dir ihre Protokolle an.',
    es: 'La integración no ha podido iniciarse: consulte sus registros.',
  },
};

/** Pick a language, English when unknown. */
export function pick(text, language) {
  return text[language] ?? text.en;
}

/** One text per language, from a function of the language. */
const each = (build) => Object.fromEntries(['en', 'fr', 'de', 'es'].map((l) => [l, build(l)]));

/** "195.05" in English, "195,05" elsewhere. */
export function formatPrice(value, language) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const CHECK = {
  en: (zone, price, time) => `${zone}: ${price} €/MWh at ${time}.`,
  fr: (zone, price, time) => `${zone} : ${price} €/MWh à ${time}.`,
  de: (zone, price, time) => `${zone}: ${price} €/MWh um ${time}.`,
  es: (zone, price, time) => `${zone}: ${price} €/MWh a las ${time}.`,
};

const PENDING = {
  en: (zone) => `${zone}: answers, no price for the running quarter-hour yet.`,
  fr: (zone) => `${zone} : répond, pas encore de prix pour le quart d'heure en cours.`,
  de: (zone) => `${zone}: antwortet, noch kein Preis für die laufende Viertelstunde.`,
  es: (zone) => `${zone}: responde, aún sin precio para el cuarto de hora en curso.`,
};

export const MESSAGES = {
  /**
   * The result of the "check" action, one sentence per zone.
   * @param {Array<{ zone: string, price?: number, time?: string, error?: object }>} results
   */
  checked(results) {
    return each((language) =>
      results
        .map(({ zone, price, time, error }) => {
          const label = pick(ZONE_LABELS[zone], language);
          if (error) {
            return pick(error, language);
          }
          return price === undefined
            ? PENDING[language](label)
            : CHECK[language](label, formatPrice(price, language), time);
        })
        .join(' '),
    );
  },

  /** Several problems in one connection status. */
  join(texts) {
    return each((language) => texts.map((text) => text[language]).join(' '));
  },
};
