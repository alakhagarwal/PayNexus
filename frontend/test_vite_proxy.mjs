/**
 * Verification that Vite Dev Server Proxy (http://localhost:5173/api/...)
 * correctly proxies all microservice endpoints to Spring Cloud Gateway (:8080).
 */

const VITE_API = 'http://localhost:5173/api';
const TEST_USER = 'a0141d67-c2fb-446b-92f6-3d751461e25a';

async function testViteProxy() {
  console.log('Testing Vite Dev Server Proxy at http://localhost:5173/api/...:\n');

  // 1. Market prices through Vite proxy
  const mkt = await fetch(`${VITE_API}/v1/market/prices`).then(r => r.json());
  console.log('1. Market Prices via Vite Proxy:', mkt.success ? '✅ OK' : '❌ FAILED', `(${mkt.data?.totalSymbols} symbols)`);

  // 2. Portfolio via Vite proxy
  const port = await fetch(`${VITE_API}/v1/portfolio/${TEST_USER}`).then(r => r.json());
  console.log('2. Portfolio via Vite Proxy:', port.success ? '✅ OK' : '❌ FAILED', `(Holdings: ${port.data?.totalStocks})`);

  // 3. Wallet via Vite proxy
  const wal = await fetch(`${VITE_API}/v1/wallet/${TEST_USER}`).then(r => r.json());
  console.log('3. Wallet via Vite Proxy:', wal.success ? '✅ OK' : '❌ FAILED', `(Balance: ₹${wal.data?.availableBalance})`);

  // 4. Alerts via Vite proxy
  const alerts = await fetch(`${VITE_API}/v1/alerts/${TEST_USER}`).then(r => r.json());
  console.log('4. Alerts via Vite Proxy:', alerts.success ? '✅ OK' : '❌ FAILED', `(Active alerts: ${alerts.data?.length})`);

  // 5. Orders history via Vite proxy
  const history = await fetch(`${VITE_API}/v1/orders/${TEST_USER}/history`).then(r => r.json());
  console.log('5. Order History via Vite Proxy:', history.success ? '✅ OK' : '❌ FAILED', `(Past orders: ${history.data?.length})`);
}

testViteProxy().catch(console.error);
