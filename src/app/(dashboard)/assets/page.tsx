'use client';
import { useEffect, useState, useRef, useCallback, useContext } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { AuthContext } from '@/contexts/AuthContext';
import { 
  FiSearch, FiX, FiMapPin, FiClock, FiAlertTriangle, 
  FiTruck, FiPause, FiPlay, FiAlertOctagon, FiActivity, 
  FiEdit2, FiTrash2, FiDownload, FiPlus, FiGrid, FiList, 
  FiCheckCircle, FiCheck, FiUser, FiArrowRight, FiBox, FiTool, FiCheckSquare
} from 'react-icons/fi';
import Papa from 'papaparse';
import { decodeWagonNumber, detectAssetCategory, validateAssetNumber } from '@/lib/assetValidation';
import AssetDetailModal from '@/components/dashboard/AssetDetailModal';
import { YardIntakeModal, ManufacturingOrderModal, ReportExceptionModal } from '@/components/dashboard/QuickActionModals';
import classes from './page.module.css';

interface MovementRecord {
  log_id?: string;
  from_location?: string | null;
  to_location: string;
  previous_status?: string | null;
  new_status: string;
  timestamp: string;
  remarks?: string | null;
  handler?: { full_name?: string; employee?: any } | string;
}

interface RepairCycle {
  id: string;
  cycle_id?: string;
  cycle_number?: number;
  status: string;
  started_at?: string;
  repair_category?: {
    id: string;
    standard_tat_hours?: number;
  };
  holds?: Array<{
    id: string;
    reason: string;
    remarks?: string | null;
    started_at: string;
    released_at: string | null;
  }>;
}

interface Asset {
  id: string;
  asset_number: string;
  asset_type: string;
  wagon_sr?: string;
  rly?: string;
  mod?: string;
  built_year?: number;
  action?: string;
  current_location: string | null;
  current_status: string;
  origin?: string;
  allocated_shop?: string | null;
  custom_fields?: any;
  asset_category: string;
  loco_type?: string;
  crane_age_tag?: string;
  tc_variant?: string;
  tc_zone?: string;
  is_active: boolean;
  repair_cycles?: RepairCycle[];
  manufacturing_orders?: any[];
  movements?: MovementRecord[];
  movement_logs?: MovementRecord[];
  exceptions?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export default function AssetsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialSearch = searchParams.get('search') || '';
  
  const { user } = useContext(AuthContext);
  const isAdmin = (user?.role as any)?.role_name === 'Administrator' || user?.role === 'Administrator';
  const toast = useToast();

