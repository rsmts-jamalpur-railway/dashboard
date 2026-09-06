'use client';
import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { 
  FiClock, FiAlertTriangle, FiPlusCircle, FiActivity, 
  FiTool, FiBox, FiAlertCircle, FiSearch, FiRefreshCw, FiMap, FiCheck 
} from 'react-icons/fi';
import classes from './page.module.css';

import AssetCard, { FormattedAsset } from '@/components/dashboard/AssetCard';
import AssetDetailModal from '@/components/dashboard/AssetDetailModal';
import LocationSelector, { LocationItem } from '@/components/dashboard/LocationSelector';
import { YardIntakeModal, ManufacturingOrderModal, ReportExceptionModal } from '@/components/dashboard/QuickActionModals';
import { detectAssetCategory } from '@/lib/assetValidation';

interface OverviewStats {
  total_active_assets: number;
  repair_active: number;
  manufacturing_active: number;
  on_hold_count: number;
  open_exceptions_count: number;
  dispatched_today: number;
  delayed_assets_count: number;
  total_locations_count: number;
  occupancy_by_location: Record<string, number>;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [assets, setAssets] = useState<FormattedAsset[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Pipeline & State Filter
  const [activePipeline, setActivePipeline] = useState<'REPAIR' | 'MANUFACTURING' | 'EXCEPTION' | 'MAP' | 'ALL'>('REPAIR');
  const [activeStateTab, setActiveStateTab] = useState<string>('ALL');

  // Secondary Filters
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const p = searchParams.get('pipeline');
    if (p && ['REPAIR', 'MANUFACTURING', 'EXCEPTION', 'MAP', 'ALL'].includes(p.toUpperCase())) {
      setActivePipeline(p.toUpperCase() as any);
    }
    const s = searchParams.get('shop') || searchParams.get('location');
    if (s) {
      setSelectedLocation(s);
    }
  }, [searchParams]);

  // Modals
  const [selectedAssetNumber, setSelectedAssetNumber] = useState<string | null>(null);
  const [isYardIntakeOpen, setIsYardIntakeOpen] = useState(false);
  const [isMfgOrderOpen, setIsMfgOrderOpen] = useState(false);
  const [isExceptionOpen, setIsExceptionOpen] = useState(false);

  const toast = useToast();

  // Fetch Dashboard Telemetry
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [overviewRes, pipelineRes, locationsRes] = await Promise.all([
        api.get('/dashboard/overview').catch(() => ({ data: { success: false, data: null } })),
        api.get('/dashboard/pipeline').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/dashboard/locations').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (overviewRes.data?.success) {
        setOverview(overviewRes.data.data);
      }

      if (pipelineRes.data?.success) {
        setAssets(pipelineRes.data.data || []);
      }

      if (locationsRes.data?.success) {
        setLocations(locationsRes.data.data || []);
      }
    } catch (err: any) {
      toast.error('Sync Error', 'Failed to refresh workshop telemetry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();

    // Setup WebSocket for Real-time Floor Pushes
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket: Socket = io(socketUrl, {
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('movement_updated', () => fetchData(true));
    socket.on('asset_updated', () => fetchData(true));
    socket.on('sync_event', () => fetchData(true));

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  // Rolling Stock Category Distribution Counts
  const categoryCounts = useMemo(() => {
    let wagonCount = 0;
    let locoCount = 0;
    let craneCount = 0;
    let towerCarCount = 0;

    for (const a of assets) {
      const raw = (a.category?.toUpperCase() || '').replace(' ', '_');
      const sub = (a.subtype?.toUpperCase() || '');
      const len = a.asset_number.length;

      if (raw === 'WAGON' || len === 11) {
        wagonCount++;
      } else if (raw === 'LOCO' || len === 5) {
        locoCount++;
      } else if (raw === 'CRANE' || sub.includes('CRANE') || len === 6) {
        craneCount++;
      } else if (raw === 'TOWER_CAR' || sub.includes('DETC') || sub.includes('DHTC')) {
        towerCarCount++;
      }
    }

    return {
      ALL: assets.length,
      WAGON: wagonCount,
      LOCO: locoCount,
      CRANE: craneCount,
      TOWER_CAR: towerCarCount,
    };
  }, [assets]);

  // State Tabs Definition according to selected Pipeline
  const stateTabs = useMemo(() => {
    if (activePipeline === 'REPAIR') {
      return [
        { id: 'ALL', label: 'All Repair' },
        { id: 'RECEIVED_NSY', label: 'Received NSY', matchStatus: ['Received NSY', 'NSY IN', 'RECEIVED_NSY'] },
        { id: 'ALLOCATED', label: 'Allocated', matchStatus: ['Allocated', 'ALLOCATED'] },
        { id: 'IN_REPAIR', label: 'Shop In (Repair)', matchStatus: ['Shop In', 'IN_REPAIR'] },
        { id: 'ON_HOLD', label: 'On Hold (Material)', matchHold: true },
        { id: 'PENDING_QA', label: 'Pending QA', matchStatus: ['Pending QA', 'PENDING_QA'] },
        { id: 'FIT', label: 'Fit (Certified)', matchStatus: ['Fit', 'FIT'] },
        { id: 'DISPATCHED', label: 'Dispatched', matchStatus: ['Dispatched', 'DISPATCHED', 'OUT'] },
      ];
    }

    if (activePipeline === 'MANUFACTURING') {
      return [
        { id: 'ALL', label: 'All Orders' },
        { id: 'ORDER_PLACED', label: 'Order Mandate', matchStatus: ['NEW', 'ORDER_PLACED'] },
        { id: 'IN_ASSEMBLY', label: 'In Assembly', matchStatus: ['IN_MANUFACTURING', 'Assembly'] },
        { id: 'PENDING_QA', label: 'Pending QA', matchStatus: ['Pending QA', 'PENDING_QA'] },
        { id: 'FIT', label: 'Fit (Certified)', matchStatus: ['Fit', 'FIT'] },
        { id: 'DISPATCHED', label: 'Dispatched', matchStatus: ['Dispatched', 'DISPATCHED', 'OUT'] },
      ];
    }

    if (activePipeline === 'EXCEPTION') {
      return [
        { id: 'ALL', label: 'All Exceptions' },
        { id: 'MISSING', label: 'Missing Wagons', matchStatus: ['Missing', 'MISSING'] },
        { id: 'ON_HOLD', label: 'Material Delays', matchHold: true },
        { id: 'REWORK', label: 'QA Defect Rework', matchStatus: ['REWORK', 'QA_FAILED'] },
        { id: 'CONDEMNED', label: 'Condemned / Scrap', matchStatus: ['Condemned', 'CONDEMNED'] },
      ];
    }

    return [
      { id: 'ALL', label: 'All Active Rolling Stock' },
      { id: 'IN_REPAIR', label: 'Under Repair', matchStatus: ['Shop In', 'IN_REPAIR'] },
      { id: 'IN_MFG', label: 'Manufacturing', matchStatus: ['IN_MANUFACTURING'] },
      { id: 'ON_HOLD', label: 'On Hold', matchHold: true },
      { id: 'PENDING_QA', label: 'Pending QA', matchStatus: ['Pending QA', 'PENDING_QA'] },
      { id: 'FIT', label: 'Fit', matchStatus: ['Fit', 'FIT'] },
    ];
  }, [activePipeline]);

  // Reset tab when switching pipeline
  const handlePipelineChange = (pipeline: typeof activePipeline) => {
    setActivePipeline(pipeline);
    setActiveStateTab('ALL');
  };

  // Filtered Assets Computation
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 1. Pipeline Filter
      if (activePipeline !== 'ALL' && activePipeline !== 'MAP') {
        if (activePipeline === 'EXCEPTION') {
          const isException = (asset.open_exceptions && asset.open_exceptions.length > 0) || asset.is_on_hold || ['MISSING', 'CONDEMNED'].includes(asset.current_status.toUpperCase());
          if (!isException) return false;
        } else if (asset.pipeline !== activePipeline) {
          return false;
        }
      }

      // 2. State Tab Filter
      if (activeStateTab !== 'ALL') {
        const tabDef = stateTabs.find((t) => t.id === activeStateTab);
        if (tabDef) {
          if (tabDef.matchHold) {
            if (!asset.is_on_hold) return false;
          } else if (tabDef.matchStatus) {
            const matches = tabDef.matchStatus.some((s) => s.toLowerCase() === asset.current_status.toLowerCase());
            if (!matches) return false;
          }
        }
      }

      // 3. Location Filter (Across all 68 Locations)
      if (selectedLocation !== 'ALL') {
        if (asset.current_location !== selectedLocation) return false;
      }

      // 4. Category Filter (By broad category code or specific subtype)
      if (selectedCategory !== 'ALL') {
        const raw = (asset.category?.toUpperCase() || '').replace(' ', '_');
        const sub = (asset.subtype?.toUpperCase() || '');
        const len = asset.asset_number.length;

        if (selectedCategory === 'WAGON') {
          if (raw !== 'WAGON' && len !== 11) return false;
        } else if (selectedCategory === 'LOCO') {
          if (raw !== 'LOCO' && len !== 5) return false;
        } else if (selectedCategory === 'CRANE') {
          if (raw !== 'CRANE' && !sub.includes('CRANE') && len !== 6) return false;
        } else if (selectedCategory === 'TOWER_CAR') {
          if (raw !== 'TOWER_CAR' && !sub.includes('DETC') && !sub.includes('DHTC')) return false;
        } else {
          // Exact subtype match (e.g., BOXNHL, WAP7, 140T_CRANE)
          if (asset.subtype !== selectedCategory && asset.category !== selectedCategory) return false;
        }
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = asset.asset_number.toLowerCase().includes(q);
        const matchesShop = asset.current_location.toLowerCase().includes(q);
        const matchesSubtype = asset.subtype?.toLowerCase().includes(q);
        const matchesRemarks = asset.latest_movement?.remarks?.toLowerCase().includes(q);
        if (!matchesNum && !matchesShop && !matchesSubtype && !matchesRemarks) return false;
      }

      return true;
    });
  }, [assets, activePipeline, activeStateTab, selectedLocation, selectedCategory, searchQuery, stateTabs]);

  // Count helper for state tabs
  const getTabCount = (tabId: string) => {
    if (tabId === 'ALL') {
      if (activePipeline === 'ALL') return assets.length;
      if (activePipeline === 'EXCEPTION') {
        return assets.filter((a) => (a.open_exceptions && a.open_exceptions.length > 0) || a.is_on_hold || ['MISSING', 'CONDEMNED'].includes(a.current_status.toUpperCase())).length;
      }
      return assets.filter((a) => a.pipeline === activePipeline).length;
    }

    const tabDef = stateTabs.find((t) => t.id === tabId);
    if (!tabDef) return 0;

    return assets.filter((a) => {
      if (activePipeline !== 'ALL' && a.pipeline !== activePipeline && activePipeline !== 'EXCEPTION') return false;
      if (tabDef.matchHold) return a.is_on_hold;
      if (tabDef.matchStatus) {
        return tabDef.matchStatus.some((s) => s.toLowerCase() === a.current_status.toLowerCase());
      }
      return false;
    }).length;
  };

  // Detected search category hint
  const searchCategoryHint = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return null;
    const cat = detectAssetCategory(q);
    if (cat === 'WAGON') return '11-Digit Wagon';
    if (cat === 'LOCO') return '5-Digit Loco';
    if (cat === 'CRANE') return '6-Digit Crane';
    if (cat === 'TOWER_CAR') return 'Tower Car';
    return null;
  }, [searchQuery]);

  if (loading && assets.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
        <p style={{ fontSize: '15px', fontWeight: 600 }}>Loading Jamalpur Workshop Telemetry (68 Location Network)...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Top Command Header & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
            Workshop Operations Command Center
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
            Jamalpur Workshop (JMPW) — Tracking <strong>Wagons (11-digit)</strong>, <strong>Locomotives (5-digit)</strong>, <strong>Cranes (6-digit)</strong> across <strong>{locations.length || 68} Workshop Locations</strong>
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={headerSecondaryBtnStyle}
            title="Refresh Workshop Feed"
          >
            <FiRefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setIsYardIntakeOpen(true)}
            style={headerPrimaryBtnStyle}
          >
            <FiPlusCircle size={14} />
            <span>+ Inward Yard Intake</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMfgOrderOpen(true)}
            style={{ ...headerPrimaryBtnStyle, backgroundColor: '#0284C7' }}
          >
            <FiBox size={14} />
            <span>+ New Mfg Order</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExceptionOpen(true)}
            style={{ ...headerPrimaryBtnStyle, backgroundColor: '#DC2626' }}
          >
            <FiAlertTriangle size={14} />
            <span>🚨 Exception</span>
          </button>
        </div>
      </div>

      {/* High-Level KPI Summary Grid */}
      <div className={classes.grid}>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}>Total Active Rolling Stock</div>
          <div className={classes.kpiValue}>
            {overview?.total_active_assets || assets.length}
            <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '6px', color: '#6B7280' }}>
              (Wagons: {categoryCounts.WAGON} | Locos: {categoryCounts.LOCO} | Cranes: {categoryCounts.CRANE})
            </span>
          </div>
        </div>

        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}><FiTool style={{ verticalAlign: 'middle', marginRight: '4px' }} /> In Repair Operations</div>
          <div className={classes.kpiValue} style={{ color: '#0A74DA' }}>
            {overview?.repair_active || 0}
          </div>
        </div>

        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}><FiBox style={{ verticalAlign: 'middle', marginRight: '4px' }} /> In Manufacturing (GIF/Crane)</div>
          <div className={classes.kpiValue} style={{ color: '#0284C7' }}>
            {overview?.manufacturing_active || 0}
          </div>
        </div>

        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}><FiClock style={{ verticalAlign: 'middle', marginRight: '4px' }} /> On Hold (Material Delays)</div>
          <div className={classes.kpiValue} style={{ color: '#D97706' }}>
            {overview?.on_hold_count || 0}
            <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '6px', color: '#6B7280' }}>
              (TAT Paused)
            </span>
          </div>
        </div>

        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}><FiActivity style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Dispatched Today</div>
          <div className={classes.kpiValue} style={{ color: '#16A34A' }}>
            {overview?.dispatched_today || 0}
          </div>
        </div>
      </div>

      {/* Primary Pipeline Selector (Pill Tabs) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E5E7EB', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handlePipelineChange('REPAIR')}
          style={getPipelineTabStyle(activePipeline === 'REPAIR')}
        >
          <FiTool size={14} />
          <span>🔧 Repair Lifecycle ({overview?.repair_active || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handlePipelineChange('MANUFACTURING')}
          style={getPipelineTabStyle(activePipeline === 'MANUFACTURING')}
        >
          <FiBox size={14} />
          <span>🏗️ New Manufacturing ({overview?.manufacturing_active || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handlePipelineChange('EXCEPTION')}
          style={getPipelineTabStyle(activePipeline === 'EXCEPTION')}
        >
          <FiAlertCircle size={14} />
          <span>🚨 Exceptions & Holds ({overview?.on_hold_count || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handlePipelineChange('ALL')}
          style={getPipelineTabStyle(activePipeline === 'ALL')}
        >
          <span>🌐 All Rolling Stock ({assets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handlePipelineChange('MAP')}
          style={getPipelineTabStyle(activePipeline === 'MAP')}
        >
          <FiMap size={14} />
          <span>🗺️ 68 Locations Topology</span>
        </button>
      </div>

      {/* 68 Locations Yard Map View (When MAP tab selected) */}
      {activePipeline === 'MAP' ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700 }}>
            Jamalpur Workshop 68 Locations & Yard Line Topology
          </h3>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
            Live occupancy and maximum capacity across all primary shops, locomotive sheds, quality assurance, receiving yards, and track lines 1–56.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
            {locations.map((loc) => {
              const occ = loc.current_occupancy || 0;
              const max = loc.max_capacity || 50;
              const isOverloaded = occ >= max;
              return (
                <div
                  key={loc.location_id}
                  onClick={() => {
                    setSelectedLocation(loc.location_id);
                    setActivePipeline('ALL');
                  }}
                  style={{
                    padding: '10px',
                    border: `1px solid ${isOverloaded ? '#F87171' : occ > 0 ? '#BFDBFE' : '#E5E7EB'}`,
                    backgroundColor: isOverloaded ? '#FEF2F2' : occ > 0 ? '#F0F9FF' : '#FAFAFA',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{loc.location_id}</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{loc.zone || 'Workshop'}</div>
                  <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>Occupancy:</span>
                    <strong style={{ color: isOverloaded ? '#DC2626' : occ > 0 ? '#0284C7' : '#6B7280' }}>
                      {occ} / {max}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* State-Based Sub-Tabs & Filter Controls Bar */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Row 1: State Tabs & Location / Search Filters */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              {/* Horizontal State Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', flex: 1 }}>
                {stateTabs.map((tab) => {
                  const isSelected = activeStateTab === tab.id;
                  const count = getTabCount(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveStateTab(tab.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#0F172A' : '#64748B',
                        backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                        border: 'none',
                        borderBottom: isSelected ? '2px solid #0F172A' : '2px solid transparent',
                        borderRadius: '4px 4px 0 0',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{tab.label}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? '#0F172A' : '#E2E8F0',
                          color: isSelected ? '#FFFFFF' : '#475569',
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Filter Controls (Right-Hand Side) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* 68 Locations Hierarchical Selector */}
                <LocationSelector
                  locations={locations}
                  selectedLocation={selectedLocation}
                  onSelect={(locId) => setSelectedLocation(locId)}
                />

                {/* Structured Asset Category & Subtype Dropdown */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={compactSelectStyle}
                >
                  <option value="ALL">All Categories ({categoryCounts.ALL})</option>
                  
                  <optgroup label="Freight Wagons (11-Digit IR Scheme)">
                    <option value="WAGON">All Wagons ({categoryCounts.WAGON})</option>
                    <option value="BOXNHL">BOXNHL (Open High Sided)</option>
                    <option value="BCNHL">BCNHL (Covered Goods)</option>
                    <option value="BVZI">BVZI (Air Brake Van)</option>
                    <option value="BTPN">BTPN (Petroleum Tank)</option>
                    <option value="BOBRN">BOBRN (Coal Hopper)</option>
                  </optgroup>

                  <optgroup label="Locomotives (5-Digit Road Numbers)">
                    <option value="LOCO">All Locomotives ({categoryCounts.LOCO})</option>
                    <option value="WAP7">WAP-7 (Passenger 25kV Electric)</option>
                    <option value="WAG9">WAG-9 (Freight 25kV Electric)</option>
                    <option value="WDG4">WDG-4 (Heavy Freight Diesel)</option>
                  </optgroup>

                  <optgroup label="Breakdown Cranes (6-Digit Jamalpur)">
                    <option value="CRANE">All Cranes ({categoryCounts.CRANE})</option>
                    <option value="140T_CRANE">140T Gottwald Breakdown Crane</option>
                    <option value="175T_CRANE">175T Heavy Hydraulic Crane</option>
                  </optgroup>

                  <optgroup label="Tower Cars (OHE Inspection)">
                    <option value="TOWER_CAR">All Tower Cars ({categoryCounts.TOWER_CAR})</option>
                    <option value="8W_DETC">8W-DETC (Diesel Electric)</option>
                    <option value="4W_DHTC">4W-DHTC (Diesel Hydraulic)</option>
                  </optgroup>
                </select>

                {/* Smart Search Bar */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <FiSearch size={13} style={{ position: 'absolute', left: '8px', color: '#9CA3AF' }} />
                  <input
                    type="text"
                    placeholder="Search Number / Shop..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: '6px 8px 6px 26px',
                      fontSize: '12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '4px',
                      width: '170px',
                      outline: 'none',
                    }}
                  />
                  {searchCategoryHint && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '6px',
                        fontSize: '9px',
                        fontWeight: 700,
                        backgroundColor: '#E0F2FE',
                        color: '#0369A1',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        pointerEvents: 'none',
                      }}
                    >
                      {searchCategoryHint}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Category Filter Quick Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Category:</span>
              
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                style={getCategoryPillStyle(selectedCategory === 'ALL')}
              >
                All Types ({categoryCounts.ALL})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('WAGON')}
                style={getCategoryPillStyle(selectedCategory === 'WAGON')}
              >
                🚃 Wagons [11-Digit] ({categoryCounts.WAGON})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('LOCO')}
                style={getCategoryPillStyle(selectedCategory === 'LOCO')}
              >
                🚂 Locomotives [5-Digit] ({categoryCounts.LOCO})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('CRANE')}
                style={getCategoryPillStyle(selectedCategory === 'CRANE')}
              >
                🏗️ Breakdown Cranes [6-Digit] ({categoryCounts.CRANE})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('TOWER_CAR')}
                style={getCategoryPillStyle(selectedCategory === 'TOWER_CAR')}
              >
                🗼 Tower Cars ({categoryCounts.TOWER_CAR})
              </button>
            </div>
          </div>

          {/* Cards Content Area (Replacing the old flat table) */}
          <div style={{ minHeight: '300px' }}>
            {filteredAssets.length === 0 ? (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px dashed #CBD5E1',
                  borderRadius: '6px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#64748B',
                }}
              >
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0 }}>
                  No rolling stock found matching current criteria.
                </p>
                <p style={{ fontSize: '12px', margin: '6px 0 0' }}>
                  Try adjusting the category filter ({selectedCategory}), state tab ({activeStateTab}), or location.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#6B7280', marginBottom: '8px', paddingLeft: '4px' }}>
                  <span>
                    Showing <strong>{filteredAssets.length}</strong> active rolling stock units in current view
                  </span>
                  {selectedCategory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      style={{ background: 'none', border: 'none', color: '#0A74DA', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Clear Category Filter
                    </button>
                  )}
                </div>
                {filteredAssets.map((asset) => (
                  <AssetCard
                    key={asset.id || asset.asset_number}
                    asset={asset}
                    onViewDetails={(assetNum) => setSelectedAssetNumber(assetNum)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Asset Detail Modal */}
      {selectedAssetNumber && (
        <AssetDetailModal
          assetNumber={selectedAssetNumber}
          onClose={() => setSelectedAssetNumber(null)}
          onAssetUpdated={() => fetchData(true)}
        />
      )}

      {/* Quick Action Modals */}
      <YardIntakeModal
        isOpen={isYardIntakeOpen}
        onClose={() => setIsYardIntakeOpen(false)}
        onSuccess={() => fetchData(true)}
      />

      <ManufacturingOrderModal
        isOpen={isMfgOrderOpen}
        onClose={() => setIsMfgOrderOpen(false)}
        onSuccess={() => fetchData(true)}
      />

      <ReportExceptionModal
        isOpen={isExceptionOpen}
        onClose={() => setIsExceptionOpen(false)}
        onSuccess={() => fetchData(true)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Loading Command Center...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

// Styling tokens
const headerPrimaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  backgroundColor: '#0F172A',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const headerSecondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  backgroundColor: '#FFFFFF',
  color: '#374151',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const compactSelectStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  backgroundColor: '#FFFFFF',
  color: '#374151',
  outline: 'none',
};

const getPipelineTabStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid',
  borderColor: isActive ? '#0F172A' : '#E5E7EB',
  backgroundColor: isActive ? '#0F172A' : '#FFFFFF',
  color: isActive ? '#FFFFFF' : '#475569',
  transition: 'all 0.15s ease',
});

const getCategoryPillStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: isActive ? 700 : 500,
  backgroundColor: isActive ? '#0F172A' : '#F1F5F9',
  color: isActive ? '#FFFFFF' : '#475569',
  border: `1px solid ${isActive ? '#0F172A' : '#E2E8F0'}`,
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});
