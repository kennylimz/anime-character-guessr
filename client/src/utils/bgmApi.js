const STORAGE_KEY = 'enableBgmAccel';
const ACCEL_DEFAULT_HOST = 'ccb.baka.website';
const OFFICIAL_BGM_API_URL = 'https://api.bgm.tv';

const DEFAULT_BGM_API_URL = import.meta.env.VITE_BGM_API_URL || OFFICIAL_BGM_API_URL;
const ACCEL_BGM_API_URL = import.meta.env.VITE_BGM_ACC_API_URL || '';

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function getHostDefaultEnabled() {
  try {
    return window.location.hostname === ACCEL_DEFAULT_HOST;
  } catch {
    return false;
  }
}

export function hasBgmAccelUrl() {
  return Boolean(ACCEL_BGM_API_URL);
}

export function isBgmAccelEnabled() {
  if (!ACCEL_BGM_API_URL) return false;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    // Fall through to host default
  }
  return getHostDefaultEnabled();
}

export function setBgmAccelEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
}

/** Enable accel after official Bangumi API looks blocked. Returns true if accel is available. */
export function enableBgmAccelAfterBlock() {
  if (!ACCEL_BGM_API_URL) return false;
  setBgmAccelEnabled(true);
  return true;
}

export function isOfficialBgmUrl(url) {
  if (!url) return false;
  const bases = new Set([
    normalizeBaseUrl(DEFAULT_BGM_API_URL),
    OFFICIAL_BGM_API_URL,
  ]);
  for (const base of bases) {
    if (url.startsWith(base)) return true;
  }
  return false;
}

/** Rewrite an official Bangumi API URL to the accel mirror, or null if not applicable. */
export function toAccelBgmUrl(url) {
  if (!ACCEL_BGM_API_URL || !url) return null;
  const accel = normalizeBaseUrl(ACCEL_BGM_API_URL);
  const bases = new Set([
    normalizeBaseUrl(DEFAULT_BGM_API_URL),
    OFFICIAL_BGM_API_URL,
  ]);
  for (const base of bases) {
    if (url.startsWith(base)) {
      return accel + url.slice(base.length);
    }
  }
  return null;
}

/** Active Bangumi API base URL (official or accelerated mirror). */
export function getBgmApiUrl() {
  if (ACCEL_BGM_API_URL && isBgmAccelEnabled()) {
    return normalizeBaseUrl(ACCEL_BGM_API_URL);
  }
  return normalizeBaseUrl(DEFAULT_BGM_API_URL);
}
