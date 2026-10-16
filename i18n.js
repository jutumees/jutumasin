// Language selection and translation lookup. Content lives only in locales/*.js.
window.I18n = (() => {
  const locales = window.JUTUMASIN_LOCALES;
  const storageKey = 'jutumasin.language';
  let language = 'et';
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(locales, saved)) language = saved;
  } catch (_) { /* The game remains usable when browser storage is disabled. */ }

  const cards = {};
  const legacyCards = new Map();
  for (const [code, locale] of Object.entries(locales)) {
    cards[code] = new Map();
    for (const [deck, entries] of Object.entries(locale.decks)) {
      for (const card of entries) {
        cards[code].set(card.id, card);
        legacyCards.set(`${deck}|${card.title}|${card.desc}`, card.id);
      }
    }
  }

  function t(key, values = {}) {
    return locales[language].ui[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
  }

  function identify(card) {
    if (card.id) return card.id;
    if (card.__deck) return legacyCards.get(`${card.__deck}|${card.title}|${card.desc}`);
    for (const deck of Object.keys(locales.et.decks)) {
      const id = legacyCards.get(`${deck}|${card.title}|${card.desc}`);
      if (id) return id;
    }
  }

  function migrate(card) {
    const id = identify(card);
    if (id) card.id = id;
    return card;
  }

  function cardText(card) {
    const id = identify(card);
    // Retired cards in old saves retain their original snapshot, never lose data.
    return cards[language].get(id) || card;
  }

  function apply() {
    document.documentElement.lang = language;
    window.AndroidApp?.setLanguage?.(language);
    document.querySelectorAll('[data-i18n]').forEach(node => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-label]').forEach(node => {
      node.setAttribute('aria-label', t(node.dataset.i18nLabel));
    });
    const toggle = document.getElementById('languageToggle');
    toggle.lang = language === 'et' ? 'en' : 'et';
    document.querySelectorAll('[data-app-version]').forEach(node => {
      node.textContent = t('version', window.APP_VERSION);
    });
  }

  function setLanguage(code) {
    if (!Object.hasOwn(locales, code)) throw new Error(`Unsupported language: ${code}`);
    language = code;
    try { localStorage.setItem(storageKey, code); } catch (_) { /* Session-only selection. */ }
    apply();
  }

  return {t, cardText, migrate, apply, setLanguage, get language() { return language; }};
})();
