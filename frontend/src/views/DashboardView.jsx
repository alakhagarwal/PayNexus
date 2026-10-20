import React from 'react';
import { RefreshCw, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Sparkline from '../components/Sparkline';

export default function DashboardView({
  prices = {},
  priceHistory = {},
  feedStatus,
  onRefresh,
  onOpenTrade
}) {
  // Live NIFTY50 base reference
  const nifty50 = prices['NIFTY50'] || 22888.95;
  const sensex = nifty50 * 3.2266;
  const niftyBank = nifty50 * 2.4242;
  const nifty100 = nifty50 * 1.044;
  const nifty200 = nifty50 * 0.5768;

  // 5 Top Benchmark Indices matching Stoxy layout
  const indices = [
    { name: 'NIFTY 50', price: nifty50, change: '-108.40', pct: '-0.47%', isPos: false },
    { name: 'SENSEX', price: sensex, change: '-462.71', pct: '-0.62%', isPos: false },
    { name: 'NIFTY BANK', price: niftyBank, change: '-322.40', pct: '-0.58%', isPos: false },
    { name: 'NIFTY 100', price: nifty100, change: '-90.65', pct: '-0.38%', isPos: false },
    { name: 'NIFTY 200', price: nifty200, change: '+71.95', pct: '+0.54%', isPos: true },
  ];

  // List of stocks for the active trading table
  const stockSymbols = Object.keys(prices).filter(s => s !== 'NIFTY50');

  // Sectors for Sector Breadth (exact Stoxy data from screenshot)
  const sectors = [
    { name: 'Banking', change: '-0.58%', isPos: false, pctVal: 0.58 },
    { name: 'Auto', change: '+0.06%', isPos: true, pctVal: 0.06 },
    { name: 'Finance', change: '-1.49%', isPos: false, pctVal: 1.49 },
    { name: 'FMCG', change: '-1.82%', isPos: false, pctVal: 1.82 },
    { name: 'IT', change: '+2.59%', isPos: true, pctVal: 2.59 },
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <div style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-dim)',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--bullish)' }} />
            MARKET CLOSED • LIVE SIMULATION FEED ACTIVE
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: '1.2' }}>
            Market Overview
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            Equities • Indices • AI Analysis
          </p>
        </div>

        <button className="btn-secondary" onClick={onRefresh} style={{ fontSize: '11.5px', padding: '5px 12px' }}>
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Stoxy AI Summary Banner */}
      <div className="ai-summary-banner">
        <span className="ai-tag">TODAY'S AI MARKET SUMMARY</span>
        <div className="ai-banner-text">
          — COMING SOON Stay tuned for AI-powered insights and analysis to help you make informed investment decisions.
        </div>
      </div>

      {/* 5 Benchmark Indices Cards Strip */}
      <div className="index-cards-row">
        {indices.map(idx => (
          <div key={idx.name} className="index-card">
            <div>
              <div className="index-card-header">
                <span className="index-name">{idx.name}</span>
                <span className="exchange-badge">NSE</span>
              </div>
              <div className="index-price">
                {idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: idx.isPos ? 'var(--bullish)' : 'var(--bearish)',
                marginTop: '2px'
              }}>
                {idx.isPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{idx.change} ( {idx.pct} )</span>
              </div>
            </div>
            <Sparkline isPositive={idx.isPos} height={32} />
          </div>
        ))}
      </div>

      {/* 2-Column Section: Market Pulse / Sector Breadth vs Index Overview Table */}
      <div className="dashboard-grid-2col">
        {/* Left: Market Pulse & Sector Breadth */}
        <div className="panel-card">
          <div className="panel-header" style={{ marginBottom: '12px' }}>
            <div className="panel-title">
              MARKET PULSE
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--bullish)' }}>
                5
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Gaining</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--bearish)' }}>
                14
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Declining</span>
            </div>
          </div>

          <div style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-dim)',
            marginBottom: '12px',
            fontWeight: '700',
            fontFamily: 'var(--font-mono)'
          }}>
            SECTOR BREADTH
          </div>

          <div>
            {sectors.map(sec => {
              const barWidth = Math.min(46, sec.pctVal * 16);
              return (
                <div key={sec.name} className="sector-row">
                  <span className="sector-name">{sec.name}</span>
                  <div className="sector-bipolar-container">
                    <div className="sector-center-axis" />
                    {sec.isPos ? (
                      <div
                        className="sector-bar-right"
                        style={{ width: `${barWidth}%` }}
                      />
                    ) : (
                      <div
                        className="sector-bar-left"
                        style={{ width: `${barWidth}%` }}
                      />
                    )}
                  </div>
                  <span style={{
                    width: '52px',
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: sec.isPos ? 'var(--bullish)' : 'var(--bearish)'
                  }}>
                    {sec.change}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '16px',
            fontSize: '10px',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            lineHeight: '1.4',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '10px'
          }}>
            Breadth driven by Banking at -0.58% — 5 of 19 tracked indices advancing.
          </div>
        </div>

        {/* Right: Index & Equities Overview Table */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              INDEX OVERVIEW • VIEW ALL →
            </div>
            <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              10 LIVE STOCKS
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>INDEX / SYMBOL</th>
                  <th>EXCHANGE</th>
                  <th style={{ textAlign: 'right' }}>LAST</th>
                  <th style={{ textAlign: 'right' }}>CHANGE</th>
                  <th style={{ textAlign: 'right' }}>CHG %</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {stockSymbols.map(sym => {
                  const price = prices[sym] || 0;
                  const isUp = (sym === 'TATAMOTORS' || sym === 'INFY' || sym === 'WIPRO');
                  const chgAmount = isUp ? (price * 0.0054).toFixed(2) : (price * -0.0047).toFixed(2);
                  const chgPercent = isUp ? '+0.54%' : '-0.47%';

                  return (
                    <tr key={sym}>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '12.5px' }}>
                          {sym}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          NSE
                        </span>
                      </td>
                      <td className="val-mono" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                        {price > 0 ? price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}
                      </td>
                      <td className="val-mono" style={{
                        textAlign: 'right',
                        color: isUp ? 'var(--bullish)' : 'var(--bearish)'
                      }}>
                        {chgAmount}
                      </td>
                      <td className="val-mono" style={{
                        textAlign: 'right',
                        color: isUp ? 'var(--bullish)' : 'var(--bearish)'
                      }}>
                        {chgPercent}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            className="btn-trade-buy"
                            onClick={() => onOpenTrade(sym, 'BUY')}
                          >
                            BUY
                          </button>
                          <button
                            className="btn-trade-sell"
                            onClick={() => onOpenTrade(sym, 'SELL')}
                          >
                            SELL
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
