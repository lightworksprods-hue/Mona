const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const DEVICE_ID_KEY = 'mona_device_id';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('pos_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(localStorage.getItem(DEVICE_ID_KEY) ? { 'X-Device-ID': localStorage.getItem(DEVICE_ID_KEY) } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Unable to parse server response.',
  }));

  if (!response.ok) {
    if (response.status === 401) {
      // Clear token if expired or unauthorized
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.dispatchEvent(new Event('auth_change'));
    }
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),
  createUser: (userData) => request('/auth/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateUser: (id, userData) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) }),
  getDevices: () => request('/auth/devices'),
  updateDevice: (id, deviceData) => request(`/auth/devices/${id}`, { method: 'PUT', body: JSON.stringify(deviceData) }),

  // Products & Barcode Scanner
  generateBarcode: () => request('/products/barcode/generate'),
  lookupBarcode: (code) => request(`/products/barcode/${encodeURIComponent(code)}`),
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getProductById: (id) => request(`/products/${id}`),
  createProduct: (product) => request('/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id, product) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request('/categories'),
  createCategory: (cat) => request('/categories', { method: 'POST', body: JSON.stringify(cat) }),
  updateCategory: (id, cat) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(cat) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Sales & Checkout
  checkout: (payload) => request('/sales/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  getSales: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    const qs = new URLSearchParams(cleanParams).toString();
    return request(`/sales${qs ? `?${qs}` : ''}`);
  },
  getSaleById: (id) => request(`/sales/${id}`),
  processRefund: (payload) => request('/sales/refund', { method: 'POST', body: JSON.stringify(payload) }),

  // Cash drawer reconciliation
  getCashCurrent: () => request('/cash/current'),
  getCashHistory: () => request('/cash/history'),
  openCashDrawer: () => request('/cash/open-hardware', { method: 'POST' }),
  openCashSession: (payload) => request('/cash/open', { method: 'POST', body: JSON.stringify(payload) }),
  addCashMovement: (payload) => request('/cash/movement', { method: 'POST', body: JSON.stringify(payload) }),
  closeCashSession: (payload) => request('/cash/close', { method: 'POST', body: JSON.stringify(payload) }),

  // Customer loyalty
  lookupCustomer: (phone) => request(`/customers/lookup?phone=${encodeURIComponent(phone)}`),
  lookupCustomerPoints: (phone) => request(`/customers/points?phone=${encodeURIComponent(phone)}`),
  getLoyaltyRewards: () => request('/customers/rewards'),
  createLoyaltyReward: (payload) => request('/customers/rewards', { method: 'POST', body: JSON.stringify(payload) }),
  updateLoyaltyReward: (id, payload) => request(`/customers/rewards/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLoyaltyReward: (id) => request(`/customers/rewards/${id}`, { method: 'DELETE' }),
  redeemLoyaltyReward: (payload) => request('/customers/redeem', { method: 'POST', body: JSON.stringify(payload) }),
  createCustomer: (payload) => request('/customers', { method: 'POST', body: JSON.stringify(payload) }),
  getCustomers: (search = '') => request(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  // Inventory
  getInventorySummary: () => request('/inventory/summary'),
  adjustStock: (payload) => request('/inventory/adjust', { method: 'POST', body: JSON.stringify(payload) }),
  getMovements: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/inventory/movements${qs ? `?${qs}` : ''}`);
  },

  // Dashboard, Reports & Settings
  getDashboardStats: () => request('/dashboard'),
  getReports: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports${qs ? `?${qs}` : ''}`);
  },
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  updateSystemStatus: (systemActive) => request('/system/status', { method: 'PUT', body: JSON.stringify({ systemActive }) }),
  updateLimits: (payload) => request('/settings/limits', { method: 'PUT', body: JSON.stringify(payload) }),
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
