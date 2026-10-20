/**
 * PayNexus Comprehensive End-to-End Frontend & API Verification Suite
 * Tests every endpoint and scenario accessible from the frontend via API Gateway / Vite proxy.
 */

const BASE_URL = 'http://localhost:8080'; // API Gateway
const FRONTEND_URL = 'http://localhost:5173'; // Vite Dev Server

const TEST_USER_1 = 'a0141d67-c2fb-446b-92f6-3d751461e25a'; // Trader (test1 user)
const TEST_USER_2 = 'b595ea4c-4baa-48a0-84ec-b4dfc272c47c'; // Aarav Sharma
const PIN = '123456';
const WRONG_PIN = '999999';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🚀 PAYNEXUS COMPREHENSIVE FRONTEND & API SCENARIO TEST RUNNER');
  console.log('================================================================\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. FRONTEND APP & ASSETS INTEGRITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('📦 [SUITE 1] Vite Dev Server & Frontend Assets:');
  try {
    const feRes = await fetch(FRONTEND_URL);
    assert(feRes.ok && feRes.status === 200, `Frontend root serves HTTP 200 from ${FRONTEND_URL}`);
    const html = await feRes.text();
    assert(html.includes('PayNexus') && html.includes('Stoxy'), 'HTML contains correct document title');
    assert(html.includes('/src/main.jsx'), 'HTML contains entrypoint script /src/main.jsx');
    assert(html.includes('id="root"'), 'HTML contains #root mounting div');
  } catch (err) {
    assert(false, `Frontend server check failed: ${err.message}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. MARKET DATA ENDPOINTS (Dashboard & Marquee Ticker)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📈 [SUITE 2] Market Data Endpoints:');
  
  // 2.1 All Prices
  const mktPrices = await request('/api/v1/market/prices');
  assert(mktPrices.ok && mktPrices.status === 200, 'GET /api/v1/market/prices returns 200');
  assert(mktPrices.data?.data?.totalSymbols === 10, 'Market data tracks all 10 NSE symbols');
  const priceData = mktPrices.data?.data?.prices || {};
  assert(priceData['RELIANCE'] > 0, `RELIANCE price active in Redis: ₹${priceData['RELIANCE']}`);
  assert(priceData['TCS'] > 0, `TCS price active in Redis: ₹${priceData['TCS']}`);

  // 2.2 Single Stock Detail + 20-tick history
  const relPrice = await request('/api/v1/market/prices/RELIANCE');
  assert(relPrice.ok && relPrice.status === 200, 'GET /api/v1/market/prices/RELIANCE returns 200');
  assert(relPrice.data?.data?.symbol === 'RELIANCE', 'Stock detail returns correct symbol RELIANCE');
  assert(Array.isArray(relPrice.data?.data?.priceHistory), 'Stock detail includes priceHistory tick array');

  // 2.3 Unknown Symbol Edge Case
  const unkStock = await request('/api/v1/market/prices/UNKNOWNXYZ');
  assert(unkStock.status === 404, 'GET /api/v1/market/prices/UNKNOWNXYZ correctly returns 404 Not Found');

  // 2.4 Feed Status
  const feedStatus = await request('/api/v1/market/feed-status');
  assert(feedStatus.ok && feedStatus.status === 200, 'GET /api/v1/market/feed-status returns 200');
  assert(feedStatus.data?.data?.mode === 'SIMULATION', 'Market feed mode is SIMULATION');

  // ──────────────────────────────────────────────────────────────────────────
  // 3. WALLET & DOUBLE-ENTRY LEDGER ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n💳 [SUITE 3] Wallet & Double-Entry Ledger Endpoints:');

  // 3.1 Get Wallet Balance
  const w1 = await request(`/api/v1/wallet/${TEST_USER_1}`);
  assert(w1.ok && w1.status === 200, `GET /api/v1/wallet/${TEST_USER_1} returns 200`);
  const initialBal = Number(w1.data?.data?.availableBalance);
  assert(!isNaN(initialBal), `User 1 available balance: ₹${initialBal.toFixed(2)}`);
  assert(w1.data?.data?.currency === 'INR', 'Currency is INR');
  assert(w1.data?.data?.frozen === false || w1.data?.data?.isFrozen === false, 'Wallet is active and not frozen');

  // 3.2 Get Ledger Entries
  const ledgerRes = await request(`/api/v1/wallet/${TEST_USER_1}/ledger?page=0&size=10`);
  assert(ledgerRes.ok && ledgerRes.status === 200, 'GET /api/v1/wallet/{userId}/ledger returns 200');
  assert(Array.isArray(ledgerRes.data?.data?.content), 'Ledger response contains paginated content array');

  // 3.3 Get Ledger Summary
  const ledgerSummary = await request(`/api/v1/wallet/${TEST_USER_1}/ledger/summary`);
  assert(ledgerSummary.ok && ledgerSummary.status === 200, 'GET /api/v1/wallet/{userId}/ledger/summary returns 200');
  assert(ledgerSummary.data?.data?.totalCredits !== undefined, 'Ledger summary includes totalCredits');

  // 3.4 P2P Transfer Happy Path (User 1 -> User 2: ₹100)
  const transferKey = `test-p2p-${Date.now()}`;
  const p2pRes = await request('/api/v1/wallet/transfer', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': transferKey },
    body: JSON.stringify({
      senderId: TEST_USER_1,
      receiverId: TEST_USER_2,
      amount: 100.00,
      transactionPin: PIN,
      idempotencyKey: transferKey
    })
  });
  assert(p2pRes.ok && p2pRes.status === 200, 'POST /api/v1/wallet/transfer (Happy Path ₹100) returns 200');

  // 3.5 P2P Transfer Error Scenario: Invalid PIN
  const badPinRes = await request('/api/v1/wallet/transfer', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `p2p-badpin-${Date.now()}` },
    body: JSON.stringify({
      senderId: TEST_USER_1,
      receiverId: TEST_USER_2,
      amount: 100.00,
      transactionPin: WRONG_PIN,
      idempotencyKey: `p2p-badpin-${Date.now()}`
    })
  });
  assert(!badPinRes.ok, 'POST /api/v1/wallet/transfer with wrong PIN is rejected');

  // 3.6 P2P Transfer Error Scenario: Insufficient Balance
  const overdrawRes = await request('/api/v1/wallet/transfer', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `p2p-overdraw-${Date.now()}` },
    body: JSON.stringify({
      senderId: TEST_USER_1,
      receiverId: TEST_USER_2,
      amount: 99999999.00,
      transactionPin: PIN,
      idempotencyKey: `p2p-overdraw-${Date.now()}`
    })
  });
  assert(!overdrawRes.ok, 'POST /api/v1/wallet/transfer with excessive amount is rejected');

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PORTFOLIO & LIVE P&L ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📊 [SUITE 4] Portfolio & Mark-to-Market P&L Endpoints:');

  // 4.1 Full Portfolio Rollup
  const portRes = await request(`/api/v1/portfolio/${TEST_USER_1}`);
  assert(portRes.ok && portRes.status === 200, `GET /api/v1/portfolio/${TEST_USER_1} returns 200`);
  const port = portRes.data?.data;
  assert(port?.userId === TEST_USER_1, 'Portfolio corresponds to the requested user');
  assert(Number(port?.totalInvested) >= 0, `Total Invested: ₹${Number(port?.totalInvested).toFixed(2)}`);
  assert(Number(port?.totalCurrentValue) >= 0, `Mark-to-Market Value: ₹${Number(port?.totalCurrentValue).toFixed(2)}`);
  assert(['PROFIT', 'LOSS', 'NEUTRAL'].includes(port?.overallPnlDirection), `P&L direction resolved: ${port?.overallPnlDirection}`);

  // 4.2 Holdings Endpoint
  const holdingsRes = await request(`/api/v1/portfolio/${TEST_USER_1}/holdings`);
  assert(holdingsRes.ok && holdingsRes.status === 200, 'GET /api/v1/portfolio/{userId}/holdings returns 200');
  assert(Array.isArray(holdingsRes.data?.data), 'Holdings returned as list');

  // ──────────────────────────────────────────────────────────────────────────
  // 5. DISTRIBUTED SAGA ORDER ENGINE (BUY & SELL)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n⚡ [SUITE 5] Distributed Saga Stock Orders (BUY / SELL):');

  // 5.1 BUY 1 Share of INFY (Happy Path Saga: Hold -> Execute -> Settle)
  const buyKey = `test-buy-${Date.now()}`;
  const buyRes = await request('/api/v1/orders/buy', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': buyKey },
    body: JSON.stringify({
      userId: TEST_USER_1,
      symbol: 'INFY',
      quantity: 1,
      transactionPin: PIN
    })
  });
  assert(buyRes.status === 201, 'POST /api/v1/orders/buy (1 INFY) returns 201 CREATED');
  assert(buyRes.data?.data?.status === 'EXECUTED', 'BUY Order status is EXECUTED');
  assert(buyRes.data?.data?.orderType === 'BUY', 'Order type is BUY');

  // 5.2 BUY Idempotency Check (re-sending same key returns same response, no double charge)
  const dupBuyRes = await request('/api/v1/orders/buy', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': buyKey },
    body: JSON.stringify({
      userId: TEST_USER_1,
      symbol: 'INFY',
      quantity: 1,
      transactionPin: PIN
    })
  });
  assert(dupBuyRes.status === 201, 'POST /api/v1/orders/buy with duplicate idempotency key returns 201');
  assert(dupBuyRes.data?.data?.orderId === buyRes.data?.data?.orderId, 'Idempotent BUY returns identical orderId');

  // 5.3 BUY Error Scenario: Insufficient Funds (Quantity 50,000 shares)
  const excessiveBuyRes = await request('/api/v1/orders/buy', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `buy-overdraw-${Date.now()}` },
    body: JSON.stringify({
      userId: TEST_USER_1,
      symbol: 'INFY',
      quantity: 50000,
      transactionPin: PIN
    })
  });
  assert(!excessiveBuyRes.ok && excessiveBuyRes.status === 422, 'POST /api/v1/orders/buy with excessive quantity fails with 422 Unprocessable Entity');

  // 5.4 BUY Error Scenario: Quantity < 1
  const zeroQtyBuyRes = await request('/api/v1/orders/buy', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `buy-zero-${Date.now()}` },
    body: JSON.stringify({
      userId: TEST_USER_1,
      symbol: 'INFY',
      quantity: 0,
      transactionPin: PIN
    })
  });
  assert(!zeroQtyBuyRes.ok, 'POST /api/v1/orders/buy with quantity 0 is rejected by validation');

  // 5.5 SELL 1 Share of INFY (Happy Path Saga: Verify Holding -> Credit -> Update Holding)
  const sellKey = `test-sell-${Date.now()}`;
  const sellRes = await request('/api/v1/orders/sell', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': sellKey },
    body: JSON.stringify({
      userId: TEST_USER_1,
      symbol: 'INFY',
      quantity: 1,
      transactionPin: PIN
    })
  });
  assert(sellRes.status === 201, 'POST /api/v1/orders/sell (1 INFY) returns 201 CREATED');
  assert(sellRes.data?.data?.status === 'EXECUTED', 'SELL Order status is EXECUTED');
  assert(sellRes.data?.data?.orderType === 'SELL', 'Order type is SELL');

  // 5.6 SELL Error Scenario: Overselling (quantity > owned)
  const overSellRes = await request('/api/v1/orders/sell', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `sell-oversell-${Date.now()}` },
    body: JSON.stringify({
      userId: TEST_USER_1,
      symbol: 'INFY',
      quantity: 999999,
      transactionPin: PIN
    })
  });
  assert(!overSellRes.ok, 'POST /api/v1/orders/sell for more shares than owned is rejected');

  // 5.7 Order History Endpoint
  const historyRes = await request(`/api/v1/orders/${TEST_USER_1}/history`);
  assert(historyRes.ok && historyRes.status === 200, 'GET /api/v1/orders/{userId}/history returns 200');
  assert(Array.isArray(historyRes.data?.data), 'Order history returns array of past trades');
  assert(historyRes.data?.data?.length >= 2, `Order history contains ${historyRes.data?.data?.length} orders`);

  // 5.8 Order History with ?status=EXECUTED filter
  const filteredHist = await request(`/api/v1/orders/${TEST_USER_1}/history?status=EXECUTED`);
  assert(filteredHist.ok && filteredHist.status === 200, 'GET /api/v1/orders/{userId}/history?status=EXECUTED returns 200');

  // ──────────────────────────────────────────────────────────────────────────
  // 6. PRICE ALERTS ENGINE ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n🔔 [SUITE 6] Price Alerts Engine Endpoints:');

  // 6.1 Create Alert (ABOVE threshold)
  const createAlertRes = await request('/api/v1/alerts', {
    method: 'POST',
    body: JSON.stringify({
      userId: TEST_USER_1,
      symbol: 'TCS',
      targetPrice: 4200.00,
      direction: 'ABOVE'
    })
  });
  assert(createAlertRes.status === 201, 'POST /api/v1/alerts returns 201 CREATED');
  const alertId = createAlertRes.data?.data?.alertId;
  assert(alertId !== undefined, `Alert created with ID: ${alertId}`);

  // 6.2 Get Active Alerts for User
  const userAlertsRes = await request(`/api/v1/alerts/${TEST_USER_1}`);
  assert(userAlertsRes.ok && userAlertsRes.status === 200, 'GET /api/v1/alerts/{userId} returns 200');
  const userAlerts = userAlertsRes.data?.data || [];
  const foundAlert = userAlerts.find(a => (a.alertId || a.id) === alertId);
  assert(foundAlert !== undefined, 'Created alert appears in active alerts list');

  // 6.3 Soft-cancel Alert
  if (alertId) {
    const cancelRes = await request(`/api/v1/alerts/${alertId}`, {
      method: 'DELETE'
    });
    assert(cancelRes.ok && cancelRes.status === 200, `DELETE /api/v1/alerts/${alertId} returns 200 OK`);

    // Verify it is no longer in active alerts
    const refreshedAlerts = await request(`/api/v1/alerts/${TEST_USER_1}`);
    const stillActive = (refreshedAlerts.data?.data || []).some(a => (a.alertId || a.id) === alertId);
    assert(!stillActive, 'Cancelled alert is no longer returned in active alerts');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. USER & PROFILE ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n👤 [SUITE 7] User Profile & KYC Status Endpoints:');
  const profRes = await request(`/api/v1/users/${TEST_USER_1}/profile`);
  assert(profRes.ok && profRes.status === 200, `GET /api/v1/users/${TEST_USER_1}/profile returns 200`);
  assert(profRes.data?.data?.email === 'test1@paynexus.io', 'User email verified');

  // ──────────────────────────────────────────────────────────────────────────
  // 8. AUTHENTICATION & RECRUITER 1-CLICK ONBOARDING
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n🔐 [SUITE 8] Authentication & Recruiter 1-Click Onboarding:');
  
  // 8.1 Login with Aarav Sharma
  const loginRes = await request('/api/v1/users/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'aarav.sharma@paynexus.io', password: 'SecurePass123!' })
  });
  assert(loginRes.ok && loginRes.status === 200, 'POST /api/v1/users/login returns 200 for Aarav Sharma');
  assert(loginRes.data?.data?.userId !== undefined, `User authenticated with ID: ${loginRes.data?.data?.userId}`);
  assert(loginRes.data?.data?.name === 'Aarav Sharma', 'Returned user name matches credentials');

  // 8.2 Login with invalid password
  const badLoginRes = await request('/api/v1/users/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'aarav.sharma@paynexus.io', password: 'WrongPassword999!' })
  });
  assert(badLoginRes.status === 404 || badLoginRes.status === 400 || badLoginRes.status === 401, 'POST /api/v1/users/login rejects incorrect password');

  // 8.3 Register a brand new candidate account
  const newEmail = `recruiter_${Date.now()}@paynexus.io`;
  const registerRes = await request('/api/v1/users/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Candidate Reviewer', email: newEmail, password: 'SecurePass123!' })
  });
  assert(registerRes.status === 201, 'POST /api/v1/users/register returns 201 CREATED');
  const newUserId = registerRes.data?.data?.userId;
  assert(newUserId !== undefined, `New candidate registered with ID: ${newUserId}`);
  assert(registerRes.data?.data?.walletId !== undefined, 'User digital wallet atomically provisioned');

  // ──────────────────────────────────────────────────────────────────────────
  // 9. KYC VERIFICATION LIFECYCLE & ADMIN OPERATIONS CONSOLE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n🛡️ [SUITE 9] KYC Lifecycle & Admin Operations:');

  // 9.1 Check initial KYC status (PENDING / NOT_SUBMITTED)
  const newProfRes = await request(`/api/v1/users/${newUserId}/profile`);
  assert(newProfRes.ok && newProfRes.status === 200, 'GET /api/v1/users/{userId}/profile returns 200');
  assert(newProfRes.data?.data?.kycStatus === 'PENDING' || newProfRes.data?.data?.kycStatus === 'NOT_SUBMITTED', 'New account KYC is unverified');

  // 9.2 Submit KYC with valid individual PAN ('P' as 4th char), Aadhaar last 4, age >= 18
  const kycSubmitRes = await request(`/api/v1/users/${newUserId}/kyc`, {
    method: 'POST',
    body: JSON.stringify({
      panNumber: 'ABCPE1234F',
      aadhaarLastFour: '5678',
      dateOfBirth: '1996-03-25'
    })
  });
  assert(kycSubmitRes.ok && kycSubmitRes.status === 200, 'POST /api/v1/users/{userId}/kyc returns 200 OK');

  // 9.3 Verify profile status transitioned to SUBMITTED
  const submittedProfRes = await request(`/api/v1/users/${newUserId}/profile`);
  assert(submittedProfRes.data?.data?.kycStatus === 'SUBMITTED', 'User KYC status transitioned to SUBMITTED');

  // 9.4 Admin pending queue contains candidate
  const pendingQueueRes = await request('/admin/kyc/pending');
  assert(pendingQueueRes.ok && pendingQueueRes.status === 200, 'GET /admin/kyc/pending returns 200 OK');
  const pendingList = pendingQueueRes.data?.data || [];
  const candidateInQueue = pendingList.some(item => item.userId === newUserId);
  assert(candidateInQueue, 'Candidate application appears in Admin pending queue');

  // 9.5 Admin approves candidate KYC
  const approveRes = await request(`/admin/kyc/${newUserId}/approve?remarks=Candidate+Verified+By+Admin`, {
    method: 'PUT'
  });
  assert(approveRes.ok && approveRes.status === 200, 'PUT /admin/kyc/{userId}/approve returns 200 OK');

  // 9.6 Verify profile status transitioned to VERIFIED
  const verifiedProfRes = await request(`/api/v1/users/${newUserId}/profile`);
  assert(verifiedProfRes.data?.data?.kycStatus === 'VERIFIED', 'User KYC status transitioned to VERIFIED');

  // 9.7 Admin Risk Control: Freeze Wallet
  const freezeRes = await request(`/admin/users/${newUserId}/freeze`, {
    method: 'PUT'
  });
  assert(freezeRes.ok && freezeRes.status === 200, 'PUT /admin/users/{userId}/freeze returns 200 OK');

  const frozenWalletRes = await request(`/api/v1/wallet/${newUserId}`);
  const isFrozen = frozenWalletRes.data?.data?.frozen ?? frozenWalletRes.data?.data?.isFrozen;
  assert(isFrozen === true, 'Wallet verified as FROZEN');

  // 9.8 Admin Risk Control: Unfreeze Wallet
  const unfreezeRes = await request(`/admin/users/${newUserId}/unfreeze`, {
    method: 'PUT'
  });
  assert(unfreezeRes.ok && unfreezeRes.status === 200, 'PUT /admin/users/{userId}/unfreeze returns 200 OK');

  const unfrozenWalletRes = await request(`/api/v1/wallet/${newUserId}`);
  const isUnfrozen = (unfrozenWalletRes.data?.data?.frozen ?? unfrozenWalletRes.data?.data?.isFrozen) === false;
  assert(isUnfrozen, 'Wallet verified as ACTIVE (UNFROZEN)');

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`📊 TEST EXECUTION SUMMARY:`);
  console.log(`   Total Tests:  ${passedTests + failedTests}`);
  console.log(`   Passed:       ${passedTests}`);
  console.log(`   Failed:       ${failedTests}`);
  console.log(`   Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(e => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
