'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FiCheck, FiXCircle, FiTruck, FiAlertCircle } from 'react-icons/fi';
import classes from './page.module.css';

interface Asset {
  id: string;
  asset_number: string;
  asset_category: string;
  current_status: string;
  current_location: string;
  movement_logs?: any[];
}

interface Location {
  location_id: string;
  is_parking_line: boolean;
}

export default function DispatchReviewPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedLines, setSelectedLines] = useState<Record<string, string>>({});
  const toast = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch assets that are ready for dispatch (NSY OUT or Not Dispatched)
      const res = await api.get('/assets?limit=100');
      if (res.data.success) {
        const dispatchable = res.data.data.filter((a: Asset) => 
          a.current_status === 'NSY OUT' || a.current_status === 'Not Dispatched'
        );
        setAssets(dispatchable);
      }

      // Fetch locations for the dropdown
      const locRes = await api.get('/locations');
      if (locRes.data.success) {
        setLocations(locRes.data.data.filter((l: Location) => l.is_parking_line));
      }
    } catch (err: any) {
      toast.error('Failed to load dispatch data', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispatch = async (asset: Asset, isOk: boolean) => {
    if (!isOk && !selectedLines[asset.asset_number]) {
      toast.error('Validation Error', 'You must select a Line No if the asset is NOT OK for dispatch.');
      return;
    }

    try {
      setProcessingId(asset.asset_number);
      const newStatus = isOk ? 'Dispatched' : 'Not Dispatched';
      const toLocation = isOk ? 'OUT' : selectedLines[asset.asset_number];

      await api.post('/movement', {
        asset_number: asset.asset_number,
        new_status: newStatus,
        to_location: toLocation,
        remarks: isOk ? 'OK - Cleared by TPT Rail' : 'NOT OK - Held by TPT Rail'
      });

      toast.success(
        isOk ? 'Dispatched Successfully' : 'Asset Held', 
        `Wagon ${asset.asset_number} was marked as ${newStatus}`
      );
      
      fetchData(); // Refresh list
    } catch (err: any) {
      toast.error('Dispatch Failed', err.response?.data?.message || err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <h1 className={classes.title}><FiTruck style={{ marginRight: '8px', verticalAlign: 'middle' }} /> TPT Rail Final Dispatch Review</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Review assets marked as 'NSY OUT' and approve them for final dispatch.</p>
      </div>

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>RS NO (Rolling Stock No)</th>
              <th>Remarks by Concerned Shop</th>
              <th>Remarks by TPT Rail</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className={classes.emptyState}>Loading assets...</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan={5} className={classes.emptyState}>No assets pending dispatch review.</td></tr>
            ) : (
              assets.map((asset) => {
                const isHeld = asset.current_status === 'Not Dispatched';
                const isProcessing = processingId === asset.asset_number;

                return (
                  <tr key={asset.asset_number} style={{ backgroundColor: isHeld ? '#FEF2F2' : 'inherit' }}>
                    <td>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{asset.asset_number}</div>
                      <span className={classes.badge}>{asset.asset_category || 'WAGON'}</span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                      Marked Fit and transferred to Yard.
                    </td>
                    <td>
                      {!isHeld && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <select 
                            className={classes.select}
                            value={selectedLines[asset.asset_number] || ''}
                            onChange={(e) => setSelectedLines({ ...selectedLines, [asset.asset_number]: e.target.value })}
                          >
                            <option value="">Select Line No (If NOT OK)...</option>
                            {locations.map(loc => (
                              <option key={loc.location_id} value={loc.location_id}>{loc.location_id}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {isHeld && (
                        <div style={{ color: '#DC2626', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FiAlertCircle /> Held at: {asset.current_location}
                        </div>
                      )}
                    </td>
                    <td>
                      {isHeld ? (
                        <span className={classes.statusRed}>🔴 Not Dispatched</span>
                      ) : (
                        <span className={classes.statusPending}>🟡 Pending Review</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className={classes.btnGreen} 
                          onClick={() => handleDispatch(asset, true)}
                          disabled={isProcessing}
                        >
                          <FiCheck /> OK (Dispatch)
                        </button>
                        {!isHeld && (
                          <button 
                            className={classes.btnRed} 
                            onClick={() => handleDispatch(asset, false)}
                            disabled={isProcessing || !selectedLines[asset.asset_number]}
                          >
                            <FiXCircle /> NOT OK
                          </button>
                        )}
                      </div>
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
