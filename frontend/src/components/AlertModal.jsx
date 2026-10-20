import React, { useState } from 'react';
import { X, Bell, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

export default function AlertModal({
  isOpen,
  onClose,
  userId,
  prices = {},
  initialSymbol = 'RELIANCE',
  onAlertCreated
}) {
  if (!isOpen) return null;

  const [symbol, setSymbol] = useState(initialSymbol);
  const [direction, setDirection] = useState('ABOVE');
  const [targetPrice, setTargetPrice] = useState(
    prices[initialSymbol] ? (prices[initialSymbol] * 1.05).toFixed(2) : '2500'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.createAlert(userId, symbol, Number(targetPrice), direction);
      onAlertCreated({
        symbol,
        targetPrice,
        direction
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create price alert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="var(--accent-orange)" />
            <span>Create Price Alert</span>
          </div>
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

        <form onSubmit={handleSubmit}>
          {/* Symbol */}
          <div className="form-group">
            <label className="form-label">Symbol</label>
            <select
              className="form-select"
              value={symbol}
              onChange={e => {
                const newSym = e.target.value;
                setSymbol(newSym);
                if (prices[newSym]) {
                  setTargetPrice((prices[newSym] * (direction === 'ABOVE' ? 1.05 : 0.95)).toFixed(2));
                }
              }}
            >
              {Object.keys(prices).map(sym => (
                <option key={sym} value={sym}>
                  {sym} (Current: ₹{prices[sym] ? prices[sym].toFixed(2) : '...'})
                </option>
              ))}
            </select>
          </div>

          {/* Direction */}
          <div className="form-group">
            <label className="form-label">Trigger Condition</label>
            <div className="modal-tab-group">
              <button
                type="button"
                className={`modal-tab-btn ${direction === 'ABOVE' ? 'active-buy' : ''}`}
                onClick={() => setDirection('ABOVE')}
              >
                Price Rises ABOVE
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${direction === 'BELOW' ? 'active-sell' : ''}`}
                onClick={() => setDirection('BELOW')}
              >
                Price Drops BELOW
              </button>
            </div>
          </div>

          {/* Target Price */}
          <div className="form-group">
            <label className="form-label">Target Trigger Price (INR)</label>
            <input
              type="number"
              step="any"
              className="form-input input-mono"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              required
            />
          </div>

          <div style={{
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            The Order Engine monitors every 2s Redis market tick against your threshold and automatically triggers in real-time.
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
          >
            {loading ? 'Registering Alert...' : 'Set Alert'}
          </button>
        </form>
      </div>
    </div>
  );
}
