/**
 * PayNexus API Client — Communicates with Spring Cloud API Gateway (:8080)
 */

const BASE_URL = ''; // Proxied via Vite to http://localhost:8080

// Predefined Demo Users
export const DEMO_USERS = [
  {
    id: 'a0141d67-c2fb-446b-92f6-3d751461e25a',
    name: 'test1 user (Trader)',
    email: 'test1@paynexus.io',
    role: 'Active Investor & Trader',
    avatar: 'T1'
  },
  {
    id: 'b595ea4c-4baa-48a0-84ec-b4dfc272c47c',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@paynexus.io',
    role: 'Verified FinTech User',
    avatar: 'AS'
  },
  {
    id: '672cc9ab-3c63-4c28-935e-271b58899a1c',
    name: 'Priya Patel',
    email: 'priya.patel@paynexus.io',
    role: 'Verified P2P Partner',
    avatar: 'PP'
  },
  {
    id: 'ef36400d-b048-46f6-9590-89a988259c2d',
    name: 'Vikram Malhotra',
    email: 'vikram.malhotra@paynexus.io',
    role: 'Standard Wallet User',
    avatar: 'VM'
  }
];

// Helper to handle API response JSON
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  try {
    const res = await fetch(url, config);
    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (e) {
        // Ignore JSON parse error if body is plain text or HTML
      }
    }

    if (!res.ok) {
      const errorMsg = json?.message || (res.status === 403 ? 'Access Forbidden (CORS or permission error)' : `Request failed with HTTP status ${res.status}`);
      throw new Error(errorMsg);
    }
    return json?.data !== undefined ? json.data : (json || {});
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // ─── Market Data ────────────────────────────────────────────────────────
  getMarketPrices: () => request('/api/v1/market/prices'),
  getStockDetails: (symbol) => request(`/api/v1/market/prices/${symbol}`),
  getFeedStatus: () => request('/api/v1/market/feed-status'),

  // ─── Portfolio & P&L ───────────────────────────────────────────────────
  getPortfolio: (userId) => request(`/api/v1/portfolio/${userId}`),
  getHoldings: (userId) => request(`/api/v1/portfolio/${userId}/holdings`),

  // ─── Stock Orders Saga ──────────────────────────────────────────────────
  buyStock: (userId, symbol, quantity, transactionPin = '123456') => {
    const idempotencyKey = `buy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return request('/api/v1/orders/buy', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ userId, symbol, quantity: Number(quantity), transactionPin })
    });
  },

  sellStock: (userId, symbol, quantity, transactionPin = '123456') => {
    const idempotencyKey = `sell-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return request('/api/v1/orders/sell', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ userId, symbol, quantity: Number(quantity), transactionPin })
    });
  },

  getOrderHistory: (userId, status = null) => {
    const query = status ? `?status=${status}` : '';
    return request(`/api/v1/orders/${userId}/history${query}`);
  },

  // ─── Price Alerts ───────────────────────────────────────────────────────
  getActiveAlerts: (userId) => request(`/api/v1/alerts/${userId}`),
  createAlert: (userId, symbol, targetPrice, direction) =>
    request('/api/v1/alerts', {
      method: 'POST',
      body: JSON.stringify({ userId, symbol, targetPrice: Number(targetPrice), direction })
    }),
  cancelAlert: (alertId) =>
    request(`/api/v1/alerts/${alertId}`, {
      method: 'DELETE'
    }),

  // ─── Digital Wallet ─────────────────────────────────────────────────────
  getWallet: (userId) => request(`/api/v1/wallet/${userId}`),
  getLedger: (userId, page = 0, size = 20) =>
    request(`/api/v1/wallet/${userId}/ledger?page=${page}&size=${size}`),
  
  transferP2P: (senderId, receiverId, amount, transactionPin = '123456') => {
    const idempotencyKey = `p2p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return request('/api/v1/wallet/transfer', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        senderId,
        receiverId,
        amount: Number(amount),
        transactionPin,
        idempotencyKey
      })
    });
  }
};
