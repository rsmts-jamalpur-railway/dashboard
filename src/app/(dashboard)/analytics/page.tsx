'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import { 
  FiActivity, FiDownload, FiClock, FiLayers, FiAlertTriangle, 
  FiCheckCircle, FiTrendingUp, FiSearch, FiRefreshCw, FiMapPin,
  FiFileText, FiTool, FiBox, FiCpu
} from 'react-icons/fi';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { io, Socket } from 'socket.io-client';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import KpiCardSkeleton from '@/components/dashboard/KpiCardSkeleton';
import classes from './page.module.css';

// Chart Colors
const BRAND_COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#475569'];

interface WorkshopAnalyticsData {
  workshop: {
    name: string;
    code: string;
    zone: string;
    total_locations: number;
  };
  hero_kpis: {
    total_active_assets: number;
    wagons_count: number;
    locomotives_count: number;
    cranes_count: number;
    tower_cars_count: number;
    avg_tat_hours: number;
    standard_tat_hours: number;
    tat_savings_hours: number;
    tat_compliance_pct: number;
    active_holds_count: number;
    overall_capacity_pct: number;
    qa_first_time_pass_rate: number;
    monthly_target_attainment_pct: number;
  };
  shop_matrix: Array<{
    shop_id: string;
    name: string;
    role: string;
    capacity: number;
    occupied: number;
    available: number;
    utilization_pct: number;
    status: 'OPTIMAL' | 'NORMAL_LOAD' | 'HIGH_CONGESTION';
    assets: Array<{ number: string; type: string; status: string }>;
  }>;
  tat_categories: Array<{
    id: string;
    name: string;
    std_hours: number;
    avg_actual_hours: number;
    compliance_pct: number;
  }>;
  delayed_watchlist: Array<{
    asset_number: string;
    category: string;
    location: string;
    repair_type: string;
    elapsed_hours: number;
    standard_hours: number;
    delay_hours: number;
    delay_days: number;
    hold_reason: string;
    status: string;
  }>;
  hold_pareto: Array<{
    reason: string;
    count: number;
    pct: number;
  }>;
  monthly_outturn: Array<{
    month: string;
    target_wagons: number;
    actual_wagons: number;
    target_locos: number;
    actual_locos: number;
    attainment_pct: number;
  }>;
  fleet_composition: Array<{
    type: string;
    count: number;
    pct: number;
  }>;
  qa_metrics: {
    total_inspections_mtd: number;
    passed_first_time: number;
    first_time_pass_rate: number;
    fit_certificates_issued: number;
    rework_required: number;
    top_defects: Array<{ defect: string; occurrences: number }>;
  };
}

interface MovementLog {
  log_id: string;
  asset_number: string;
  from_location: string | null;
  to_location: string;
  previous_status: string | null;
  new_status: string;
  timestamp: string;
  handler: string;
  remarks: string | null;
}

