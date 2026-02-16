const PROTECTED_PREFIXES = [
  'sb-',          // Supabase auth tokens
  'theme',        // Dark mode
  'fontSize',     // Font size
  'language',     // Language
  'autoLogin',    // Auto login
  'medAlarmTime', // Medication alarm
  'defaultPetId', // Default pet
  'highContrast', // High contrast
  'notify_',      // Notification settings
];

const CACHE_TIMESTAMP_KEY = 'cache_timestamps';
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

interface CacheTimestamps {
  [key: string]: number; // key → timestamp (ms)
}

function getTimestamps(): CacheTimestamps {
  try {
    const raw = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTimestamps(timestamps: CacheTimestamps) {
  localStorage.setItem(CACHE_TIMESTAMP_KEY, JSON.stringify(timestamps));
}

function isProtected(key: string): boolean {
  return key === CACHE_TIMESTAMP_KEY || PROTECTED_PREFIXES.some(p => key.startsWith(p));
}

/**
 * Track a localStorage item for cache management.
 * Call this when setting non-protected cache items.
 */
export function trackCacheItem(key: string) {
  if (isProtected(key)) return;
  const timestamps = getTimestamps();
  if (!timestamps[key]) {
    timestamps[key] = Date.now();
    saveTimestamps(timestamps);
  }
}

/**
 * Run on app load: remove cache items older than 6 months.
 * Protected keys (auth, settings) are never removed.
 */
export function cleanupOldCache() {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const timestamps = getTimestamps();
  let changed = false;

  // 1) Clean tracked items older than 6 months
  for (const [key, ts] of Object.entries(timestamps)) {
    if (isProtected(key)) {
      delete timestamps[key];
      changed = true;
      continue;
    }
    if (now - ts > SIX_MONTHS_MS) {
      localStorage.removeItem(key);
      delete timestamps[key];
      changed = true;
    }
  }

  // 2) Register untracked non-protected items so they'll be cleaned next cycle
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || isProtected(key) || timestamps[key]) continue;
    timestamps[key] = now;
    changed = true;
  }

  if (changed) saveTimestamps(timestamps);
}
