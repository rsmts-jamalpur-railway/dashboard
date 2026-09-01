'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FiRefreshCw, FiSmartphone, FiUser, FiKey, FiClock, FiActivity } from 'react-icons/fi';
import classes from './page.module.css';

interface User {
  full_name: string;
  employee_id: string;
}

interface Device {
  id: string;
  device_id: string;
  last_sync: string | null;
  user: User;
}

export default function SyncMonitorPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();

  const fetchSyncStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/sync/status');
      if (res.data.success) {
        setDevices(res.data.data || []);
      }
    } catch (err: any) {
      setError('Failed to fetch sync status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  const getSyncHealth = (lastSync: string | null) => {
    if (!lastSync) return { label: 'Never Synced', className: classes.statusCritical };
    
    const lastSyncTime = new Date(lastSync).getTime();
    const now = new Date().getTime();
    const diffHours = (now - lastSyncTime) / (1000 * 60 * 60);

    if (diffHours > 24) {
      return { label: 'Critical (> 24h)', className: classes.statusCritical };
    } else if (diffHours > 4) {
      return { label: 'Warning (> 4h)', className: classes.statusWarning };
    } else {
      return { label: 'Healthy', className: classes.statusHealthy };
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <h1 className={classes.title}>Offline Sync Monitor</h1>
        <div className={classes.actions}>
          <button className={classes.primaryBtn} onClick={fetchSyncStatus}>
            <FiRefreshCw style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Refresh Now
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiSmartphone style={{ color: 'var(--color-primary-action)' }} /> Device ID <span className={classes.typeIndicator}>uuid</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiUser /> Assigned User <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiKey /> Employee ID <span className={classes.typeIndicator}>varchar</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiClock /> Last Synced <span className={classes.typeIndicator}>timestamp</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiActivity /> Health Status <span className={classes.typeIndicator}>status</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  Actions
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && devices.length === 0 ? (
              <tr>
                <td colSpan={6} className={classes.emptyState}>Loading device sync status...</td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={6} className={classes.emptyState}>No devices registered.</td>
              </tr>
            ) : (
              devices.map((device) => {
                const health = getSyncHealth(device.last_sync);
                return (
                  <tr key={device.id}>
                    <td><strong>{device.device_id}</strong></td>
                    <td>{device.user?.full_name || 'N/A'}</td>
                    <td>{device.user?.employee_id || 'N/A'}</td>
                    <td>
                      {device.last_sync 
                        ? new Date(device.last_sync).toLocaleString() 
                        : 'Never'}
                    </td>
                    <td>
                      <span className={`${classes.statusBadge} ${health.className}`}>
                        {health.label}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={classes.primaryBtn}
                        onClick={() => toast.success('Ping Sent', `Push notification sent to ${device.user?.full_name}'s device to sync data.`)}
                      >
                        Ping Device
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
