const PRODUCTS_KEY = 'mona_products_cache';
const SETTINGS_KEY = 'mona_settings_cache';
const QUEUE_KEY = 'mona_pending_sales';

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const cacheProducts = (products) => write(PRODUCTS_KEY, products);
export const getCachedProducts = () => read(PRODUCTS_KEY, []);
export const cacheSettings = (settings) => write(SETTINGS_KEY, settings);
export const getCachedSettings = () => read(SETTINGS_KEY, null);

export const getOfflineQueue = () => read(QUEUE_KEY, []);
const newOfflineId = () => globalThis.crypto?.randomUUID?.() || `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const getPendingSales = () => {
  const queue = getOfflineQueue();
  let changed = false;
  const normalized = queue.map((sale) => {
    if (sale.payload?.offlineId) return sale;
    changed = true;
    return { ...sale, payload: { ...sale.payload, offlineId: newOfflineId() } };
  });
  if (changed) write(QUEUE_KEY, normalized);
  return normalized.filter((sale) => sale.status !== 'failed');
};
export const getFailedSales = () => getOfflineQueue().filter((sale) => sale.status === 'failed');

export const queueSale = (payload) => {
  const pending = getOfflineQueue();
  const queuedSale = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
    payload: { ...payload, offlineId: payload.offlineId || newOfflineId() },
  };
  write(QUEUE_KEY, [...pending, queuedSale]);
  window.dispatchEvent(new Event('offline_queue_changed'));
  return queuedSale;
};

export const removePendingSale = (id) => {
  write(QUEUE_KEY, getOfflineQueue().filter((sale) => sale.id !== id));
  window.dispatchEvent(new Event('offline_queue_changed'));
};

export const markSaleFailed = (id, error) => {
  write(QUEUE_KEY, getOfflineQueue().map((sale) => sale.id === id
    ? { ...sale, status: 'failed', attempts: (sale.attempts || 0) + 1, lastError: error, failedAt: new Date().toISOString() }
    : sale));
  window.dispatchEvent(new Event('offline_queue_changed'));
};

export const retryFailedSale = (id) => {
  write(QUEUE_KEY, getOfflineQueue().map((sale) => sale.id === id
    ? { ...sale, status: 'pending', lastError: null }
    : sale));
  window.dispatchEvent(new Event('offline_queue_changed'));
};

export const retryFailedSales = () => {
  write(QUEUE_KEY, getOfflineQueue().map((sale) => sale.status === 'failed'
    ? { ...sale, status: 'pending', lastError: null }
    : sale));
  window.dispatchEvent(new Event('offline_retry_requested'));
  window.dispatchEvent(new Event('offline_queue_changed'));
};

export const isNetworkError = (error) => !navigator.onLine || !error?.status;
