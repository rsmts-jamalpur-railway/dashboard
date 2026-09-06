'use client';
import React from 'react';
import { FiClock, FiMapPin, FiUser, FiAlertTriangle, FiArrowRight, FiCamera, FiCheck, FiInfo } from 'react-icons/fi';
import { decodeWagonNumber, detectAssetCategory, ASSET_CATEGORIES } from '@/lib/assetValidation';

export interface FormattedAsset {
  id: string;
  asset_number: string;
  category: string;
  subtype?: string;
  current_location: string;
  location_zone?: string;
  current_status: string;
  pipeline: 'REPAIR' | 'MANUFACTURING' | 'EXCEPTION' | string;
  tat_status: 'NORMAL' | 'WARNING' | 'BREACHED';
  elapsed_hours: number;
  standard_tat_hours: number;
  is_on_hold: boolean;
  hold_reason?: string | null;
  active_repair?: {
    cycle_id: string;
    category: string;
    status: string;
    started_at?: string;
  } | null;
  active_manufacturing?: {
    order_id: string;
    built_by_shop: string;
    status: string;
    current_stage: string;
    started_at?: string;
  } | null;
  qa_status?: {
    result: string;
    certificate_number?: string | null;
    inspected_at?: string;
  } | null;
  open_exceptions?: Array<{
    id: string;
    type: string;
    severity: string;
    reason: string;
  }>;
  latest_movement?: {
    from?: string | null;
    to: string;
    timestamp: string;
    handler: string;
    remarks?: string | null;
  } | null;
  photos?: string[];
  last_updated: string;
}

interface AssetCardProps {
  asset: FormattedAsset;
  onViewDetails: (assetNumber: string) => void;
}

