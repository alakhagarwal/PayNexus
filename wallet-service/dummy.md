# PayNexus Wallet Service — Test Dummy Data & Scenarios

This document contains the complete details of test data seeded into the `wallet-service` database via live REST API endpoints. Use these records to test authentication, wallet queries, P2P transfers, KYC approval/rejection workflows, and guard conditions.

---

## 1. Quick Summary Table

| User | Email | Password | PIN | KYC Status | Available Balance | Wallet Frozen? | Test Scenario / Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Aarav Sharma** | `aarav.sharma@paynexus.io` | `SecurePass123!` | `123456` | `VERIFIED` | **₹45,000.00** | No | Active sender, funded wallet, verified KYC, completed outgoing transfer |
| **Priya Patel** | `priya.patel@paynexus.io` | `SecurePass123!` | `654321` | `VERIFIED` | **₹30,000.00** | No | Active recipient, funded wallet, verified KYC, received P2P transfer |
| **Rohan Verma** | `rohan.verma@paynexus.io` | `SecurePass123!` | `112233` | `SUBMITTED` | **₹10,000.00** | No | Pending Admin review queue (`/admin/kyc/pending`) |
| **Neha Gupta** | `neha.gupta@paynexus.io` | `SecurePass123!` | `998877` | `REJECTED` | **₹2,500.00** | No | Rejected KYC testing re-submission flow |
| **Vikram Malhotra** | `vikram.malhotra@paynexus.io` | `SecurePass123!` | `554433` | `PENDING` | **₹15,000.00** | **YES (Frozen)** | Frozen wallet testing (`403 Forbidden` on transfer) |
| **Ananya Iyer** | `ananya.iyer@paynexus.io` | `SecurePass123!` | *None* | `PENDING` | **₹0.00** | No | Fresh onboarded user (no PIN set, 0 balance, unverified) |

---

## 2. Detailed User Profiles & Test Credentials

### 1. Aarav Sharma (Active Sender — Verified & Funded)
- **User ID**: `b595ea4c-4baa-48a0-84ec-b4dfc272c47c`
- **Wallet ID**: `b72c4c87-0b5b-4ac9-b159-73549150565b`
- **Email**: `aarav.sharma@paynexus.io`
- **Password**: `SecurePass123!`
- **Transaction PIN**: `123456`
- **KYC Status**: `VERIFIED`
- **Wallet Details**:
  - `availableBalance`: `45000.00`
  - `reservedBalance`: `0.00`
  - `dailyLimit`: `50000.00`
  - `dailySpent`: `5000.00`
  - `remainingDailyLimit`: `45000.00`
  - `isFrozen`: `false`
- **Ledger Entries**:
  1. `CREDIT` ₹50,000.00 — *Initial Deposit / Salary Credit*
  2. `DEBIT` ₹5,000.00 — *P2P Transfer to Priya Patel*

---

### 2. Priya Patel (Active Recipient — Verified & Funded)
- **User ID**: `672cc9ab-3c63-4c28-935e-271b58899a1c`
- **Wallet ID**: `6cae2c26-65c9-435e-9d84-54b946388f67`
- **Email**: `priya.patel@paynexus.io`
- **Password**: `SecurePass123!`
- **Transaction PIN**: `654321`
- **KYC Status**: `VERIFIED`
  - PAN: `BKUPP9876Z`
  - Aadhaar Last 4: `4321`
  - DOB: `1998-03-22`
  - Review Remarks: `Documents verified successfully`
- **Wallet Details**:
  - `availableBalance`: `30000.00`
  - `reservedBalance`: `0.00`
  - `dailySpent`: `0.00`
  - `isFrozen`: `false`
- **Ledger Entries**:
  1. `CREDIT` ₹25,000.00 — *Welcome Credit*
  2. `CREDIT` ₹5,000.00 — *P2P Transfer from Aarav Sharma*

---

### 3. Rohan Verma (Pending KYC Review)
- **User ID**: `6023f573-dd7a-4e2c-8807-8296e9f8e27e`
- **Wallet ID**: `8cdbf00b-582a-48ab-a5ed-53de40012597`
- **Email**: `rohan.verma@paynexus.io`
- **Password**: `SecurePass123!`
- **Transaction PIN**: `112233`
- **KYC Status**: `SUBMITTED` *(Visible in `GET /admin/kyc/pending`)*
  - PAN: `ROHPV5432M`
  - Aadhaar Last 4: `9988`
  - DOB: `2001-11-10`