  // Search & Filters State
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeFilter, setActiveFilter] = useState<'true' | 'all' | 'false'>('true');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Asset Data State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [locations, setLocations] = useState<any[]>([]);

  // Selected Asset for Modals
  const [selectedAssetNumber, setSelectedAssetNumber] = useState<string | null>(null);
  const [detailModalAsset, setDetailModalAsset] = useState<string | null>(null);

  // Quick Action Modals State (Yard Intake, Mfg Order, Global Exception)
  const [isYardIntakeOpen, setIsYardIntakeOpen] = useState(false);
  const [isMfgOrderOpen, setIsMfgOrderOpen] = useState(false);
  const [isGlobalExceptionOpen, setIsGlobalExceptionOpen] = useState(false);

  // Quick Shunt Modal State
  const [showShuntModal, setShowShuntModal] = useState(false);
  const [shuntAsset, setShuntAsset] = useState<Asset | null>(null);
  const [targetLocation, setTargetLocation] = useState('WRS-1');
  const [targetStatus, setTargetStatus] = useState('IN_REPAIR');
  const [shuntRemarks, setShuntRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Hold Modal State
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdAsset, setHoldAsset] = useState<Asset | null>(null);
  const [holdReason, setHoldReason] = useState('MATERIAL_SHORTAGE');
  const [holdRemarks, setHoldRemarks] = useState('');

  // Quick Exception Modal State
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionAsset, setExceptionAsset] = useState<Asset | null>(null);
  const [exceptionType, setExceptionType] = useState('DEFECT_FOUND');
  const [exceptionSeverity, setExceptionSeverity] = useState('HIGH');
  const [exceptionReason, setExceptionReason] = useState('');

  // Register / Edit Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formData, setFormData] = useState({
    asset_number: '',
    asset_category: 'WAGON',
    asset_type: 'BOXNHL',
    origin: 'REPAIR',
    wagon_sr: '',
    rly: 'ER',
    mod: '',
    built_year: new Date().getFullYear(),
    action: 'POH',
    current_location: 'NSY',
    current_status: 'RECEIVED_NSY',
    custom_fields: {} as any,
  });

  // Keep search input in sync if URL changes
  useEffect(() => {
    const s = searchParams.get('search') || '';
    setSearchInput(s);
    if (s) {
      setViewMode('CARDS');
    }
  }, [searchParams]);

  // Load Locations Topology
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await api.get('/locations');
        if (res.data?.success) {
          setLocations(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load locations', err);
      }
    };
    fetchLocations();
  }, []);

  // Fetch Assets from Backend with Full Server-Side Filtering
  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const searchParam = searchParams.get('search') || '';

      const queryParams = new URLSearchParams({
        page: '1',
        limit: '100',
        active: activeFilter,
      });

      if (searchParam.trim()) {
        queryParams.set('search', searchParam.trim());
      }
      if (selectedCategory !== 'ALL') {
        queryParams.set('category', selectedCategory);
      }
      if (selectedStatus !== 'ALL') {
        queryParams.set('status', selectedStatus);
      }

      const res = await api.get(`/assets?${queryParams.toString()}`);
      if (res.data?.success) {
        const data = res.data.data || [];
        setAssets(data);
        setTotalCount(res.data.meta?.total || data.length);
      }
    } catch (err: any) {
      toast.error('Query Failed', err.response?.data?.message || 'Failed to fetch workshop assets');
    } finally {
      setLoading(false);
    }
  }, [searchParams, activeFilter, selectedCategory, selectedStatus, toast]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Execute Search
  const handleExecuteSearch = (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchInput).trim();
    if (q) {
      router.push(`/assets?search=${encodeURIComponent(q)}`);
      setViewMode('CARDS');
    } else {
      router.push('/assets');
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    router.push('/assets');
  };

  // Quick Action Handlers
  const handleOpenShunt = (asset: Asset) => {
    setShuntAsset(asset);
    setTargetLocation(asset.current_location || 'WRS-1');
    setTargetStatus(asset.current_status || 'IN_REPAIR');
    setShuntRemarks(`Shunted from ${asset.current_location || 'NSY'}`);
    setShowShuntModal(true);
  };

  const handleExecuteShunt = async () => {
    if (!shuntAsset) return;
    try {
      setActionLoading(true);
      await api.post('/movement', {
        asset_number: shuntAsset.asset_number,
        from_location: shuntAsset.current_location,
        to_location: targetLocation,
        new_status: targetStatus,
        remarks: shuntRemarks || 'Direct Workshop Shunt Execution',
      });
      toast.success('Movement Logged', `Asset #${shuntAsset.asset_number} moved to ${targetLocation}`);
      setShowShuntModal(false);
      fetchAssets();
    } catch (err: any) {
      toast.error('Move Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleHold = async (asset: Asset) => {
    const activeRepair = asset.repair_cycles?.find((c) => c.status === 'ACTIVE') || asset.repair_cycles?.[0];
    const isCurrentlyHeld = asset.current_status === 'ON_HOLD' || (activeRepair?.holds && activeRepair.holds.some((h) => !h.released_at));

    if (isCurrentlyHeld) {
      // Direct Resume Overhaul
      try {
        setActionLoading(true);
        await api.patch('/repair/resume', {
          cycle_id: activeRepair?.cycle_id || activeRepair?.id,
          asset_number: asset.asset_number,
        });
        toast.success('Hold Released', `Overhaul cycle resumed for #${asset.asset_number}`);
        fetchAssets();
      } catch (err: any) {
        toast.error('Resume Failed', err.response?.data?.message || err.message);
      } finally {
        setActionLoading(false);
      }
    } else {
      // Open Hold Reason Modal
      setHoldAsset(asset);
      setHoldReason('MATERIAL_SHORTAGE');
      setHoldRemarks('');
      setShowHoldModal(true);
    }
  };

  const handleExecuteHold = async () => {
    if (!holdAsset) return;
    const activeRepair = holdAsset.repair_cycles?.find((c) => c.status === 'ACTIVE') || holdAsset.repair_cycles?.[0];
    try {
      setActionLoading(true);
      await api.post('/repair/hold', {
        cycle_id: activeRepair?.cycle_id || activeRepair?.id,
        asset_number: holdAsset.asset_number,
        reason: holdReason,
        remarks: holdRemarks,
      });
      toast.success('Hold Applied', `Repair cycle paused for #${holdAsset.asset_number}`);
      setShowHoldModal(false);
      fetchAssets();
    } catch (err: any) {
      toast.error('Hold Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenException = (asset: Asset) => {
    setExceptionAsset(asset);
    setExceptionType('DEFECT_FOUND');
    setExceptionSeverity('HIGH');
    setExceptionReason('');
    setShowExceptionModal(true);
  };

  const handleExecuteException = async () => {
    if (!exceptionAsset) return;
    if (!exceptionReason.trim()) {
      toast.error('Validation Error', 'Discrepancy description required');
      return;
    }
    try {
      setActionLoading(true);
      await api.post('/exceptions', {
        client_operation_id: `op-ex-${Date.now()}`,
        asset_number: exceptionAsset.asset_number,
        type: exceptionType,
        severity: exceptionSeverity,
        reason: exceptionReason.trim(),
      });
      toast.success('Exception Flagged', `Logged against #${exceptionAsset.asset_number}`);
      setShowExceptionModal(false);
      fetchAssets();
    } catch (err: any) {
      toast.error('Exception Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (assetNumber: string) => {
    if (!confirm(`Are you sure you want to deactivate asset #${assetNumber}?`)) return;
    try {
      await api.delete(`/assets/${assetNumber}`);
      toast.success('Deactivated', `Asset #${assetNumber} deactivated`);
      fetchAssets();
    } catch (err: any) {
      toast.error('Failed', err.response?.data?.message || err.message);
    }
  };

  const handleReactivate = async (assetNumber: string) => {
    try {
      await api.patch(`/assets/${assetNumber}`, { is_active: true });
      toast.success('Reactivated', `Asset #${assetNumber} restored`);
      fetchAssets();
    } catch (err: any) {
      toast.error('Failed', err.response?.data?.message || err.message);
    }
  };

  const handleHardDelete = async (assetNumber: string) => {
    if (!confirm(`[GOD MODE WARNING] Permanently delete asset #${assetNumber} and all its audit history?`)) return;
    try {
      await api.delete(`/assets/${assetNumber}?hard=true`);
      toast.success('Deleted', `Asset #${assetNumber} permanently purged`);
      fetchAssets();
    } catch (err: any) {
      toast.error('Failed', err.response?.data?.message || err.message);
    }
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset({
      ...asset,
      asset_type: asset.asset_type || 'BOXNHL',
      asset_category: asset.asset_category || 'WAGON',
      wagon_sr: asset.wagon_sr || '',
      rly: asset.rly || 'ER',
      mod: asset.mod || '',
      built_year: asset.built_year || new Date().getFullYear(),
      action: asset.action || 'POH',
      current_location: asset.current_location || 'NSY',
      current_status: asset.current_status || 'IN_REPAIR',
      origin: asset.origin || 'REPAIR',
      is_active: asset.is_active !== false,
      custom_fields: asset.custom_fields || {},
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) return;
    try {
      setActionLoading(true);
      await api.patch(`/assets/${editingAsset.asset_number}`, {
        asset_type: editingAsset.asset_type,
        current_status: editingAsset.current_status,
        current_location: editingAsset.current_location,
        wagon_sr: editingAsset.wagon_sr,
        rly: editingAsset.rly,
        mod: editingAsset.mod,
        built_year: Number(editingAsset.built_year),
        action: editingAsset.action,
        origin: editingAsset.origin,
        is_active: editingAsset.is_active,
        custom_fields: editingAsset.custom_fields,
      });
      toast.success('Asset Updated', `Successfully updated #${editingAsset.asset_number}`);
      setIsEditOpen(false);
      setEditingAsset(null);
      fetchAssets();
    } catch (err: any) {
      toast.error('Update Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.asset_number.trim()) {
      toast.error('Validation Error', 'Asset number required');
      return;
    }
    try {
      setActionLoading(true);
      await api.post('/assets', {
        ...formData,
        built_year: Number(formData.built_year),
      });
      toast.success('Asset Registered', `Asset #${formData.asset_number} registered successfully`);
      setIsRegisterOpen(false);
      setFormData({
        asset_number: '',
        asset_category: 'WAGON',
        asset_type: 'BOXNHL',
        origin: 'REPAIR',
        wagon_sr: '',
        rly: 'ER',
        mod: '',
        built_year: new Date().getFullYear(),
        action: 'POH',
        current_location: 'NSY',
        current_status: 'RECEIVED_NSY',
        custom_fields: {},
      });
      fetchAssets();
    } catch (err: any) {
      toast.error('Registration Failed', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (!assets || assets.length === 0) {
      toast.error('Export Empty', 'No assets available to export');
      return;
    }
    const csvData = assets.map((a) => ({
      'Asset Number': a.asset_number,
      Category: a.asset_category,
      Type: a.asset_type,
      Location: a.current_location || 'N/A',
      Status: a.current_status,
      Origin: a.origin || 'REPAIR',
      'Active State': a.is_active ? 'Active' : 'Inactive',
      'Registered Date': a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'N/A',
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RSMTS_Assets_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Styling Helper
  const getStatusBadge = (status: string, isHeld: boolean) => {
    if (isHeld) {
      return { bg: '#FEF3C7', color: '#B45309', border: '#F59E0B', label: 'ON HOLD' };
    }
    switch ((status || '').toUpperCase()) {
      case 'FIT':
      case 'DISPATCHED':
        return { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC', label: status };
      case 'IN_REPAIR':
      case 'SHOP IN':
      case 'SHOP_IN':
        return { bg: '#E0F2FE', color: '#0369A1', border: '#7DD3FC', label: 'IN REPAIR' };
      case 'PENDING_QA':
      case 'PENDING QA':
        return { bg: '#EDE9FE', color: '#6D28D9', border: '#C4B5FD', label: 'PENDING QA' };
      case 'RECEIVED_NSY':
      case 'RECEIVED NSY':
      case 'NSY IN':
        return { bg: '#F1F5F9', color: '#334155', border: '#CBD5E1', label: 'RECEIVED NSY' };
      default:
        return { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0', label: status || 'ACTIVE' };
    }
  };

  // Category Icon & Label Helper
  const getCategoryDetails = (asset: Asset) => {
    const num = asset.asset_number;
    const cat = (asset.asset_category || detectAssetCategory(num)).toUpperCase();
    const isWagon = cat === 'WAGON' || num.length === 11;
    const isLoco = cat === 'LOCO' || num.length === 5;
    const isCrane = cat === 'CRANE' || (asset.asset_type || '').includes('CRANE') || num.startsWith('140') || num.startsWith('175');
    const isTowerCar = cat === 'TOWER_CAR' || (asset.asset_type || '').includes('DETC') || (asset.asset_type || '').includes('DHTC');

    if (isWagon) return { icon: '🚃', name: 'Wagon (11-Digit)', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' };
    if (isLoco) return { icon: '🚂', name: 'Locomotive', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
    if (isCrane) return { icon: '🏗️', name: 'Breakdown Crane', bg: '#FAF5FF', color: '#7E22CE', border: '#E9D5FF' };
    if (isTowerCar) return { icon: '🗼', name: 'Tower Car (OHE)', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' };
    return { icon: '📦', name: cat, bg: '#F1F5F9', color: '#334155', border: '#CBD5E1' };
  };

  return (
    <div className={classes.container}>
      {/* Page Header */}
      <div className={classes.headerRow}>
        <div className={classes.titleArea}>
          <span className={classes.breadcrumb}>Operational Directory • Rolling Stock Master</span>
          <h1 className={classes.title}>
            {initialSearch ? `Asset Search: ${initialSearch}` : 'Assets Master & Telemetry Directory'}
          </h1>
        </div>

        <div className={classes.headerActions}>
          <button className={classes.intakeBtn} onClick={() => setIsYardIntakeOpen(true)} title="Inward Yard Intake into NSY">
            <FiPlus size={14} /> Yard Intake
          </button>
          <button className={classes.mfgBtn} onClick={() => setIsMfgOrderOpen(true)} title="Create New Build Manufacturing Order">
            <FiBox size={14} /> New Mfg Order
          </button>
          <button className={classes.exceptionBtn} onClick={() => setIsGlobalExceptionOpen(true)} title="Report Defect or Hazard Exception">
            <FiAlertTriangle size={14} /> Exception
          </button>
          <button className={classes.actionBtn} onClick={exportToCSV} title="Export Assets to CSV">
            <FiDownload size={14} /> Export CSV
          </button>
          <button className={classes.primaryBtn} onClick={() => setIsRegisterOpen(true)} title="Register New Rolling Stock">
            <FiPlus size={14} /> Register Asset
          </button>
        </div>
      </div>

      {/* ================= COMPACT FILTER & CONTROLS TOOLBAR ================= */}
      <div className={classes.toolbarSection}>
        {/* Category Filter Pills */}
        <div className={classes.filterGroup}>
          <span className={classes.filterLabel}>Category:</span>
          {['ALL', 'WAGON', 'LOCO', 'CRANE', 'TOWER_CAR'].map((cat) => (
            <button
              key={cat}
              className={`${classes.filterPill} ${selectedCategory === cat ? classes.filterPillActive : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'ALL' && 'All Fleet'}
              {cat === 'WAGON' && '🚃 Wagons'}
              {cat === 'LOCO' && '🚂 Locos'}
              {cat === 'CRANE' && '🏗️ Cranes'}
              {cat === 'TOWER_CAR' && '🗼 Tower Cars'}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className={classes.filterGroup}>
          <span className={classes.filterLabel}>Status:</span>
          {['ALL', 'IN_REPAIR', 'ON_HOLD', 'RECEIVED_NSY', 'FIT'].map((st) => (
            <button
              key={st}
              className={`${classes.filterPill} ${selectedStatus === st ? classes.filterPillActive : ''}`}
              onClick={() => setSelectedStatus(st)}
            >
              {st === 'ALL' ? 'All Statuses' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Usable Action Controls on Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
            Fleet: <strong style={{ color: '#0F172A' }}>{assets.length}</strong> {assets.length === 1 ? 'Asset' : 'Assets'}
          </span>
          <button
            className={classes.actionBtn}
            style={{ padding: '5px 12px', fontSize: '12px', color: '#0284C7', borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' }}
            onClick={() => setIsRegisterOpen(true)}
            title="Register new rolling stock asset"
          >
            <FiPlus size={12} /> Add Asset
          </button>
        </div>
      </div>

      {/* Active Search Result Feedback Banner */}
      {initialSearch && (
        <div className={classes.resultBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCheckCircle size={16} />
            <span>
              Showing search results for &ldquo;<strong>{initialSearch}</strong>&rdquo; ({assets.length} {assets.length === 1 ? 'rolling stock asset' : 'rolling stock assets'} found)
            </span>
          </div>
          <button
            className={classes.clearSearchBtn}
            onClick={handleClearSearch}
            title="Clear global search filter"
          >
            Clear Search ✕
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={classes.emptyState}>
          <FiClock className={classes.emptyIcon} style={{ animation: 'spin 1.5s linear infinite' }} />
          <h3 className={classes.emptyTitle}>Scanning Rolling Stock Master...</h3>
          <p className={classes.emptySubtitle}>Querying database records across 68 workshop track lines and repair bays.</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && assets.length === 0 && (
        <div className={classes.emptyState}>
          <FiAlertTriangle className={classes.emptyIcon} />
          <h3 className={classes.emptyTitle}>No Rolling Stock Matching Query</h3>
          <p className={classes.emptySubtitle}>
            No assets found for &ldquo;{initialSearch}&rdquo;. Try searching by 11-digit wagon number, 5-digit loco number, or reset filters.
          </p>
          <button className={classes.actionBtn} onClick={handleClearSearch} style={{ marginTop: '8px' }}>
            Reset Filters
          </button>
        </div>
      )}

      {/* ================= VIEW 1: FULL-WIDTH ASSET CARDS WITH ALL CONTROLS ================= */}
      {!loading && assets.length > 0 && viewMode === 'CARDS' && (
        <div className={classes.cardsContainer}>
          {assets.map((asset) => {
            const cat = getCategoryDetails(asset);
            const activeRepair = asset.repair_cycles?.find((c) => c.status === 'ACTIVE') || asset.repair_cycles?.[0];
            const activeHold = activeRepair?.holds?.find((h) => !h.released_at);
            const isHeld = asset.current_status === 'ON_HOLD' || !!activeHold;
            const statusStyle = getStatusBadge(asset.current_status, isHeld);
            const isWagon = (asset.asset_category || '').toUpperCase() === 'WAGON' || asset.asset_number.length === 11;
            const wagonData = isWagon && asset.asset_number.length === 11 ? decodeWagonNumber(asset.asset_number) : null;
            const isSpotlight = initialSearch && asset.asset_number.includes(initialSearch);

            const lastMove = asset.movements?.[0] || asset.movement_logs?.[0];
            const supervisor = typeof lastMove?.handler === 'string' 
              ? lastMove.handler 
              : lastMove?.handler?.full_name || 'System Supervisor';

            return (
              <div
                key={asset.id || asset.asset_number}
                className={`${classes.assetCard} ${isSpotlight ? classes.assetCardSpotlight : ''}`}
              >
                {isSpotlight && <span className={classes.spotlightBadge}>🎯 Direct Match</span>}

                {/* Card Top Row: Identity, Type, Status */}
                <div className={classes.cardHeader}>
                  <div className={classes.assetNumberArea}>
                    <span className={classes.categoryIcon}>{cat.icon}</span>
                    <span className={classes.assetNumber}>#{asset.asset_number}</span>

                    {/* Category Tag */}
                    <span
                      className={classes.categoryPill}
                      style={{ backgroundColor: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}
                    >
                      {asset.asset_type || cat.name}
                    </span>

                    {/* Wagon 11-Digit Check Digit Pill */}
                    {wagonData && (
                      <span
                        className={classes.checkDigitPill}
                        style={{
                          backgroundColor: wagonData.isValidCheckDigit ? '#DCFCE7' : '#FEE2E2',
                          color: wagonData.isValidCheckDigit ? '#15803D' : '#DC2626',
                          border: `1px solid ${wagonData.isValidCheckDigit ? '#86EFAC' : '#FCA5A5'}`,
                        }}
                        title={`Check digit calculation: ${wagonData.enteredCheckDigit}`}
                      >
                        {wagonData.isValidCheckDigit ? <FiCheck size={11} /> : <FiAlertTriangle size={11} />}
                        CD: {wagonData.enteredCheckDigit} {wagonData.isValidCheckDigit ? '✓' : '⚠️'}
                      </span>
                    )}
                  </div>

                  {/* Operational Status Pill */}
                  <span
                    className={classes.statusPill}
                    style={{
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.color,
                      border: `1px solid ${statusStyle.border}`,
                    }}
                  >
                    ● {statusStyle.label}
                  </span>
                </div>

                {/* Card Telemetry Body */}
                <div className={classes.cardBody}>
                  <div className={classes.telemetryItem}>
                    <span className={classes.telemetryLabel}>
                      <FiMapPin size={11} color="#0284C7" /> Current Location
                    </span>
                    <span className={classes.telemetryValue}>
                      {asset.current_location || 'NSY Staging Yard'}
                    </span>
                  </div>

                  <div className={classes.telemetryItem}>
                    <span className={classes.telemetryLabel}>
                      <FiClock size={11} color="#64748B" /> Overhaul Cycle
                    </span>
                    <span className={classes.telemetryValue}>
                      {activeRepair?.repair_category?.id || asset.action || 'POH Overhaul'}
                      {activeRepair?.repair_category?.standard_tat_hours ? ` (${activeRepair.repair_category.standard_tat_hours}h TAT)` : ''}
                    </span>
                  </div>

                  <div className={classes.telemetryItem}>
                    <span className={classes.telemetryLabel}>
                      <FiUser size={11} color="#64748B" /> Supervisor
                    </span>
                    <span className={classes.telemetryValue}>
                      {supervisor}
                    </span>
                  </div>

                  <div className={classes.telemetryItem}>
                    <span className={classes.telemetryLabel}>
                      <FiActivity size={11} color="#15803D" /> Pipeline Mode
                    </span>
                    <span className={classes.telemetryValue}>
                      {asset.origin === 'MANUFACTURING' ? '🏗️ Manufacturing' : '🔧 Repair Overhaul'}
                    </span>
                  </div>
                </div>

                {/* Active Hold Alert Banner (If On Hold) */}
                {isHeld && (
                  <div className={classes.holdBanner}>
                    <div className={classes.holdBannerText}>
                      <FiPause size={14} color="#B45309" />
                      <span>
                        <strong>Overhaul Paused:</strong> [{activeHold?.reason || 'MATERIAL_SHORTAGE'}]
                        {activeHold?.remarks ? ` — ${activeHold.remarks}` : ''}
                      </span>
                    </div>
                    <button
                      className={classes.resumeBtn}
                      onClick={() => handleToggleHold(asset)}
                      disabled={actionLoading}
                    >
                      <FiPlay size={11} /> Resume Overhaul
                    </button>
                  </div>
                )}

                {/* Open Exceptions Alert Banner */}
                {asset.exceptions && asset.exceptions.length > 0 && (
                  <div className={classes.exceptionBanner}>
                    <FiAlertOctagon size={14} color="#DC2626" />
                    <span>
                      <strong>Exception Flagged:</strong> {asset.exceptions[0]?.type} (Severity: {asset.exceptions[0]?.severity})
                    </span>
                  </div>
                )}

                {/* ================= ALL ADMIN CONTROLS ROW ================= */}
                <div className={classes.cardControlsArea}>
                  <div className={classes.controlsLabel}>Operational Controls & Actions</div>
                  <div className={classes.controlsRow}>
                    {/* 1. Shunt / Move */}
                    <button
                      className={`${classes.controlBtn} ${classes.controlBtnPrimary}`}
                      onClick={() => handleOpenShunt(asset)}
                      title="Shunt or move asset to another shop or track line"
                    >
                      <FiTruck size={13} /> Shunt / Move
                    </button>

                    {/* 2. Hold / Resume */}
                    <button
                      className={`${classes.controlBtn} ${isHeld ? classes.controlBtnSuccess : classes.controlBtnWarning}`}
                      onClick={() => handleToggleHold(asset)}
                      title={isHeld ? 'Resume paused repair cycle' : 'Pause repair cycle for material/sanction hold'}
                      disabled={actionLoading}
                    >
                      {isHeld ? <FiPlay size={13} /> : <FiPause size={13} />}
                      {isHeld ? 'Resume Overhaul' : 'Put on Hold'}
                    </button>

                    {/* 3. Report Exception */}
                    <button
                      className={`${classes.controlBtn} ${classes.controlBtnDanger}`}
                      onClick={() => handleOpenException(asset)}
                      title="Report defect or safety exception"
                    >
                      <FiAlertTriangle size={13} /> Exception
                    </button>

                    {/* 4. Lifetime Activity Timeline */}
                    <button
                      className={`${classes.controlBtn} ${classes.controlBtnTimeline}`}
                      onClick={() => setDetailModalAsset(asset.asset_number)}
                      title="View complete lifetime activity history & telemetry"
                    >
                      <FiActivity size={13} /> Lifetime Timeline
                    </button>

                    {/* 5. Edit Asset */}
                    <button
                      className={`${classes.controlBtn} ${classes.controlBtnEdit}`}
                      onClick={() => handleOpenEdit(asset)}
                      title="Edit rolling stock parameters and metadata"
                    >
                      <FiEdit2 size={13} /> Edit Asset
                    </button>

                    {/* 6. Deactivate / Delete */}
                    {asset.is_active ? (
                      <button
                        className={`${classes.controlBtn} ${classes.controlBtnSecondary}`}
                        style={{ color: '#DC2626' }}
                        onClick={() => handleDeactivate(asset.asset_number)}
                        title="Deactivate asset from active fleet"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className={`${classes.controlBtn} ${classes.controlBtnSuccess}`}
                        onClick={() => handleReactivate(asset.asset_number)}
                        title="Reactivate asset"
                      >
                        Reactivate
                      </button>
                    )}

                    {/* Admin God Mode Hard Delete */}
                    {isAdmin && (
                      <button
                        className={`${classes.controlBtn} ${classes.controlBtnDanger}`}
                        onClick={() => handleHardDelete(asset.asset_number)}
                        title="Permanently Purge Asset (Admin God Mode)"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= VIEW 2: MODERN COMPACT TABLE ================= */}
      {!loading && assets.length > 0 && viewMode === 'TABLE' && (
        <div className={classes.tableContainer}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th>Asset Number</th>
                <th>Category & Type</th>
                <th>Location</th>
                <th>Status</th>
                <th>Pipeline / Cycle</th>
                <th>Supervisor</th>
                <th style={{ textAlign: 'right' }}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const cat = getCategoryDetails(asset);
                const activeRepair = asset.repair_cycles?.find((c) => c.status === 'ACTIVE') || asset.repair_cycles?.[0];
                const activeHold = activeRepair?.holds?.find((h) => !h.released_at);
                const isHeld = asset.current_status === 'ON_HOLD' || !!activeHold;
                const statusStyle = getStatusBadge(asset.current_status, isHeld);
                const isWagon = (asset.asset_category || '').toUpperCase() === 'WAGON' || asset.asset_number.length === 11;
                const wagonData = isWagon && asset.asset_number.length === 11 ? decodeWagonNumber(asset.asset_number) : null;
                const lastMove = asset.movements?.[0] || asset.movement_logs?.[0];
                const supervisor = typeof lastMove?.handler === 'string' 
                  ? lastMove.handler 
                  : lastMove?.handler?.full_name || 'System Staff';

                return (
                  <tr key={asset.id || asset.asset_number}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                          #{asset.asset_number}
                        </span>
                        {wagonData && (
                          <span
                            className={classes.checkDigitPill}
                            style={{
                              backgroundColor: wagonData.isValidCheckDigit ? '#DCFCE7' : '#FEE2E2',
                              color: wagonData.isValidCheckDigit ? '#15803D' : '#DC2626',
                            }}
                          >
                            CD: {wagonData.enteredCheckDigit} {wagonData.isValidCheckDigit ? '✓' : '⚠️'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {asset.asset_type || cat.name}
                      </span>
                    </td>

                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: '#0284C7' }}>
                        <FiMapPin size={13} /> {asset.current_location || 'NSY'}
                      </span>
                    </td>

                    <td>
                      <span
                        className={classes.statusPill}
                        style={{
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                        }}
                      >
                        ● {statusStyle.label}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '12px', color: '#475569' }}>
                        {activeRepair?.repair_category?.id || asset.action || 'POH'}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        {supervisor}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className={`${classes.controlBtn} ${classes.controlBtnPrimary}`}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleOpenShunt(asset)}
                          title="Shunt / Move"
                        >
                          <FiTruck size={12} /> Shunt
                        </button>
                        <button
                          className={`${classes.controlBtn} ${isHeld ? classes.controlBtnSuccess : classes.controlBtnWarning}`}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleToggleHold(asset)}
                          title={isHeld ? 'Resume Overhaul' : 'Put on Hold'}
                        >
                          {isHeld ? <FiPlay size={12} /> : <FiPause size={12} />}
                          {isHeld ? 'Resume' : 'Hold'}
                        </button>
                        <button
                          className={`${classes.controlBtn} ${classes.controlBtnSecondary}`}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => setDetailModalAsset(asset.asset_number)}
                          title="Lifetime Activity & Controls"
                        >
                          <FiActivity size={12} /> Details
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

      {/* ================= MODAL 1: SHUNT / MOVE DRAWER ================= */}
      {showShuntModal && shuntAsset && (
        <div className={classes.modalOverlay} onClick={() => setShowShuntModal(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>
                <FiTruck color="#0284C7" /> Shunt & Transfer Rolling Stock #{shuntAsset.asset_number}
              </h3>
              <button className={classes.closeBtn} onClick={() => setShowShuntModal(false)}>
                <FiX />
              </button>
            </div>

            <div className={classes.modalBody}>
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', fontSize: '13px' }}>
                <div><strong>Current Location:</strong> {shuntAsset.current_location || 'NSY Staging Yard'}</div>
                <div><strong>Current Status:</strong> {shuntAsset.current_status}</div>
                <div><strong>Category / Type:</strong> {shuntAsset.asset_category} ({shuntAsset.asset_type})</div>
              </div>

              <div className={classes.formGroup}>
                <label>Destination Location (68 Topology Nodes):</label>
                <select
                  className={classes.formSelect}
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                >
                  <optgroup label="Shops & Production Sheds">
                    {locations
                      .filter((l) => ['SHOP', 'SHED'].includes(l.location_type))
                      .map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.name} ({loc.location_id}) — Occ: {loc.current_occupancy || 0}/{loc.max_capacity}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Track Lines 01–56 & Yards">
                    {locations
                      .filter((l) => ['YARD', 'TRACK_LINE'].includes(l.location_type))
                      .map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.name} ({loc.location_id}) — Occ: {loc.current_occupancy || 0}/{loc.max_capacity}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="All Other Workshop Locations">
                    {locations
                      .filter((l) => !['SHOP', 'SHED', 'YARD', 'TRACK_LINE'].includes(l.location_type))
                      .map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.name} ({loc.location_id})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div className={classes.formGroup}>
                <label>New Operational Status Post-Movement:</label>
                <select
                  className={classes.formSelect}
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                >
                  <option value="IN_REPAIR">IN_REPAIR (Work In Progress)</option>
                  <option value="SHOP_IN">SHOP_IN (Admitted to Bay)</option>
                  <option value="RECEIVED_NSY">RECEIVED_NSY (Inward Yard Staged)</option>
                  <option value="PENDING_QA">PENDING_QA (Awaiting WRS-5 Testing)</option>
                  <option value="FIT">FIT (QA Certified)</option>
                  <option value="DISPATCHED">DISPATCHED (Outturn Outbound)</option>
                </select>
              </div>

              <div className={classes.formGroup}>
                <label>Movement & Shunting Remarks:</label>
                <textarea
                  className={classes.formTextarea}
                  rows={2}
                  value={shuntRemarks}
                  onChange={(e) => setShuntRemarks(e.target.value)}
                  placeholder="e.g. Shunted from WRS-1 to WRS-2 for heavy wheelset and bogie overhaul"
                />
              </div>
            </div>

            <div className={classes.modalFooter}>
              <button className={classes.cancelBtn} onClick={() => setShowShuntModal(false)}>
                Cancel
              </button>
              <button
                className={classes.submitBtn}
                onClick={handleExecuteShunt}
                disabled={actionLoading}
              >
                {actionLoading ? 'Logging Movement...' : 'Confirm Shunt Movement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: HOLD REPAIR REASON MODAL ================= */}
      {showHoldModal && holdAsset && (
        <div className={classes.modalOverlay} onClick={() => setShowHoldModal(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>
                <FiPause color="#D97706" /> Place Asset #{holdAsset.asset_number} On Hold (Pause TAT)
              </h3>
              <button className={classes.closeBtn} onClick={() => setShowHoldModal(false)}>
                <FiX />
              </button>
            </div>

            <div className={classes.modalBody}>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Placing this asset on hold will pause the standard Turn-Around Time (TAT) clock and flag the repair stoppage on the management dashboard.
              </p>

              <div className={classes.formGroup}>
                <label>Stoppage Root Cause Reason:</label>
                <select
                  className={classes.formSelect}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                >
                  <option value="MATERIAL_SHORTAGE">MATERIAL_SHORTAGE (Spare Parts / Stores Non-Availability)</option>
                  <option value="SANCTION_PENDING">SANCTION_PENDING (Awaiting HQ / Divisional Financial Sanction)</option>
                  <option value="UNSCHEDULED_DEFECT">UNSCHEDULED_DEFECT (Major Structural / Wheel Crack Detected)</option>
                  <option value="LINE_BLOCK">LINE_BLOCK (Shop Track Maintenance Stoppage)</option>
                  <option value="OTHER">OTHER (Special Investigation)</option>
                </select>
              </div>

              <div className={classes.formGroup}>
                <label>Hold Explanation & Store Requisition Details:</label>
                <textarea
                  className={classes.formTextarea}
                  rows={3}
                  value={holdRemarks}
                  onChange={(e) => setHoldRemarks(e.target.value)}
                  placeholder="e.g. Awaiting delivery of 2x CTRB bearings and CBC draft gear from Stores Depot"
                />
              </div>
            </div>

            <div className={classes.modalFooter}>
              <button className={classes.cancelBtn} onClick={() => setShowHoldModal(false)}>
                Cancel
              </button>
              <button
                className={classes.submitBtn}
                style={{ backgroundColor: '#D97706', borderColor: '#D97706' }}
                onClick={handleExecuteHold}
                disabled={actionLoading}
              >
                {actionLoading ? 'Applying Hold...' : 'Confirm Repair Hold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: REPORT EXCEPTION MODAL ================= */}
      {showExceptionModal && exceptionAsset && (
        <div className={classes.modalOverlay} onClick={() => setShowExceptionModal(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>
                <FiAlertTriangle color="#DC2626" /> Report Exception on Asset #{exceptionAsset.asset_number}
              </h3>
              <button className={classes.closeBtn} onClick={() => setShowExceptionModal(false)}>
                <FiX />
              </button>
            </div>

            <div className={classes.modalBody}>
              <div className={classes.formGroup}>
                <label>Discrepancy / Failure Classification:</label>
                <select
                  className={classes.formSelect}
                  value={exceptionType}
                  onChange={(e) => setExceptionType(e.target.value)}
                >
                  <option value="DEFECT_FOUND">DEFECT_FOUND (Physical or Component Flaw Identified)</option>
                  <option value="MISSING_ASSET">MISSING_ASSET (Asset not found at designated yard/track)</option>
                  <option value="SAFETY_HAZARD">SAFETY_HAZARD (Brake Pipe / Coupler Safety Violation)</option>
                  <option value="REPAIR_REJECTED">REPAIR_REJECTED (Failed Stage Inspection QA)</option>
                </select>
              </div>

              <div className={classes.formGroup}>
                <label>Severity Level:</label>
                <select
                  className={classes.formSelect}
                  value={exceptionSeverity}
                  onChange={(e) => setExceptionSeverity(e.target.value)}
                >
                  <option value="LOW">LOW (Informational / Minor Rectification)</option>
                  <option value="MEDIUM">MEDIUM (Requires Supervisor Attention)</option>
                  <option value="HIGH">HIGH (Blocks Subsequent Stages)</option>
                  <option value="CRITICAL">CRITICAL (Executive Alert & Workshop Escalation)</option>
                </select>
              </div>

              <div className={classes.formGroup}>
                <label>Discrepancy Details & Findings:</label>
                <textarea
                  className={classes.formTextarea}
                  rows={3}
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Detail the exact defect or missing component found..."
                />
              </div>
            </div>

            <div className={classes.modalFooter}>
              <button className={classes.cancelBtn} onClick={() => setShowExceptionModal(false)}>
                Cancel
              </button>
              <button
                className={classes.submitBtn}
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                onClick={handleExecuteException}
                disabled={actionLoading}
              >
                {actionLoading ? 'Logging Exception...' : 'Report Exception'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: FULL ASSET DETAIL MODAL WITH LIFETIME TIMELINE ================= */}
      {detailModalAsset && (
        <AssetDetailModal
          assetNumber={detailModalAsset}
          onClose={() => setDetailModalAsset(null)}
          onAssetUpdated={() => {
            fetchAssets();
          }}
        />
      )}

      {/* ================= MODAL 5: COMPREHENSIVE REGISTER ASSET MODAL ================= */}
      {isRegisterOpen && (
        <div className={classes.modalOverlay} onClick={() => setIsRegisterOpen(false)}>
          <div className={`${classes.modal} ${classes.modalWide}`} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>
                <FiPlus color="#0284C7" /> Register New Rolling Stock Asset
              </h3>
              <button className={classes.closeBtn} onClick={() => setIsRegisterOpen(false)}>
                <FiX />
              </button>
            </div>

            <div className={classes.modalBody}>
              {/* Form Row 1: Category & Asset Number */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Asset Category:</label>
                  <select
                    className={classes.formSelect}
                    value={formData.asset_category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setFormData({ 
                        ...formData, 
                        asset_category: cat,
                        asset_type: cat === 'LOCO' ? 'WAG9' : cat === 'CRANE' ? '140T_CRANE' : cat === 'TOWER_CAR' ? '8W_DETC' : 'BOXNHL'
                      });
                    }}
                  >
                    <option value="WAGON">WAGON (11-Digit IR Freight Wagon)</option>
                    <option value="LOCO">LOCO (5-Digit IR Locomotive Road No.)</option>
                    <option value="CRANE">CRANE (6-Digit Heavy Breakdown Crane)</option>
                    <option value="TOWER_CAR">TOWER_CAR (OHE Inspection Tower Car)</option>
                  </select>
                </div>
                <div className={classes.formGroup}>
                  <label>
                    Asset Number ({formData.asset_category === 'WAGON' ? '11-Digit IR Format' : 'Identifier'}):
                  </label>
                  <input
                    type="text"
                    className={classes.formInput}
                    placeholder={formData.asset_category === 'WAGON' ? 'e.g. 21021845128' : formData.asset_category === 'LOCO' ? 'e.g. 30215' : 'e.g. 140012'}
                    value={formData.asset_number}
                    onChange={(e) => setFormData({ ...formData, asset_number: e.target.value.trim().toUpperCase() })}
                  />
                  {formData.asset_category === 'WAGON' && formData.asset_number.length === 11 && (
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                      {(() => {
                        const val = validateAssetNumber(formData.asset_number, 'WAGON');
                        return val.isValid ? (
                          <span style={{ color: '#15803D', fontWeight: 600 }}>✓ Valid 11-digit IR check digit verified</span>
                        ) : (
                          <span style={{ color: '#DC2626', fontWeight: 600 }}>
                            ⚠️ Check digit mismatch! Expected: {val.autoFix?.slice(-1)}
                            {val.autoFix && (
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, asset_number: val.autoFix! })}
                                style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px', borderRadius: '4px', border: '1px solid #DC2626', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}
                              >
                                Auto-fix to {val.autoFix}
                              </button>
                            )}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Row 2: Subtype & Railway Zone */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Subtype / Classification:</label>
                  <input
                    type="text"
                    className={classes.formInput}
                    placeholder="e.g. BOXNHL, BCNHL, BTPN, WAG-9, 140T"
                    value={formData.asset_type}
                    onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                  />
                </div>
                <div className={classes.formGroup}>
                  <label>Railway Zone (Rly):</label>
                  <select
                    className={classes.formSelect}
                    value={formData.rly}
                    onChange={(e) => setFormData({ ...formData, rly: e.target.value })}
                  >
                    {['ER', 'CR', 'NR', 'NER', 'NFR', 'SR', 'SCR', 'SER', 'WR', 'NCR', 'SWR', 'SECR', 'WCR', 'NWR', 'ECoR', 'ECR', 'CONCOR', 'MOD'].map((rly) => (
                      <option key={rly} value={rly}>{rly} — {rly === 'ER' ? 'Eastern Railway (Jamalpur Home)' : `${rly} Zone`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Row 3: Wagon Sr & Modification */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Serial Number (RS Sr):</label>
                  <input
                    type="text"
                    className={classes.formInput}
                    placeholder="e.g. 45128"
                    value={formData.wagon_sr}
                    onChange={(e) => setFormData({ ...formData, wagon_sr: e.target.value })}
                  />
                </div>
                <div className={classes.formGroup}>
                  <label>Modification (Mod):</label>
                  <input
                    type="text"
                    className={classes.formInput}
                    placeholder="e.g. Twin Pipe Air Brake, BMBS"
                    value={formData.mod}
                    onChange={(e) => setFormData({ ...formData, mod: e.target.value })}
                  />
                </div>
              </div>

              {/* Form Row 4: Built Year & Overhaul Action */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Built Year:</label>
                  <input
                    type="number"
                    className={classes.formInput}
                    value={formData.built_year}
                    onChange={(e) => setFormData({ ...formData, built_year: Number(e.target.value) })}
                  />
                </div>
                <div className={classes.formGroup}>
                  <label>Overhaul Action:</label>
                  <select
                    className={classes.formSelect}
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  >
                    <option value="POH">POH (Periodic Overhaul)</option>
                    <option value="ROH">ROH (Routine Overhaul)</option>
                    <option value="IOH">IOH (Intermediate Overhaul)</option>
                    <option value="SPECIAL_REPAIR">SPECIAL_REPAIR (Special Repairs)</option>
                    <option value="NEW_BUILD">NEW_BUILD (New Manufacturing Order)</option>
                  </select>
                </div>
              </div>

              {/* Form Row 5: Lifecycle Origin & Initial Location */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Lifecycle Mode:</label>
                  <select
                    className={classes.formSelect}
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  >
                    <option value="REPAIR">Repair Overhaul (POH/IOH/ROH)</option>
                    <option value="MANUFACTURING">New Build Manufacturing (GIF/Crane)</option>
                  </select>
                </div>
                <div className={classes.formGroup}>
                  <label>Initial Workshop Location:</label>
                  <select
                    className={classes.formSelect}
                    value={formData.current_location}
                    onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
                  >
                    <option value="NSY">NSY (New Sorting Yard Staging)</option>
                    <option value="DPS">DPS (Diesel POH Shed)</option>
                    <option value="GIF">GIF (General Iron Foundry / Mfg)</option>
                    <option value="CRANE_SHOP">CRANE_SHOP (Crane Overhaul / Mfg)</option>
                    {locations.filter((l) => ['SHOP', 'SHED'].includes(l.location_type)).map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.name} ({loc.location_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={classes.modalFooter}>
              <button className={classes.cancelBtn} onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </button>
              <button
                className={classes.submitBtn}
                onClick={handleRegister}
                disabled={actionLoading}
              >
                {actionLoading ? 'Registering...' : 'Register Rolling Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 6: COMPREHENSIVE EDIT ASSET MODAL ================= */}
      {isEditOpen && editingAsset && (
        <div className={classes.modalOverlay} onClick={() => setIsEditOpen(false)}>
          <div className={`${classes.modal} ${classes.modalWide}`} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>
                <FiEdit2 color="#4338CA" /> Edit Rolling Stock Asset: #{editingAsset.asset_number}
              </h3>
              <button className={classes.closeBtn} onClick={() => setIsEditOpen(false)}>
                <FiX />
              </button>
            </div>

            <div className={classes.modalBody}>
              {/* Asset Identity Banner */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Asset Identifier</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>#{editingAsset.asset_number}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ padding: '4px 10px', backgroundColor: '#EEF2FF', color: '#4338CA', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                    {editingAsset.asset_category}
                  </span>
                  <span style={{ padding: '4px 10px', backgroundColor: '#F1F5F9', color: '#334155', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                    {editingAsset.origin === 'MANUFACTURING' ? '🏗️ Manufacturing' : '🔧 Repair Lifecycle'}
                  </span>
                </div>
              </div>

              {/* Form Row 1: Category & Type */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Fleet Category:</label>
                  <select
                    className={classes.formSelect}
                    value={editingAsset.asset_category}
                    onChange={(e) => setEditingAsset({ ...editingAsset, asset_category: e.target.value })}
                  >
                    <option value="WAGON">WAGON (Freight Wagon)</option>
                    <option value="LOCO">LOCO (Locomotive)</option>
                    <option value="CRANE">CRANE (Breakdown Crane)</option>
                    <option value="TOWER_CAR">TOWER_CAR (OHE Tower Car)</option>
                  </select>
                </div>
                <div className={classes.formGroup}>
                  <label>Subtype / Classification:</label>
                  <input
                    type="text"
                    className={classes.formInput}
                    value={editingAsset.asset_type || ''}
                    placeholder="e.g. BOXNHL, BTPN, WAG-9, 140T"
                    onChange={(e) => setEditingAsset({ ...editingAsset, asset_type: e.target.value })}
                  />
                </div>
              </div>

              {/* Form Row 2: Railway Zone & Wagon Sr */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Railway Zone (Rly):</label>
                  <select
                    className={classes.formSelect}
                    value={editingAsset.rly || 'ER'}
                    onChange={(e) => setEditingAsset({ ...editingAsset, rly: e.target.value })}
                  >
                    {['ER', 'CR', 'NR', 'NER', 'NFR', 'SR', 'SCR', 'SER', 'WR', 'NCR', 'SWR', 'SECR', 'WCR', 'NWR', 'ECoR', 'ECR', 'CONCOR', 'MOD'].map((rly) => (
                      <option key={rly} value={rly}>{rly} — {rly === 'ER' ? 'Eastern Railway (Home)' : `${rly} Zone`}</option>
                    ))}
                  </select>
                </div>
                <div className={classes.formGroup}>
                  <label>Fleet Serial No (RS Sr):</label>
                  <input
                    type="text"
                    className={classes.formInput}
                    value={editingAsset.wagon_sr || ''}
                    placeholder="e.g. 45128"
                    onChange={(e) => setEditingAsset({ ...editingAsset, wagon_sr: e.target.value })}
                  />
                </div>
              </div>

              {/* Form Row 3: Modification & Built Year */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Modification Status (Mod):</label>
                  <input
                    type="text"
                    className={classes.formInput}
                    value={editingAsset.mod || ''}
                    placeholder="e.g. Twin Pipe Air Brake, BMBS Fitted"
                    onChange={(e) => setEditingAsset({ ...editingAsset, mod: e.target.value })}
                  />
                </div>
                <div className={classes.formGroup}>
                  <label>
                    Built Year {editingAsset.built_year ? `(${new Date().getFullYear() - Number(editingAsset.built_year)} yrs old)` : ''}:
                  </label>
                  <input
                    type="number"
                    className={classes.formInput}
                    value={editingAsset.built_year || ''}
                    placeholder="e.g. 2019"
                    onChange={(e) => setEditingAsset({ ...editingAsset, built_year: parseInt(e.target.value) || undefined })}
                  />
                </div>
              </div>

              {/* Form Row 4: Action & Pipeline Mode */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Overhaul Action Cycle:</label>
                  <select
                    className={classes.formSelect}
                    value={editingAsset.action || 'POH'}
                    onChange={(e) => setEditingAsset({ ...editingAsset, action: e.target.value })}
                  >
                    <option value="POH">POH (Periodic Overhaul)</option>
                    <option value="ROH">ROH (Routine Overhaul)</option>
                    <option value="IOH">IOH (Intermediate Overhaul)</option>
                    <option value="SPECIAL_REPAIR">SPECIAL_REPAIR (Heavy Structural / Accident)</option>
                    <option value="NEW_BUILD">NEW_BUILD (New Manufacturing Commissioning)</option>
                    <option value="COMMISSIONING">COMMISSIONING (Final Testing)</option>
                  </select>
                </div>
                <div className={classes.formGroup}>
                  <label>Lifecycle Origin Mode:</label>
                  <select
                    className={classes.formSelect}
                    value={editingAsset.origin || 'REPAIR'}
                    onChange={(e) => setEditingAsset({ ...editingAsset, origin: e.target.value })}
                  >
                    <option value="REPAIR">Repair Overhaul (POH/IOH/ROH)</option>
                    <option value="MANUFACTURING">New Build Manufacturing (GIF/Crane)</option>
                  </select>
                </div>
              </div>

              {/* Form Row 5: Location & Status */}
              <div className={classes.formRow}>
                <div className={classes.formGroup}>
                  <label>Current Location (68 Topology Nodes):</label>
                  <select
                    className={classes.formSelect}
                    value={editingAsset.current_location || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, current_location: e.target.value })}
                  >
                    <optgroup label="Shops & Production Sheds">
                      {locations.filter((l) => ['SHOP', 'SHED'].includes(l.location_type)).map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.name} ({loc.location_id})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Track Lines & Yards">
                      {locations.filter((l) => !['SHOP', 'SHED'].includes(l.location_type)).map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.name} ({loc.location_id})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className={classes.formGroup}>
                  <label>Current Status:</label>
                  <select
                    className={classes.formSelect}
                    value={editingAsset.current_status}
                    onChange={(e) => setEditingAsset({ ...editingAsset, current_status: e.target.value })}
                  >
                    <option value="IN_REPAIR">IN_REPAIR (Work In Progress)</option>
                    <option value="SHOP_IN">SHOP_IN (Admitted in Bay)</option>
                    <option value="RECEIVED_NSY">RECEIVED_NSY (Inward Yard Staged)</option>
                    <option value="ON_HOLD">ON_HOLD (Overhaul Paused)</option>
                    <option value="PENDING_QA">PENDING_QA (Awaiting QA / Testing)</option>
                    <option value="FIT">FIT (QA Certified)</option>
                    <option value="DISPATCHED">DISPATCHED (Outturn Outbound)</option>
                    <option value="MISSING">MISSING (Asset Missing)</option>
                    <option value="CONDEMNED">CONDEMNED (Flagged for Scrap)</option>
                  </select>
                </div>
              </div>

              {/* Form Row 6: Active Fleet Status */}
              <div className={classes.formGroup}>
                <label>Active Fleet Status:</label>
                <select
                  className={classes.formSelect}
                  value={editingAsset.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setEditingAsset({ ...editingAsset, is_active: e.target.value === 'active' })}
                >
                  <option value="active">Active (Enrolled in Live Workshop Fleet)</option>
                  <option value="inactive">Inactive / Deactivated</option>
                </select>
              </div>
            </div>

            <div className={classes.modalFooter}>
              <button className={classes.cancelBtn} onClick={() => setIsEditOpen(false)}>
                Cancel
              </button>
              <button
                className={classes.submitBtn}
                style={{ backgroundColor: '#4338CA', borderColor: '#4338CA' }}
                onClick={handleSaveEdit}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving Changes...' : 'Save Asset Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= QUICK ACTION MODALS ================= */}
      <YardIntakeModal
        isOpen={isYardIntakeOpen}
        onClose={() => setIsYardIntakeOpen(false)}
        onSuccess={() => {
          setIsYardIntakeOpen(false);
          fetchAssets();
        }}
      />
      <ManufacturingOrderModal
        isOpen={isMfgOrderOpen}
        onClose={() => setIsMfgOrderOpen(false)}
        onSuccess={() => {
          setIsMfgOrderOpen(false);
          fetchAssets();
        }}
      />
      <ReportExceptionModal
        isOpen={isGlobalExceptionOpen}
        onClose={() => setIsGlobalExceptionOpen(false)}
        onSuccess={() => {
          setIsGlobalExceptionOpen(false);
          fetchAssets();
        }}
      />
    </div>
  );
}
