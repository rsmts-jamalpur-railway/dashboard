'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FiBook, FiClock, FiActivity, FiUser, FiFileText } from 'react-icons/fi';
import classes from './page.module.css';

interface Setting {
  key: string;
  value: string;
  description: string | null;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  details: any;
  timestamp: string;
  user?: {
    employee_id: string;
    full_name: string;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await api.get('/settings');
      if (res.data.success) {
        setSettings(res.data.data || []);
      }
    } catch (err) {
      setError('Failed to fetch settings.');
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const res = await api.get('/audit');
      if (res.data.success) {
        setAuditLogs(res.data.data || []);
      }
    } catch (err) {
      setError('Failed to fetch audit logs.');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchAuditLogs();
  }, []);

  const handleUpdateSetting = async (key: string, value: string) => {
    if (key === 'ASSET_FORM_CONFIG') {
      try {
        JSON.parse(value);
      } catch (e: any) {
        toast.error('Invalid JSON Formatting', `Please check your syntax before saving: ${e.message}`);
        return;
      }
    }

    try {
      await api.patch(`/settings/${key}`, { value });
      toast.success('Setting Updated', `${key} was successfully saved.`);
      fetchAuditLogs(); // Refresh logs to show the setting change
    } catch (err) {
      toast.error('Failed to update setting', err);
      fetchSettings(); // Revert local state on error
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <h1 className={classes.title}>Settings & Audit Log</h1>
      </div>

      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className={classes.layout}>
        {/* Settings Panel */}
        <div className={classes.card}>
          <h2>System Settings</h2>
          {loadingSettings ? (
            <p>Loading settings...</p>
          ) : settings.length === 0 ? (
            <p className={classes.emptyState}>No settings configured.</p>
          ) : (
            settings.map((setting) => (
              <div key={setting.key} className={classes.settingRow}>
                <div className={classes.settingInfo}>
                  <span className={classes.settingName}>{setting.key.replace(/_/g, ' ')}</span>
                  <span className={classes.settingDesc}>{setting.description}</span>
                </div>
                {setting.key === 'ASSET_FORM_CONFIG' ? (
                  <textarea
                    className={classes.input}
                    style={{ height: '200px', fontFamily: 'monospace', resize: 'vertical' }}
                    value={setting.value}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setSettings(settings.map(s => s.key === setting.key ? { ...s, value: newVal } : s));
                    }}
                    onBlur={(e) => handleUpdateSetting(setting.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={setting.value === 'true' || setting.value === 'false' ? 'text' : 'number'}
                    className={classes.input}
                    value={setting.value}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setSettings(settings.map(s => s.key === setting.key ? { ...s, value: newVal } : s));
                    }}
                    onBlur={(e) => handleUpdateSetting(setting.key, e.target.value)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Audit Log Panel */}
        <div className={classes.card}>
          <h2>Security Audit Ledger (Immutable)</h2>
          <div className={classes.tableContainer}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th>
                    <div className={classes.tableHeaderCell}>
                      <FiClock style={{ color: 'var(--color-primary-action)' }} /> Timestamp <span className={classes.typeIndicator}>timestamp</span>
                    </div>
                  </th>
                  <th>
                    <div className={classes.tableHeaderCell}>
                      <FiActivity /> Action <span className={classes.typeIndicator}>text</span>
                    </div>
                  </th>
                  <th>
                    <div className={classes.tableHeaderCell}>
                      <FiUser /> User <span className={classes.typeIndicator}>uuid</span>
                    </div>
                  </th>
                  <th>
                    <div className={classes.tableHeaderCell}>
                      <FiFileText /> Details <span className={classes.typeIndicator}>jsonb</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingAudit ? (
                  <tr>
                    <td colSpan={4} className={classes.emptyState}>Loading ledger...</td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={classes.emptyState}>No audit logs found.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td><strong>{log.action}</strong></td>
                      <td>{log.user ? `${log.user.employee_id} (${log.user.full_name})` : 'SYSTEM'}</td>
                      <td>
                        <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 300, color: 'var(--color-text-secondary)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontWeight: 400 }}><FiBook style={{ verticalAlign: 'middle', marginRight: '4px' }} /> System Settings & Security Audit Terminology</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
          <div>SYSTEM_MAINTENANCE_MODE: Locks the dashboard for all non-admin users when set to true</div>
          <div>MAX_CAPACITY_THRESHOLD: Sets the threshold (%) for overloaded shop alerts</div>
          <div>OFFLINE_SYNC_INTERVAL: Frequency (in seconds) that field devices sync WatermelonDB data</div>
          <div>Security Audit Ledger: Immutable record of all sensitive actions taken by users</div>
          <div>Action: The specific API endpoint or critical function executed</div>
          <div>Details: JSON payload containing the before/after state of the action</div>
        </div>
      </div>
    </div>
  );
}