- **Wallet Details**:
  - `availableBalance`: `10000.00`
  - `isFrozen`: `false`

---

### 4. Neha Gupta (Rejected KYC)
- **User ID**: `a0d0de59-e6c9-4a5c-888d-42ca654bcf5d`
- **Wallet ID**: `44ae73b4-eb13-49b9-8f07-e1f1bb2150a8`
- **Email**: `neha.gupta@paynexus.io`
- **Password**: `SecurePass123!`
- **Transaction PIN**: `998877`
- **KYC Status**: `REJECTED`
  - PAN: `NEHPG7766K`
  - Aadhaar Last 4: `1122`
  - DOB: `1996-07-04`
  - Admin Remarks: `PAN name does not match user profile`
- **Wallet Details**:
  - `availableBalance`: `2500.00`
  - `isFrozen`: `false`

---

### 5. Vikram Malhotra (Frozen Account)
- **User ID**: `ef36400d-b048-46f6-9590-89a988259c2d`
- **Wallet ID**: `aab6b9b7-5ca5-4097-a07b-c5dc3222f1ff`
- **Email**: `vikram.malhotra@paynexus.io`
- **Password**: `SecurePass123!`
- **Transaction PIN**: `554433`
- **KYC Status**: `PENDING`
- **Wallet Details**:
  - `availableBalance`: `15000.00`
  - `isFrozen`: `true` *(Triggered via `PUT /admin/users/{userId}/freeze`)*
  - **Testing Purpose**: Test error handling when initiating a transfer from a frozen wallet (expects `403 Forbidden - Wallet is frozen`).

---

### 6. Ananya Iyer (Brand New User)
- **User ID**: `c8ea6a3b-ae1d-4708-a7c3-702a59578ed5`
- **Wallet ID**: `a8e19ced-a9e2-4626-a8eb-20639b12bb76`
- **Email**: `ananya.iyer@paynexus.io`
- **Password**: `SecurePass123!`
- **Transaction PIN**: *Not set* (`hasPinSet = false`)
- **KYC Status**: `PENDING`
- **Wallet Details**:
  - `availableBalance`: `0.00`
  - `isFrozen`: `false`
  - **Testing Purpose**: Test first-time user flows (Setting PIN, submitting KYC, attempting transfer without PIN).

---

## 3. Ready-to-Use Sample API Requests (cURL / PowerShell)

### 1. Check Aarav's Wallet & Balance
```bash
curl -X GET http://localhost:8082/api/v1/wallet/b595ea4c-4baa-48a0-84ec-b4dfc272c47c
```

### 2. View Aarav's Transaction History / Ledger
```bash
curl -X GET "http://localhost:8082/api/v1/wallet/b595ea4c-4baa-48a0-84ec-b4dfc272c47c/ledger?page=0&size=10"
```

### 3. Check Pending KYC Queue (Admin)
```bash
curl -X GET http://localhost:8082/admin/kyc/pending
```

### 4. Approve Rohan's Pending KYC (Admin)
```bash
curl -X PUT "http://localhost:8082/admin/kyc/6023f573-dd7a-4e2c-8807-8296e9f8e27e/approve?remarks=Approved+by+Admin"
```

### 5. Perform P2P Transfer (Priya -> Aarav ₹2,000)
```bash
curl -X POST http://localhost:8082/api/v1/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: 11111111-2222-3333-4444-555555555555" \
  -d '{
    "senderId": "672cc9ab-3c63-4c28-935e-271b58899a1c",
    "receiverId": "b595ea4c-4baa-48a0-84ec-b4dfc272c47c",
    "amount": 2000.00,
    "transactionPin": "654321",
    "idempotencyKey": "11111111-2222-3333-4444-555555555555"
  }'
```

### 6. Test Frozen Wallet Guard (Vikram Transfer Attempt)
```bash
curl -X POST http://localhost:8082/api/v1/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: 99999999-8888-7777-6666-555555555555" \
  -d '{
    "senderId": "ef36400d-b048-46f6-9590-89a988259c2d",
    "receiverId": "b595ea4c-4baa-48a0-84ec-b4dfc272c47c",
    "amount": 500.00,
    "transactionPin": "554433",
    "idempotencyKey": "99999999-8888-7777-6666-555555555555"
  }'
```
*Expected Response: HTTP 403 Forbidden - "Wallet is frozen. Please contact support."*