export default function AssetCard({ asset, onViewDetails }: AssetCardProps) {
  // Format elapsed time nicely
  const formatTimeInState = (hours: number) => {
    if (hours < 24) return `${hours} hrs`;
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return rem > 0 ? `${days}d ${rem}h` : `${days} days`;
  };

  const isRepair = asset.pipeline === 'REPAIR';
  const isMfg = asset.pipeline === 'MANUFACTURING';
  const hasPhotos = asset.photos && asset.photos.length > 0;

  // Resolve Category & Format Rules
  const detectedType = detectAssetCategory(asset.asset_number);
  const normalizedCategory = (asset.category?.toUpperCase() || detectedType).replace(' ', '_');
  const isWagon = normalizedCategory === 'WAGON' || asset.asset_number.length === 11;
  const isLoco = normalizedCategory === 'LOCO' || asset.asset_number.length === 5;
  const isCrane = normalizedCategory === 'CRANE' || asset.subtype?.includes('CRANE') || asset.asset_number.startsWith('140') || asset.asset_number.startsWith('175');
  const isTowerCar = normalizedCategory === 'TOWER_CAR' || asset.subtype?.includes('DETC') || asset.subtype?.includes('DHTC');

  // Wagon 11-digit decoding (if applicable)
  const wagonInfo = isWagon && asset.asset_number.length === 11 ? decodeWagonNumber(asset.asset_number) : null;

  // Status badge styling
  const getStatusBadgeStyle = () => {
    if (asset.is_on_hold) {
      return { bg: '#FEF3C7', color: '#B45309', border: '#F59E0B', text: 'ON HOLD' };
    }
    switch (asset.current_status.toUpperCase()) {
      case 'FIT':
      case 'DISPATCHED':
        return { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC', text: asset.current_status };
      case 'PENDING QA':
      case 'PENDING_QA':
        return { bg: '#EDE9FE', color: '#6D28D9', border: '#C4B5FD', text: 'PENDING QA' };
      case 'SHOP IN':
      case 'IN_REPAIR':
        return { bg: '#E0F2FE', color: '#0369A1', border: '#7DD3FC', text: 'IN REPAIR' };
      case 'IN_MANUFACTURING':
        return { bg: '#FDF4FF', color: '#A21CAF', border: '#F0ABFC', text: 'IN ASSEMBLY' };
      case 'RECEIVED NSY':
      case 'NSY IN':
      case 'RECEIVED_NSY':
        return { bg: '#F3F4F6', color: '#374151', border: '#D1D5DB', text: 'RECEIVED NSY' };
      case 'ALLOCATED':
        return { bg: '#FEF9C3', color: '#854D0E', border: '#FDE047', text: 'ALLOCATED' };
      case 'MISSING':
      case 'CONDEMNED':
        return { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5', text: asset.current_status };
      default:
        return { bg: '#F3F4F6', color: '#1F2937', border: '#E5E7EB', text: asset.current_status };
    }
  };

  const statusStyle = getStatusBadgeStyle();

  // Category Badge Visuals
  const getCategoryTheme = () => {
    if (isWagon) {
      return { icon: '🚃', label: 'WAGON (11-Digit)', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' };
    }
    if (isLoco) {
      return { icon: '🚂', label: 'LOCO (5-Digit)', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
    }
    if (isCrane) {
      return { icon: '🏗️', label: 'CRANE (6-Digit)', bg: '#FAF5FF', color: '#7E22CE', border: '#E9D5FF' };
    }
    if (isTowerCar) {
      return { icon: '🗼', label: 'TOWER CAR', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' };
    }
    return { icon: '📦', label: asset.category || 'ROLLING STOCK', bg: '#F1F5F9', color: '#334155', border: '#CBD5E1' };
  };

  const catTheme = getCategoryTheme();

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '6px',
        padding: '14px 18px',
        marginBottom: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#94A3B8';
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E5E7EB';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Asset Number with Category Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px' }}>{catTheme.icon}</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '15px',
                fontWeight: 700,
                color: '#0F172A',
                letterSpacing: '0.03em',
              }}
            >
              #{asset.asset_number}
            </span>
          </div>

          {/* Category Type Badge */}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '3px',
              backgroundColor: catTheme.bg,
              color: catTheme.color,
              border: `1px solid ${catTheme.border}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {asset.subtype || catTheme.label}
          </span>

          {/* 11-Digit Wagon Check-Digit Pill (If Wagon) */}
          {wagonInfo && (
            <span
              title={`Indian Railways 11-digit verified: Type=${wagonInfo.typeCode}, Zone=${wagonInfo.railwayCode}, Year=${wagonInfo.yearCode}, Serial=${wagonInfo.serialNumber}, CheckDigit=${wagonInfo.enteredCheckDigit}`}
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: wagonInfo.isValidCheckDigit ? '#DCFCE7' : '#FEE2E2',
                color: wagonInfo.isValidCheckDigit ? '#15803D' : '#DC2626',
                border: `1px solid ${wagonInfo.isValidCheckDigit ? '#86EFAC' : '#FCA5A5'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              {wagonInfo.isValidCheckDigit ? <FiCheck size={11} /> : <FiAlertTriangle size={11} />}
              {wagonInfo.isValidCheckDigit ? `CD: ${wagonInfo.enteredCheckDigit} ✓` : `CD: ${wagonInfo.enteredCheckDigit} (Exp: ${wagonInfo.calculatedCheckDigit})`}
            </span>
          )}

          {/* Subtype / Railway Quick Tag for Wagons */}
          {wagonInfo && (
            <span
              style={{
                fontSize: '10px',
                color: '#64748B',
                backgroundColor: '#F8FAFC',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #E2E8F0',
              }}
            >
              {wagonInfo.railwayName.split(' ')[0]} • Built {wagonInfo.manufactureYear}
            </span>
          )}

          {/* Pipeline Pill */}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '3px',
              backgroundColor: isMfg ? '#FDF4FF' : '#EFF6FF',
              color: isMfg ? '#86198F' : '#1E40AF',
              border: `1px solid ${isMfg ? '#F0ABFC' : '#BFDBFE'}`,
            }}
          >
            {isMfg ? '🏗️ Manufacturing' : '🔧 Repair Overhaul'}
          </span>

          {/* Current Status Pill */}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '3px',
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
            }}
          >
            {statusStyle.text}
          </span>

          {/* Photo indicator badge */}
          {hasPhotos && (
            <span
              title={`${asset.photos?.length} inspection photos attached`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: '#F8FAFC',
                color: '#64748B',
                border: '1px solid #E2E8F0',
              }}
            >
              <FiCamera size={11} /> {asset.photos?.length}
            </span>
          )}
        </div>

        {/* Right side: TAT Health Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {asset.tat_status === 'BREACHED' && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '3px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #F87171',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FiAlertTriangle size={12} /> TAT BREACHED
            </span>
          )}
          {asset.tat_status === 'WARNING' && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '3px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                border: '1px solid #FCD34D',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FiClock size={12} /> 80% TAT
            </span>
          )}
        </div>
      </div>

      {/* Primary Context Line */}
      <div
        style={{
          fontSize: '13px',
          color: '#374151',
          lineHeight: '1.5',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FiMapPin size={13} color="#6B7280" />
          <span style={{ fontWeight: 600, color: '#111827' }}>Location:</span>
          <span>{asset.current_location}</span>
          <span style={{ fontSize: '11px', color: '#6B7280' }}>({asset.location_zone || 'Yard'})</span>
        </div>

        {isRepair && asset.active_repair && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontWeight: 600, color: '#111827' }}>Category:</span>
            <span>{asset.active_repair.category || 'POH'}</span>
          </div>
        )}

        {isMfg && asset.active_manufacturing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontWeight: 600, color: '#111827' }}>Stage:</span>
            <span>{asset.active_manufacturing.current_stage}</span>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>(Shop: {asset.active_manufacturing.built_by_shop})</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FiClock size={13} color="#6B7280" />
          <span style={{ fontWeight: 600, color: '#111827' }}>Elapsed:</span>
          <span>{formatTimeInState(asset.elapsed_hours)}</span>
          {asset.standard_tat_hours > 0 && (
            <span style={{ fontSize: '11px', color: '#6B7280' }}>/ std {asset.standard_tat_hours}h</span>
          )}
        </div>

        {asset.latest_movement?.handler && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FiUser size={13} color="#6B7280" />
            <span style={{ fontWeight: 600, color: '#111827' }}>Supervisor:</span>
            <span>{asset.latest_movement.handler}</span>
          </div>
        )}
      </div>

      {/* Sub-text / Remarks / Hold Alert */}
      {asset.is_on_hold && (
        <div
          style={{
            fontSize: '12px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            padding: '6px 10px',
            borderRadius: '4px',
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <FiClock size={13} color="#B45309" />
          <span>
            <strong>Material Shortage Hold:</strong> {asset.hold_reason || 'Awaiting inventory parts from Stores Yard'}
          </span>
        </div>
      )}

      {asset.latest_movement?.remarks && !asset.is_on_hold && (
        <div
          style={{
            fontSize: '12px',
            color: '#6B7280',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          &ldquo;{asset.latest_movement.remarks}&rdquo;
        </div>
      )}

      {/* Footer Row: Timestamp & View Details Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #F3F4F6',
          paddingTop: '8px',
          marginTop: '2px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
          Last telemetry update: {new Date(asset.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        <button
          type="button"
          onClick={() => onViewDetails(asset.asset_number)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#0F172A',
            backgroundColor: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '4px',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0F172A';
            e.currentTarget.style.color = '#FFFFFF';
            e.currentTarget.style.borderColor = '#0F172A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F8FAFC';
            e.currentTarget.style.color = '#0F172A';
            e.currentTarget.style.borderColor = '#CBD5E1';
          }}
        >
          <span>View Asset Telemetry</span>
          <FiArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
