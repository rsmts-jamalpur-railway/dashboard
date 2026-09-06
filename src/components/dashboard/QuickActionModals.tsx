'use client';
import React, { useState } from 'react';
import { FiX, FiCheck, FiPlus, FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiTool, FiBox } from 'react-icons/fi';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { ASSET_CATEGORIES, validateAssetNumber, calculateIndianRailwaysCheckDigit } from '@/lib/assetValidation';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * 1. Modal: Inward Yard Intake (NSY)
 * Supports all asset categories: Wagon (11-digit), Loco (5-digit), Crane (6-digit), Tower Car
 */
export function YardIntakeModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR'>('WAGON');
  const [assetNumber, setAssetNumber] = useState('');
  const [subtype, setSubtype] = useState('BOXNHL');
  const [assignedLocation, setAssignedLocation] = useState('NSY');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const catConfig = ASSET_CATEGORIES[selectedCategory];
  const validation = validateAssetNumber(assetNumber, selectedCategory);

  const handleCategoryChange = (cat: 'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR') => {
    setSelectedCategory(cat);
    const newConfig = ASSET_CATEGORIES[cat];
    setSubtype(newConfig.subtypes[0]?.code || '');
    setAssetNumber('');
    if (cat === 'TOWER_CAR') setAssignedLocation('Tower Car Line');
    else if (cat === 'LOCO') setAssignedLocation('DPS');
    else setAssignedLocation('NSY');
  };

  const handleAutoFix = () => {
    if (validation.autoFix) {
      setAssetNumber(validation.autoFix);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation.isValid) {
      toast.error('Validation Error', validation.message);
      return;
    }

    try {
      setSubmitting(true);
      const clientOpId = `op-intake-${Date.now()}`;
      await api.post('/yard/intake', {
        client_operation_id: clientOpId,
        asset_number: assetNumber.trim().toUpperCase(),
        category_id: subtype,
        assigned_location: assignedLocation,
        remarks: remarks || `Inward intake logged for ${catConfig.label} #${assetNumber.trim()}`,
      });

      toast.success('Intake Success', `${catConfig.label} #${assetNumber} entered into ${assignedLocation}`);
      setAssetNumber('');
      setRemarks('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Intake Failed', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalBackdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalBoxStyle}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Inward Yard Intake (NSY)
              </h3>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Receiving rolling stock into workshop boundary
              </div>
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle}><FiX size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Category Selector Tabs */}
          <div>
            <label style={labelStyle}>Select Rolling Stock Category *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
              {(['WAGON', 'LOCO', 'CRANE', 'TOWER_CAR'] as const).map((cat) => {
                const conf = ASSET_CATEGORIES[cat];
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    style={{
                      padding: '8px 4px',
                      fontSize: '11px',
                      fontWeight: active ? 700 : 500,
                      backgroundColor: active ? '#0F172A' : '#F8FAFC',
                      color: active ? '#FFFFFF' : '#334155',
                      border: `1px solid ${active ? '#0F172A' : '#E2E8F0'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{conf.icon}</span>
                    <span>{conf.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtype Dropdown */}
          <div>
            <label style={labelStyle}>{catConfig.label} Subtype *</label>
            <select
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              style={inputStyle}
            >
              {catConfig.subtypes.map((sub) => (
                <option key={sub.code} value={sub.code}>{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Asset Number Input with Real-time Category Validation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={labelStyle}>{catConfig.label} Number *</label>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {selectedCategory === 'WAGON' && 'Requires 11-digit IR Check Digit'}
                {selectedCategory === 'LOCO' && '5-digit Road Number'}
                {selectedCategory === 'CRANE' && '6-digit Crane ID'}
                {selectedCategory === 'TOWER_CAR' && '3 to 6 digits'}
              </span>
            </div>

            <input
              type="text"
              placeholder={catConfig.placeholder}
              value={assetNumber}
              maxLength={selectedCategory === 'WAGON' ? 11 : selectedCategory === 'LOCO' ? 5 : selectedCategory === 'CRANE' ? 6 : 8}
              onChange={(e) => setAssetNumber(e.target.value.toUpperCase())}
              required
              style={{
                ...inputStyle,
                borderColor: assetNumber ? (validation.isValid ? '#22C55E' : '#EF4444') : '#D1D5DB',
                backgroundColor: assetNumber ? (validation.isValid ? '#F0FDF4' : '#FEF2F2') : '#FFFFFF',
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            />

            {/* Validation Feedback & Check Digit Auto-Fix */}
            {assetNumber.trim().length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '11px' }}>
                {validation.isValid ? (
                  <div style={{ color: '#15803D', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <FiCheckCircle size={13} /> {validation.message}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#DC2626', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiAlertTriangle size={13} />
                      <span>{validation.message}</span>
                    </div>
                    {validation.autoFix && (
                      <button
                        type="button"
                        onClick={handleAutoFix}
                        style={{
                          backgroundColor: '#0F172A',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        [ Auto-Fill Check Digit ]
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Receiving Location */}
          <div>
            <label style={labelStyle}>Receiving Track / Yard Node</label>
            <select
              value={assignedLocation}
              onChange={(e) => setAssignedLocation(e.target.value)}
              style={inputStyle}
            >
              <option value="NSY">NSY (New Sorting Yard - Primary Inward)</option>
              <option value="Trial Yard">Trial Yard</option>
              <option value="Tower Car Line">Tower Car Line</option>
              <option value="Wheel Park Line">Wheel Park Line</option>
              <option value="DPS">DPS (Diesel Power Shed)</option>
              <option value="Line-01">Line-01 (Inward Marshalling Track)</option>
              <option value="Line-02">Line-02</option>
              <option value="Line-03">Line-03</option>
              <option value="Line-04">Line-04</option>
              <option value="Line-05">Line-05</option>
            </select>
          </div>

          {/* Arrival Remarks */}
          <div>
            <label style={labelStyle}>Arrival Defect Remarks / Inward Notes</label>
            <textarea
              rows={2}
              placeholder="Visual damage, missing components, train rake details..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button
              type="submit"
              disabled={submitting || (assetNumber.trim().length > 0 && !validation.isValid)}
              style={{
                ...submitBtnStyle,
                opacity: submitting || (assetNumber.trim().length > 0 && !validation.isValid) ? 0.6 : 1,
              }}
            >
              {submitting ? 'Logging...' : 'Confirm Yard Intake'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 2. Modal: New Manufacturing Order (GIF / Crane)
 */
export function ManufacturingOrderModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'WAGON' | 'CRANE' | 'TOWER_CAR'>('WAGON');
  const [assetNumber, setAssetNumber] = useState('');
  const [subtype, setSubtype] = useState('BOXNHL');
  const [shopId, setShopId] = useState('GIF');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const catConfig = ASSET_CATEGORIES[selectedCategory];
  const validation = validateAssetNumber(assetNumber, selectedCategory);

  const handleCategoryChange = (cat: 'WAGON' | 'CRANE' | 'TOWER_CAR') => {
    setSelectedCategory(cat);
    const newConfig = ASSET_CATEGORIES[cat];
    setSubtype(newConfig.subtypes[0]?.code || '');
    setAssetNumber('');
    if (cat === 'CRANE') setShopId('CRANE');
    else if (cat === 'TOWER_CAR') setShopId('CRANE');
    else setShopId('GIF');
  };

  const handleAutoFix = () => {
    if (validation.autoFix) {
      setAssetNumber(validation.autoFix);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      toast.error('Validation Error', validation.message);
      return;
    }

    try {
      setSubmitting(true);
      const clientOpId = `op-mfg-${Date.now()}`;
      await api.post('/manufacturing/start', {
        client_operation_id: clientOpId,
        asset_number: assetNumber.trim().toUpperCase(),
        category_id: subtype,
        shop_id: shopId,
      });

      toast.success('Order Created', `Manufacturing mandate #${assetNumber} initiated at ${shopId}`);
      setAssetNumber('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Creation Failed', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalBackdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalBoxStyle}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🏗️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Initiate New Manufacturing Order
              </h3>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Jamalpur Workshop Manufacturing Mandate (GIF / Crane Shop)
              </div>
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle}><FiX size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Category Tabs */}
          <div>
            <label style={labelStyle}>Select Manufacturing Type *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '4px' }}>
              {(['WAGON', 'CRANE', 'TOWER_CAR'] as const).map((cat) => {
                const conf = ASSET_CATEGORIES[cat];
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    style={{
                      padding: '8px 4px',
                      fontSize: '11px',
                      fontWeight: active ? 700 : 500,
                      backgroundColor: active ? '#0284C7' : '#F8FAFC',
                      color: active ? '#FFFFFF' : '#334155',
                      border: `1px solid ${active ? '#0284C7' : '#E2E8F0'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{conf.icon}</span>
                    <span>{conf.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtype Dropdown */}
          <div>
            <label style={labelStyle}>{catConfig.label} Production Subtype *</label>
            <select
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              style={inputStyle}
            >
              {catConfig.subtypes.map((sub) => (
                <option key={sub.code} value={sub.code}>{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Planned Asset Number Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={labelStyle}>Planned Asset Identification Number *</label>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {selectedCategory === 'WAGON' ? '11 digits with IR Check Digit' : '6 digits'}
              </span>
            </div>

            <input
              type="text"
              placeholder={catConfig.placeholder}
              value={assetNumber}
              maxLength={selectedCategory === 'WAGON' ? 11 : 6}
              onChange={(e) => setAssetNumber(e.target.value.toUpperCase())}
              required
              style={{
                ...inputStyle,
                borderColor: assetNumber ? (validation.isValid ? '#22C55E' : '#EF4444') : '#D1D5DB',
                backgroundColor: assetNumber ? (validation.isValid ? '#F0FDF4' : '#FEF2F2') : '#FFFFFF',
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 600,
              }}
            />

            {assetNumber.trim().length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '11px' }}>
                {validation.isValid ? (
                  <div style={{ color: '#15803D', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <FiCheckCircle size={13} /> {validation.message}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#DC2626', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiAlertTriangle size={13} />
                      <span>{validation.message}</span>
                    </div>
                    {validation.autoFix && (
                      <button
                        type="button"
                        onClick={handleAutoFix}
                        style={{
                          backgroundColor: '#0F172A',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        [ Auto-Fill Check Digit ]
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manufacturing Erection Shop */}
          <div>
            <label style={labelStyle}>Erection & Assembly Shop *</label>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} style={inputStyle}>
              <option value="GIF">GIF (General Iron Foundry / Wagon Assembly Shop)</option>
              <option value="CRANE">CRANE (140T Crane / DETC Special Erection Shop)</option>
            </select>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button
              type="submit"
              disabled={submitting || (assetNumber.trim().length > 0 && !validation.isValid)}
              style={{
                ...submitBtnStyle,
                backgroundColor: '#0284C7',
                opacity: submitting || (assetNumber.trim().length > 0 && !validation.isValid) ? 0.6 : 1,
              }}
            >
              {submitting ? 'Initiating...' : 'Start Manufacturing Mandate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 3. Modal: Report Workshop Exception / Discrepancy
 */
export function ReportExceptionModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [assetNumber, setAssetNumber] = useState('');
  const [type, setType] = useState('MISSING_ASSET');
  const [severity, setSeverity] = useState('HIGH');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetNumber.trim() || !reason.trim()) {
      toast.error('Validation Error', 'Asset number and description required');
      return;
    }

    try {
      setSubmitting(true);
      const clientOpId = `op-ex-${Date.now()}`;
      await api.post('/exceptions', {
        client_operation_id: clientOpId,
        asset_number: assetNumber.trim().toUpperCase(),
        type,
        severity,
        reason: reason.trim(),
      });

      toast.success('Exception Logged', `Exception flagged on #${assetNumber}`);
      setAssetNumber('');
      setReason('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Reporting Failed', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalBackdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalBoxStyle}>
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#DC2626' }}>
            🚨 Report Workshop Exception
          </h3>
          <button onClick={onClose} style={iconBtnStyle}><FiX size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Asset Number *</label>
            <input
              type="text"
              placeholder="e.g. 21021845128 or 30215"
              value={assetNumber}
              onChange={(e) => setAssetNumber(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Exception Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              <option value="MISSING_ASSET">Missing Asset (Physically Not Found on Line/Shop)</option>
              <option value="MATERIAL_SHORTAGE">Critical Material Shortage Hold</option>
              <option value="WRONG_SHED_DROPOFF">Wrong Shed Drop-off (Shunting Error)</option>
              <option value="CONDEMNATION_REQUEST">Condemnation / Scrap Request (Cracked Frame)</option>
              <option value="CRANE_COLLISION">Yard Track Derailment / Collision</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Severity Level</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle}>
              <option value="LOW">Low (Informational)</option>
              <option value="MEDIUM">Medium (Shop delay)</option>
              <option value="HIGH">High (Critical bottleneck)</option>
              <option value="CRITICAL">Critical (Immediate Admin Intervention)</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Detailed Justification & Location Notes *</label>
            <textarea
              rows={3}
              placeholder="Explain why this exception is being raised and which yard line or shop is impacted..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...submitBtnStyle, backgroundColor: '#DC2626' }}>
              {submitting ? 'Logging...' : 'Submit Exception Flag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Styling Constants
const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.65)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
};

const modalBoxStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  width: '100%',
  maxWidth: '480px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #E5E7EB',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#F9FAFB',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#6B7280',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  outline: 'none',
  boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 500,
  backgroundColor: '#F3F4F6',
  color: '#374151',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  cursor: 'pointer',
};

const submitBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: '12px',
  fontWeight: 600,
  backgroundColor: '#0F172A',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};
