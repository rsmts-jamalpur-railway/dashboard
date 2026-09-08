'use client';
import React, { useEffect, useState, useCallback, useMemo, useContext } from 'react';
import { 
  FiX, FiClock, FiMapPin, FiCheckCircle, FiAlertTriangle, 
  FiChevronDown, FiChevronUp, FiCamera, FiExternalLink, FiShare2, FiCheck, FiInfo,
  FiTruck, FiPause, FiPlay, FiAlertOctagon, FiTrash2
} from 'react-icons/fi';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { AuthContext } from '@/contexts/AuthContext';
import { decodeWagonNumber, detectAssetCategory, calculateIndianRailwaysCheckDigit } from '@/lib/assetValidation';

interface AssetDetailModalProps {
  assetNumber: string;
  onClose: () => void;
  onAssetUpdated?: () => void;
}

export default function AssetDetailModal({
  assetNumber,
  onClose,
  onAssetUpdated,
}: AssetDetailModalProps) {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.roles?.some((r: string) => ['ADMIN', 'SYSTEM_ADMIN'].includes(r)) || ['ADMIN', 'SYSTEM_ADMIN'].includes(user?.role as string);

  const [asset, setAsset] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<'IDENTITY' | 'WORKFLOW' | 'QA' | 'LOCATION' | 'NONE'>('NONE');
  const [showFormula, setShowFormula] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Executive Admin Action Controls
  const [showMoveDrawer, setShowMoveDrawer] = useState(false);
  const [targetLocation, setTargetLocation] = useState('WRS-1');
  const [targetStatus, setTargetStatus] = useState('IN_REPAIR');
  const [moveRemarks, setMoveRemarks] = useState('');

  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('MATERIAL_SHORTAGE');
  const [holdRemarks, setHoldRemarks] = useState('');

  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionType, setExceptionType] = useState('DEFECT_FOUND');
  const [exceptionSeverity, setExceptionSeverity] = useState('HIGH');
  const [exceptionReason, setExceptionReason] = useState('');

  const [locationsList, setLocationsList] = useState<any[]>([]);
  const toast = useToast();

  const fetchDetails = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [res, locRes] = await Promise.all([
        api.get(`/dashboard/asset/${assetNumber}`),
        api.get('/locations').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (res.data?.success) {
        setAsset(res.data.data);
        if (res.data.data.current_location) {
          setTargetLocation(res.data.data.current_location);
        }
        if (res.data.data.current_status) {
          setTargetStatus(res.data.data.current_status);
        }
      } else {
        toast.error('Load Error', `Could not fetch details for #${assetNumber}`);
      }

      if (locRes.data?.success) {
        setLocationsList(locRes.data.data || []);
      }
    } catch (err: any) {
      toast.error('Network Error', err.response?.data?.message || err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [assetNumber, toast]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const activeRepair = asset?.repair_cycles?.find((c: any) => c.status === 'ACTIVE') || asset?.repair_cycles?.[0];
  const activeMfg = asset?.manufacturing_orders?.find((m: any) => m.status === 'ACTIVE') || asset?.manufacturing_orders?.[0];
  const latestQA = asset?.qa_inspections?.[0];
  const activeHold = activeRepair?.holds?.find((h: any) => !h.released_at);

  const movements = [...(asset?.movements || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Asset category & numbering resolution
  const detectedCategory = detectAssetCategory(asset?.asset_number || assetNumber);
  const rawCat = (asset?.category?.category || detectedCategory).toUpperCase();
  const isWagon = rawCat === 'WAGON' || (asset?.asset_number || assetNumber).length === 11;
  const isLoco = rawCat === 'LOCO' || (asset?.asset_number || assetNumber).length === 5;
  const isCrane = rawCat === 'CRANE' || asset?.category?.subtype?.includes('CRANE') || (asset?.asset_number || assetNumber).startsWith('140') || (asset?.asset_number || assetNumber).startsWith('175');
  const isTowerCar = rawCat === 'TOWER_CAR' || asset?.category?.subtype?.includes('DETC') || asset?.category?.subtype?.includes('DHTC');

  const wagonBreakdown = isWagon && (asset?.asset_number || assetNumber).length === 11 ? decodeWagonNumber(asset?.asset_number || assetNumber) : null;

  // Active pipeline detection
  const hasActiveRepair = Boolean(
    (activeRepair && (activeRepair.status === 'ACTIVE' || activeRepair.status === 'IN_PROGRESS')) ||
    asset?.current_status?.includes('REPAIR') ||
    asset?.current_status?.includes('Received NSY') ||
    asset?.current_status?.includes('Shop In') ||
    asset?.current_status === 'ON_HOLD'
  );

  const hasActiveMfg = Boolean(
    (activeMfg && (activeMfg.status === 'ACTIVE' || activeMfg.status === 'IN_PROGRESS')) ||
    asset?.current_status?.includes('MANUFACTURING')
  );

  // Asset is strictly in the initial new-build manufacturing route ONLY if active in manufacturing AND NOT in repair.
  // Manufactured assets that return for repair (POH/ROH) follow standard repair routing without restriction.
  const isMfgAsset = hasActiveMfg && !hasActiveRepair;

  const isReturnedMfgForRepair = Boolean(
    asset?.manufacturing_orders &&
    asset.manufacturing_orders.length > 0 &&
    hasActiveRepair
  );

  // Synthesize complete, unified lifetime activity history from all operational events
  const lifetimeActivities = useMemo(() => {
    if (!asset) return [];
    const list: Array<{
      id: string;
      timestamp: string | Date;
      type: string;
      title: string;
      description?: string;
      badge: string;
      badgeBg: string;
      badgeColor: string;
      icon: string;
      actor?: string;
      location?: string;
    }> = [];

    // 1. Initial Workshop Registration / Intake Event
    if (asset.createdAt) {
      list.push({
        id: `intake-${asset.id}`,
        timestamp: asset.createdAt,
        type: 'INTAKE',
        title: 'Initial Intake & Registration',
        description: `Rolling stock #${asset.asset_number} registered in workshop inventory at ${asset.origin || 'NSY'}. Initial state: ${asset.current_status || 'Received'}.`,
        badge: 'INTAKE',
        badgeBg: '#EFF6FF',
        badgeColor: '#1D4ED8',
        icon: '📥',
        location: 'NSY',
      });
    }

    // 2. Physical Movements & Shunting Telemetry
    (asset.movements || []).forEach((m: any, idx: number) => {
      // DEDUPLICATION: Skip in-place movements that were generated as audit shadows of Hold / Resume events.
      // Those are rendered with richer detail (reason, releaser, duration) in the Overhaul & Holds section below!
      const isShadowHoldMove = (m.from_location === m.to_location && (
        m.remarks?.includes('Hold') || 
        m.new_status === 'ON_HOLD' || 
        m.previous_status === 'ON_HOLD'
      ));
      if (isShadowHoldMove) return;

      const handlerName = m.handler?.employee
        ? `${m.handler.employee.first_name} ${m.handler.employee.last_name || ''}`.trim()
        : 'Station Master / Yard Staff';

      let badge = 'SHUNT';
      let badgeBg = '#F1F5F9';
      let badgeColor = '#475569';
      let icon = '🚚';

      if (m.new_status === 'FIT') {
        badge = 'FIT CERT';
        badgeBg = '#DCFCE7';
        badgeColor = '#15803D';
        icon = '✅';
      } else if (m.new_status?.includes('Dispatched')) {
        badge = 'DISPATCH';
        badgeBg = '#E0F2FE';
        badgeColor = '#0369A1';
        icon = '🏁';
      }

      list.push({
        id: m.id || `mov-${idx}`,
        timestamp: m.timestamp,
        type: 'MOVEMENT',
        title: `Shunted: ${m.from_location || 'NSY'} → ${m.to_location}`,
        description: `${m.remarks ? `"${m.remarks}" • ` : ''}Status: ${m.previous_status || 'N/A'} → ${m.new_status}`,
        badge,
        badgeBg,
        badgeColor,
        icon,
        actor: handlerName,
        location: m.to_location,
      });
    });

    // 3. Repair Cycles & Overhaul Stages
    (asset.repair_cycles || []).forEach((rc: any) => {
      if (rc.started_at) {
        list.push({
          id: `rc-start-${rc.cycle_id}`,
          timestamp: rc.started_at,
          type: 'REPAIR',
          title: `Repair Cycle Started (${rc.repair_category?.id || rc.repair_category_id || 'POH'})`,
          description: `Standard target TAT: ${rc.repair_category?.standard_tat_hours || 120} hrs. Bay: ${asset.current_location}.`,
          badge: 'REPAIR',
          badgeBg: '#FEF3C7',
          badgeColor: '#92400E',
          icon: '🔧',
        });
      }

      if (rc.completed_at) {
        list.push({
          id: `rc-end-${rc.cycle_id}`,
          timestamp: rc.completed_at,
          type: 'REPAIR',
          title: `Repair Cycle Completed (${rc.repair_category?.id || rc.repair_category_id || 'POH'})`,
          description: `Total TAT: ${rc.actual_tat_hours || 0} hrs. All mechanical overhauls certified.`,
          badge: 'OVERHAUL PASS',
          badgeBg: '#DCFCE7',
          badgeColor: '#15803D',
          icon: '🏆',
        });
      }

      // Repair Holds (Both Active and Historical)
      (rc.holds || []).forEach((h: any) => {
        const creatorName = h.creator?.employee
          ? `${h.creator.employee.first_name} ${h.creator.employee.last_name || ''}`.trim()
          : 'Supervisor';

        const isCurrentlyActiveHold = !h.released_at;

        list.push({
          id: `hold-start-${h.id}`,
          timestamp: h.started_at,
          type: 'HOLD_APPLIED',
          title: isCurrentlyActiveHold ? `Active Hold: [${h.reason}]` : `Placed on Hold: [${h.reason}]`,
          description: h.remarks ? `"${h.remarks}"` : 'Shop operation paused due to material/sanction hold.',
          badge: isCurrentlyActiveHold ? 'HOLD ACTIVE' : 'HOLD RESOLVED',
          badgeBg: isCurrentlyActiveHold ? '#FEE2E2' : '#F1F5F9',
          badgeColor: isCurrentlyActiveHold ? '#B91C1C' : '#475569',
          icon: '⏸️',
          actor: creatorName,
        });

        if (h.released_at) {
          const releaserName = h.releaser?.employee
            ? `${h.releaser.employee.first_name} ${h.releaser.employee.last_name || ''}`.trim()
            : 'Supervisor';

          const durationMs = new Date(h.released_at).getTime() - new Date(h.started_at).getTime();
          const durationMins = Math.max(1, Math.round(durationMs / 60000));
          const durationStr = durationMins >= 60 ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m` : `${durationMins}m`;

          list.push({
            id: `hold-end-${h.id}`,
            timestamp: h.released_at,
            type: 'HOLD_RELEASED',
            title: `Hold Released & Overhaul Resumed`,
            description: `Released by ${releaserName}. Reason resolved: [${h.reason}]. ${h.remarks ? `Remarks: "${h.remarks}". ` : ''}Hold duration: ${durationStr}. TAT clock restarted.`,
            badge: 'OVERHAUL RESUMED',
            badgeBg: '#DCFCE7',
            badgeColor: '#15803D',
            icon: '▶️',
            actor: releaserName,
          });
        }
      });
    });

    // 4. Manufacturing Orders (New Builds)
    (asset.manufacturing_orders || []).forEach((mo: any) => {
      if (mo.started_at) {
        list.push({
          id: `mo-start-${mo.id}`,
          timestamp: mo.started_at,
          type: 'MANUFACTURING',
          title: `New Build Manufacturing Initiated (${mo.production_type || 'NEW_BUILD'})`,
          description: `Erection begun in ${mo.built_by_shop || 'GIF Shop'}. Target specification loaded.`,
          badge: 'NEW BUILD',
          badgeBg: '#E0F2FE',
          badgeColor: '#0369A1',
          icon: '🏗️',
          location: mo.built_by_shop,
        });
      }

      (mo.work_logs || []).forEach((wl: any) => {
        list.push({
          id: `mo-wl-${wl.id}`,
          timestamp: wl.createdAt,
          type: 'MANUFACTURING',
          title: `Assembly Milestone: ${wl.stage?.stage_name || 'Fabrication'}`,
          description: wl.remarks || 'Stage inspection verified.',
          badge: 'MFG MILESTONE',
          badgeBg: '#E0F2FE',
          badgeColor: '#0284C7',
          icon: '⚙️',
          actor: wl.user?.employee ? `${wl.user.employee.first_name} ${wl.user.employee.last_name || ''}`.trim() : undefined,
        });
      });

      if (mo.completed_at) {
        list.push({
          id: `mo-end-${mo.id}`,
          timestamp: mo.completed_at,
          type: 'MANUFACTURING',
          title: 'Manufacturing Assembly Completed',
          description: 'Shell & bogie assembly completed. Cleared for WRS-5 QA Testing.',
          badge: 'BUILD COMPLETE',
          badgeBg: '#DCFCE7',
          badgeColor: '#15803D',
          icon: '🎉',
        });
      }
    });

    // 5. Quality Assurance & Air Brake Testing (WRS-5)
    (asset.qa_inspections || []).forEach((qa: any) => {
      const inspectorName = qa.inspector?.employee
        ? `${qa.inspector.employee.first_name} ${qa.inspector.employee.last_name || ''}`.trim()
        : 'WRS-5 QA Inspector';

      const isFit = qa.result === 'FIT';
      list.push({
        id: `qa-${qa.id}`,
        timestamp: qa.inspected_at,
        type: 'QA',
        title: `WRS-5 QA Inspection: ${isFit ? 'FIT CERTIFIED' : 'UNFIT / REJECTED'}`,
        description: `${qa.inspection_type} - ${isFit ? 'All single car & air brake leakage tests passed.' : 'Defects identified during inspection.'} ${qa.certificates?.[0]?.certificate_number ? `Fit Certificate #${qa.certificates[0].certificate_number}.` : ''}`,
        badge: isFit ? 'QA FIT' : 'QA REJECT',
        badgeBg: isFit ? '#DCFCE7' : '#FEE2E2',
        badgeColor: isFit ? '#15803D' : '#DC2626',
        icon: isFit ? '🛡️' : '⚠️',
        actor: inspectorName,
        location: 'WRS-5',
      });
    });

    // 6. Exceptions & Discrepancies
    (asset.exceptions || []).forEach((ex: any) => {
      list.push({
        id: `ex-${ex.id}`,
        timestamp: ex.createdAt,
        type: 'EXCEPTION',
        title: `Discrepancy Flagged: [${ex.exception_type}] (${ex.severity})`,
        description: ex.reason || ex.description || 'Workshop anomaly flagged by supervisory staff.',
        badge: `${ex.severity} DISCREPANCY`,
        badgeBg: '#FEE2E2',
        badgeColor: '#DC2626',
        icon: '🚨',
        actor: ex.reporter?.employee ? `${ex.reporter.employee.first_name} ${ex.reporter.employee.last_name || ''}`.trim() : 'Operator',
      });

      if (ex.resolved_at) {
        list.push({
          id: `ex-res-${ex.id}`,
          timestamp: ex.resolved_at,
          type: 'EXCEPTION',
          title: `Discrepancy Resolved: [${ex.exception_type}]`,
          description: ex.resolution_notes || 'Defect rectified and cleared by shop supervisor.',
          badge: 'RESOLVED',
          badgeBg: '#DCFCE7',
          badgeColor: '#15803D',
          icon: '✅',
          actor: ex.resolver?.employee ? `${ex.resolver.employee.first_name} ${ex.resolver.employee.last_name || ''}`.trim() : 'Supervisor',
        });
      }
    });

    // Sort descending by timestamp (newest activity at the top)
    return list.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
    });
  }, [asset]);

  const formatSafeDate = (ts: any) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return 'N/A';
    }
  };

  const handleExecuteMove = async () => {
    try {
      setActionLoading(true);
      await api.post('/movement', {
        asset_number: asset.asset_number,
        from_location: asset.current_location,
        to_location: targetLocation,
        new_status: targetStatus,
        remarks: moveRemarks || 'Admin Shunt Execution',
      });
      toast.success('Movement Logged', `Asset #${asset.asset_number} moved to ${targetLocation}`);
      setShowMoveDrawer(false);
      setMoveRemarks('');
      await fetchDetails(true);
      if (onAssetUpdated) onAssetUpdated();
    } catch (err: any) {
      toast.error('Move Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeHold = async () => {
    try {
      setActionLoading(true);
      await api.patch('/repair/resume', {
        cycle_id: activeRepair?.cycle_id,
        asset_number: asset.asset_number,
      });
      toast.success('Hold Released', `Cycle resumed for #${asset.asset_number}`);
      await fetchDetails(true);
      if (onAssetUpdated) onAssetUpdated();
    } catch (err: any) {
      toast.error('Resume Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteHold = async () => {
    try {
      setActionLoading(true);
      await api.post('/repair/hold', {
        cycle_id: activeRepair?.cycle_id,
        asset_number: asset.asset_number,
        reason: holdReason,
        remarks: holdRemarks,
      });
      toast.success('Hold Applied', `Repair cycle paused for #${asset.asset_number}`);
      setShowHoldModal(false);
      setHoldRemarks('');
      await fetchDetails(true);
      if (onAssetUpdated) onAssetUpdated();
    } catch (err: any) {
      toast.error('Hold Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteException = async () => {
    if (!exceptionReason.trim()) {
      toast.error('Validation Error', 'Discrepancy description required');
      return;
    }
    try {
      setActionLoading(true);
      await api.post('/exceptions', {
        client_operation_id: `op-ex-${Date.now()}`,
        asset_number: asset.asset_number,
        type: exceptionType,
        severity: exceptionSeverity,
        reason: exceptionReason.trim(),
      });
      toast.success('Exception Flagged', `Logged against #${asset.asset_number}`);
      setShowExceptionModal(false);
      setExceptionReason('');
      await fetchDetails(true);
      if (onAssetUpdated) onAssetUpdated();
    } catch (err: any) {
      toast.error('Reporting Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDelete = async () => {
    if (!isAdmin) return;
    if (!confirm(`[GOD MODE WARNING] Permanently delete asset #${assetNumber} and all its audit history?`)) return;
    
    try {
      setActionLoading(true);
      await api.delete(`/assets/${assetNumber}?hard=true`);
      toast.success('Asset Purged', `Asset #${assetNumber} was permanently deleted.`);
      if (onAssetUpdated) onAssetUpdated();
      onClose();
    } catch (err: any) {
      toast.error('Deletion Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={modalBackdropStyle}>
        <div style={{ ...modalContainerStyle, padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            Loading detailed telemetry for #{assetNumber}...
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div style={modalBackdropStyle}>
        <div style={{ ...modalContainerStyle, padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#DC2626' }}>Asset #{assetNumber} not found.</p>
          <button onClick={onClose} style={closeBtnStyle}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={modalBackdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalContainerStyle}>
        {/* Modal Header */}
        <div style={headerStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px' }}>
                {isWagon ? '🚃' : isLoco ? '🚂' : isCrane ? '🏗️' : isTowerCar ? '🗼' : '📦'}
              </span>
              <h2 style={{ margin: 0, fontSize: '20px', fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                #{asset.asset_number}
              </h2>
              <span style={getStatusBadgeStyle(asset.current_status, !!activeHold)}>
                {activeHold ? 'ON HOLD' : asset.current_status}
              </span>
              <span style={categoryBadgeStyle}>
                {asset.category?.category} ({asset.category?.subtype || asset.category_id})
              </span>
              {wagonBreakdown && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: wagonBreakdown.isValidCheckDigit ? '#DCFCE7' : '#FEE2E2',
                    color: wagonBreakdown.isValidCheckDigit ? '#15803D' : '#DC2626',
                    border: `1px solid ${wagonBreakdown.isValidCheckDigit ? '#86EFAC' : '#FCA5A5'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {wagonBreakdown.isValidCheckDigit ? <FiCheck size={12} /> : <FiAlertTriangle size={12} />}
                  {wagonBreakdown.isValidCheckDigit ? 'IR Check Digit Valid ✓' : 'Invalid Check Digit'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              Current Location: <strong>{asset.current_location || 'NSY'}</strong> ({asset.location?.zone || 'Yard'})
              {asset.allocated_shop && ` • Allocated To: ${asset.allocated_shop}`}
            </div>
          </div>
          <button onClick={onClose} style={iconCloseBtnStyle} title="Close Modal">
            <FiX size={20} />
          </button>
        </div>

        {/* Quick Status Subheader with Pinned Latest Action */}
        {lifetimeActivities.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor:
                lifetimeActivities[0].type === 'HOLD_RELEASED' ? '#F0FDF4' :
                lifetimeActivities[0].type === 'HOLD_APPLIED' ? '#FEF2F2' : '#F8FAFC',
              borderBottom: `1px solid ${
                lifetimeActivities[0].type === 'HOLD_RELEASED' ? '#BBF7D0' :
                lifetimeActivities[0].type === 'HOLD_APPLIED' ? '#FECACA' : '#E2E8F0'
              }`,
              padding: '7px 20px',
              fontSize: '11.5px',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  backgroundColor: lifetimeActivities[0].badgeColor,
                  color: '#FFFFFF',
                  letterSpacing: '0.4px',
                }}
              >
                LATEST ACTION
              </span>
              <span style={{ fontWeight: 700, color: '#0F172A' }}>
                {lifetimeActivities[0].icon} {lifetimeActivities[0].title}
              </span>
              <span style={{ color: '#94A3B8' }}>•</span>
              <span style={{ color: '#64748B', fontFamily: 'monospace' }}>
                {formatSafeDate(lifetimeActivities[0].timestamp)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {lifetimeActivities[0].actor && (
                <span style={{ color: '#64748B' }}>
                  👤 By: <strong>{lifetimeActivities[0].actor}</strong>
                </span>
              )}
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  backgroundColor: lifetimeActivities[0].badgeBg,
                  color: lifetimeActivities[0].badgeColor,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  border: `1px solid ${lifetimeActivities[0].badgeColor}33`,
                  textTransform: 'uppercase',
                }}
              >
                {lifetimeActivities[0].badge}
              </span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div style={bodyStyle}>
          
          {/* Section 0: Rolling Stock Identity & Numbering Architecture */}
          <div style={sectionCardStyle}>
            <div
              style={sectionHeaderStyle}
              onClick={() => setOpenSection(openSection === 'IDENTITY' ? 'NONE' : 'IDENTITY')}
            >
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>
                {isWagon && '📋 Indian Railways 11-Digit Numbering Specification & Check Digit'}
                {isLoco && '🚂 Locomotive Technical Specifications (5-Digit IR System)'}
                {isCrane && '🏗️ Heavy Breakdown Crane Specification (Jamalpur Erection Shop)'}
                {isTowerCar && '🗼 Overhead Equipment (OHE) Tower Car Specification'}
                {!isWagon && !isLoco && !isCrane && !isTowerCar && '📋 Rolling Stock Master Identity'}
              </span>
              {openSection === 'IDENTITY' ? <FiChevronUp /> : <FiChevronDown />}
            </div>

            {openSection === 'IDENTITY' && (
              <div style={{ padding: '14px', borderTop: '1px solid #E5E7EB', fontSize: '12px' }}>
                {/* 11-Digit Wagon Decoder */}
                {wagonBreakdown && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                      <div style={decoderBoxStyle}>
                        <div style={decoderBoxHeaderStyle}>Type of Wagon (C1-C2)</div>
                        <div style={decoderBoxValStyle}>{wagonBreakdown.typeCode}</div>
                        <div style={decoderBoxSubStyle}>{wagonBreakdown.typeName.split('(')[0]}</div>
                      </div>

                      <div style={decoderBoxStyle}>
                        <div style={decoderBoxHeaderStyle}>Owning Railway (C3-C4)</div>
                        <div style={decoderBoxValStyle}>{wagonBreakdown.railwayCode}</div>
                        <div style={decoderBoxSubStyle}>{wagonBreakdown.railwayName}</div>
                      </div>

                      <div style={decoderBoxStyle}>
                        <div style={decoderBoxHeaderStyle}>Mfg Year (C5-C6)</div>
                        <div style={decoderBoxValStyle}>{wagonBreakdown.yearCode}</div>
                        <div style={decoderBoxSubStyle}>Year {wagonBreakdown.manufactureYear}</div>
                      </div>

                      <div style={decoderBoxStyle}>
                        <div style={decoderBoxHeaderStyle}>Serial Number (C7-C10)</div>
                        <div style={decoderBoxValStyle}>{wagonBreakdown.serialNumber}</div>
                        <div style={decoderBoxSubStyle}>Individual Serial</div>
                      </div>

                      <div style={{ ...decoderBoxStyle, borderColor: wagonBreakdown.isValidCheckDigit ? '#86EFAC' : '#FCA5A5', backgroundColor: wagonBreakdown.isValidCheckDigit ? '#F0FDF4' : '#FEF2F2' }}>
                        <div style={decoderBoxHeaderStyle}>Check Digit (C11)</div>
                        <div style={{ ...decoderBoxValStyle, color: wagonBreakdown.isValidCheckDigit ? '#15803D' : '#DC2626' }}>
                          {wagonBreakdown.enteredCheckDigit} {wagonBreakdown.isValidCheckDigit ? '✓' : '✗'}
                        </div>
                        <div style={decoderBoxSubStyle}>
                          {wagonBreakdown.isValidCheckDigit ? 'Verified (IR Modulo-10)' : `Expected ${wagonBreakdown.calculatedCheckDigit}`}
                        </div>
                      </div>
                    </div>

                    {/* Formula Explanation Toggle */}
                    <div style={{ marginTop: '8px', borderTop: '1px dashed #E2E8F0', paddingTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowFormula(!showFormula)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '11px',
                          color: '#0A74DA',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                        }}
                      >
                        <FiInfo size={12} />
                        <span>{showFormula ? 'Hide Check Digit Calculation Steps' : 'View 6-Step IR Check Digit Verification Steps'}</span>
                      </button>

                      {showFormula && (
                        <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
                          <div><strong>Step 1:</strong> S1 = Sum of even position digits = {wagonBreakdown.raw[1]} + {wagonBreakdown.raw[3]} + {wagonBreakdown.raw[5]} + {wagonBreakdown.raw[7]} + {wagonBreakdown.raw[9]}</div>
                          <div><strong>Step 2:</strong> 3 × S1 = {3 * (Number(wagonBreakdown.raw[1]) + Number(wagonBreakdown.raw[3]) + Number(wagonBreakdown.raw[5]) + Number(wagonBreakdown.raw[7]) + Number(wagonBreakdown.raw[9]))}</div>
                          <div><strong>Step 3:</strong> S2 = Sum of odd position digits = {wagonBreakdown.raw[0]} + {wagonBreakdown.raw[2]} + {wagonBreakdown.raw[4]} + {wagonBreakdown.raw[6]} + {wagonBreakdown.raw[8]}</div>
                          <div><strong>Step 4:</strong> S4 = (3 × S1) + S2</div>
                          <div><strong>Step 5:</strong> Next multiple of 10</div>
                          <div><strong>Step 6:</strong> Check Digit = (Next multiple of 10) - S4 = <strong>{wagonBreakdown.calculatedCheckDigit}</strong></div>
                          <div style={{ marginTop: '4px', color: wagonBreakdown.isValidCheckDigit ? '#15803D' : '#DC2626', fontWeight: 'bold' }}>
                            {wagonBreakdown.isValidCheckDigit ? '✓ Verification Passed: Check digit matches C11 perfectly.' : `⚠ Check Digit Mismatch: Entered ${wagonBreakdown.enteredCheckDigit}, calculated ${wagonBreakdown.calculatedCheckDigit}.`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Locomotive Tech Specs */}
                {isLoco && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div><strong>Road Number:</strong> #{asset.asset_number} (5-Digit Standard)</div>
                    <div><strong>Class / Type:</strong> {asset.category?.subtype || 'WAP-7'}</div>
                    <div><strong>Traction Power:</strong> 25 kV AC, 3-Phase IGBT Inverter Drive</div>
                    <div><strong>Horsepower Rating:</strong> 6,000 HP / 4,475 kW Traction Motors</div>
                    <div><strong>Wheel Arrangement:</strong> Co-Co (6 Axles, All Powered)</div>
                    <div><strong>Overhaul Facility:</strong> Diesel & Power Shed (DPS), Jamalpur</div>
                  </div>
                )}

                {/* Crane Tech Specs */}
                {isCrane && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div><strong>Crane Number:</strong> #{asset.asset_number} (6-Digit Series)</div>
                    <div><strong>Model / License:</strong> 140-Tonne Gottwald / Cowans Sheldon Hydraulic</div>
                    <div><strong>Lifting Capacity:</strong> 140 Metric Tonnes @ 9.0m Working Radius</div>
                    <div><strong>Power Plant:</strong> Cummins 6-Cylinder Turbo Diesel</div>
                    <div><strong>Jib System:</strong> 4-Stage Heavy Duty Telescopic Jib</div>
                    <div><strong>Manufacturing Facility:</strong> Jamalpur Workshop Crane Erection Shop</div>
                  </div>
                )}

                {/* Tower Car Tech Specs */}
                {isTowerCar && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div><strong>Tower Car Number:</strong> #{asset.asset_number}</div>
                    <div><strong>Configuration:</strong> 8-Wheeler Diesel Electric Tower Car (DETC)</div>
                    <div><strong>Operational Purpose:</strong> 25 kV AC OHE Catenary & Contact Wire Maintenance</div>
                    <div><strong>Work Platform:</strong> Hydraulic Elevating Swiveling Platform (360°)</div>
                    <div><strong>Equipment:</strong> Contact Wire Height/Stagger Measuring Pantograph</div>
                    <div><strong>Dedicated Track:</strong> Jamalpur Tower Car Line</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 1: Active Operation Details (Collapsible) */}
          <div style={sectionCardStyle}>
            <div
              style={sectionHeaderStyle}
              onClick={() => setOpenSection(openSection === 'WORKFLOW' ? 'NONE' : 'WORKFLOW')}
            >
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>
                ⚙️ {activeMfg ? 'Manufacturing Order Lifecycle' : 'Repair Overhaul Lifecycle'}
              </span>
              {openSection === 'WORKFLOW' ? <FiChevronUp /> : <FiChevronDown />}
            </div>

            {openSection === 'WORKFLOW' && (
              <div style={{ padding: '12px', borderTop: '1px solid #E5E7EB', fontSize: '12px' }}>
                {activeRepair && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div><strong>Cycle ID:</strong> {activeRepair.cycle_id}</div>
                    <div><strong>Repair Category:</strong> {activeRepair.repair_category_id}</div>
                    <div><strong>Status:</strong> {activeRepair.status}</div>
                    <div><strong>Standard TAT:</strong> {activeRepair.repair_category?.standard_tat_hours || 120} hrs</div>
                    <div><strong>Started At:</strong> {activeRepair.started_at ? new Date(activeRepair.started_at).toLocaleString() : 'N/A'}</div>
                    <div><strong>Completed At:</strong> {activeRepair.completed_at ? new Date(activeRepair.completed_at).toLocaleString() : 'In Progress'}</div>
                  </div>
                )}

                {activeMfg && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div><strong>Order ID:</strong> {activeMfg.order_id}</div>
                    <div><strong>Production Type:</strong> {activeMfg.production_type}</div>
                    <div><strong>Built By Shop:</strong> {activeMfg.built_by_shop}</div>
                    <div><strong>Current Stage:</strong> {activeMfg.current_stage?.stage_name || 'Assembly'}</div>
                    <div><strong>Started At:</strong> {activeMfg.started_at ? new Date(activeMfg.started_at).toLocaleString() : 'N/A'}</div>
                    <div><strong>Status:</strong> {activeMfg.status}</div>
                  </div>
                )}

                {activeHold && (
                  <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '4px', color: '#92400E' }}>
                    <strong>Active Material Shortage Hold:</strong> {activeHold.reason}
                    <div style={{ fontSize: '11px', marginTop: '2px' }}>
                      Paused on: {new Date(activeHold.started_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Quality Assurance & Testing (Collapsible) */}
          <div style={sectionCardStyle}>
            <div
              style={sectionHeaderStyle}
              onClick={() => setOpenSection(openSection === 'QA' ? 'NONE' : 'QA')}
            >
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>
                🔍 Quality Assurance & Air Brake Testing (WRS-5)
              </span>
              {openSection === 'QA' ? <FiChevronUp /> : <FiChevronDown />}
            </div>

            {openSection === 'QA' && (
              <div style={{ padding: '12px', borderTop: '1px solid #E5E7EB', fontSize: '12px' }}>
                {latestQA ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div><strong>Inspection Type:</strong> {latestQA.inspection_type}</div>
                      <div>
                        <strong>Result:</strong>{' '}
                        <span style={{ color: latestQA.result === 'FIT' ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                          {latestQA.result}
                        </span>
                      </div>
                      <div><strong>Inspected Date:</strong> {new Date(latestQA.inspected_at).toLocaleString()}</div>
                      <div>
                        <strong>Fit Certificate:</strong>{' '}
                        {latestQA.certificates?.[0]?.certificate_number ? (
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16A34A' }}>
                            {latestQA.certificates[0].certificate_number}
                          </span>
                        ) : 'Pending / Not Issued'}
                      </div>
                    </div>

                    {latestQA.test_results?.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <strong>Test Measurements:</strong>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {latestQA.test_results.map((t: any) => (
                            <span key={t.id} style={{ padding: '2px 8px', backgroundColor: t.passed ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${t.passed ? '#86EFAC' : '#FCA5A5'}`, borderRadius: '3px', fontSize: '11px' }}>
                              {t.test_name}: {t.value || 'N/A'} ({t.passed ? 'PASS' : 'FAIL'})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#6B7280', margin: 0 }}>No QA inspection conducted yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Physical Inspection Proofs (Photo Gallery) */}
          {asset.photos?.length > 0 && (
            <div style={sectionCardStyle}>
              <div style={{ padding: '10px 12px', fontWeight: 600, fontSize: '13px', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiCamera size={14} /> Physical Inspection Photos ({asset.photos.length})
              </div>
              <div style={{ padding: '12px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '10px', overflowX: 'auto' }}>
                {asset.photos.map((photo: any) => (
                  <img
                    key={photo.id}
                    src={photo.photo_url}
                    alt="Asset Inspection Proof"
                    onClick={() => setActivePhoto(photo.photo_url)}
                    style={{
                      width: '90px',
                      height: '70px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      border: '1px solid #D1D5DB',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Comprehensive Lifetime Activity History (Full Audit Trail) */}
          <div style={sectionCardStyle}>
            <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: '13px', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiClock size={15} color="#0284C7" />
                <span>Lifetime Activity History</span>
                <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#E2E8F0', color: '#334155', padding: '1px 8px', borderRadius: '10px' }}>
                  {lifetimeActivities.length} {lifetimeActivities.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                Intake • Shunts • Holds • Overhauls • QA • Discrepancies
              </span>
            </div>
            
            {lifetimeActivities.length === 0 ? (
              <div style={{ color: '#94A3B8', textAlign: 'center', padding: '24px 0', fontSize: '12px' }}>
                No historical activity records found for this rolling stock.
              </div>
            ) : (
              <div>
                {/* 1. PINNED LATEST ACTION CARD - ALWAYS PROMINENT AT TOP */}
                {lifetimeActivities[0] && (
                  <div
                    style={{
                      margin: '12px 14px 8px 14px',
                      padding: '12px 14px',
                      backgroundColor:
                        lifetimeActivities[0].type === 'HOLD_RELEASED' ? '#F0FDF4' :
                        lifetimeActivities[0].type === 'HOLD_APPLIED' ? '#FEF2F2' :
                        lifetimeActivities[0].type === 'QA' ? '#F0FDF4' : '#F0F9FF',
                      borderRadius: '8px',
                      border: `1.5px solid ${
                        lifetimeActivities[0].type === 'HOLD_RELEASED' ? '#86EFAC' :
                        lifetimeActivities[0].type === 'HOLD_APPLIED' ? '#FCA5A5' :
                        lifetimeActivities[0].type === 'QA' ? '#86EFAC' : '#BAE6FD'
                      }`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: '#0F172A',
                            color: '#FFFFFF',
                            letterSpacing: '0.5px',
                          }}
                        >
                          ⚡ LATEST ACTION
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>
                          {lifetimeActivities[0].icon} {lifetimeActivities[0].title}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: lifetimeActivities[0].badgeBg,
                            color: lifetimeActivities[0].badgeColor,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: `1px solid ${lifetimeActivities[0].badgeColor}33`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {lifetimeActivities[0].badge}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>
                          {formatSafeDate(lifetimeActivities[0].timestamp)}
                        </span>
                      </div>
                    </div>

                    {lifetimeActivities[0].description && (
                      <div style={{ color: '#334155', fontSize: '12px', marginBottom: '6px', lineHeight: '1.45' }}>
                        {lifetimeActivities[0].description}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#64748B', flexWrap: 'wrap' }}>
                      {lifetimeActivities[0].actor && (
                        <span>👤 Executed By: <strong>{lifetimeActivities[0].actor}</strong></span>
                      )}
                      {lifetimeActivities[0].location && (
                        <span>📍 Bay / Location: <strong>{lifetimeActivities[0].location}</strong></span>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. PRIOR TIMELINE LOG */}
                {lifetimeActivities.length > 1 && (
                  <div style={{ padding: '4px 14px 12px 14px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '8px 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Prior Timeline History ({lifetimeActivities.length - 1} earlier {lifetimeActivities.length - 1 === 1 ? 'event' : 'events'})</span>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
                      {lifetimeActivities.slice(1).map((evt, idx) => (
                        <div
                          key={evt.id || idx}
                          style={{
                            display: 'flex',
                            gap: '10px',
                            padding: '9px 12px',
                            backgroundColor: '#F8FAFC',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            fontSize: '12px',
                            lineHeight: '1.45',
                          }}
                        >
                          <div style={{ fontSize: '15px', paddingTop: '1px' }}>{evt.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '2px' }}>
                              <span style={{ fontWeight: 600, color: '#1E293B' }}>{evt.title}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    backgroundColor: evt.badgeBg,
                                    color: evt.badgeColor,
                                    padding: '1px 6px',
                                    borderRadius: '3px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                  }}
                                >
                                  {evt.badge}
                                </span>
                                <span style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'monospace' }}>
                                  {formatSafeDate(evt.timestamp)}
                                </span>
                              </div>
                            </div>

                            {evt.description && (
                              <div style={{ color: '#475569', fontSize: '11.5px', marginBottom: '3px' }}>
                                {evt.description}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', fontSize: '10.5px', color: '#64748B', flexWrap: 'wrap' }}>
                              {evt.actor && (
                                <span>👤 By: <strong>{evt.actor}</strong></span>
                              )}
                              {evt.location && (
                                <span>📍 Location: <strong>{evt.location}</strong></span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer: Supervisory Admin Actions */}
        <div style={footerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>ADMIN CONTROLS:</span>
            
            {/* Shunt / Move Asset */}
            <button
              onClick={() => {
                const nextShow = !showMoveDrawer;
                setShowMoveDrawer(nextShow);
                if (nextShow) {
                  const isOnHold = asset?.current_status === 'ON_HOLD' || !!activeHold;
                  if (isOnHold) {
                    setTargetStatus('ON_HOLD');
                    if (['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4'].includes(asset.current_location)) {
                      setTargetLocation('Line-01');
                    } else {
                      setTargetLocation(asset.current_location || 'Line-01');
                    }
                    setMoveRemarks(`Shunted to clear active bay while on hold [${activeHold?.reason || 'MATERIAL_SHORTAGE'}]`);
                  } else if (isMfgAsset) {
                    if (['GIF', 'CRANE'].includes(asset.current_location)) {
                      setTargetLocation('WRS-5');
                      setTargetStatus('PENDING_QA');
                    } else {
                      setTargetLocation(asset.current_location || 'WRS-5');
                      setTargetStatus(asset.current_status || 'IN_MANUFACTURING');
                    }
                  } else {
                    setTargetLocation(asset.current_location || 'WRS-1');
                    setTargetStatus(asset.current_status || 'IN_REPAIR');
                  }
                }
                setShowHoldModal(false);
                setShowExceptionModal(false);
              }}
              style={{
                ...adminBtnStyle,
                backgroundColor: showMoveDrawer ? '#0284C7' : '#FFFFFF',
                color: showMoveDrawer ? '#FFFFFF' : '#0284C7',
                borderColor: '#0284C7',
              }}
            >
              <FiTruck size={13} /> Shunt / Move
            </button>

            {/* Hold / Resume if in repair */}
            {activeRepair && (
              <button
                onClick={() => {
                  if (activeHold) {
                    handleResumeHold();
                  } else {
                    setShowHoldModal(!showHoldModal);
                    setShowMoveDrawer(false);
                    setShowExceptionModal(false);
                  }
                }}
                disabled={actionLoading}
                style={{
                  ...adminBtnStyle,
                  backgroundColor: activeHold ? '#15803D' : (showHoldModal ? '#B45309' : '#FFFFFF'),
                  color: activeHold ? '#FFFFFF' : (showHoldModal ? '#FFFFFF' : '#B45309'),
                  borderColor: activeHold ? '#15803D' : '#F59E0B',
                }}
              >
                {activeHold ? (
                  <><FiPlay size={13} /> Resume Cycle</>
                ) : (
                  <><FiPause size={13} /> Put on Hold</>
                )}
              </button>
            )}

            {/* Report Exception */}
            <button
              onClick={() => {
                setShowExceptionModal(!showExceptionModal);
                setShowMoveDrawer(false);
                setShowHoldModal(false);
              }}
              style={{
                ...adminBtnStyle,
                backgroundColor: showExceptionModal ? '#DC2626' : '#FFFFFF',
                color: showExceptionModal ? '#FFFFFF' : '#DC2626',
                borderColor: '#EF4444',
              }}
            >
              <FiAlertOctagon size={13} /> Flag Discrepancy
            </button>

            {/* God Mode Delete */}
            {isAdmin && (
              <button
                onClick={handleHardDelete}
                disabled={actionLoading}
                style={{
                  ...adminBtnStyle,
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  borderColor: '#FCA5A5',
                  marginLeft: '8px',
                }}
                title="Permanently Purge Asset (God Mode)"
              >
                <FiTrash2 size={13} /> Purge Asset
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
              {asset.id.substring(0, 8)}...
            </span>
            <button onClick={onClose} style={cancelBtnStyle}>Close</button>
          </div>
        </div>

        {/* Drawer 1: Move / Shunt Action Panel */}
        {showMoveDrawer && (
          <div style={drawerPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiTruck size={14} color="#0284C7" /> Shunt Rolling Stock #{asset.asset_number}
                {(asset.current_status === 'ON_HOLD' || !!activeHold) && (
                  <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '3px' }}>
                    HOLD RELOCATION MODE
                  </span>
                )}
                {isMfgAsset && (
                  <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#E0F2FE', color: '#0369A1', padding: '1px 6px', borderRadius: '3px' }}>
                    NEW MANUFACTURING
                  </span>
                )}
                {isReturnedMfgForRepair && (
                  <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: '3px' }}>
                    RETURNED FOR REPAIR
                  </span>
                )}
              </div>
              <button onClick={() => setShowMoveDrawer(false)} style={iconBtnStyle}><FiX size={14} /></button>
            </div>

            {/* Protocol Notice Banner */}
            {(asset.current_status === 'ON_HOLD' || !!activeHold) ? (
              <div style={{ fontSize: '11px', color: '#92400E', backgroundColor: '#FFFBEB', padding: '8px 12px', borderRadius: '4px', border: '1px solid #FCD34D', marginBottom: '8px', lineHeight: '1.5' }}>
                🟡 <strong>Hold Relocation Protocol (Bay Decongestion):</strong> This rolling stock is currently <strong>ON HOLD</strong> ({activeHold?.reason || 'Material/Sanction'}). In railway workshop SOP, wagons on hold are shunted out of active overhaul bays (WRS-1 to WRS-4) into <strong>Holding Siding Lines (Lines 01–56)</strong> to prevent bottlenecking shop throughput.
                <div style={{ marginTop: '3px', fontWeight: 600, color: '#B45309' }}>
                  ⚠️ Relocating will update physical location while <strong>strictly preserving ON_HOLD status and the paused TAT clock</strong>.
                </div>
              </div>
            ) : isMfgAsset ? (
              <div style={{ fontSize: '11px', color: '#0369A1', backgroundColor: '#F0F9FF', padding: '6px 10px', borderRadius: '4px', border: '1px solid #BAE6FD', marginBottom: '8px' }}>
                🏗️ <strong>Manufacturing Route:</strong> Newly manufactured rolling stock from GIF / Crane Shop proceeds directly to <strong>WRS-5 (QA Testing)</strong>, <strong>Trial Yard</strong>, or <strong>Exit Yard</strong> for dispatch. Repair shops (WRS-1 to WRS-4) and Locomotive Shed (DPS) are strictly bypassed.
              </div>
            ) : isReturnedMfgForRepair ? (
              <div style={{ fontSize: '11px', color: '#166534', backgroundColor: '#F0FDF4', padding: '6px 10px', borderRadius: '4px', border: '1px solid #BBF7D0', marginBottom: '8px' }}>
                🔁 <strong>Return for Overhaul (POH/ROH):</strong> This rolling stock was originally manufactured at Jamalpur Workshop and has returned for periodic repair. Standard repair routing across <strong>WRS-1 through WRS-4</strong> is active without restriction.
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#92400E', backgroundColor: '#FEF3C7', padding: '6px 10px', borderRadius: '4px', border: '1px solid #FDE68A', marginBottom: '8px' }}>
                🔧 <strong>Repair Route:</strong> Rolling stock undergoing POH/ROH/Special Repair is routed through <strong>WRS-1 through WRS-4</strong>, then to <strong>WRS-5 (QA Testing)</strong>. New build shop (GIF) is bypassed.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              <div>
                <label style={drawerLabelStyle}>Target Location (68 Topology) *</label>
                <select
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  style={drawerInputStyle}
                >
                  {locationsList
                    .filter((loc) => {
                      if (isMfgAsset) {
                        // Manufacturing assets CANNOT go to repair shops WRS-1 to WRS-4 or DPS
                        return !['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'DPS'].includes(loc.location_id);
                      }
                      // Repair wagons cannot go to new manufacturing erection foundry (GIF)
                      return loc.location_id !== 'GIF';
                    })
                    .map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.location_id} ({loc.zone || loc.location_type}) - Occ: {loc.current_occupancy || 0}/{loc.max_capacity}
                      </option>
                    ))}
                  {locationsList.length === 0 && (
                    isMfgAsset ? (
                      <>
                        <option value="GIF">GIF (General Iron Foundry / Assembly)</option>
                        <option value="CRANE">CRANE (Crane & DETC Shop)</option>
                        <option value="WRS-5">WRS-5 (QA / Air Brake Testing)</option>
                        <option value="Trial Yard">Trial Yard (Test Track)</option>
                        <option value="Exit Yard">Exit Yard (Outward)</option>
                        <option value="Line-01">Line-01 (Yard Parking)</option>
                      </>
                    ) : (
                      <>
                        <option value="NSY">NSY (Inward Yard)</option>
                        <option value="WRS-1">WRS-1 (Wagon Repair Shop 1)</option>
                        <option value="WRS-2">WRS-2 (Wagon Repair Shop 2)</option>
                        <option value="WRS-3">WRS-3 (Wagon Repair Shop 3)</option>
                        <option value="WRS-4">WRS-4 (Wagon Repair Shop 4)</option>
                        <option value="WRS-5">WRS-5 (QA / Air Brake Testing)</option>
                        <option value="Exit Yard">Exit Yard (Outward)</option>
                        <option value="Trial Yard">Trial Yard</option>
                      </>
                    )
                  )}
                </select>
              </div>

              <div>
                <label style={drawerLabelStyle}>New Status *</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  style={drawerInputStyle}
                >
                  {(asset.current_status === 'ON_HOLD' || !!activeHold) ? (
                    <>
                      <option value="ON_HOLD">ON_HOLD (Preserve Hold & Paused TAT) [Recommended]</option>
                      <option value="IN_REPAIR">IN_REPAIR (Resume Overhaul at Target Bay)</option>
                      <option value="Not Dispatched">Not Dispatched (Holding Siding)</option>
                    </>
                  ) : isMfgAsset ? (
                    <>
                      <option value="IN_MANUFACTURING">IN_MANUFACTURING (In Assembly)</option>
                      <option value="PENDING_QA">PENDING_QA (Awaiting WRS-5 Testing)</option>
                      <option value="FIT">FIT (QA Certified)</option>
                      <option value="Dispatched">Dispatched (Outward Handover)</option>
                      <option value="Not Dispatched">Not Dispatched (Holding on Line)</option>
                    </>
                  ) : (
                    <>
                      <option value="IN_REPAIR">IN_REPAIR</option>
                      <option value="Shop In">Shop In</option>
                      <option value="Received NSY">Received NSY</option>
                      <option value="PENDING_QA">PENDING_QA</option>
                      <option value="FIT">FIT</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Not Dispatched">Not Dispatched</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={drawerLabelStyle}>Movement Remarks</label>
                <input
                  type="text"
                  placeholder={(asset.current_status === 'ON_HOLD' || !!activeHold) ? "e.g. Relocated to siding Line-01 while waiting for store components" : isMfgAsset ? "e.g. Erection complete, routing to WRS-5 for air brake testing" : "e.g. Shunted by yard master for wheelset overhaul"}
                  value={moveRemarks}
                  onChange={(e) => setMoveRemarks(e.target.value)}
                  style={drawerInputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => setShowMoveDrawer(false)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={handleExecuteMove}
                disabled={actionLoading}
                style={{ ...submitBtnStyle, backgroundColor: '#0284C7' }}
              >
                {actionLoading ? 'Shunting...' : 'Execute Shunt Movement'}
              </button>
            </div>
          </div>
        )}

        {/* Drawer 2: Hold Action Panel */}
        {showHoldModal && (
          <div style={drawerPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiPause size={14} color="#B45309" /> Put Repair Cycle On Hold (Pause TAT)
              </div>
              <button onClick={() => setShowHoldModal(false)} style={iconBtnStyle}><FiX size={14} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              <div>
                <label style={drawerLabelStyle}>Primary Hold Reason *</label>
                <select
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  style={drawerInputStyle}
                >
                  <option value="MATERIAL_SHORTAGE">MATERIAL_SHORTAGE (Store Non-Availability)</option>
                  <option value="SANCTION_PENDING">SANCTION_PENDING (Headquarters Approval)</option>
                  <option value="UNSCHEDULED_DEFECT">UNSCHEDULED_DEFECT (Major Structural Crack)</option>
                  <option value="LINE_BLOCK">LINE_BLOCK (Track Maintenance Block)</option>
                </select>
              </div>

              <div>
                <label style={drawerLabelStyle}>Remarks / Part Indent Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Waiting for CBC coupler draft gear indent #894"
                  value={holdRemarks}
                  onChange={(e) => setHoldRemarks(e.target.value)}
                  style={drawerInputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => setShowHoldModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={handleExecuteHold}
                disabled={actionLoading}
                style={{ ...submitBtnStyle, backgroundColor: '#B45309' }}
              >
                {actionLoading ? 'Placing Hold...' : 'Confirm TAT Hold'}
              </button>
            </div>
          </div>
        )}

        {/* Drawer 3: Discrepancy Exception Panel */}
        {showExceptionModal && (
          <div style={drawerPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiAlertOctagon size={14} color="#DC2626" /> Flag Workshop Discrepancy / Exception
              </div>
              <button onClick={() => setShowExceptionModal(false)} style={iconBtnStyle}><FiX size={14} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              <div>
                <label style={drawerLabelStyle}>Discrepancy Type *</label>
                <select
                  value={exceptionType}
                  onChange={(e) => setExceptionType(e.target.value)}
                  style={drawerInputStyle}
                >
                  <option value="DEFECT_FOUND">DEFECT_FOUND (Critical Failure during Repair)</option>
                  <option value="MISSING_ASSET">MISSING_ASSET (Asset not found at designated line)</option>
                  <option value="SAFETY_HAZARD">SAFETY_HAZARD (Brake Pipe Pressure / Shell Damage)</option>
                  <option value="REPAIR_REJECTED">REPAIR_REJECTED (QA Rejection)</option>
                </select>
              </div>

              <div>
                <label style={drawerLabelStyle}>Severity Level *</label>
                <select
                  value={exceptionSeverity}
                  onChange={(e) => setExceptionSeverity(e.target.value)}
                  style={drawerInputStyle}
                >
                  <option value="LOW">LOW (Informational)</option>
                  <option value="MEDIUM">MEDIUM (Requires Supervisor Review)</option>
                  <option value="HIGH">HIGH (Halts Stage Clearance)</option>
                  <option value="CRITICAL">CRITICAL (Executive Escalate)</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={drawerLabelStyle}>Defect Details & Justification *</label>
                <input
                  type="text"
                  placeholder="Describe exact physical discrepancy observed..."
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  style={drawerInputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => setShowExceptionModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={handleExecuteException}
                disabled={actionLoading || !exceptionReason.trim()}
                style={{ ...submitBtnStyle, backgroundColor: '#DC2626' }}
              >
                {actionLoading ? 'Flagging...' : 'File Discrepancy Exception'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox for Enlarge Photo */}
      {activePhoto && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setActivePhoto(null)}
        >
          <img src={activePhoto} alt="Enlarged inspection evidence" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '4px' }} />
        </div>
      )}
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

const modalContainerStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  width: '100%',
  maxWidth: '750px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #E5E7EB',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const bodyStyle: React.CSSProperties = {
  padding: '16px 20px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const footerStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid #E5E7EB',
  backgroundColor: '#F9FAFB',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sectionCardStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  backgroundColor: '#FFFFFF',
  overflow: 'hidden',
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '10px 12px',
  backgroundColor: '#F9FAFB',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  userSelect: 'none',
};

const iconCloseBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#6B7280',
  padding: '4px',
};

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '3px',
  backgroundColor: '#F1F5F9',
  color: '#334155',
  border: '1px solid #CBD5E1',
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

const closeBtnStyle: React.CSSProperties = {
  marginTop: '12px',
  padding: '6px 16px',
  backgroundColor: '#111827',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

const decoderBoxStyle: React.CSSProperties = {
  padding: '8px 10px',
  backgroundColor: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '4px',
  textAlign: 'center',
};

const decoderBoxHeaderStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#64748B',
  fontWeight: 600,
  marginBottom: '2px',
};

const decoderBoxValStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'monospace',
  color: '#0F172A',
};

const decoderBoxSubStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#475569',
  marginTop: '2px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function getStatusBadgeStyle(status: string, onHold: boolean): React.CSSProperties {
  if (onHold) {
    return {
      fontSize: '11px',
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: '3px',
      backgroundColor: '#FEF3C7',
      color: '#B45309',
      border: '1px solid #F59E0B',
    };
  }
  return {
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '3px',
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    border: '1px solid #86EFAC',
  };
}

const adminBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '5px 10px',
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: '4px',
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const drawerPanelStyle: React.CSSProperties = {
  padding: '12px 16px',
  backgroundColor: '#F8FAFC',
  borderTop: '1px solid #E2E8F0',
  animation: 'fadeIn 0.2s ease',
};

const drawerLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '3px',
  display: 'block',
  textTransform: 'uppercase',
};

const drawerInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid #CBD5E1',
  backgroundColor: '#FFFFFF',
  color: '#0F172A',
  outline: 'none',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#64748B',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const submitBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

