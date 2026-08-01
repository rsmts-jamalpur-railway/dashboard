'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { FiClock, FiBook, FiKey, FiActivity } from 'react-icons/fi';
import classes from './page.module.css';

interface Occupancy {
  location_id: string;
  max_capacity: number;
  current: number;
  allocated: number;
  total_load: number;
  is_overloaded: boolean;
}

interface DashboardData {
  total_active_assets: number;
  dispatched_today: number;
  occupancy: Occupancy[];
  timestamp: string;
}

interface MovementLog {
  log_id: number;
  asset_number: string;
  from_location: string | null;
  to_location: string;
  new_status: string;
  timestamp: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentLogs, setRecentLogs] = useState<MovementLog[]>([]);
  const [allLogsState, setAllLogsState] = useState<MovementLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [avgTat, setAvgTat] = useState<string>('-');
  const [loading, setLoading] = useState(true);

  // Infrastructure Health State
  const [health, setHealth] = useState({
    api: 'Online',
    db: 'Connected',
    redis: 'Connected',
    socket: 'Connecting...',
  });

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
          setRecentLogs(allLogs.slice(0, 10 * logPage)); // slice based on current logPage

          // Calculate Avg TAT
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
        setHealth((prev) => ({ ...prev, api: 'Offline' }));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();

    // Infinite Scroll Observer for Activity Feed
    // We define this using hooks so it persists


    // 2. Setup Socket.io Client for real-time updates & health fallback
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket: Socket = io(socketUrl, {
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      setHealth((prev) => ({ ...prev, socket: 'Connected' }));
    });

    socket.on('disconnect', () => {
      setHealth((prev) => ({ ...prev, socket: 'Disconnected' }));
    });

    socket.on('connect_error', () => {
      setHealth((prev) => ({ ...prev, socket: 'Error (Retrying 5s)' }));
    });

    socket.on('movement_updated', () => {
      // Refresh the dashboard stats silently
      fetchDashboard();
    });

    socket.on('notification', (payload) => {
      // Will integrate with the notification center bell icon later
      console.log('New Notification:', payload);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastLogRef = useCallback((node: HTMLTableRowElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && recentLogs.length < allLogsState.length) {
        setLogPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, recentLogs.length, allLogsState.length]);

  useEffect(() => {
    if (logPage > 1 && allLogsState.length > 0) {
      setRecentLogs(allLogsState.slice(0, logPage * 10));
    }
  }, [logPage, allLogsState]);

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading real-time data...</div>;
  }

  return (
    <div>
      {/* Top KPIs */}
      <div className={classes.grid}>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}>📥 Active Wagons (NSY)</div>
          <div className={classes.kpiValue}>
            {data?.total_active_assets || 0}
          </div>
        </div>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}>📤 Workshop Out Today</div>
          <div className={classes.kpiValue}>
            {data?.dispatched_today || 0}
          </div>
        </div>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}>⚠️ Overloaded Shops</div>
          <div className={classes.kpiValue}>
            {data?.occupancy.filter(o => o.is_overloaded).length || 0}
          </div>
        </div>
        <div className={classes.kpiCard}>
          <div className={classes.kpiTitle}><FiClock style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Avg TAT</div>
          <div className={classes.kpiValue}>{avgTat}</div>
        </div>
      </div>

      <div className={classes.mainLayout}>
        {/* Workshop Map Grid (Replaced by Capacity Chart) */}
        <div className={classes.mapSection}>
          <div className={classes.sectionHeader}>Live Capacity Utilization</div>
          <div className={classes.chartContainer} style={{ padding: '16px' }}>
            {!data?.occupancy || data.occupancy.length === 0 ? (
              <div className={classes.emptyState}>No location data available.</div>
            ) : (
              <div style={{ width: '100%', height: 420, marginTop: '20px' }}>
                <ResponsiveContainer>
                  <BarChart data={data.occupancy.filter((o: any) => o.location_id !== 'OUT')} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="location_id" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total_load" name="Current Load" radius={[4, 4, 0, 0]} barSize={30}>
                      {data.occupancy.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.is_overloaded ? '#EF4444' : '#3B82F6'} />
                      ))}
                    </Bar>
                    <Bar dataKey="max_capacity" name="Max Capacity" fill="#D1D5DB" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Infrastructure Health & Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div className={classes.healthSection}>
            <div className={classes.sectionHeader} style={{ padding: 0, border: 'none', marginBottom: '16px' }}>
              System Health
            </div>
            <div className={classes.healthItem}>
              <span>API Server</span>
              <span className={health.api === 'Online' ? classes.statusOnline : classes.statusOffline}>
                {health.api}
              </span>
            </div>
            <div className={classes.healthItem}>
              <span>Database</span>
              <span className={health.db === 'Connected' ? classes.statusOnline : classes.statusOffline}>
                {health.db}
              </span>
            </div>
            <div className={classes.healthItem}>
              <span>Redis Cache</span>
              <span className={health.redis === 'Connected' ? classes.statusOnline : classes.statusOffline}>
                {health.redis}
              </span>
            </div>
            <div className={classes.healthItem}>
              <span>WebSocket</span>
              <span className={health.socket === 'Connected' ? classes.statusOnline : classes.statusOffline}>
                {health.socket}
              </span>
            </div>
          </div>

          <div className={classes.healthSection}>
            <div className={classes.sectionHeader} style={{ padding: 0, border: 'none', marginBottom: '16px' }}>
              Recent Activity
            </div>
            <div className={classes.activityScroll}>
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th>
                      <div className={classes.tableHeaderCell}>
                        <FiKey style={{ color: 'var(--color-primary-action)' }} /> Wagon <span className={classes.typeIndicator}>varchar</span>
                      </div>
                    </th>
                    <th>
                      <div className={classes.tableHeaderCell}>
                        <FiActivity /> Action <span className={classes.typeIndicator}>text</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={2} className={classes.emptyState}>No activity today</td>
                    </tr>
                  ) : (
                    recentLogs.map((log, index) => {
                      const isLast = index === recentLogs.length - 1;
                      return (
                        <tr key={log.log_id} ref={isLast ? lastLogRef : null}>
                          <td><strong>{log.asset_number}</strong></td>
                          <td>
                            {(() => {
                              let color = '#6B7280';
                              let bg = '#F3F4F6';
                              switch (log.new_status) {
                                case 'Workshop In': color = '#3B82F6'; bg = '#EFF6FF'; break;
                                case 'Shop In': color = '#F59E0B'; bg = '#FEF3C7'; break;
                                case 'Fit': color = '#10B981'; bg = '#ECFDF5'; break;
                                case 'Not Fit': color = '#EF4444'; bg = '#FEF2F2'; break;
                                case 'Workshop Out': color = '#8B5CF6'; bg = '#F5F3FF'; break;
                              }
                              return (
                                <span style={{
                                  display: 'inline-block', padding: '2px 8px',
                                  borderRadius: '12px', fontSize: '0.75rem',
                                  fontWeight: 500, color: color, backgroundColor: bg
                                }}>
                                  {log.new_status}
                                </span>
                              );
                            })()}
                            <br />
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'inline-block' }}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {recentLogs.length > 0 && recentLogs.length < allLogsState.length && (
                    <tr>
                      <td colSpan={2} className={classes.emptyState}>Loading more activity...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 300, color: 'var(--color-text-secondary)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontWeight: 400 }}><FiBook style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Dashboard Terminology Reference</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
          <div>NSY: New Sick Yard (Initial intake)</div>
          <div>WRS (1-5): Wagon Repair Shops</div>
          <div>GIF: Goods Inspection Facility</div>
          <div>TAT: Turn-Around Time (Total hours in workshop)</div>
          <div>Workshop In: Total wagons that entered today</div>
          <div>Workshop Out: Total wagons dispatched today</div>
          <div>Active Wagons: Wagons currently inside the facility</div>
          <div>Overloaded Shops: Shops exceeding max capacity</div>
        </div>
      </div>

    </div>
  );
}
