import React, { useState } from 'react';
import { X, ArrowRight, ShieldCheck, AlertCircle, Lock } from 'lucide-react';
import { api, DEMO_USERS } from '../api/client';

export default function TransferModal({
  isOpen,
  onClose,
  currentUser,
  wallet,
  onTransferSuccess
}) {
  if (!isOpen) return null;

  const recipients = DEMO_USERS.filter(u => u.id !== currentUser.id);
  const [receiverId, setReceiverId] = useState(recipients[0]?.id || '');
  const [amount, setAmount] = useState('5000');
  const [pin, setPin] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const numAmount = Number(amount);
      if (numAmount <= 0) {
        throw new Error('Please enter an amount greater than 0.');
      }
      if (wallet && numAmount > wallet.availableBalance) {
        throw new Error(`Transfer amount (₹${numAmount}) exceeds available balance (₹${wallet.availableBalance}).`);
      }

      await api.transferP2P(currentUser.id, receiverId, numAmount, pin);

      const receiver = DEMO_USERS.find(u => u.id === receiverId);
      onTransferSuccess({
        amount: numAmount,
        recipientName: receiver ? receiver.name : 'Recipient',
        idempotencyKey: `p2p-${Date.now()}`
      });
      onClose();
    } catch (err) {
      setError(err.message || 'P2P Transfer failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Send Money (P2P Transfer)</div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            background: 'var(--bearish-soft)',
            border: '1px solid var(--bearish)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12.5px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Sender details badge */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From Account</div>
            <div style={{ fontWeight: '600', color: '#fff' }}>{currentUser.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Balance</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--bullish)' }}>
              ₹{wallet ? wallet.availableBalance.toFixed(2) : '0.00'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Recipient */}
          <div className="form-group">
            <label className="form-label">Transfer To (Recipient)</label>
            <select
              className="form-select"
              value={receiverId}
              onChange={e => setReceiverId(e.target.value)}
            >
              {recipients.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.email})
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="form-group">
            <label className="form-label">Amount (INR)</label>
            <input
              type="number"
              min="1"
              step="any"
              className="form-input input-mono"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              required
            />
            {/* Quick amount chips */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {['1000', '5000', '10000', '25000'].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  +₹{val}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction PIN */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Transaction PIN</label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default: 123456</span>
            </div>
            <input
              type="password"
              maxLength="6"
              className="form-input input-mono"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Enter 6-digit PIN"
              required
            />
          </div>

          {/* Distributed lock badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '20px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}>
            <Lock size={14} color="var(--accent-orange)" />
            <span>Atomic MultiLock across both wallets guarantees zero double-spending</span>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
          >
            {loading ? 'Processing Atomic Transfer...' : `Transfer ₹${amount || 0}`}
          </button>
        </form>
      </div>
    </div>
  );
}
