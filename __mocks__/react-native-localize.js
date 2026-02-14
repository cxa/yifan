const getLocales = () => [
  {
    countryCode: 'US',
    isRTL: false,
    languageCode: 'en',
    languageTag: 'en-US',
  },
];

const findBestLanguageTag = supportedLocales => {
  if (!Array.isArray(supportedLocales) || supportedLocales.length === 0) {
    return null;
  }

  const matched = supportedLocales.includes('en-US')
    ? 'en-US'
    : supportedLocales[0];

  return {
    languageTag: matched,
    isRTL: false,
  };
};

const listeners = new Set();

const addEventListener = (_event, handler) => {
  if (typeof handler === 'function') {
    listeners.add(handler);
  }
  return {
    remove: () => {
      listeners.delete(handler);
    },
  };
};

const removeEventListener = (_event, handler) => {
  listeners.delete(handler);
};

module.exports = {
  addEventListener,
  findBestLanguageTag,
  getLocales,
  removeEventListener,
};
