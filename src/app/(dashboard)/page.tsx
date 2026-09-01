'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { FiClock, FiFilter, FiActivity, FiPlusSquare, FiSearch, FiUserPlus, FiMapPin } from 'react-icons/fi';
import classes from './page.module.css';
import AssetTimeline from '@/components/dashboard/AssetTimeline';

interface DashboardData {
  total_active_assets: number;
  total_active_wagons: number;
  total_active_other: number;
  dispatched_today: number;
  dispatched_today_wagons: number;
  dispatched_today_other: number;
}

interface Photo {
  photo_url: string;
  createdAt: string;
}

interface MovementLog {
  log_id: string;
  asset_number: string;
  from_location: string | null;
  to_location: string;
  previous_status: string | null;
  new_status: string;
  timestamp: string;
  remarks: string | null;
  handler: { full_name: string };
  asset?: { asset_category: string };
  photos?: Photo[];
}

interface GroupedAsset {
  asset_number: string;
  category: string;
  current_location: string;
  current_status: string;
  last_updated: string;
  history: string[];
  logs: MovementLog[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [allLogsState, setAllLogsState] = useState<MovementLog[]>([]);
  const [groupedAssets, setGroupedAssets] = useState<GroupedAsset[]>([]);
  const [visibleAssets, setVisibleAssets] = useState<GroupedAsset[]>([]);
  const [assetPage, setAssetPage] = useState(1);
  const [avgTat, setAvgTat] = useState<string>('-');
  const [sysHealth, setSysHealth] = useState<'Operational' | 'Degraded' | 'Offline' | 'Loading'>('Loading');
  const [loading, setLoading] = useState(true);
  
  // Timeline State
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  // Compact Filters
  const [filterType, setFilterType] = useState<'ALL' | 'WAGON' | 'OTHER'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SHOP_IN' | 'PENDING_QA'>('ALL');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [res, logsRes] = await Promise.all([
          api.get('/dashboard/overview'),
          api.get('/reports/movements-data')
        ]);
        
        if (res.data.success) {
          setData(res.data.data);
        }
        
        if (logsRes.data.success) {
          const allLogs = logsRes.data.data as MovementLog[];
          setAllLogsState(allLogs);

          // Group by asset
          const groups: Record<string, GroupedAsset> = {};
          
          // Sort logs oldest to newest first for building history string
          const chronLogs = [...allLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          chronLogs.forEach(log => {
            if (!groups[log.asset_number]) {
              groups[log.asset_number] = {
                asset_number: log.asset_number,
                category: log.asset?.asset_category || 'WAGON',
                current_location: log.to_location,
                current_status: log.new_status,
                last_updated: log.timestamp,
                history: [log.new_status],
                logs: []
              };
            } else {
              groups[log.asset_number].current_location = log.to_location;
              groups[log.asset_number].current_status = log.new_status;
              groups[log.asset_number].last_updated = log.timestamp;
              groups[log.asset_number].history.push(log.new_status);
            }
            groups[log.asset_number].logs.push(log);
          });

          // Convert to array and sort by last updated descending
          const finalAssets = Object.values(groups).sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
          setGroupedAssets(finalAssets);
          setVisibleAssets(finalAssets.slice(0, 15));

          // Calculate Avg TAT globally
          const assetArrivals: Record<string, Date> = {};
          const assetDispatches: Record<string, Date> = {};

          allLogs.forEach(log => {
            const date = new Date(log.timestamp);
            if (log.new_status === 'Workshop In' && (log.to_location === 'NSY' || !log.from_location)) {
              if (!assetArrivals[log.asset_number] || date < assetArrivals[log.asset_number]) {
                assetArrivals[log.asset_number] = date;
              }
            }
            if (log.new_status === 'Workshop Out' || log.new_status === 'Fit') {
              if (!assetDispatches[log.asset_number] || date > assetDispatches[log.asset_number]) {
                assetDispatches[log.asset_number] = date;
              }
            }
          });

          let totalHours = 0;
          let count = 0;
          Object.keys(assetDispatches).forEach(asset => {
            if (assetArrivals[asset]) {
              const diffMs = assetDispatches[asset].getTime() - assetArrivals[asset].getTime();
              totalHours += diffMs / (1000 * 60 * 60);
              count++;
            }
          });

          setAvgTat(count > 0 ? `${(totalHours / count).toFixed(1)} hrs` : 'N/A');
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();

    const fetchHealth = async () => {
      try {
        const res = await api.get('/health');
        if (res.data && res.data.status === 'ok') {
          setSysHealth('Operational');
        } else {
          setSysHealth('Degraded');
        }
      } catch (err) {
        setSysHealth('Offline');
      }
    };
    fetchHealth();
    const healthInterval = setInterval(fetchHealth, 30000);

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket: Socket = io(socketUrl, {
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('movement_updated', () => {
      fetchDashboard();
    });

    return () => {
      socket.disconnect();
      clearInterval(healthInterval);
    };
  }, []);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastAssetRef = useCallback((node: HTMLTableRowElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleAssets.length < groupedAssets.length) {
        setAssetPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, visibleAssets.length, groupedAssets.length]);

  useEffect(() => {
    if (groupedAssets.length > 0) {
      let filtered = groupedAssets;
      
      if (filterType !== 'ALL') {
        filtered = filtered.filter(a => {
          if (filterType === 'WAGON') return a.category === 'WAGON';
          return a.category !== 'WAGON';
        });
      }

      if (filterStatus !== 'ALL') {
        filtered = filtered.filter(a => {
          if (filterStatus === 'SHOP_IN') return a.current_status === 'Shop In';
          if (filterStatus === 'PENDING_QA') return a.current_status === 'Pending QA';
          return true;
        });
      }

      setVisibleAssets(filtered.slice(0, assetPage * 15));
    }
  }, [assetPage, groupedAssets, filterType, filterStatus]);

  if (loading) {
    return <div style={{ padding: '16px', fontSize: '13px' }}>Loading real-time data...</div>;
  }

  const selectedAssetData = selectedAsset ? groupedAssets.find(a => a.asset_number === selectedAsset) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Command Center (Quick Actions) */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
          Quick Actions (Command Center)
        </h2>
        <div className={classes.commandCenter}>
          <Link href="/assets?modal=new" className={classes.actionCard}>
            <div className={classes.actionIcon} style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
              <FiPlusSquare />
            </div>
            <div>
              <h3 className={classes.actionTitle}>Register Asset</h3>
              <p className={classes.actionDesc}>Intake new wagons or locos</p>
            </div>
          </Link>
          
          <Link href="/assets?focus=search" className={classes.actionCard}>
            <div className={classes.actionIcon} style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }}>
              <FiSearch />
            </div>
            <div>
              <h3 className={classes.actionTitle}>Search & Update</h3>
              <p className={classes.actionDesc}>Find assets and update state</p>
            </div>
          </Link>

          <Link href="/users?modal=new" className={classes.actionCard}>
            <div className={classes.actionIcon} style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
              <FiUserPlus />
            </div>
            <div>
              <h3 className={classes.actionTitle}>Add User</h3>
              <p className={classes.actionDesc}>Onboard a new employee</p>
            </div>
          </Link>

          <Link href="/locations?modal=new" className={classes.actionCard}>
            <div className={classes.actionIcon} style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
              <FiMapPin />
            </div>
            <div>
              <h3 className={classes.actionTitle}>Manage Locations</h3>
              <p className={classes.actionDesc}>Add workshop or yard nodes</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Top KPIs */}
      <div className={classes.grid}>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}>Total Active Assets</div>
          <div className={classes.kpiValue}>
            {data?.total_active_assets || 0}
            <span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '8px', color: 'var(--color-text-secondary)' }}>
              (Wagons: {data?.total_active_wagons || 0}, Other: {data?.total_active_other || 0})
            </span>
          </div>
        </div>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}>Dispatched Today</div>
          <div className={classes.kpiValue}>
            {data?.dispatched_today || 0}
          </div>
        </div>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}><FiClock style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Global Avg TAT</div>
          <div className={classes.kpiValue}>{avgTat}</div>
        </div>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}><FiActivity style={{ verticalAlign: 'middle', marginRight: '4px' }} /> System Health</div>
          <div className={classes.kpiValue} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: sysHealth === 'Operational' ? '#10B981' : sysHealth === 'Offline' ? '#EF4444' : '#F59E0B'
            }}></span>
            <span style={{ fontSize: '1.25rem', color: sysHealth === 'Operational' ? '#10B981' : sysHealth === 'Offline' ? '#EF4444' : '#F59E0B' }}>
              {sysHealth}
            </span>
          </div>
        </div>
      </div>

      {/* Unified Master Table */}
      <div className={classes.tableContainer}>
        <div className={classes.tableHeaderRow}>
          <h2 className={classes.tableTitle}>Master Assets Log</h2>
          <div className={classes.filters}>
            <div className={classes.filterGroup}>
              <FiFilter size={12} style={{ marginRight: '4px' }}/>
              <select className={classes.compactSelect} value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setAssetPage(1); }}>
                <option value="ALL">All Types</option>
                <option value="WAGON">Wagon Only</option>
                <option value="OTHER">Loco / Crane / Tower Car</option>
              </select>
            </div>
            <div className={classes.filterGroup}>
              <select className={classes.compactSelect} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as any); setAssetPage(1); }}>
                <option value="ALL">All Statuses</option>
                <option value="SHOP_IN">Shop In</option>
                <option value="PENDING_QA">Pending QA</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className={classes.activityScroll}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th>Asset Number</th>
                <th>Category</th>
                <th>Current Location</th>
                <th>Current Status</th>
                <th>Transitions</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className={classes.emptyState}>No activity found</td>
                </tr>
              ) : (
                visibleAssets.map((asset, index) => {
                  const isLast = index === visibleAssets.length - 1;
                  // Show last 3 transitions
                  const recentHistory = asset.history.slice(-3).join(' ➔ ');
                  const hasMore = asset.history.length > 3;

                  return (
                    <tr 
                      key={asset.asset_number} 
                      ref={isLast ? lastAssetRef : null}
                      onClick={() => setSelectedAsset(asset.asset_number)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 600, color: '#0A74DA' }}>{asset.asset_number}</td>
                      <td>{asset.category}</td>
                      <td>{asset.current_location}</td>
                      <td>
                        <span className={`${classes.statusBadge} ${classes[asset.current_status.replace(/\s+/g, '')] || classes.defaultStatus}`}>
                          {asset.current_status}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: '#6B7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {hasMore ? `... ➔ ${recentHistory}` : recentHistory}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(asset.last_updated).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
              {visibleAssets.length > 0 && visibleAssets.length < groupedAssets.length && (
                <tr>
                  <td colSpan={6} className={classes.emptyState}>Loading more assets...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Timeline Modal */}
      {selectedAsset && selectedAssetData && (
        <AssetTimeline 
          assetNumber={selectedAsset}
          logs={selectedAssetData.logs}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}
