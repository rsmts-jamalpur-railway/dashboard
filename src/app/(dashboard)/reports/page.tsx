'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { FiBook } from 'react-icons/fi';
import classes from './page.module.css';

interface Handler {
  full_name: string;
}

interface MovementLog {
  log_id: number;
  asset_number: string;
  from_location: string | null;
  to_location: string;
  previous_status: string | null;
  new_status: string;
  timestamp: string;
  remarks: string | null;
  handler: Handler;
}

export default function ReportsPage() {
  const [logs, setLogs] = useState<MovementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      let url = '/reports/movements-data';
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      
      const res = await api.get(url);
      if (res.data.success) {
        setLogs(res.data.data || []);
      }
    } catch (err: any) {
      setError('Failed to fetch movement logs. Ensure you have the right permissions.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCSV = async () => {
    try {
      let url = '/reports/movements';
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `movement_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export CSV report.');
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <h1 className={classes.title}>Movement Reports</h1>
        <div className={classes.actions}>
          <button className={classes.primaryBtn} onClick={handleExportCSV}>
            📥 Export CSV
          </button>
          <button className={classes.primaryBtn} onClick={() => alert('PDF Export coming soon')}>
            📄 Export PDF
          </button>
        </div>
      </div>

      <div className={classes.filters}>
        <div className={classes.filterGroup}>
          <label>Start Date</label>
          <input 
            type="date" 
            className={classes.filterInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className={classes.filterGroup}>
          <label>End Date</label>
          <input 
            type="date" 
            className={classes.filterInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className={classes.filterGroup} style={{ marginTop: '16px' }}>
          <button 
            className={classes.primaryBtn}
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            style={{ backgroundColor: 'white', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Wagon No.</th>
              <th>Transition</th>
              <th>Status Update</th>
              <th>Handled By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className={classes.emptyState}>Loading reports...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className={classes.emptyState}>No movement logs found for the selected criteria.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.log_id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td><strong>{log.asset_number}</strong></td>
                  <td>
                    {log.from_location || 'N/A'} ➔ {log.to_location}
                  </td>
                  <td>
                    {log.previous_status || 'N/A'} ➔ <strong>{log.new_status}</strong>
                  </td>
                  <td>{log.handler.full_name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 300, color: 'var(--color-text-secondary)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontWeight: 400 }}><FiBook style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Movement Report Terminology</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
          <div>Transition: Movement from one physical location to another</div>
          <div>Status Update: Progression of the asset lifecycle</div>
          <div>NSY: New Sick Yard (Entry triage point)</div>
          <div>WRS: Wagon Repair Shop (Repair shed)</div>
          <div>Workshop In: Asset successfully registered to facility</div>
          <div>Shop In: Asset moved into a dedicated repair shed</div>
          <div>Fit / Not Fit: Asset passed or failed quality inspection</div>
          <div>Workshop Out: Asset physically dispatched back to main line</div>
        </div>
      </div>
    </div>
  );
}
