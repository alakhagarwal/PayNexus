import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle, FileText, CheckCircle2, Calendar, CreditCard } from 'lucide-react';
import { api } from '../api/client';

export default function KycModal({
  isOpen,
  onClose,
  userId,
  userName,
  currentStatus = 'NOT_SUBMITTED',
  onKycSubmitted
}) {
  if (!isOpen) return null;

  const [panNumber, setPanNumber] = useState('ABCDE1234F');
  const [aadhaarLastFour, setAadhaarLastFour] = useState('9988');
  const [dateOfBirth, setDateOfBirth] = useState('2001-05-15');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanPan = panNumber.trim().toUpperCase();
      const cleanAadhaar = aadhaarLastFour.trim();

      // Client-side validations matching backend KYC business logic
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        throw new Error('Invalid PAN format. Standard format is 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).');
      }

      if (cleanPan.charAt(3) !== 'P') {
        throw new Error("4th character of individual PAN must be 'P' (Person/Individual).");
      }

      if (!/^\d{4}$/.test(cleanAadhaar)) {
        throw new Error('Aadhaar digits must be exactly the last 4 digits.');
      }

      if (!dateOfBirth) {
        throw new Error('Please select your Date of Birth.');
      }

      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        throw new Error('Regulatory compliance requires all account holders to be at least 18 years old.');
      }

      await api.submitKyc(userId, cleanPan, cleanAadhaar, dateOfBirth);

      onKycSubmitted({
        panNumber: cleanPan,
        aadhaarLastFour: cleanAadhaar,
        dateOfBirth,
        status: 'SUBMITTED'
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit KYC details. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--accent-orange)" />
            <span>Complete KYC Verification</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Current status alert */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Applicant
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {userName}
            </div>
          </div>
          <div>
            <span style={{
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '4px',
              background: currentStatus === 'VERIFIED' ? 'var(--bullish-soft)' : currentStatus === 'SUBMITTED' ? 'rgba(245, 158, 11, 0.12)' : 'var(--accent-orange-soft)',
              color: currentStatus === 'VERIFIED' ? 'var(--bullish)' : currentStatus === 'SUBMITTED' ? '#f59e0b' : 'var(--accent-orange)'
            }}>
              {currentStatus}
            </span>
          </div>
        </div>

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

        <form onSubmit={handleSubmit}>
          {/* PAN Number */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label className="form-label" style={{ margin: 0 }}>PAN Card Number</label>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>4th char must be 'P'</span>
            </div>
            <input
              type="text"
              maxLength="10"
              className="form-input input-mono"
              value={panNumber}
              onChange={e => setPanNumber(e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              required
            />
          </div>

          {/* Aadhaar Last 4 */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label className="form-label" style={{ margin: 0 }}>Aadhaar (Last 4 Digits)</label>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Numeric only</span>
            </div>
            <input
              type="text"
              maxLength="4"
              className="form-input input-mono"
              value={aadhaarLastFour}
              onChange={e => setAadhaarLastFour(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 9988"
              required
            />
          </div>

          {/* Date of Birth */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label className="form-label" style={{ margin: 0 }}>Date of Birth</label>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Age ≥ 18 Required</span>
            </div>
            <input
              type="date"
              className="form-input input-mono"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              required
            />
          </div>

          {/* Compliance note */}
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '18px',
            lineHeight: '1.4',
            background: 'rgba(238, 229, 218, 0.03)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}>
            Identity verification is submitted directly to the Compliance Admin Review Queue. No document uploads are stored.
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '13.5px' }}
          >
            {loading ? 'Submitting Verification...' : 'Submit Identity Details for Review'}
          </button>
        </form>
      </div>
    </div>
  );
}
