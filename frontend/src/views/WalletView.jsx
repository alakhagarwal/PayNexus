import React, { useState } from 'react';
import { Wallet, Send, ArrowUpRight, ArrowDownLeft, Lock, ShieldCheck, ShieldAlert, RefreshCw, PlusCircle, CheckCircle, Clock, FileCheck, ArrowRight } from 'lucide-react';
import { api } from '../api/client';

export default function WalletView({
  user,
  userProfile,
  wallet,
  ledger = [],
  onRefresh,
  onOpenTransfer,
  onOpenKyc,
  onNavigateAdmin
}) {
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);

  const available = wallet?.availableBalance !== undefined ? Number(wallet.availableBalance) : 0;
  const reserved = wallet?.reservedBalance !== undefined ? Number(wallet.reservedBalance) : 0;
  const dailySpent = wallet?.dailySpent !== undefined ? Number(wallet.dailySpent) : 0;
  const dailyLimit = wallet?.dailyLimit !== undefined ? Number(wallet.dailyLimit) : 50000;
  const spentPct = Math.min(100, (dailySpent / dailyLimit) * 100);

  const kycStatus = userProfile?.kycStatus || (user?.role?.includes('SUBMITTED') ? 'SUBMITTED' : (user?.role?.includes('Verified') ? 'VERIFIED' : 'PENDING'));

  // Quick Topup helper (simulates Razorpay credit via direct endpoint or test deposit)
  const handleTopup = async (amt = 10000) => {
    setTopupLoading(true);
    setTopupSuccess(false);
    try {
      const res = await fetch('/api/v1/payments/mock-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: amt })
      });
      onRefresh();
      setTopupSuccess(true);
      setTimeout(() => setTopupSuccess(false), 3000);
    } catch (e) {
      console.warn('Topup note:', e);
      onRefresh();
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            Digital Wallet
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontWeight: '700' }}>
            Double-Entry Ledger • Redisson MultiLock • P2P Transfers
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-primary" onClick={onOpenTransfer}>
            <Send size={15} />
            Send Money (P2P)
          </button>
          <button className="btn-secondary" onClick={onRefresh}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* KYC Alert Notification Banner (if not verified) */}
      {kycStatus !== 'VERIFIED' && (
        <div style={{
          background: kycStatus === 'SUBMITTED' ? 'rgba(255, 160, 0, 0.08)' : (kycStatus === 'REJECTED' ? 'rgba(224, 96, 96, 0.08)' : 'rgba(255, 79, 0, 0.08)'),
          border: `1px solid ${kycStatus === 'SUBMITTED' ? 'rgba(255, 160, 0, 0.25)' : (kycStatus === 'REJECTED' ? 'rgba(224, 96, 96, 0.25)' : 'rgba(255, 79, 0, 0.25)')}`,
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {kycStatus === 'SUBMITTED' ? (
              <Clock size={20} color="#ffa000" />
            ) : kycStatus === 'REJECTED' ? (
              <ShieldAlert size={20} color="var(--bearish)" />
            ) : (
              <FileCheck size={20} color="var(--accent-orange)" />
            )}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {kycStatus === 'SUBMITTED' && 'KYC Application Under Compliance Review'}
                {kycStatus === 'REJECTED' && 'KYC Application Rejected by Administrator'}
                {(kycStatus === 'PENDING' || kycStatus === 'NOT_SUBMITTED') && 'Regulatory Identity Verification (KYC) Required'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {kycStatus === 'SUBMITTED' && 'Identity details (PAN & Aadhaar) are in the review queue. Compliance verification is restricted to authorized Compliance Officers. In demo mode, sign in as the Compliance Officer to review & approve.'}
                {kycStatus === 'REJECTED' && 'Your documents were rejected. Please review remarks and re-submit valid PAN & Aadhaar details.'}
                {(kycStatus === 'PENDING' || kycStatus === 'NOT_SUBMITTED') && 'Complete 1-step paperless PAN & Aadhaar verification to unlock higher order quantities and P2P transfers.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {kycStatus === 'SUBMITTED' ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 160, 0, 0.12)',
                border: '1px solid rgba(255, 160, 0, 0.3)',
                color: '#ffa000',
                fontSize: '11.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: '600'
              }}>
                <Clock size={13} />
                Awaiting Admin Approval
              </div>
            ) : (
              <button
                className="btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={onOpenKyc}
              >
                {kycStatus === 'REJECTED' ? 'Re-Submit KYC' : 'Verify KYC Now'} <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hero Wallet Card */}
      <div className="wallet-card-hero" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--accent-orange)', fontWeight: '700', marginBottom: '4px' }}>
              PayNexus Digital Account
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              UUID: {user.id}
            </div>
          </div>

          {/* Status Badges: Wallet state and KYC State */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Wallet Freeze Badge */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: (wallet?.frozen ?? wallet?.isFrozen) ? 'var(--bearish)' : 'var(--bullish)',
              fontFamily: 'var(--font-mono)'
            }}>
              <ShieldCheck size={14} />
              <span>{(wallet?.frozen ?? wallet?.isFrozen) ? 'FROZEN BY ADMIN' : 'WALLET ACTIVE'}</span>
            </div>

            {/* KYC Status Badge */}
            <div
              onClick={kycStatus !== 'VERIFIED' ? onOpenKyc : undefined}
              style={{
                background: kycStatus === 'VERIFIED' ? 'var(--bullish-soft)' : (kycStatus === 'SUBMITTED' ? 'rgba(255, 160, 0, 0.12)' : 'rgba(255, 79, 0, 0.12)'),
                border: `1px solid ${kycStatus === 'VERIFIED' ? 'rgba(90, 184, 112, 0.3)' : (kycStatus === 'SUBMITTED' ? 'rgba(255, 160, 0, 0.3)' : 'rgba(255, 79, 0, 0.3)')}`,
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: kycStatus === 'VERIFIED' ? 'var(--bullish)' : (kycStatus === 'SUBMITTED' ? '#ffa000' : 'var(--accent-orange)'),
                fontFamily: 'var(--font-mono)',
                cursor: kycStatus !== 'VERIFIED' ? 'pointer' : 'default'
              }}
              title={kycStatus !== 'VERIFIED' ? 'Click to submit or update KYC' : 'Account is fully verified'}
            >
              {kycStatus === 'VERIFIED' && <ShieldCheck size={14} />}
              {kycStatus === 'SUBMITTED' && <Clock size={14} />}
              {kycStatus === 'REJECTED' && <ShieldAlert size={14} />}
              {(kycStatus === 'PENDING' || kycStatus === 'NOT_SUBMITTED') && <FileCheck size={14} />}
              <span>KYC: {kycStatus}</span>
            </div>
          </div>
        </div>

        {/* Balance Display */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              Available Liquidity
            </div>
            <div style={{ fontSize: '36px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', letterSpacing: '-1px' }}>
              ₹{available.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              Held In Active Sagas
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: reserved > 0 ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
              ₹{reserved.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Daily limit progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>Daily Spend: ₹{dailySpent.toLocaleString('en-IN')} / ₹{dailyLimit.toLocaleString('en-IN')}</span>
            <span>{spentPct.toFixed(0)}% Utilized</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${spentPct}%`, height: '100%', background: 'linear-gradient(90deg, #ff4f00, #ff7a00)', borderRadius: '3px' }} />
          </div>
        </div>

        {/* Action bar below card */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            style={{ fontSize: '12px', padding: '6px 14px' }}
            onClick={onOpenTransfer}
          >
            <Send size={14} /> Send P2P
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 14px' }}
            onClick={() => handleTopup(10000)}
            disabled={topupLoading}
          >
            <PlusCircle size={14} color="var(--bullish)" />
            {topupLoading ? 'Processing Deposit...' : '+ Add ₹10,000 (Mock Top-Up)'}
          </button>
          {kycStatus !== 'VERIFIED' && (
            <button
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px', borderColor: 'rgba(255, 79, 0, 0.3)', color: 'var(--accent-orange)' }}
              onClick={onOpenKyc}
            >
              <FileCheck size={14} /> {kycStatus === 'SUBMITTED' ? 'View KYC Status' : 'Complete KYC'}
            </button>
          )}
          {topupSuccess && (
            <span style={{ fontSize: '12px', color: 'var(--bullish)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={14} /> Deposit recorded!
            </span>
          )}
        </div>
      </div>

      {/* Double-Entry Transaction Ledger */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Lock size={15} color="var(--accent-orange)" />
            Immutable Transaction Ledger ({ledger.length} entries)
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Strict Double-Entry Bookkeeping
          </span>
        </div>

        {ledger.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No transaction records found for this account.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Running Balance</th>
                  <th>Narration</th>
                  <th>Reference ID</th>
                  <th style={{ textAlign: 'right' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((item, index) => {
                  const isCredit = item.transactionType === 'CREDIT';
                  const isHold = item.transactionType === 'HOLD';
                  const isDebit = item.transactionType === 'DEBIT';
                  const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'Just now';

                  return (
                    <tr key={item.id || index}>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: isCredit ? 'var(--bullish-soft)' : isDebit ? 'var(--bearish-soft)' : 'rgba(255, 87, 34, 0.12)',
                          color: isCredit ? 'var(--bullish)' : isDebit ? 'var(--bearish)' : 'var(--accent-orange)'
                        }}>
                          {isCredit && <ArrowDownLeft size={12} />}
                          {isDebit && <ArrowUpRight size={12} />}
                          {isHold && <Lock size={12} />}
                          {item.transactionType}
                        </span>
                      </td>
                      <td className="val-mono" style={{
                        fontSize: '13.5px',
                        fontWeight: '700',
                        color: isCredit ? 'var(--bullish)' : isDebit ? 'var(--bearish)' : 'var(--accent-orange)'
                      }}>
                        {isCredit ? '+' : isDebit ? '-' : ''}₹{Number(item.amount).toFixed(2)}
                      </td>
                      <td className="val-mono" style={{ color: '#fff', fontSize: '13px' }}>
                        ₹{Number(item.runningBalance).toFixed(2)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '280px' }}>
                        {item.narration}
                      </td>
                      <td className="val-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.referenceId ? `${item.referenceId.substring(0, 16)}...` : 'N/A'}
                      </td>
                      <td className="val-mono" style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {dateStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