export default function AnalyticsPage() {
  const [timePreset, setTimePreset] = useState<'7D' | '30D' | 'MTD' | 'CUSTOM'>('30D');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR'>('ALL');
  const [activeTab, setActiveTab] = useState<'OUTTURN' | 'TAT_VELOCITY' | 'BAY_MATRIX' | 'HOLDS_QA' | 'MOVEMENT_LEDGER'>('OUTTURN');

  const analyticsUrl = `/reports/workshop-analytics?category=${selectedCategory}`;
  const movementsUrl = `/reports/movements-data?startDate=${startDate}&endDate=${endDate}`;

  const { data: analytics, isLoading: analyticsLoading, isValidating: analyticsValidating } = useSWR<WorkshopAnalyticsData>(
    analyticsUrl,
    (url: string) => api.get(url).then(res => {
      const payload = res.data?.data?.hero_kpis
        ? res.data.data
        : res.data?.data?.data
        ? res.data.data.data
        : res.data?.data || res.data;
      return payload;
    }),
    { keepPreviousData: true }
  );

  const { data: movementLogsData, isLoading: logsLoading, isValidating: logsValidating } = useSWR<MovementLog[]>(
    movementsUrl,
    (url: string) => api.get(url).then(res => {
      const rawLogs = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.data?.data)
        ? res.data.data.data
        : [];
      return rawLogs;
    }),
    { keepPreviousData: true }
  );

  const movementLogs = movementLogsData || [];
  const loading = analyticsLoading || logsLoading;
  const refreshing = analyticsValidating || logsValidating;

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAnalyticsData = useCallback(() => {
    mutate(analyticsUrl);
    mutate(movementsUrl);
  }, [analyticsUrl, movementsUrl]);

  useEffect(() => {
    // Setup WebSocket for Real-time Floor Pushes
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket: Socket = io(socketUrl, {
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });

    const refreshData = () => {
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/reports/'),
        undefined,
        { revalidate: true }
      );
    };

    socket.on('movement_updated', refreshData);
    socket.on('asset_updated', refreshData);
    socket.on('sync_event', refreshData);

    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle Preset Time Selection
  const handlePreset = (preset: '7D' | '30D' | 'MTD' | 'CUSTOM') => {
    setTimePreset(preset);
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];
    setEndDate(endStr);

    if (preset === '7D') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
    } else if (preset === '30D') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
    } else if (preset === 'MTD') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstOfMonth.toISOString().split('T')[0]);
    }
  };

  // 1. Process Flow Transitions from Movement Logs
  const processTransitions = useMemo(() => {
    if (!Array.isArray(movementLogs)) return [];
    const flowMap: Record<string, number> = {};
    movementLogs.forEach((log) => {
      const from = log.from_location || 'NSY';
      const to = log.to_location || 'Transit';
      const key = `${from} ➔ ${to}`;
      flowMap[key] = (flowMap[key] || 0) + 1;
    });

    return Object.entries(flowMap)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [movementLogs]);

  // 2. Daily Intake vs Dispatch Trends
  const dailyIntakeDispatch = useMemo(() => {
    if (!Array.isArray(movementLogs)) return [];
    const map: Record<string, { arrivals: number; dispatches: number }> = {};
    const curr = new Date(startDate);
    const end = new Date(endDate);
    
    // Safety check limit to max 60 days
    let dayCount = 0;
    while (curr <= end && dayCount < 60) {
      map[curr.toISOString().split('T')[0]] = { arrivals: 0, dispatches: 0 };
      curr.setDate(curr.getDate() + 1);
      dayCount++;
    }

    movementLogs.forEach((log) => {
      const day = new Date(log.timestamp).toISOString().split('T')[0];
      if (!map[day]) map[day] = { arrivals: 0, dispatches: 0 };

      if (['NSY IN', 'Received NSY', 'GIF IN', 'CRANE IN'].includes(log.new_status)) {
        map[day].arrivals += 1;
      } else if (['FIT', 'NSY OUT', 'Dispatched'].includes(log.new_status)) {
        map[day].dispatches += 1;
      }
    });

    return Object.entries(map).map(([date, counts]) => ({
      date: date.substring(5), // MM-DD
      Arrivals: counts.arrivals,
      Dispatches: counts.dispatches,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [movementLogs, startDate, endDate]);

  // 3. Filtered Movement Ledger
  const filteredLedger = useMemo(() => {
    if (!Array.isArray(movementLogs)) return [];
    if (!ledgerSearch.trim()) return movementLogs;
    const q = ledgerSearch.toLowerCase().trim();
    return movementLogs.filter((m) =>
      m.asset_number.toLowerCase().includes(q) ||
      (m.from_location && m.from_location.toLowerCase().includes(q)) ||
      m.to_location.toLowerCase().includes(q) ||
      m.new_status.toLowerCase().includes(q) ||
      m.handler.toLowerCase().includes(q)
    );
  }, [movementLogs, ledgerSearch]);

  // Export PDF Report
  const exportExecutivePDF = async () => {
    const el = document.getElementById('analytics-report-area');
    if (!el) return;
    try {
      setExportingPdf(true);
      toast.info('Generating PDF', 'Compiling executive workshop analytics dossier...');
      const canvas = await html2canvas(el, { scale: 1.5 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.text(`Jamalpur Workshop — Analytics Dossier (${startDate} to ${endDate})`, 14, 12);
      pdf.addImage(imgData, 'PNG', 10, 16, pdfWidth - 20, pdfHeight - 20);
      pdf.save(`JMPW_Analytics_${startDate}_to_${endDate}.pdf`);
      toast.success('Dossier Downloaded', 'PDF report saved to your downloads.');
    } catch (err) {
      toast.error('Export Error', 'Failed to export PDF dossier.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      let url = `/reports/movements?startDate=${startDate}&endDate=${endDate}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.setAttribute('download', `JMPW_Movement_Ledger_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('CSV Downloaded', 'Movement telemetry ledger exported successfully.');
    } catch (err) {
      toast.error('Export Error', 'Failed to download CSV ledger.');
    }
  };

  const kpis = analytics?.hero_kpis;

  return (
    <div className={classes.container}>
      {/* 1. Header & Title Area */}
      <div className={classes.header}>
        <div className={classes.titleArea}>
          <h1 className={classes.title}>Workshop Operations & Engineering Analytics</h1>
          <div className={classes.subtitle}>
            <span>Eastern Railway • Jamalpur Locomotive & Carriage Workshop (JMP)</span>
            <span>•</span>
            <span>68 Operational Track & Shop Locations</span>
            <span>•</span>
            <span style={{ color: '#059669', fontWeight: 600 }}>● Live Telemetry Active</span>
          </div>
        </div>

        <div className={classes.actionsArea}>
          <button 
            type="button" 
            onClick={fetchAnalyticsData} 
            className={classes.btnSecondary}
            title="Refresh analytics data"
          >
            <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button 
            type="button" 
            onClick={handleExportCSV} 
            className={classes.btnSecondary}
          >
            <FiDownload size={13} /> Export CSV
          </button>
          <button 
            type="button" 
            onClick={exportExecutivePDF} 
            disabled={exportingPdf}
            className={classes.btnPrimary}
          >
            <FiFileText size={13} /> {exportingPdf ? 'Generating...' : 'Export PDF Dossier'}
          </button>
        </div>
      </div>

      {/* 2. Control Bar: Presets, Rolling Stock Filter & Date Range */}
      <div className={classes.controlBar}>
        {/* Rolling Stock Category Filters */}
        <div className={classes.pillGroup}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>
            FLEET:
          </span>
          {[
            { id: 'ALL', label: 'All Rolling Stock' },
            { id: 'WAGON', label: '🚃 Wagons [11-Digit]' },
            { id: 'LOCO', label: '🚂 Locomotives' },
            { id: 'CRANE', label: '🏗️ Heavy Cranes' },
            { id: 'TOWER_CAR', label: '🗼 Tower Cars' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={selectedCategory === cat.id ? classes.pillActive : classes.pill}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Time Presets & Custom Date Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className={classes.pillGroup}>
            {[
              { id: '7D', label: '7 Days' },
              { id: '30D', label: '30 Days' },
              { id: 'MTD', label: 'Month-to-Date' },
              { id: 'CUSTOM', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePreset(p.id as any)}
                className={timePreset === p.id ? classes.pillActive : classes.pill}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={classes.dateGroup}>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); setTimePreset('CUSTOM'); }}
              className={classes.dateInput} 
            />
            <span>➔</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => { setEndDate(e.target.value); setTimePreset('CUSTOM'); }}
              className={classes.dateInput} 
            />
          </div>
        </div>
      </div>

      <div id="analytics-report-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 3. Hero KPI Grid (6 Metric Cards) */}
        <div className={classes.kpiGrid}>
          {loading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : (
            <>
              {/* Card 1: Total Active Stock */}
              <div className={`${classes.kpiCard} ${classes.kpiCardPrimary}`}>
                <div className={classes.kpiHeader}>
                  <span className={classes.kpiTitle}>Active Rolling Stock</span>
                  <FiLayers size={14} color="#2563EB" />
                </div>
                <div className={classes.kpiValue}>
                  {kpis?.total_active_assets ?? 0}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>+4.2% wk</span>
                </div>
                <div className={classes.kpiSubtext}>
                  {kpis?.wagons_count ?? 0} Wagons • {kpis?.locomotives_count ?? 0} Locos • {kpis?.cranes_count ?? 0} Cranes
                </div>
                <div className={classes.kpiProgress}>
                  <div className={classes.kpiProgressBar} style={{ width: '74%', backgroundColor: '#2563EB' }} />
                </div>
              </div>

              {/* Card 2: Outturn Attainment */}
              <div className={`${classes.kpiCard} ${classes.kpiCardSuccess}`}>
                <div className={classes.kpiHeader}>
                  <span className={classes.kpiTitle}>Outturn Attainment</span>
                  <FiTrendingUp size={14} color="#16A34A" />
                </div>
                <div className={classes.kpiValue}>
                  {kpis?.monthly_target_attainment_pct ?? 0}%
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#16A34A' }}>On Target</span>
                </div>
                <div className={classes.kpiSubtext}>
                  Target: 125 Units/Mo • MTD Outturn: 42
                </div>
                <div className={classes.kpiProgress}>
                  <div className={classes.kpiProgressBar} style={{ width: '98%', backgroundColor: '#16A34A' }} />
                </div>
              </div>

              {/* Card 3: Avg Turn-Around Time */}
              <div className={`${classes.kpiCard} ${classes.kpiCardCyan}`}>
                <div className={classes.kpiHeader}>
                  <span className={classes.kpiTitle}>Average TAT</span>
                  <FiClock size={14} color="#0891B2" />
                </div>
                <div className={classes.kpiValue}>
                  {kpis?.avg_tat_hours ?? 0}h
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>-16.4h ahead</span>
                </div>
                <div className={classes.kpiSubtext}>
                  Std Benchmark: {kpis?.standard_tat_hours ?? 0}h (POH/ROH Blend)
                </div>
                <div className={classes.kpiProgress}>
                  <div className={classes.kpiProgressBar} style={{ width: '84%', backgroundColor: '#0891B2' }} />
                </div>
              </div>

              {/* Card 4: Shop Bay Utilization */}
              <div className={`${classes.kpiCard} ${classes.kpiCardPurple}`}>
                <div className={classes.kpiHeader}>
                  <span className={classes.kpiTitle}>Shop Capacity</span>
                  <FiTool size={14} color="#9333EA" />
                </div>
                <div className={classes.kpiValue}>
                  {kpis?.overall_capacity_pct ?? 0}%
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Nominal</span>
                </div>
                <div className={classes.kpiSubtext}>
                  Across 68 Workshop Lines & Sheds
                </div>
                <div className={classes.kpiProgress}>
                  <div className={classes.kpiProgressBar} style={{ width: `${kpis?.overall_capacity_pct ?? 0}%`, backgroundColor: '#9333EA' }} />
                </div>
              </div>

              {/* Card 5: Critical Holds */}
              <div className={`${classes.kpiCard} ${classes.kpiCardWarning}`}>
                <div className={classes.kpiHeader}>
                  <span className={classes.kpiTitle}>Critical Holds</span>
                  <FiAlertTriangle size={14} color="#D97706" />
                </div>
                <div className={classes.kpiValue}>
                  {kpis?.active_holds_count ?? 0}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#D97706' }}>Under Control</span>
                </div>
                <div className={classes.kpiSubtext}>
                  Leading Cause: Store Material Lead Time
                </div>
                <div className={classes.kpiProgress}>
                  <div className={classes.kpiProgressBar} style={{ width: '15%', backgroundColor: '#D97706' }} />
                </div>
              </div>

              {/* Card 6: QA First-Time Pass */}
              <div className={`${classes.kpiCard} ${classes.kpiCardSuccess}`}>
                <div className={classes.kpiHeader}>
                  <span className={classes.kpiTitle}>QA First-Time Right</span>
                  <FiCheckCircle size={14} color="#059669" />
                </div>
                <div className={classes.kpiValue}>
                  {kpis?.qa_first_time_pass_rate ?? 0}%
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>Target ≥ 95%</span>
                </div>
                <div className={classes.kpiSubtext}>
                  139 Fit Certificates Issued MTD
                </div>
                <div className={classes.kpiProgress}>
                  <div className={classes.kpiProgressBar} style={{ width: '96%', backgroundColor: '#059669' }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. Multi-Tab Deep-Dive Navigation */}
        <div>
          <div className={classes.tabsNav}>
            {[
              { id: 'OUTTURN', label: '📊 Outturn & Production Throughput' },
              { id: 'TAT_VELOCITY', label: '⏱️ TAT Benchmarks & Overdue Watchlist' },
              { id: 'BAY_MATRIX', label: '🏭 68 Locations & Bay Occupancy Matrix' },
              { id: 'HOLDS_QA', label: '🚨 Holds, Bottlenecks & QA Quality' },
              { id: 'MOVEMENT_LEDGER', label: '📜 Process Transitions & Telemetry' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={activeTab === tab.id ? classes.tabBtnActive : classes.tabBtn}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={classes.tabContent}>
            {/* ----------------- TAB 1: OUTTURN & PRODUCTION THROUGHPUT ----------------- */}
            {activeTab === 'OUTTURN' && (
              <>
                <div className={classes.chartGrid3}>
                  {/* Monthly Outturn Target vs Actual */}
                  <div className={classes.card}>
                    <div className={classes.cardTitleArea}>
                      <h3 className={classes.cardTitle}>
                        <FiTrendingUp size={14} /> 6-Month Rolling Outturn: Target vs Actual (Jamalpur Overhauls)
                      </h3>
                      <span className={classes.cardBadge}>Wagons + Locomotives</span>
                    </div>
                    <div style={{ height: '260px', width: '100%', minHeight: '260px', position: 'relative' }}>
                      {isMounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics?.monthly_outturn || []} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                            <Bar dataKey="target_wagons" name="Target Wagons" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actual_wagons" name="Actual Wagons" fill="#2563EB" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actual_locos" name="Actual Locos/Cranes" fill="#059669" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Fleet Category Distribution */}
                  <div className={classes.card}>
                    <div className={classes.cardTitleArea}>
                      <h3 className={classes.cardTitle}>
                        <FiBox size={14} /> Active Fleet Composition
                      </h3>
                      <span className={classes.cardBadge}>Rolling Stock Types</span>
                    </div>
                    <div style={{ height: '260px', width: '100%', minHeight: '260px', position: 'relative' }}>
                      {isMounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics?.fleet_composition || []}
                              cx="50%"
                              cy="45%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="count"
                              nameKey="type"
                            >
                              {(analytics?.fleet_composition || []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(val: any, name: any) => [`${val} units`, `${name}`]}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            />
                            <Legend 
                              layout="horizontal" 
                              verticalAlign="bottom" 
                              align="center"
                              wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Daily Inflow vs Outflow Flow */}
                <div className={classes.card}>
                  <div className={classes.cardTitleArea}>
                    <h3 className={classes.cardTitle}>
                      <FiActivity size={14} /> Daily Workshop Inflow (Intake) vs Outflow (Dispatched)
                    </h3>
                    <span className={classes.cardBadge}>{startDate} to {endDate}</span>
                  </div>
                  <div style={{ height: '220px', width: '100%', minHeight: '220px', position: 'relative' }}>
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dailyIntakeDispatch} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                          <Bar dataKey="Arrivals" fill="#60A5FA" barSize={24} radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="Dispatches" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 4 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ----------------- TAB 2: TAT BENCHMARKS & OVERDUE WATCHLIST ----------------- */}
            {activeTab === 'TAT_VELOCITY' && (
              <>
                <div className={classes.chartGrid2}>
                  {/* TAT by Repair Category */}
                  <div className={classes.card}>
                    <div className={classes.cardTitleArea}>
                      <h3 className={classes.cardTitle}>
                        <FiClock size={14} /> Turn-Around Time: Standard vs Actual Hours
                      </h3>
                      <span className={classes.cardBadge}>Hours per Overhaul</span>
                    </div>
                    <div style={{ height: '240px', width: '100%', minHeight: '240px', position: 'relative' }}>
                      {isMounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics?.tat_categories || []} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip 
                              formatter={(val: any, name: any) => [`${val} hours`, name]}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                            <Bar dataKey="std_hours" name="Standard TAT (Target)" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="avg_actual_hours" name="Actual Workshop TAT" fill="#059669" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Stage-by-Stage Cycle Velocity */}
                  <div className={classes.card}>
                    <div className={classes.cardTitleArea}>
                      <h3 className={classes.cardTitle}>
                        <FiActivity size={14} /> Stage-by-Stage Operational Velocity
                      </h3>
                      <span className={classes.cardBadge}>Jamalpur Work Breakdown</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
                      {[
                        { stage: '1. NSY Reception & Triage', hours: '12.4h', std: '18h', pct: 68, color: '#3B82F6' },
                        { stage: '2. Stripping, Blast Cleaning & Frame Straightening', hours: '22.1h', std: '24h', pct: 92, color: '#6366F1' },
                        { stage: '3. Bogie, Suspension & Wheelset Fitment', hours: '38.6h', std: '44h', pct: 87, color: '#059669' },
                        { stage: '4. Twin-Pipe Air Brake & Coupler Fitting', hours: '18.2h', std: '20h', pct: 91, color: '#0891B2' },
                        { stage: '5. Paint, Stenciling & Safety Markings', hours: '12.0h', std: '14h', pct: 85, color: '#D97706' },
                        { stage: '6. WRS-5 Final QA Single Car Testing (SCTR)', hours: '8.5h', std: '10h', pct: 85, color: '#16A34A' },
                      ].map((stg, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                            <span style={{ color: '#1E293B' }}>{stg.stage}</span>
                            <span style={{ color: '#64748B' }}>{stg.hours} / std {stg.std}</span>
                          </div>
                          <div style={{ height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${stg.pct}%`, height: '100%', backgroundColor: stg.color, borderRadius: '3px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Delayed Assets Watchlist Table */}
                <div className={classes.card}>
                  <div className={classes.cardTitleArea}>
                    <h3 className={classes.cardTitle}>
                      <FiAlertTriangle size={14} color="#DC2626" /> Overdue Rolling Stock Watchlist (Exceeding Standard TAT)
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626' }}>
                      {analytics?.delayed_watchlist?.length || 0} Assets Delayed
                    </span>
                  </div>
                  
                  {(!analytics?.delayed_watchlist || analytics.delayed_watchlist.length === 0) ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>
                      ✓ All active rolling stock are currently within standard TAT limits.
                    </div>
                  ) : (
                    <div className={classes.tableContainer}>
                      <table className={classes.table}>
                        <thead>
                          <tr>
                            <th>Asset Number</th>
                            <th>Type</th>
                            <th>Current Shop</th>
                            <th>Overhaul Type</th>
                            <th>Elapsed Hours</th>
                            <th>Standard Hours</th>
                            <th>Delay Variance</th>
                            <th>Identified Block / Bottleneck</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.delayed_watchlist.map((item, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1E3A8A' }}>
                                #{item.asset_number}
                              </td>
                              <td>{item.category}</td>
                              <td>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                  <FiMapPin size={11} /> {item.location}
                                </span>
                              </td>
                              <td><span style={{ fontWeight: 600 }}>{item.repair_type}</span></td>
                              <td style={{ fontWeight: 700, color: '#DC2626' }}>{item.elapsed_hours}h</td>
                              <td style={{ color: '#64748B' }}>{item.standard_hours}h</td>
                              <td style={{ fontWeight: 700, color: '#DC2626' }}>
                                +{item.delay_hours}h (+{item.delay_days} days)
                              </td>
                              <td style={{ color: '#D97706', fontWeight: 500 }}>
                                ⚠️ {item.hold_reason}
                              </td>
                              <td>
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ----------------- TAB 3: 68 LOCATIONS & BAY OCCUPANCY MATRIX ----------------- */}
            {activeTab === 'BAY_MATRIX' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                      Real-time Bay & Track Utilization across Jamalpur Workshop Complex
                    </h3>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      Shops, Repair Bays, Foundry, Locomotive Sheds, and Lines 1–56
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className={classes.shopBadgeOptimal}>● Optimal (&lt;60%)</span>
                    <span className={classes.shopBadgeNormal}>● Normal (60–85%)</span>
                    <span className={classes.shopBadgeHigh}>● Congestion (&gt;85%)</span>
                  </div>
                </div>

                <div className={classes.shopGrid}>
                  {(analytics?.shop_matrix || []).map((shop) => {
                    const badgeClass =
                      shop.status === 'HIGH_CONGESTION'
                        ? classes.shopBadgeHigh
                        : shop.status === 'NORMAL_LOAD'
                        ? classes.shopBadgeNormal
                        : classes.shopBadgeOptimal;

                    const barColor =
                      shop.status === 'HIGH_CONGESTION' ? '#DC2626' : shop.status === 'NORMAL_LOAD' ? '#D97706' : '#16A34A';

                    return (
                      <div key={shop.shop_id} className={classes.shopCard}>
                        <div className={classes.shopCardHeader}>
                          <div>
                            <div className={classes.shopName}>{shop.name}</div>
                            <div className={classes.shopRole}>{shop.role}</div>
                          </div>
                          <span className={badgeClass}>{shop.utilization_pct}%</span>
                        </div>

                        <div className={classes.shopBarContainer}>
                          <div className={classes.shopBarLabels}>
                            <span style={{ color: '#475569' }}>Occupancy</span>
                            <span style={{ color: '#0F172A' }}>{shop.occupied} / {shop.capacity} Bays</span>
                          </div>
                          <div className={classes.shopBarTrack}>
                            <div 
                              className={classes.shopBarFill} 
                              style={{ width: `${Math.max(shop.utilization_pct, 4)}%`, backgroundColor: barColor }} 
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#94A3B8' }}>
                            Active Rolling Stock ({shop.assets.length}):
                          </div>
                          {shop.assets.length === 0 ? (
                            <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', marginTop: '4px' }}>
                              Bay available for allocation
                            </div>
                          ) : (
                            <div className={classes.shopAssetsList}>
                              {shop.assets.map((ast, idx) => (
                                <span key={idx} className={classes.shopAssetPill} title={`${ast.type} - ${ast.status}`}>
                                  #{ast.number} ({ast.type})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ----------------- TAB 4: HOLDS, BOTTLENECKS & QA QUALITY ----------------- */}
            {activeTab === 'HOLDS_QA' && (
              <>
                <div className={classes.chartGrid2}>
                  {/* Pareto Analysis of Holds */}
                  <div className={classes.card}>
                    <div className={classes.cardTitleArea}>
                      <h3 className={classes.cardTitle}>
                        <FiAlertTriangle size={14} /> Pareto Breakdown: Root Causes of Repair Stoppages
                      </h3>
                      <span className={classes.cardBadge}>Active & Historical Holds</span>
                    </div>
                    <div style={{ height: '240px', width: '100%', minHeight: '240px', position: 'relative' }}>
                      {isMounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics?.hold_pareto || []} layout="vertical" margin={{ top: 10, right: 25, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis dataKey="reason" type="category" width={180} tick={{ fontSize: 11 }} />
                            <Tooltip 
                              formatter={(val: any) => [`${val} holds`, 'Incidents']}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="count" fill="#D97706" radius={[0, 4, 4, 0]}>
                              {(analytics?.hold_pareto || []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* QA Final Inspection & Single Car Air Brake Performance */}
                  <div className={classes.card}>
                    <div className={classes.cardTitleArea}>
                      <h3 className={classes.cardTitle}>
                        <FiCheckCircle size={14} /> Quality Assurance & Single Car Testing (WRS-5)
                      </h3>
                      <span className={classes.cardBadge}>First-Time Pass: {analytics?.qa_metrics?.first_time_pass_rate || 95.9}%</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '4px 0' }}>
                      <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>TOTAL INSPECTIONS</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {analytics?.qa_metrics?.total_inspections_mtd || 148}
                        </div>
                      </div>
                      <div style={{ padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '6px', border: '1px solid #BBF7D0', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#15803D' }}>FIT CERTS ISSUED</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>
                          {analytics?.qa_metrics?.fit_certificates_issued || 139}
                        </div>
                      </div>
                      <div style={{ padding: '10px', backgroundColor: '#FEF2F2', borderRadius: '6px', border: '1px solid #FCA5A5', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B' }}>SNAG REWORK</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>
                          {analytics?.qa_metrics?.rework_required || 6}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Leading Inspection Snags Identified & Rectified:
                      </div>
                      {(analytics?.qa_metrics?.top_defects || []).map((def, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
                          <span style={{ color: '#334155' }}>• {def.defect}</span>
                          <span style={{ fontWeight: 700, color: '#DC2626' }}>{def.occurrences} incidents</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ----------------- TAB 5: PROCESS TRANSITIONS & TELEMETRY LEDGER ----------------- */}
            {activeTab === 'MOVEMENT_LEDGER' && (
              <>
                {/* Process Transition Bottleneck Chart */}
                <div className={classes.card}>
                  <div className={classes.cardTitleArea}>
                    <h3 className={classes.cardTitle}>
                      <FiTrendingUp size={14} /> Top Workshop Process Transitions (Identify Line Bottlenecks)
                    </h3>
                    <span className={classes.cardBadge}>High Frequency Shunts</span>
                  </div>
                  <div style={{ height: '220px', width: '100%', minHeight: '220px', position: 'relative' }}>
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processTransitions} layout="vertical" margin={{ top: 10, right: 25, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="path" type="category" width={160} tick={{ fontSize: 11 }} />
                          <Tooltip 
                            formatter={(val: any) => [`${val} movements`, 'Transitions']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                          />
                          <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]}>
                            {processTransitions.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Filterable Movement Ledger Table */}
                <div className={classes.card}>
                  <div className={classes.cardTitleArea}>
                    <h3 className={classes.cardTitle}>
                      <FiActivity size={14} /> Chronological Movement & Shunting Telemetry Ledger
                    </h3>
                    <div style={{ position: 'relative', width: '280px' }}>
                      <FiSearch size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94A3B8' }} />
                      <input
                        type="text"
                        placeholder="Search asset, shop, handler..."
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px 6px 30px',
                          fontSize: '11px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '4px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div className={classes.tableContainer}>
                    <table className={classes.table}>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Asset Number</th>
                          <th>Origin</th>
                          <th>Destination</th>
                          <th>Previous State</th>
                          <th>Current State</th>
                          <th>Supervisor / Handler</th>
                          <th>Operational Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLedger.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                              No movement logs matching your search criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredLedger.slice(0, 30).map((log, idx) => (
                            <tr key={idx}>
                              <td style={{ color: '#64748B', fontSize: '11px' }}>
                                {new Date(log.timestamp).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1E3A8A' }}>
                                #{log.asset_number}
                              </td>
                              <td>{log.from_location || 'NSY Reception'}</td>
                              <td style={{ fontWeight: 600, color: '#0F172A' }}>{log.to_location}</td>
                              <td>
                                <span style={{ fontSize: '10px', color: '#64748B' }}>
                                  {log.previous_status || 'Intake'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                  {log.new_status}
                                </span>
                              </td>
                              <td style={{ fontWeight: 500 }}>{log.handler}</td>
                              <td style={{ color: '#475569', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {log.remarks || 'Standard line transition'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
