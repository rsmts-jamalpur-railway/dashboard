'use client';
import React from 'react';
import classes from '../../app/(dashboard)/page.module.css';

export default function KpiCardSkeleton() {
  return (
    <>
      <style>
        {`
          @keyframes pulse-kpi {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
          .kpi-skeleton-box {
            background-color: #E2E8F0;
            border-radius: 4px;
            animation: pulse-kpi 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}
      </style>
      
      {/* 5 KPI Skeletons to match the grid */}
      {[1, 2, 3, 4, 5].map((idx) => (
        <div key={idx} className={classes.kpiCard} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '86px', justifyContent: 'center' }}>
          <div className="kpi-skeleton-box" style={{ width: '70%', height: '14px' }} />
          <div className="kpi-skeleton-box" style={{ width: '40%', height: '28px', marginTop: '4px' }} />
        </div>
      ))}
    </>
  );
}
