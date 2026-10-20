import React from 'react';
import { Bell, Plus, Trash2, ArrowUpRight, ArrowDownRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';

export default function AlertsView({
  alerts = [],
  prices = {},
  onOpenCreateAlert,
  onRefresh
}) {
  const handleCancel = async (alertId) => {
    try {
      await api.cancelAlert(alertId);
      onRefresh();
    } catch (err) {
      console.error('Cancel alert error:', err);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
            Precision Assets
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontWeight: '700' }}>
            Curated Price Alerts & Automated Trigger Engine
          </p>
        </div>

        <button className="btn-primary" onClick={onOpenCreateAlert}>
          <Plus size={15} />
          + Create Alert
        </button>
      </div>

      {/* Info Banner */}
      <div className="ai-summary-banner">
        <span className="ai-tag">Real-Time Monitor</span>
        <div className="ai-banner-text">
          Order Engine checks price thresholds against every 2-second Redis market tick. Upon trigger, alerts update instantaneously and dispatch notifications.
        </div>
      </div>

      {/* Alerts Table / List */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Bell size={16} color="var(--accent-orange)" />
            Active Price Alerts ({alerts.length})
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-monitoring active</span>
        </div>

        {alerts.length === 0 ? (
          <div style={{
            padding: '50px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Bell size={36} color="var(--border-card)" />
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>No active price alerts set.</div>
            <p style={{ fontSize: '12.5px', maxWidth: '380px' }}>
              Set customized price alerts on any of the 10 NSE stocks to get notified when market targets are reached.
            </p>
            <button className="btn-primary" style={{ marginTop: '8px' }} onClick={onOpenCreateAlert}>
              + Create First Alert
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Condition</th>
                  <th>Target Price</th>
                  <th>Current Market Price</th>
                  <th>Proximity</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, index) => {
                  const alertId = a.alertId || a.id;
                  const currentPrice = prices[a.symbol] || 0;
                  const target = Number(a.targetPrice);
                  const isAbove = a.direction === 'ABOVE';
                  const diff = currentPrice ? ((target - currentPrice) / currentPrice) * 100 : 0;
                  const isTriggered = a.triggeredAt !== null && a.triggeredAt !== undefined;

                  return (
                    <tr key={alertId || index}>
                      <td>
                        <div className="stock-symbol-cell">
                          <div className="stock-icon-badge" style={{ color: 'var(--accent-orange)' }}>
                            {a.symbol.substring(0, 3)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#fff' }}>{a.symbol}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NSE Equity</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          color: isAbove ? 'var(--bullish)' : 'var(--bearish)'
                        }}>
                          {isAbove ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          Price {isAbove ? 'rises above' : 'drops below'}
                        </span>
                      </td>
                      <td className="val-mono" style={{ fontSize: '14px', color: '#fff', fontWeight: '700' }}>
                        ₹{target.toFixed(2)}
                      </td>
                      <td className="val-mono" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        ₹{currentPrice ? currentPrice.toFixed(2) : '...'}
                      </td>
                      <td className="val-mono" style={{ fontSize: '12px', color: Math.abs(diff) < 2 ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
                        {diff > 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`} away
                      </td>
                      <td>
                        {isTriggered ? (
                          <span className="pill-profit" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> TRIGGERED
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: 'var(--bullish)',
                            background: 'var(--bullish-soft)',
                            padding: '3px 8px',
                            borderRadius: '4px'
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 10px', color: 'var(--bearish)' }}
                          onClick={() => handleCancel(alertId)}
                          title="Cancel alert"
                        >
                          <Trash2 size={13} />
                        </button>
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
