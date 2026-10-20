import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, UserX, Lock, Unlock, RefreshCw, AlertCircle, CheckCircle2, Server, Eye, Search, Layers } from 'lucide-react';
import { api, DEMO_USERS } from '../api/client';

export default function AdminView({ onKycActionSuccess }) {
  const [activeTab, setActiveTab] = useState('kyc'); // 'kyc' | 'freeze' | 'system'
  const [pendingKyc, setPendingKyc] = useState([]);
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // Freeze tab state
  const [selectedUserForFreeze, setSelectedUserForFreeze] = useState(DEMO_USERS[0].id);
  const [freezeLoading, setFreezeLoading] = useState(false);

  // Reject Remarks modal state
  const [rejectingUserId, setRejectingUserId] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('PAN and legal name record mismatch in ITD registry');

  const fetchPendingKyc = async () => {
    setLoadingKyc(true);
    try {
      const data = await api.getPendingKyc();
      setPendingKyc(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Pending KYC fetch warning:', err.message);
      setPendingKyc([]);
    } finally {
      setLoadingKyc(false);
    }
  };

  useEffect(() => {
    fetchPendingKyc();
  }, []);

  const handleApprove = async (userId, userName) => {
    setActionLoadingId(userId);
    try {
      await api.approveKyc(userId, 'Verified by System Administrator');
      setAlertMsg({ type: 'success', text: `KYC approved for ${userName}. Account status is now VERIFIED.` });
      fetchPendingKyc();
      if (onKycActionSuccess) onKycActionSuccess();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to approve KYC.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingUserId) return;
    setActionLoadingId(rejectingUserId);
    try {
      await api.rejectKyc(rejectingUserId, rejectRemarks);
      setAlertMsg({ type: 'success', text: `KYC rejected with remarks: "${rejectRemarks}". User can re-submit.` });
      setRejectingUserId(null);
      fetchPendingKyc();
      if (onKycActionSuccess) onKycActionSuccess();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to reject KYC.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFreezeToggle = async (userId, shouldFreeze) => {
    setFreezeLoading(true);
    try {
      if (shouldFreeze) {
        await api.freezeWallet(userId);
        setAlertMsg({ type: 'success', text: `Wallet frozen for user ${userId}. All transactions blocked.` });
      } else {
        await api.unfreezeWallet(userId);
        setAlertMsg({ type: 'success', text: `Wallet unfrozen for user ${userId}. Transactions restored.` });
      }
      if (onKycActionSuccess) onKycActionSuccess();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setFreezeLoading(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Admin & Compliance Console
            </h1>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--accent-orange-soft)',
              color: 'var(--accent-orange)',
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>
              ROLE: COMPLIANCE OFFICER
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            KYC Verification Queue • Wallet Risk Controls • Spring Cloud Gateway :8080
          </p>
        </div>

        <button className="btn-secondary" onClick={fetchPendingKyc} style={{ fontSize: '11.5px', padding: '5px 12px' }}>
          <RefreshCw size={12} />
          Refresh Queue
        </button>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div style={{
          background: alertMsg.type === 'success' ? 'var(--bullish-soft)' : 'var(--bearish-soft)',
          border: `1px solid ${alertMsg.type === 'success' ? 'var(--bullish)' : 'var(--bearish)'}`,
          color: alertMsg.type === 'success' ? 'var(--bullish)' : '#fca5a5',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {alertMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{alertMsg.text}</span>
          </div>
          <button
            onClick={() => setAlertMsg(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin Metrics Strip */}
      <div className="metrics-strip">
        <div className="metric-card">
          <div className="metric-header">
            <span>Pending KYC Queue</span>
            <ShieldCheck size={14} color="var(--accent-orange)" />
          </div>
          <div className="metric-value" style={{ color: pendingKyc.length > 0 ? '#f59e0b' : 'var(--bullish)' }}>
            {pendingKyc.length} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>submissions</span>
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Awaiting compliance review
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>API Gateway Routing</span>
            <Server size={14} color="var(--bullish)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--bullish)' }}>
            Port :8080
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            lb://wallet-service active
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Distributed Locking</span>
            <Lock size={14} color="var(--accent-orange)" />
          </div>
          <div className="metric-value">
            Redisson
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Atomic MultiLock active
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '8px'
      }}>
        <button
          className={`btn-secondary ${activeTab === 'kyc' ? 'btn-primary' : ''}`}
          style={{ fontSize: '12px', padding: '6px 14px' }}
          onClick={() => setActiveTab('kyc')}
        >
          <ShieldCheck size={14} />
          KYC Review Queue ({pendingKyc.length})
        </button>
        <button
          className={`btn-secondary ${activeTab === 'freeze' ? 'btn-primary' : ''}`}
          style={{ fontSize: '12px', padding: '6px 14px' }}
          onClick={() => setActiveTab('freeze')}
        >
          <Lock size={14} />
          Account Risk & Freeze Control
        </button>
        <button
          className={`btn-secondary ${activeTab === 'system' ? 'btn-primary' : ''}`}
          style={{ fontSize: '12px', padding: '6px 14px' }}
          onClick={() => setActiveTab('system')}
        >
          <Layers size={14} />
          Microservice Topology
        </button>
      </div>

      {/* TAB 1: KYC Review Queue */}
      {activeTab === 'kyc' && (
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              Pending KYC Applications ({pendingKyc.length})
            </div>
            <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Text-based regulatory compliance
            </span>
          </div>

          {loadingKyc ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading compliance queue...
            </div>
          ) : pendingKyc.length === 0 ? (
            <div style={{
              padding: '45px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <CheckCircle2 size={36} color="var(--bullish)" />
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>
                All KYC Applications Processed
              </div>
              <p style={{ fontSize: '12px', maxWidth: '380px' }}>
                There are no pending submissions in the queue. You can submit new identity details using the KYC modal in the user terminal.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Email</th>
                    <th>PAN Number</th>
                    <th>Aadhaar (Last 4)</th>
                    <th>Date of Birth</th>
                    <th>Submitted At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingKyc.map((item) => {
                    const isActing = actionLoadingId === item.userId;
                    const dateStr = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'N/A';

                    return (
                      <tr key={item.userId}>
                        <td>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {item.userName}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            UUID: {item.userId.substring(0, 12)}...
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{item.userEmail}</td>
                        <td className="val-mono" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                          {item.panNumber}
                        </td>
                        <td className="val-mono">•••• •••• {item.aadhaarLastFour}</td>
                        <td className="val-mono">{item.dateOfBirth}</td>
                        <td className="val-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {dateStr}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn-trade-buy"
                              style={{ padding: '5px 12px' }}
                              disabled={isActing}
                              onClick={() => handleApprove(item.userId, item.userName)}
                            >
                              <UserCheck size={12} style={{ marginRight: '4px' }} />
                              {isActing ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              className="btn-trade-sell"
                              style={{ padding: '5px 12px' }}
                              disabled={isActing}
                              onClick={() => setRejectingUserId(item.userId)}
                            >
                              <UserX size={12} style={{ marginRight: '4px' }} />
                              Reject
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
      )}

      {/* TAB 2: Freeze / Risk Control */}
      {activeTab === 'freeze' && (
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              Wallet Risk & Fraud Prevention Controls
            </div>
            <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              PUT /admin/users/{'{userId}'}/freeze
            </span>
          </div>

          <div style={{ maxWidth: '520px', marginBottom: '24px' }}>
            <div className="form-group">
              <label className="form-label">Select User Account to Manage</label>
              <select
                className="form-select"
                value={selectedUserForFreeze}
                onChange={e => setSelectedUserForFreeze(e.target.value)}
              >
                {DEMO_USERS.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — ID: {u.id.substring(0, 14)}...
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                className="btn-trade-sell"
                style={{ padding: '10px 18px', fontSize: '12.5px' }}
                disabled={freezeLoading}
                onClick={() => handleFreezeToggle(selectedUserForFreeze, true)}
              >
                <Lock size={14} style={{ marginRight: '6px' }} />
                Freeze User Wallet
              </button>
              <button
                className="btn-trade-buy"
                style={{ padding: '10px 18px', fontSize: '12.5px' }}
                disabled={freezeLoading}
                onClick={() => handleFreezeToggle(selectedUserForFreeze, false)}
              >
                <Unlock size={14} style={{ marginRight: '6px' }} />
                Unfreeze User Wallet
              </button>
            </div>
          </div>

          <div style={{
            fontSize: '11px',
            color: 'var(--text-dim)',
            lineHeight: '1.4',
            background: 'rgba(238, 229, 218, 0.02)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}>
            Freezing a user's wallet sets <code>is_frozen = true</code> in PostgreSQL. The atomic distributed transfer engine rejects all subsequent outgoing transfers and stock BUY orders until cleared by compliance.
          </div>
        </div>
      )}

      {/* TAB 3: System Topology */}
      {activeTab === 'system' && (
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              Microservices Architecture Topology
            </div>
            <span style={{ fontSize: '10.5px', color: 'var(--bullish)', fontFamily: 'var(--font-mono)' }}>
              ● 4 Services Healthy
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {[
              { name: 'API Gateway', port: '8080', tech: 'Spring Cloud Gateway (Netty)', status: 'ONLINE', route: '/api/v1/**' },
              { name: 'Wallet Service', port: '8082', tech: 'Spring Boot • PostgreSQL • Redis', status: 'ONLINE', route: '/api/v1/wallet/**' },
              { name: 'Order Engine', port: '8083', tech: 'Distributed Saga • Redis Feeds', status: 'ONLINE', route: '/api/v1/orders/**' },
              { name: 'Discovery Server', port: '8761', tech: 'Netflix Eureka Service Registry', status: 'ONLINE', route: 'eureka/' },
            ].map(svc => (
              <div key={svc.name} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>{svc.name}</div>
                  <span style={{ fontSize: '9.5px', color: 'var(--bullish)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                    ● {svc.status}
                  </span>
                </div>
                <div className="val-mono" style={{ fontSize: '12px', color: 'var(--accent-orange)', marginBottom: '4px' }}>
                  Port :{svc.port}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                  {svc.tech}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Route: {svc.route}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Remarks Modal */}
      {rejectingUserId && (
        <div className="modal-overlay" onClick={() => setRejectingUserId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--bearish)' }}>Reject KYC Application</div>
              <button className="close-btn" onClick={() => setRejectingUserId(null)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Compliance Rejection Remarks</label>
              <textarea
                className="form-input"
                rows="3"
                value={rejectRemarks}
                onChange={e => setRejectRemarks(e.target.value)}
                placeholder="Reason for rejection..."
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn-secondary" onClick={() => setRejectingUserId(null)}>
                Cancel
              </button>
              <button
                className="btn-trade-sell"
                style={{ padding: '8px 16px' }}
                onClick={handleRejectConfirm}
                disabled={actionLoadingId !== null}
              >
                {actionLoadingId ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
