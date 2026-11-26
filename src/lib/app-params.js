/**
 * App parameters – cleaned of Base44-specific tokens.
 * Used for local/standalone mode and future Directus integration.
 */

const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) {
    return defaultValue;
  }
  const storageKey = `meditrust_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam) {
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue !== undefined) {
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = storage.getItem(storageKey);
  if (storedValue) {
    return storedValue;
  }
  return null;
};

const getAppParams = () => {
  if (getAppParamValue("clear_access_token") === 'true') {
    storage.removeItem('meditrust_access_token');
    storage.removeItem('token');
  }
  return {
    // Kept for compatibility while we migrate to Directus
    appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_APP_ID || 'meditrust-local' }),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", { defaultValue: typeof window !== 'undefined' ? window.location.href : '' }),
    // Directus-ready placeholders
    directusUrl: import.meta.env.VITE_DIRECTUS_URL || '',
    directusToken: import.meta.env.VITE_DIRECTUS_TOKEN || '',
  };
};

export const appParams = {
  ...getAppParams()
};
