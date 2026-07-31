'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FiSearch, FiCamera, FiEdit2, FiX, FiBook } from 'react-icons/fi';
import classes from './page.module.css';

interface MovementLog {
  log_id: string;
  from_location: string | null;
  to_location: string;
  previous_status: string | null;
  new_status: string;
  timestamp: string;
  remarks: string | null;
  handler: { full_name: string };
}

interface Asset {
  id: string;
  asset_number: string;
  asset_type: string;
  current_location: string | null;
  current_status: string;
  origin?: string;
  allocated_shop?: string | null;
  is_active?: boolean;
  movement_logs?: MovementLog[];
}

export default function AssetsPage() {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [photoModalAsset, setPhotoModalAsset] = useState<string | null>(null);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [timelineAsset, setTimelineAsset] = useState<Asset | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    asset_number: '',
    asset_type: 'BOXN',
    origin: 'NEW_MFG'
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchAssets = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const limit = 20;
      let url = `/assets?page=${pageNum}&limit=${limit}`;
      
      const res = await api.get(url);
      if (res.data.success) {
        let fetchedAssets = res.data.data || [];
        
        // The backend filters are better, but we do client-side filter here if needed
        if (search) {
          fetchedAssets = fetchedAssets.filter((a: Asset) => 
            a.asset_number.toLowerCase().includes(search.toLowerCase())
          );
        }

        if (pageNum === 1) {
          setAssets(fetchedAssets);
        } else {
          setAssets(prev => [...prev, ...fetchedAssets]);
        }

        const meta = res.data.meta;
        if (meta) {
          setHasMore(pageNum < meta.last_page);
        } else {
          setHasMore(fetchedAssets.length === limit);
        }
      }
    } catch (err: any) {
      setError('Failed to fetch assets.');
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchAssets(1);
  }, [search]); // re-fetch / filter if search changes

  // Infinite Scroll Observer
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLTableRowElement) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    if (page > 1) {
      fetchAssets(page);
    }
  }, [page]);

  const handleDelete = async (asset_number: string) => {
    if (!confirm(`Are you sure you want to deactivate asset ${asset_number}?`)) return;
    try {
      await api.delete(`/assets/${asset_number}`);
      toast.success('Asset Deactivated', `Wagon ${asset_number} was successfully removed.`);
      fetchAssets();
    } catch (err) {
      toast.error('Failed to Deactivate', err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/assets', formData);
      setIsRegisterOpen(false);
      setFormData({ asset_number: '', asset_type: 'BOXN', origin: 'NEW_MFG' });
      toast.success('Asset Registered', `Wagon ${formData.asset_number} has been added.`);
      fetchAssets();
    } catch (err: any) {
      toast.error('Registration Failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    try {
      setSaving(true);
      await api.patch(`/assets/${editingAsset.asset_number}`, { asset_type: editingAsset.asset_type });
      setIsEditOpen(false);
      setEditingAsset(null);
      toast.success('Asset Updated', `Wagon ${editingAsset.asset_number} has been updated.`);
      fetchAssets();
    } catch (err: any) {
      toast.error('Update Failed', err);
    } finally {
      setSaving(false);
    }
  };

  const openTimeline = async (asset_number: string) => {
    setIsTimelineOpen(true);
    setTimelineLoading(true);
    setTimelineAsset(null);
    try {
      const res = await api.get(`/assets/${asset_number}`);
      if (res.data.success) {
        setTimelineAsset(res.data.data);
      }
    } catch (err: any) {
      toast.error('Failed to load asset timeline', err);
      setIsTimelineOpen(false);
    } finally {
      setTimelineLoading(false);
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <h1 className={classes.title}>Assets Master {search && `(Search: ${search})`}</h1>
        <div className={classes.actions}>
          <button className={classes.primaryBtn} onClick={() => setIsRegisterOpen(true)}>
            + Register Asset
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>Wagon No.</th>
              <th>Type</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className={classes.emptyState}>Loading assets...</td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={5} className={classes.emptyState}>No assets found.</td>
              </tr>
            ) : (
              assets.map((asset, index) => {
                const isLast = index === assets.length - 1;
                return (
                  <tr key={asset.asset_number} ref={isLast ? lastElementRef : null}>
                  <td><strong>{asset.asset_number}</strong></td>
                  <td>{asset.asset_type}</td>
                  <td>{asset.current_location || 'Transit'}</td>
                  <td>
                    <span className={classes.statusBadge}>
                      {asset.current_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={classes.actionBtn}
                        onClick={() => openTimeline(asset.asset_number)}
                        title="View Timeline"
                      >
                        <FiSearch style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Timeline
                      </button>
                      <button 
                        className={classes.actionBtn}
                        onClick={() => setPhotoModalAsset(asset.asset_number)}
                      >
                        <FiCamera style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Photos
                      </button>
                      <button 
                        className={classes.actionBtn}
                        onClick={() => {
                          setEditingAsset(asset);
                          setIsEditOpen(true);
                        }}
                      >
                        <FiEdit2 style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Edit
                      </button>
                      <button 
                        className={classes.actionBtn}
                        onClick={() => handleDelete(asset.asset_number)}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
            {loadingMore && (
              <tr>
                <td colSpan={5} className={classes.emptyState}>Loading more assets...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 300, color: 'var(--color-text-secondary)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontWeight: 400 }}><FiBook style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Assets Master Terminology & Guides</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px' }}>
          <div>Wagon No: Must be a standard 11-digit IR identification number</div>
          <div>Location: The current physical shop or yard the asset resides in</div>
          <div>Status: The current lifecycle phase of the asset's repair process</div>
          <div>BOXN / BCN / BTPN: Standard classifications for open, covered, or tank wagons</div>
          <div>Workshop In / Out: Asset has officially entered or left the facility</div>
          <div>Shop In: Asset is actively undergoing repairs in a shed</div>
          <div>Fit / Not Fit: Asset passed or failed the final quality inspection</div>
          <div><FiSearch style={{ verticalAlign: 'middle' }} /> Timeline: View the complete movement history of the asset</div>
          <div><FiCamera style={{ verticalAlign: 'middle' }} /> Photos: View physical inspection evidence uploaded by field operators</div>
          <div><FiEdit2 style={{ verticalAlign: 'middle' }} /> Edit / Deactivate: Modify asset type or permanently remove from tracking</div>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      {photoModalAsset && (
        <div className={classes.modalOverlay} onClick={() => setPhotoModalAsset(null)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>Physical Inspection Photos: {photoModalAsset}</h3>
              <button className={classes.closeBtn} onClick={() => setPhotoModalAsset(null)}><FiX /></button>
            </div>
            <div className={classes.modalContent}>
              <div className={classes.photoPlaceholder}>
                <p>No photos uploaded from the shop floor yet.</p>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                Photos synced via WatermelonDB offline sync will appear here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Register Asset Modal */}
      {isRegisterOpen && (
        <div className={classes.modalOverlay} onClick={() => setIsRegisterOpen(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className={classes.modalHeader}>
              <h3>Register New Asset</h3>
              <button className={classes.closeBtn} onClick={() => setIsRegisterOpen(false)}><FiX /></button>
            </div>
            <form className={classes.modalContent} onSubmit={handleRegister}>
              <div className={classes.inputGroup}>
                <label>Wagon Number (11-digit)</label>
                <input 
                  type="text"
                  required
                  className={classes.input}
                  value={formData.asset_number}
                  onChange={(e) => setFormData({...formData, asset_number: e.target.value})}
                  placeholder="e.g. 12345678901"
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Asset Type</label>
                <select 
                  className={classes.input}
                  value={formData.asset_type}
                  onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                >
                  <option value="BOXN">BOXN</option>
                  <option value="BCNA">BCNA</option>
                  <option value="BTPN">BTPN</option>
                  <option value="BOBRN">BOBRN</option>
                </select>
              </div>
              <div className={classes.inputGroup}>
                <label>Origin</label>
                <select 
                  className={classes.input}
                  value={formData.origin}
                  onChange={(e) => setFormData({...formData, origin: e.target.value})}
                >
                  <option value="NEW_MFG">New Manufacturing (GIF)</option>
                  <option value="REPAIR">Repair (NSY)</option>
                </select>
              </div>
              <button type="submit" className={classes.saveBtn} disabled={saving}>
                {saving ? 'Registering...' : 'Register Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {isEditOpen && editingAsset && (
        <div className={classes.modalOverlay} onClick={() => setIsEditOpen(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className={classes.modalHeader}>
              <h3>Edit Asset: {editingAsset.asset_number}</h3>
              <button className={classes.closeBtn} onClick={() => setIsEditOpen(false)}><FiX /></button>
            </div>
            <form className={classes.modalContent} onSubmit={handleEdit}>
              <div className={classes.inputGroup}>
                <label>Wagon Number</label>
                <input 
                  type="text"
                  disabled
                  className={classes.input}
                  value={editingAsset.asset_number}
                  style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Asset Type</label>
                <select 
                  className={classes.input}
                  value={editingAsset.asset_type}
                  onChange={(e) => setEditingAsset({...editingAsset, asset_type: e.target.value})}
                >
                  <option value="BOXN">BOXN</option>
                  <option value="BCNA">BCNA</option>
                  <option value="BTPN">BTPN</option>
                  <option value="BOBRN">BOBRN</option>
                </select>
              </div>
              <button type="submit" className={classes.saveBtn} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {isTimelineOpen && (
        <div className={classes.modalOverlay} onClick={() => setIsTimelineOpen(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={classes.modalHeader}>
              <h3>Asset Timeline</h3>
              <button className={classes.closeBtn} onClick={() => setIsTimelineOpen(false)}><FiX /></button>
            </div>
            <div className={classes.modalContent}>
              {timelineLoading ? (
                <div className={classes.emptyState}>Loading timeline data...</div>
              ) : !timelineAsset ? (
                <div className={classes.emptyState}>Failed to load timeline.</div>
              ) : (
                <>
                  <div style={{ padding: '16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>{timelineAsset.asset_number}</div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                      <span><strong>Type:</strong> {timelineAsset.asset_type}</span>
                      <span><strong>Origin:</strong> {timelineAsset.origin}</span>
                      <span><strong>Status:</strong> {timelineAsset.current_status}</span>
                    </div>
                  </div>

                  <div className={classes.timelineContainer}>
                    {!timelineAsset.movement_logs || timelineAsset.movement_logs.length === 0 ? (
                      <div className={classes.emptyState} style={{ padding: 0 }}>No movement history found.</div>
                    ) : (
                      timelineAsset.movement_logs.map((log) => (
                        <div key={log.log_id} className={classes.timelineNode}>
                          <div className={classes.timelineDot} />
                          <div className={classes.timelineHeader}>
                            <span className={classes.timelineTitle}>
                              {log.new_status}
                            </span>
                            <span className={classes.timelineTime}>
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className={classes.timelineSubtitle}>
                            {log.from_location ? `${log.from_location} ➔ ` : 'Arrived at '}{log.to_location}
                          </div>
                          
                          <div className={classes.timelineSubtitle}>
                            Handled by: <strong>{log.handler?.full_name || 'System'}</strong>
                          </div>

                          {log.remarks && (
                            <div className={classes.timelineRemarks}>
                              {log.remarks}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
