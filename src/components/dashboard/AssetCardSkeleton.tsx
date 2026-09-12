'use client';
import React from 'react';

export default function AssetCardSkeleton() {
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
        gap: '12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
          .skeleton-box {
            background-color: #E2E8F0;
            border-radius: 4px;
          }
        `}
      </style>

      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Asset Number Icon/Text */}
          <div className="skeleton-box" style={{ width: '120px', height: '24px' }} />
          {/* Badges */}
          <div className="skeleton-box" style={{ width: '80px', height: '20px' }} />
          <div className="skeleton-box" style={{ width: '90px', height: '20px' }} />
          <div className="skeleton-box" style={{ width: '70px', height: '20px' }} />
        </div>
        {/* TAT Badge Right */}
        <div className="skeleton-box" style={{ width: '80px', height: '22px' }} />
      </div>

      {/* Primary Context Line */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div className="skeleton-box" style={{ width: '140px', height: '18px' }} />
        <div className="skeleton-box" style={{ width: '110px', height: '18px' }} />
        <div className="skeleton-box" style={{ width: '100px', height: '18px' }} />
      </div>

      {/* Footer Row */}
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
        <div className="skeleton-box" style={{ width: '150px', height: '14px' }} />
        <div className="skeleton-box" style={{ width: '130px', height: '28px' }} />
      </div>
    </div>
  );
}
