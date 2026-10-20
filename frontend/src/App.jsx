import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  LayoutDashboard,
  PieChart,
  Wallet,
  Bell,
  Search,
  Activity,
  User,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Layers,
  Shield,
  ArrowRight
} from 'lucide-react';

import { api, DEMO_USERS } from './api/client';
import DashboardView from './views/DashboardView';
import PortfolioView from './views/PortfolioView';
import WalletView from './views/WalletView';
import AlertsView from './views/AlertsView';
import TradeModal from './components/TradeModal';
import TransferModal from './components/TransferModal';
import AlertModal from './components/AlertModal';

export default function App() {
  // Navigation: 'dashboard' | 'portfolio' | 'wallet' | 'alerts'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Active User: Defaults to Demo User 1 (Trader with active holdings)
  const [currentUser, setCurrentUser] = useState(DEMO_USERS[0]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Live State
  const [prices, setPrices] = useState({});
  const [priceHistory, setPriceHistory] = useState({});
  const [feedStatus, setFeedStatus] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Modals state
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState('RELIANCE');
  const [selectedAction, setSelectedAction] = useState('BUY');

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // ─── 1. Poll Market Data Every 2s ──────────────────────────────────────
  const fetchMarketData = useCallback(async () => {
    try {
      const data = await api.getMarketPrices();
      if (data && data.prices) {
        setPrices(data.prices);

        // Update in-memory tick history for sparklines
        setPriceHistory(prev => {
          const next = { ...prev };
          Object.entries(data.prices).forEach(([sym, price]) => {
            const arr = next[sym] ? [...next[sym], price] : [price];
            if (arr.length > 20) arr.shift();
            next[sym] = arr;
          });
          return next;
        });
      }
    } catch (err) {
      console.warn('Market fetch error:', err.message);
    }
  }, []);

  // ─── 2. Fetch User-Specific Data (Wallet, Portfolio, Alerts) ─────────────
  const fetchUserData = useCallback(async () => {
    if (!currentUser) return;

    try {
      const [walletData, ledgerData, portfolioData, alertsData] = await Promise.allSettled([
        api.getWallet(currentUser.id),
        api.getLedger(currentUser.id, 0, 15),
        api.getPortfolio(currentUser.id),
        api.getActiveAlerts(currentUser.id)
      ]);

      if (walletData.status === 'fulfilled' && walletData.value) {
        setWallet(walletData.value);
      }
      if (ledgerData.status === 'fulfilled' && ledgerData.value?.content) {
        setLedger(ledgerData.value.content);
      }
      if (portfolioData.status === 'fulfilled' && portfolioData.value) {
        setPortfolio(portfolioData.value);
        setHoldings(portfolioData.value.holdings || []);
      }
      if (alertsData.status === 'fulfilled' && Array.isArray(alertsData.value)) {
        setAlerts(alertsData.value);
      }
    } catch (err) {
      console.warn('User data fetch error:', err.message);
    }
  }, [currentUser]);

  // Initial and recurring data subscriptions
  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 2000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Handle Trade Modal Open
  const handleOpenTrade = (symbol = 'RELIANCE', action = 'BUY') => {
    setSelectedStock(symbol);
    setSelectedAction(action);
    setTradeModalOpen(true);
  };

  // Trade Success Callback
  const handleTradeSuccess = (details) => {
    addToast(`${details.action} order for ${details.quantity}x ${details.symbol} @ ₹${Number(details.price).toFixed(2)} EXECUTED via Saga!`, 'success');
    fetchUserData();
  };

  // Transfer Success Callback
  const handleTransferSuccess = (details) => {
    addToast(`Transferred ₹${details.amount} to ${details.recipientName} successfully!`, 'success');
    fetchUserData();
  };

  // Alert Created Callback
  const handleAlertCreated = (details) => {
    addToast(`Price alert for ${details.symbol} (${details.direction} ₹${details.targetPrice}) registered!`, 'success');
    fetchUserData();
  };

  // Live formatted time for Stoxy navbar
  const [timeStr, setTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const datePart = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      const timePart = d.toLocaleTimeString('en-US', { hour12: false });
      setTimeStr(`${datePart} | LIVE | ${timePart}`);
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      {/* 1. Top Scrolling Marquee Ticker */}
      <div className="ticker-bar">
        <div className="ticker-track">
          {Object.entries(prices).map(([sym, price]) => {
            const isPos = price > 1000 ? (price % 2 === 0) : true;
            return (
              <span key={sym} className="ticker-item">
                <span className="ticker-symbol">{sym}</span>
                <span className="ticker-price">₹{price.toFixed(2)}</span>
                <span style={{ color: isPos ? 'var(--bullish)' : 'var(--bearish)', fontSize: '10.5px' }}>
                  {isPos ? '+0.20%' : '-0.18%'}
                </span>
                <span style={{ color: 'rgba(238, 229, 218, 0.2)' }}>•</span>
              </span>
            );
          })}
          {/* Duplicate track for seamless infinite marquee */}
          {Object.entries(prices).map(([sym, price]) => {
            const isPos = price > 1000 ? (price % 2 === 0) : true;
            return (
              <span key={`dup-${sym}`} className="ticker-item">
                <span className="ticker-symbol">{sym}</span>
                <span className="ticker-price">₹{price.toFixed(2)}</span>
                <span style={{ color: isPos ? 'var(--bullish)' : 'var(--bearish)', fontSize: '10.5px' }}>
                  {isPos ? '+0.20%' : '-0.18%'}
                </span>
                <span style={{ color: 'rgba(238, 229, 218, 0.2)' }}>•</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* 2. Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-logo" onClick={() => setActiveTab('dashboard')}>
            Stoxy<span className="dot">.</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>by PayNexus</span>
          </div>
          <span className="brand-subtext">NSE LIVE</span>
        </div>

        {/* Center Tabs */}
        <nav className="nav-links">
          <button
            className={`nav-link-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={15} />
            Market
          </button>
          <button
            className={`nav-link-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
            onClick={() => setActiveTab('portfolio')}
          >
            <PieChart size={15} />
            Portfolio
          </button>
          <button
            className={`nav-link-btn ${activeTab === 'wallet' ? 'active' : ''}`}
            onClick={() => setActiveTab('wallet')}
          >
            <Wallet size={15} />
            Wallet & Ledger
          </button>
          <button
            className={`nav-link-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <Bell size={15} />
            Watchlist & Alerts
          </button>
        </nav>

        {/* Right Controls */}
        <div className="nav-controls">
          <div className="search-input-wrapper">
            <Search size={14} />
            <input
              type="text"
              className="search-input"
              placeholder="Search TCS, Reliance..."
              onKeyDown={e => {
                if (e.key === 'Enter' && e.target.value) {
                  const query = e.target.value.toUpperCase();
                  if (prices[query]) {
                    handleOpenTrade(query, 'BUY');
                  }
                }
              }}
            />
          </div>

          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {timeStr}
          </div>

          {/* User Switcher Dropdown */}
          <div style={{ position: 'relative' }}>
            <div
              className="user-selector"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            >
              <div className="user-avatar">{currentUser.avatar}</div>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>{currentUser.name.split(' ')[0]}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  ₹{wallet ? wallet.availableBalance.toFixed(0) : '...'}
                </div>
              </div>
            </div>

            {userDropdownOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '44px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '8px',
                width: '260px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                zIndex: 60
              }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 10px', fontWeight: '700' }}>
                  Switch Demo Account
                </div>
                {DEMO_USERS.map(u => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setCurrentUser(u);
                      setUserDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      background: currentUser.id === u.id ? 'var(--accent-orange-soft)' : 'transparent',
                      color: currentUser.id === u.id ? 'var(--accent-orange)' : 'var(--text-primary)',
                      fontSize: '12.5px'
                    }}
                  >
                    <div className="user-avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                      {u.avatar}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600' }}>{u.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{u.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3. Main Body Layout (Sidebar + Content Viewport) */}
      <div className="app-layout">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div>
            <div className="sidebar-heading">Navigation</div>
            <div className="sidebar-menu">
              <button
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={17} />
                Dashboard
              </button>

              <button
                className={`sidebar-item ${activeTab === 'portfolio' ? 'active' : ''}`}
                onClick={() => setActiveTab('portfolio')}
              >
                <PieChart size={17} />
                Portfolio
                {holdings.length > 0 && (
                  <span className="sidebar-badge">{holdings.length}</span>
                )}
              </button>

              <button
                className={`sidebar-item ${activeTab === 'wallet' ? 'active' : ''}`}
                onClick={() => setActiveTab('wallet')}
              >
                <Wallet size={17} />
                Digital Wallet
              </button>

              <button
                className={`sidebar-item ${activeTab === 'alerts' ? 'active' : ''}`}
                onClick={() => setActiveTab('alerts')}
              >
                <Bell size={17} />
                Precision Alerts
                {alerts.length > 0 && (
                  <span className="sidebar-badge">{alerts.length}</span>
                )}
              </button>
            </div>
          </div>

          <div>
            <div style={{
              background: 'rgba(255, 87, 34, 0.08)',
              border: '1px solid rgba(255, 87, 34, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-orange)', marginBottom: '4px' }}>
                Distributed Sagas
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Spring Cloud Gateway :8080 routing to Wallet :8082 & Order Engine :8083.
              </div>
            </div>

            <div className="sidebar-footer">
              <span>v2.0 • Live Sim</span>
              <span style={{ color: 'var(--bullish)' }}>• All Systems OK</span>
            </div>
          </div>
        </aside>

        {/* Main Viewport Content */}
        <main className="main-viewport">
          {activeTab === 'dashboard' && (
            <DashboardView
              prices={prices}
              priceHistory={priceHistory}
              feedStatus={feedStatus}
              onRefresh={fetchMarketData}
              onOpenTrade={handleOpenTrade}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              portfolio={portfolio}
              holdings={holdings}
              onRefresh={fetchUserData}
              onOpenTrade={handleOpenTrade}
            />
          )}

          {activeTab === 'wallet' && (
            <WalletView
              user={currentUser}
              wallet={wallet}
              ledger={ledger}
              onRefresh={fetchUserData}
              onOpenTransfer={() => setTransferModalOpen(true)}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              alerts={alerts}
              prices={prices}
              onOpenCreateAlert={() => setAlertModalOpen(true)}
              onRefresh={fetchUserData}
            />
          )}
        </main>
      </div>

      {/* 4. Interactive Modals */}
      <TradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        initialSymbol={selectedStock}
        initialAction={selectedAction}
        prices={prices}
        user={currentUser}
        wallet={wallet}
        holdings={holdings}
        onTradeSuccess={handleTradeSuccess}
      />

      <TransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        currentUser={currentUser}
        wallet={wallet}
        onTransferSuccess={handleTransferSuccess}
      />

      <AlertModal
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        userId={currentUser.id}
        prices={prices}
        initialSymbol={selectedStock}
        onAlertCreated={handleAlertCreated}
      />

      {/* 5. Toast Notifications Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? (
              <CheckCircle size={18} color="var(--bullish)" />
            ) : (
              <AlertCircle size={18} color="var(--bearish)" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
