import React from 'react';
import { Plus, RefreshCw, TrendingUp, TrendingDown, Layers, PieChart } from 'lucide-react';

export default function PortfolioView({
  portfolio,
  holdings = [],
  onRefresh,
  onOpenTrade
}) {
  const totalStocks = portfolio?.totalStocks || holdings.length || 0;
  const totalInvested = portfolio?.totalInvested ? Number(portfolio.totalInvested) : 0;
  const totalCurrentValue = portfolio?.totalCurrentValue ? Number(portfolio.totalCurrentValue) : 0;
  const totalUnrealizedPnl = portfolio?.totalUnrealizedPnl !== undefined ? Number(portfolio.totalUnrealizedPnl) : 0;
  const totalPnlPercent = portfolio?.totalPnlPercent !== undefined ? Number(portfolio.totalPnlPercent) : 0;
  const pnlDirection = portfolio?.overallPnlDirection || (totalUnrealizedPnl >= 0 ? 'PROFIT' : 'LOSS');
  const isProfit = pnlDirection === 'PROFIT';

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
            Portfolio
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontWeight: '700' }}>
            Holdings & Real-Time P&L Analysis
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-primary"
            onClick={() => onOpenTrade('RELIANCE', 'BUY')}
          >
            <Plus size={15} />
            + Buy a new stock...
          </button>
          <button className="btn-secondary" onClick={onRefresh}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* 4 Metric Cards Row (Stoxy Layout) */}
      <div className="metrics-strip">
        {/* Invested */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Invested</span>
            <PieChart size={14} color="var(--text-muted)" />
          </div>
          <div className="metric-value">
            ₹{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Initial capital deployed
          </div>
        </div>

        {/* Current Value */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Current Value</span>
            <Layers size={14} color="var(--text-muted)" />
          </div>
          <div className="metric-value">
            ₹{totalCurrentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Mark-to-market live Redis valuation
          </div>
        </div>

        {/* Unrealised P&L */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Unrealised P&L</span>
            {isProfit ? (
              <TrendingUp size={15} color="var(--bullish)" />
            ) : (
              <TrendingDown size={15} color="var(--bearish)" />
            )}
          </div>
          <div className="metric-value" style={{ color: isProfit ? 'var(--bullish)' : 'var(--bearish)' }}>
            {isProfit ? '+' : ''}₹{totalUnrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="metric-sub">
            <span className={isProfit ? 'pill-profit' : 'pill-loss'}>
              {isProfit ? '+' : ''}{totalPnlPercent.toFixed(2)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>overall return</span>
          </div>
        </div>

        {/* Total Stocks */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Total Positions</span>
            <span className="exchange-badge">ACTIVE</span>
          </div>
          <div className="metric-value">
            {totalStocks} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>stocks</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Weighted Avg Price accounting
          </div>
        </div>
      </div>

      {/* Holdings Section */}
      <div className="panel-card" style={{ marginTop: '24px' }}>
        <div className="panel-header">
          <div className="panel-title">
            Holdings ({totalStocks})
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Live calculations via Redis Dual-Write
          </span>
        </div>

        {holdings.length === 0 ? (
          <div style={{
            padding: '50px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Layers size={36} color="var(--border-card)" />
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>No active stock holdings yet.</div>
            <p style={{ fontSize: '12.5px', maxWidth: '380px' }}>
              Execute your first BUY order using available wallet funds to start tracking live mark-to-market P&L.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: '8px' }}
              onClick={() => onOpenTrade('RELIANCE', 'BUY')}
            >
              + Buy RELIANCE
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Quantity</th>
                  <th>Avg Buy Price</th>
                  <th>Current Price (Redis)</th>
                  <th>Total Invested</th>
                  <th>Current Value</th>
                  <th>Unrealized P&L</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const isHProfit = h.pnlDirection === 'PROFIT';
                  const pnl = h.unrealizedPnl !== undefined && h.unrealizedPnl !== null ? Number(h.unrealizedPnl) : 0;
                  const pnlPct = h.pnlPercent !== undefined && h.pnlPercent !== null ? Number(h.pnlPercent) : 0;

                  return (
                    <tr key={h.holdingId || h.symbol}>
                      <td>
                        <div className="stock-symbol-cell">
                          <div className="stock-icon-badge" style={{ color: 'var(--accent-orange)' }}>
                            {h.symbol.substring(0, 3)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#fff' }}>{h.symbol}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NSE Equity</div>
                          </div>
                        </div>
                      </td>
                      <td className="val-mono" style={{ fontSize: '14px', color: '#fff' }}>
                        {h.quantity}
                      </td>
                      <td className="val-mono" style={{ color: 'var(--text-secondary)' }}>
                        ₹{Number(h.avgBuyPrice).toFixed(2)}
                      </td>
                      <td className="val-mono" style={{ color: '#fff', fontSize: '14px' }}>
                        ₹{h.currentPrice ? Number(h.currentPrice).toFixed(2) : '...'}
                      </td>
                      <td className="val-mono" style={{ color: 'var(--text-secondary)' }}>
                        ₹{Number(h.totalInvested).toFixed(2)}
                      </td>
                      <td className="val-mono" style={{ color: '#fff', fontWeight: '700' }}>
                        ₹{h.currentValue ? Number(h.currentValue).toFixed(2) : '...'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            color: isHProfit ? 'var(--bullish)' : 'var(--bearish)'
                          }}>
                            {isHProfit ? '+' : ''}₹{pnl.toFixed(2)}
                          </span>
                          <span className={isHProfit ? 'pill-profit' : 'pill-loss'} style={{ alignSelf: 'flex-start' }}>
                            {isHProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn-trade-buy"
                            onClick={() => onOpenTrade(h.symbol, 'BUY')}
                          >
                            Buy More
                          </button>
                          <button
                            className="btn-trade-sell"
                            onClick={() => onOpenTrade(h.symbol, 'SELL')}
                          >
                            Sell
                          </button>
                        </div>
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
