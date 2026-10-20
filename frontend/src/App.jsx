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
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  LogOut,
  FileCheck,
  CheckCircle2,
  Lock,
  UserCheck
} from 'lucide-react';

import { api, DEMO_USERS, ADMIN_USER } from './api/client';
import DashboardView from './views/DashboardView';
import PortfolioView from './views/PortfolioView';
import WalletView from './views/WalletView';
import AlertsView from './views/AlertsView';
import AdminView from './views/AdminView';
import LoginView from './views/LoginView';
import TradeModal from './components/TradeModal';
import TransferModal from './components/TransferModal';
import AlertModal from './components/AlertModal';
import KycModal from './components/KycModal';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('paynexus_logged_in') === 'true';
  });

  // Current User (Defaults to Aarav Sharma if customer, or ADMIN_USER if admin logged in)
  const [currentUser, setCurrentUser] = useState(() => {
    const savedRole = localStorage.getItem('paynexus_role');
    return savedRole === 'ROLE_ADMIN' ? ADMIN_USER : DEMO_USERS[0];
  });

  const isAdmin = currentUser?.role === 'ROLE_ADMIN' || currentUser?.isAdmin === true || currentUser?.email === 'admin@paynexus.io';

  // Navigation: 'dashboard' | 'portfolio' | 'wallet' | 'alerts' | 'admin'
  const [activeTab, setActiveTab] = useState(() => {
    const savedRole = localStorage.getItem('paynexus_role');
    return savedRole === 'ROLE_ADMIN' ? 'admin' : 'dashboard';
  });

  const [userProfile, setUserProfile] = useState(null);
  const [pendingKycCount, setPendingKycCount] = useState(0);
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
  const [kycModalOpen, setKycModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Enforce RBAC Tab constraints
  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

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

  // ─── 2. Fetch User-Specific Data Based on Role ──────────────────────────
  const fetchUserData = useCallback(async () => {
    if (!currentUser) return;

    // Admin Persona: Only needs pending KYC queue & system health
    if (isAdmin) {
      try {
        const pendingKycData = await api.getPendingKyc();
        if (Array.isArray(pendingKycData)) {
          setPendingKycCount(pendingKycData.length);
        }
      } catch (err) {
        console.warn('Admin pending KYC fetch error:', err.message);
      }
      return;
    }

    // Customer Persona: Wallet, Ledger, Portfolio, Alerts, Profile
    try {
      const [walletData, ledgerData, portfolioData, alertsData, profileData] = await Promise.allSettled([
        api.getWallet(currentUser.id),
        api.getLedger(currentUser.id, 0, 15),
        api.getPortfolio(currentUser.id),
        api.getActiveAlerts(currentUser.id),
        api.getProfile(currentUser.id)
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
      if (profileData.status === 'fulfilled' && profileData.value) {
        setUserProfile(profileData.value);
      }
    } catch (err) {
      console.warn('User data fetch error:', err.message);
    }
  }, [currentUser, isAdmin]);

  // Initial and recurring data subscriptions
  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 2000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserData();
    }
  }, [fetchUserData, isAuthenticated]);

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

  // KYC Submission Callback
  const handleKycSubmitted = () => {
    addToast('KYC documents submitted to compliance queue! Awaiting Compliance Officer approval.', 'success');
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

  // ─── If Not Authenticated, Render Dedicated Login View ──────────────────
  if (!isAuthenticated) {
    return (
      <>
        <LoginView
          onLoginSuccess={(loggedInUser) => {
            if (loggedInUser.isAdmin || loggedInUser.role === 'ROLE_ADMIN' || loggedInUser.email === 'admin@paynexus.io') {
              setCurrentUser(ADMIN_USER);
              setIsAuthenticated(true);
              setActiveTab('admin');
              localStorage.setItem('paynexus_logged_in', 'true');
              localStorage.setItem('paynexus_role', 'ROLE_ADMIN');
              addToast(`Authenticated as Compliance Officer (${ADMIN_USER.name})`, 'success');
              return;
            }

            const matched = DEMO_USERS.find(u => u.id === loggedInUser.id || u.email.toLowerCase() === loggedInUser.email.toLowerCase());
            const sessionUser = matched || {
              id: loggedInUser.id,
              name: loggedInUser.name,
              email: loggedInUser.email,
              role: 'ROLE_USER',
              isAdmin: false,
              avatar: (loggedInUser.name || 'US').substring(0, 2).toUpperCase()
            };
            setCurrentUser(sessionUser);
            setIsAuthenticated(true);
            setActiveTab('dashboard');
            localStorage.setItem('paynexus_logged_in', 'true');
            localStorage.setItem('paynexus_role', 'ROLE_USER');
            addToast(`Authenticated successfully as ${sessionUser.name}`, 'success');
          }}
          onSkipToGuest={() => {
            setCurrentUser(DEMO_USERS[0]);
            setIsAuthenticated(true);
            setActiveTab('dashboard');
            localStorage.setItem('paynexus_logged_in', 'true');
            localStorage.setItem('paynexus_role', 'ROLE_USER');
            addToast('Logged in as Aarav Sharma (Active Portfolio)', 'success');
          }}
        />

        {/* Toast Container for Login view */}
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
      </>
    );
  }

  const kycStatus = userProfile?.kycStatus || (currentUser?.typeDescription?.includes('SUBMITTED') ? 'SUBMITTED' : (currentUser?.typeDescription?.includes('Verified') ? 'VERIFIED' : 'PENDING'));

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
          <div className="brand-logo" onClick={() => setActiveTab(isAdmin ? 'admin' : 'dashboard')} style={{ cursor: 'pointer' }}>
            Stoxy<span className="dot">.</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>by PayNexus</span>
          </div>
          <span className="brand-subtext" style={{ color: isAdmin ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
            {isAdmin ? 'COMPLIANCE PORTAL' : 'NSE LIVE'}
          </span>
        </div>

        {/* Center Tabs: Role-Based Access Control */}
        <nav className="nav-links">
          {isAdmin ? (
            /* ADMIN NAVIGATION TABS */
            <>
              <button
                className={`nav-link-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
                style={{
                  borderColor: activeTab === 'admin' ? 'var(--accent-orange)' : 'transparent',
                  color: activeTab === 'admin' ? 'var(--accent-orange)' : 'var(--text-secondary)'
                }}
              >
                <Shield size={15} />
                Compliance Console
                {pendingKycCount > 0 && (
                  <span style={{
                    background: 'var(--accent-orange)',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    fontWeight: '700'
                  }}>
                    {pendingKycCount}
                  </span>
                )}
              </button>

              <button
                className={`nav-link-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={15} />
                Market Feeds Monitor
              </button>
            </>
          ) : (
            /* CUSTOMER / TRADER NAVIGATION TABS */
            <>
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
            </>
          )}
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
              style={{
                border: isAdmin ? '1px solid rgba(255, 79, 0, 0.4)' : '1px solid var(--border-card)',
                background: isAdmin ? 'rgba(255, 79, 0, 0.08)' : 'var(--bg-surface)'
              }}
            >
              <div className="user-avatar" style={{ background: isAdmin ? 'var(--accent-orange)' : undefined, color: '#fff' }}>
                {currentUser.avatar || (isAdmin ? 'AD' : 'US')}
              </div>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {currentUser.name.split(' ')[0]}
                </div>
                <div style={{ fontSize: '10px', color: isAdmin ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
                  {isAdmin ? 'ADMIN' : (wallet ? `₹${Number(wallet.availableBalance).toFixed(0)}` : '...')}
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
                width: '280px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
                zIndex: 60
              }}>
                {/* Active user header inside dropdown */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{currentUser.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{currentUser.email}</div>
                  
                  {/* Role / KYC Status Pill in Dropdown */}
                  <div style={{
                    marginTop: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '10.5px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: isAdmin ? 'rgba(255, 79, 0, 0.15)' : (kycStatus === 'VERIFIED' ? 'var(--bullish-soft)' : 'rgba(255, 79, 0, 0.12)'),
                    color: isAdmin ? 'var(--accent-orange)' : (kycStatus === 'VERIFIED' ? 'var(--bullish)' : 'var(--accent-orange)')
                  }}>
                    {isAdmin ? <Shield size={12} /> : (kycStatus === 'VERIFIED' ? <ShieldCheck size={12} /> : <FileCheck size={12} />)}
                    {isAdmin ? 'ROLE: COMPLIANCE OFFICER' : `KYC: ${kycStatus}`}
                  </div>
                </div>

                {/* Quick actions for customer */}
                {!isAdmin && kycStatus !== 'VERIFIED' && (
                  <div
                    onClick={() => {
                      setKycModalOpen(true);
                      setUserDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--accent-orange)',
                      background: 'rgba(255, 79, 0, 0.08)',
                      marginBottom: '6px'
                    }}
                  >
                    <FileCheck size={14} /> Submit / Update KYC
                  </div>
                )}

                {/* Switch to Admin Shortcut for quick demo evaluation */}
                {!isAdmin && (
                  <div
                    onClick={() => {
                      setCurrentUser(ADMIN_USER);
                      setActiveTab('admin');
                      localStorage.setItem('paynexus_role', 'ROLE_ADMIN');
                      setUserDropdownOpen(false);
                      addToast('Switched to Compliance Officer Portal', 'info');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                      color: 'var(--accent-orange)',
                      background: 'rgba(255, 79, 0, 0.05)',
                      border: '1px dashed rgba(255, 79, 0, 0.3)',
                      marginBottom: '8px'
                    }}
                  >
                    <Shield size={13} /> Switch to Compliance Admin →
                  </div>
                )}

                {/* Switch to Customer Shortcut if currently Admin */}
                {isAdmin && (
                  <div
                    onClick={() => {
                      setCurrentUser(DEMO_USERS[0]);
                      setActiveTab('dashboard');
                      localStorage.setItem('paynexus_role', 'ROLE_USER');
                      setUserDropdownOpen(false);
                      addToast('Switched to Customer Trading Portal (Aarav)', 'info');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                      color: 'var(--text-secondary)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      marginBottom: '8px'
                    }}
                  >
                    <UserCheck size={13} /> Switch to Customer (Aarav) →
                  </div>
                )}

                {!isAdmin && (
                  <>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 10px', fontWeight: '700' }}>
                      Switch Customer Account
                    </div>
                    {DEMO_USERS.map(u => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setCurrentUser(u);
                          setUserDropdownOpen(false);
                          addToast(`Switched account to ${u.name}`, 'info');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          background: currentUser.id === u.id ? 'var(--accent-orange-soft)' : 'transparent',
                          color: currentUser.id === u.id ? 'var(--accent-orange)' : 'var(--text-primary)',
                          fontSize: '12px'
                        }}
                      >
                        <div className="user-avatar" style={{ width: '22px', height: '22px', fontSize: '9.5px' }}>
                          {u.avatar}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600' }}>{u.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{u.typeDescription || u.role}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Sign Out Action */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '6px', paddingTop: '6px' }}>
                  <div
                    onClick={() => {
                      setIsAuthenticated(false);
                      localStorage.setItem('paynexus_logged_in', 'false');
                      localStorage.removeItem('paynexus_role');
                      setUserDropdownOpen(false);
                      addToast('Signed out. Return to login anytime.', 'info');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--bearish)'
                    }}
                  >
                    <LogOut size={13} /> Sign Out (Back to Login)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3. Main Body Layout (Sidebar + Content Viewport) */}
      <div className="app-layout">
        {/* Left Sidebar: Role-Based Items */}
        <aside className="sidebar">
          <div>
            <div className="sidebar-heading">
              {isAdmin ? 'Compliance Operations' : 'Navigation'}
            </div>
            
            <div className="sidebar-menu">
              {isAdmin ? (
                /* ADMIN SIDEBAR MENU */
                <>
                  <button
                    className={`sidebar-item ${activeTab === 'admin' ? 'active' : ''}`}
                    onClick={() => setActiveTab('admin')}
                  >
                    <Shield size={17} />
                    Compliance & KYC Review
                    {pendingKycCount > 0 && (
                      <span className="sidebar-badge" style={{ background: 'var(--accent-orange)' }}>
                        {pendingKycCount}
                      </span>
                    )}
                  </button>

                  <button
                    className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                  >
                    <LayoutDashboard size={17} />
                    Market Feeds Monitor
                  </button>
                </>
              ) : (
                /* CUSTOMER SIDEBAR MENU */
                <>
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
                </>
              )}
            </div>
          </div>

          <div>
            <div style={{
              background: isAdmin ? 'rgba(255, 79, 0, 0.08)' : 'rgba(255, 79, 0, 0.06)',
              border: `1px solid ${isAdmin ? 'rgba(255, 79, 0, 0.3)' : 'rgba(255, 79, 0, 0.15)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-orange)', marginBottom: '4px' }}>
                {isAdmin ? 'Privileged Security' : 'Distributed Sagas'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {isAdmin
                  ? 'Authorized for regulatory identity approval and fraud prevention wallet freeze holds.'
                  : 'Spring Cloud Gateway :8080 routing to Wallet :8082 & Order Engine :8083.'}
              </div>
            </div>

            <div className="sidebar-footer">
              <span>{isAdmin ? 'Role: ROLE_ADMIN' : 'v2.0 • Live Sim'}</span>
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
              onOpenTrade={isAdmin ? undefined : handleOpenTrade}
            />
          )}

          {!isAdmin && activeTab === 'portfolio' && (
            <PortfolioView
              portfolio={portfolio}
              holdings={holdings}
              onRefresh={fetchUserData}
              onOpenTrade={handleOpenTrade}
            />
          )}

          {!isAdmin && activeTab === 'wallet' && (
            <WalletView
              user={currentUser}
              userProfile={userProfile}
              wallet={wallet}
              ledger={ledger}
              onRefresh={fetchUserData}
              onOpenTransfer={() => setTransferModalOpen(true)}
              onOpenKyc={() => setKycModalOpen(true)}
              onNavigateAdmin={() => setActiveTab('admin')}
            />
          )}

          {!isAdmin && activeTab === 'alerts' && (
            <AlertsView
              alerts={alerts}
              prices={prices}
              onOpenCreateAlert={() => setAlertModalOpen(true)}
              onRefresh={fetchUserData}
            />
          )}

          {isAdmin && activeTab === 'admin' && (
            <AdminView
              onKycActionSuccess={() => {
                fetchUserData();
                addToast('Administrative action executed successfully!', 'success');
              }}
            />
          )}
        </main>
      </div>

      {/* 4. Interactive Modals (Customers Only) */}
      {!isAdmin && (
        <>
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

          <KycModal
            isOpen={kycModalOpen}
            onClose={() => setKycModalOpen(false)}
            userId={currentUser.id}
            userName={currentUser.name}
            currentStatus={kycStatus}
            onKycSubmitted={handleKycSubmitted}
          />
        </>
      )}

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
