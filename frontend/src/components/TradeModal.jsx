import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

export default function TradeModal({
  isOpen,
  onClose,
  initialSymbol = 'RELIANCE',
  initialAction = 'BUY',
  prices = {},
  user,
  wallet,
  holdings = [],
  onTradeSuccess
}) {
  if (!isOpen) return null;

  const [action, setAction] = useState(initialAction);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [quantity, setQuantity] = useState(1);
  const [pin, setPin] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setAction(initialAction);
    setSymbol(initialSymbol);
    setQuantity(1);
    setError(null);
  }, [initialSymbol, initialAction]);

  const currentPrice = prices[symbol] || 0;
  const totalValue = (currentPrice * quantity).toFixed(2);

  // Find user's existing holding for this symbol if SELL
  const currentHolding = holdings.find(h => h.symbol === symbol);
  const availableQty = currentHolding ? currentHolding.quantity : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (action === 'BUY') {
        if (wallet && wallet.availableBalance < Number(totalValue)) {
          throw new Error(`Insufficient wallet balance. Required: ₹${totalValue}, Available: ₹${wallet.availableBalance}`);
        }
        await api.buyStock(user.id, symbol, quantity, pin);
      } else {
        if (quantity > availableQty) {
          throw new Error(`Cannot sell ${quantity} shares. You only own ${availableQty} shares of ${symbol}.`);
        }
        await api.sellStock(user.id, symbol, quantity, pin);
      }

      onTradeSuccess({
        action,
        symbol,
        quantity,
        price: currentPrice,
        total: totalValue
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Trade execution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Trade NSE Equities</div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="modal-tab-group">
          <button
            type="button"
            className={`modal-tab-btn ${action === 'BUY' ? 'active-buy' : ''}`}
            onClick={() => { setAction('BUY'); setError(null); }}
          >
            BUY (Hold & Settle)
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${action === 'SELL' ? 'active-sell' : ''}`}
            onClick={() => { setAction('SELL'); setError(null); }}
          >
            SELL (Credit Proceeds)
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
            <label className="form-label">Stock Symbol</label>
            <select
              className="form-select"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
            >
              {Object.keys(prices).map(sym => (
                <option key={sym} value={sym}>
                  {sym} — ₹{prices[sym] ? prices[sym].toFixed(2) : '...'}
                </option>
              ))}
            </select>
          </div>

          {/* Current Execution Price */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Live Redis Price</span>
            <span style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#fff' }}>
              ₹{currentPrice ? currentPrice.toFixed(2) : '0.00'}
            </span>
          </div>

          {/* Quantity */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Quantity</label>
              {action === 'SELL' && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Owned: <strong style={{ color: '#fff' }}>{availableQty}</strong> shares
                </span>
              )}
            </div>
            <input
              type="number"
              min="1"
              max={action === 'SELL' ? Math.max(1, availableQty) : 1000}
              className="form-input input-mono"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
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

          {/* Summary Box */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: '12.5px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Total Estimated Value:</span>
              <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>₹{totalValue}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
              <span>Available Wallet Balance:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>₹{wallet ? wallet.availableBalance.toFixed(2) : '...'}</span>
            </div>
          </div>

          {/* Security badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '16px'
          }}>
            <ShieldCheck size={14} color="var(--bullish)" />
            <span>Secured via Distributed Saga & Idempotency Key</span>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || (action === 'SELL' && availableQty <= 0)}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px',
              fontSize: '14px',
              backgroundColor: action === 'BUY' ? 'var(--bullish)' : 'var(--bearish)'
            }}
          >
            {loading ? 'Executing Distributed Saga...' : `${action} ${quantity} ${symbol} @ ₹${currentPrice ? currentPrice.toFixed(2) : '...'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
