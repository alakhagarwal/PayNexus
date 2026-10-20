import React, { useState } from 'react';
import { ShieldCheck, Shield, Lock, Mail, User, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Sparkles, Building2 } from 'lucide-react';
import { api, DEMO_CREDENTIALS, ADMIN_CREDENTIALS } from '../api/client';

export default function LoginView({ onLoginSuccess, onSkipToGuest }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('aarav.sharma@paynexus.io');
  const [password, setPassword] = useState('SecurePass123!');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(null);

  const handleQuickFill = (cred) => {
    setEmail(cred.email);
    setPassword(cred.password);
    if (isRegister) {
      setName(cred.name);
    }
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error('Please enter your full legal name.');
        }
        const regRes = await api.register(name.trim(), email.trim(), password);
        setRegisteredSuccess(`Account and Wallet created for ${name}! Please sign in.`);
        setIsRegister(false);
      } else {
        const loginRes = await api.login(email.trim(), password);
        onLoginSuccess({
          id: loginRes.userId,
          name: loginRes.name || email.split('@')[0],
          email: loginRes.email || email,
          role: loginRes.role || (loginRes.isAdmin ? 'ROLE_ADMIN' : 'ROLE_USER'),
          isAdmin: Boolean(loginRes.isAdmin || loginRes.role === 'ROLE_ADMIN'),
          avatar: (loginRes.name || email).substring(0, 2).toUpperCase()
        });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative'
    }}>
      {/* Background radial glow */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '500px',
        height: '350px',
        background: 'radial-gradient(circle, rgba(255, 79, 0, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '28px',
          fontWeight: '800',
          color: 'var(--text-primary)',
          letterSpacing: '-0.5px'
        }}>
          Stoxy<span style={{ color: 'var(--accent-orange)' }}>.</span>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>by PayNexus</span>
        </div>
        <div style={{
          fontSize: '10.5px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '1.2px',
          marginTop: '4px'
        }}>
          High-Frequency FinTech Super-App • NSE Live Markets
        </div>
      </div>

      {/* Main Auth Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 24px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
        zIndex: 1
      }}>
        {/* Sign In vs Register Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-surface)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              background: !isRegister ? 'var(--bg-card)' : 'transparent',
              color: !isRegister ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: !isRegister ? '600' : '500',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12.5px',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              background: isRegister ? 'var(--bg-card)' : 'transparent',
              color: isRegister ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: isRegister ? '600' : '500',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12.5px',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
          >
            Create Account & Wallet
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'var(--bearish-soft)',
            border: '1px solid var(--bearish)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {registeredSuccess && (
          <div style={{
            background: 'var(--bullish-soft)',
            border: '1px solid var(--bullish)',
            color: 'var(--bullish)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={15} />
            <span>{registeredSuccess}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Legal Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '32px' }}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                />
                <User size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-dim)' }} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: '32px' }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@paynexus.io"
                required
              />
              <Mail size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label className="form-label" style={{ margin: 0 }}>Password</label>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>BCrypt Hashed</span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '32px' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
              <Lock size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '11px',
              fontSize: '13.5px',
              marginTop: '8px'
            }}
          >
            {loading ? (
              'Authenticating...'
            ) : isRegister ? (
              <>Create Account & Wallet <ArrowRight size={14} /></>
            ) : (
              <>Sign In to Terminal <ArrowRight size={14} /></>
            )}
          </button>
        </form>

        {/* Demo Fast Fill Section */}
        <div style={{
          marginTop: '22px',
          paddingTop: '18px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}>
            <span style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <KeyRound size={12} color="var(--accent-orange)" />
              1-Click Demo Accounts (Testing)
            </span>
            <span style={{ fontSize: '9.5px', color: 'var(--bullish)', fontFamily: 'var(--font-mono)' }}>
              Ready to Test
            </span>
          </div>

          {/* Customer / Trader Accounts */}
          <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', fontWeight: '700' }}>
            Customer Portals (Trading, Wallet, KYC Submission)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {DEMO_CREDENTIALS.map(c => (
              <button
                key={c.email}
                type="button"
                onClick={() => handleQuickFill(c)}
                style={{
                  background: email === c.email ? 'var(--accent-orange-soft)' : 'var(--bg-surface)',
                  border: `1px solid ${email === c.email ? 'var(--accent-orange)' : 'var(--border-card)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 9px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.role}
                </div>
              </button>
            ))}
          </div>

          {/* Compliance & Administration Account */}
          <div style={{ fontSize: '9.5px', color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Shield size={11} color="var(--accent-orange)" /> Compliance & Operations (ROLE_ADMIN)
          </div>
          <button
            type="button"
            onClick={() => handleQuickFill(ADMIN_CREDENTIALS)}
            style={{
              width: '100%',
              background: email === ADMIN_CREDENTIALS.email ? 'rgba(255, 79, 0, 0.15)' : 'rgba(255, 79, 0, 0.05)',
              border: `1px solid ${email === ADMIN_CREDENTIALS.email ? 'var(--accent-orange)' : 'rgba(255, 79, 0, 0.25)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'var(--transition-fast)'
            }}
          >
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={12} /> {ADMIN_CREDENTIALS.name}
                <span style={{ fontSize: '9px', background: 'var(--accent-orange)', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>ADMIN</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Admin Console • Approve/Reject KYCs • Freeze Compromised Accounts
              </div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              admin@paynexus.io
            </div>
          </button>

          {/* Skip direct button */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onSkipToGuest}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11.5px',
                cursor: 'pointer',
                textDecoration: 'underline',
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Skip login & continue as Guest Demo Trader →
            </button>
          </div>
        </div>
      </div>

      {/* Security Architecture Footer Badges */}
      <div style={{
        marginTop: '22px',
        display: 'flex',
        gap: '16px',
        fontSize: '10.5px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-dim)',
        flexWrap: 'wrap',
        justifyContent: 'center',
        zIndex: 1
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} color="var(--bullish)" /> BCrypt 12-Round Password Hashing
        </span>
        <span>•</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Building2 size={12} color="var(--accent-orange)" /> Atomic User + Wallet Generation
        </span>
        <span>•</span>
        <span>Spring Cloud Gateway :8080</span>
      </div>
    </div>
  );
}
