'use client';
import { useEffect, useState, useRef, useCallback, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FiSearch, FiCamera, FiEdit2, FiX, FiBook, FiChevronLeft, FiChevronRight, FiKey, FiType, FiCalendar, FiClock, FiHash, FiDownload } from 'react-icons/fi';
import Papa from 'papaparse';
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
  photos?: { photo_url: string }[];
}

interface RepairCycle {
  id: string;
  cycle_number: number;
  nsy_in_date: string | null;
  nsy_out_date: string | null;
  tat_days: number | null;
  movement_logs: MovementLog[];
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
  nsy_in_date?: string;
  shop_in_date?: string;
  fit_date?: string;
  nsy_out_date?: string;
  current_location: string | null;
  current_status: string;
  origin?: string;
  allocated_shop?: string | null;
  custom_fields?: any;
  is_active?: boolean;
  repair_cycles?: RepairCycle[];
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
  const [activeFilter, setActiveFilter] = useState<'true' | 'all' | 'false'>('true');

  // Lightbox State
  const [lightboxImages, setLightboxImages] = useState<{ photo_url: string }[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const [formData, setFormData] = useState({
    asset_number: '',
    asset_type: 'BOXNHL',
    origin: 'REPAIR',
    wagon_sr: '',
    rly: '',
    mod: '',
    built_year: new Date().getFullYear(),
    action: 'POH',
    custom_fields: {} as any
  });
  const [formConfig, setFormConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchAssets = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const limit = 20;
      let url = `/assets?page=${pageNum}&limit=${limit}&active=${activeFilter}`;
      
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
  }, [search, activeFilter]); // re-fetch / filter if search or activeFilter changes

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data.success) {
          const configSetting = res.data.data.find((s: any) => s.key === 'ASSET_FORM_CONFIG');
          if (configSetting && configSetting.value) {
            setFormConfig(JSON.parse(configSetting.value));
          }
        }
      } catch (err) {
        console.error('Failed to fetch ASSET_FORM_CONFIG', err);
      }
    };
    fetchConfig();
  }, []);

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

  const handleReactivate = async (asset_number: string) => {
    if (!confirm(`Are you sure you want to reactivate asset ${asset_number}?`)) return;
    try {
      await api.patch(`/assets/${asset_number}`, { is_active: true });
      toast.success('Asset Reactivated', `Wagon ${asset_number} is now active again.`);
      fetchAssets();
    } catch (err) {
      toast.error('Failed to Reactivate', err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/assets', formData);
      setIsRegisterOpen(false);
      setFormData({ asset_number: '', asset_type: formConfig ? formConfig.origins['REPAIR']?.assetTypes[0] || 'BOXNHL' : 'BOXNHL', origin: 'REPAIR', wagon_sr: '', rly: '', mod: '', built_year: new Date().getFullYear(), action: 'POH', custom_fields: {} });
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

  const exportToCSV = () => {
    const csvData = assets.map(a => {
      const base = {
        'Asset Number': a.asset_number,
        'Type': a.asset_type,
        'Origin': a.origin,
        'Current Status': a.current_status,
        'Active': a.is_active ? 'Yes' : 'No'
      };
      
      // Inject custom fields
      if (formConfig && formConfig.customFields) {
        formConfig.customFields.forEach((cf: any) => {
          (base as any)[cf.label] = a.custom_fields && a.custom_fields[cf.key] ? a.custom_fields[cf.key] : '';
        });
      }
      
      return base;
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'assets_master_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
            <button 
              onClick={() => setActiveFilter('true')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeFilter === 'true' ? 'var(--color-primary-action)' : 'transparent',
                color: activeFilter === 'true' ? 'white' : 'var(--color-text-primary)',
                cursor: 'pointer',
                fontWeight: activeFilter === 'true' ? 600 : 400
              }}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderLeft: '1px solid var(--color-border)',
                borderRight: '1px solid var(--color-border)',
                background: activeFilter === 'all' ? 'var(--color-primary-action)' : 'transparent',
                color: activeFilter === 'all' ? 'white' : 'var(--color-text-primary)',
                cursor: 'pointer',
                fontWeight: activeFilter === 'all' ? 600 : 400
              }}
            >
              All
            </button>
            <button 
              onClick={() => setActiveFilter('false')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeFilter === 'false' ? 'var(--color-primary-action)' : 'transparent',
                color: activeFilter === 'false' ? 'white' : 'var(--color-text-primary)',
                cursor: 'pointer',
                fontWeight: activeFilter === 'false' ? 600 : 400
              }}
            >
              Inactive
            </button>
          </div>

          <button className={classes.actionBtn} onClick={exportToCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiDownload /> Export CSV
          </button>
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

              <th>
                <div className={classes.tableHeaderCell}>
                  <FiClock /> NSY IN <span className={classes.typeIndicator}>timestamp</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiType /> Wagon Sr. <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiKey style={{ color: 'var(--color-primary-action)' }} /> Wagon No. <span className={classes.typeIndicator}>varchar</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiType /> Rly <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiType style={{ color: 'var(--color-primary-action)' }} /> Type <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiType /> Mod <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiCalendar /> Built <span className={classes.typeIndicator}>int4</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiHash /> Age <span className={classes.typeIndicator}>int4</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiType /> Action <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiType /> Shop <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiClock /> Shop In <span className={classes.typeIndicator}>timestamp</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiClock /> Fit <span className={classes.typeIndicator}>timestamp</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiClock /> NSY Out <span className={classes.typeIndicator}>timestamp</span>
                </div>
              </th>
              {formConfig && formConfig.customFields && formConfig.customFields.map((field: any) => (
                <th key={field.key}>
                  <div className={classes.tableHeaderCell}>
                    <FiType /> {field.label} <span className={classes.typeIndicator}>{field.type}</span>
                  </div>
                </th>
              ))}
              <th>
                <div className={classes.tableHeaderCell}>
                  Actions
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14 + (formConfig?.customFields?.length || 0)} className={classes.emptyState}>Loading assets...</td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={14 + (formConfig?.customFields?.length || 0)} className={classes.emptyState}>No assets found.</td>
              </tr>
            ) : (
              assets.map((asset, index) => {
                const isLast = index === assets.length - 1;
                const age = asset.built_year ? new Date().getFullYear() - asset.built_year : '-';
                
                const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB') : '-';

                return (
                  <tr 
                    key={asset.asset_number} 
                    ref={isLast ? lastElementRef : null}
                    style={asset.is_active === false ? { backgroundColor: '#f9fafb', color: '#9ca3af', textDecoration: 'line-through' } : {}}
                  >
                  <td>{formatDate(asset.nsy_in_date)}</td>
                  <td>{asset.wagon_sr || '-'}</td>
                  <td>
                    <strong>{asset.asset_number}</strong>
                    {asset.is_active === false && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#ef4444', textDecoration: 'none' }}>(Inactive)</span>}
                  </td>
                  <td>{asset.rly || '-'}</td>
                  <td>{asset.asset_type}</td>
                  <td>{asset.mod || '-'}</td>
                  <td>{asset.built_year || '-'}</td>
                  <td>{age}</td>
                  <td>{asset.action || '-'}</td>
                  <td>{asset.current_location || '-'}</td>
                  <td>{formatDate(asset.shop_in_date)}</td>
                  <td>{formatDate(asset.fit_date)}</td>
                  <td>{formatDate(asset.nsy_out_date)}</td>
                  {formConfig && formConfig.customFields && formConfig.customFields.map((field: any) => (
                    <td key={field.key}>{asset.custom_fields ? asset.custom_fields[field.key] || '-' : '-'}</td>
                  ))}
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
                        onClick={() => {
                          setEditingAsset(asset);
                          setIsEditOpen(true);
                        }}
                      >
                        <FiEdit2 style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Edit
                      </button>
                      {asset.is_active !== false ? (
                        <button 
                          className={classes.actionBtn}
                          onClick={() => handleDelete(asset.asset_number)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button 
                          className={classes.actionBtn}
                          style={{ color: '#059669', borderColor: '#059669' }}
                          onClick={() => handleReactivate(asset.asset_number)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
            {loadingMore && (
              <tr>
                <td colSpan={14 + (formConfig?.customFields?.length || 0)} className={classes.emptyState}>Loading more assets...</td>
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
          <div className={classes.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={classes.modalHeader}>
              <h3>Register New Asset</h3>
              <button className={classes.closeBtn} onClick={() => setIsRegisterOpen(false)}><FiX /></button>
            </div>
            <form className={classes.modalContent} onSubmit={handleRegister}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                  <label>Origin</label>
                  <select 
                    className={classes.input}
                    value={formData.origin}
                    onChange={(e) => {
                      const newOrigin = e.target.value;
                      const newAssetType = formConfig ? formConfig.origins[newOrigin]?.assetTypes[0] || '' : 'BOXNHL';
                      setFormData({...formData, origin: newOrigin, asset_type: newAssetType});
                    }}
                  >
                    {formConfig ? Object.keys(formConfig.origins).map(key => (
                      <option key={key} value={key}>{formConfig.origins[key].label}</option>
                    )) : (
                      <option value="REPAIR">Repair (NSY)</option>
                    )}
                  </select>
                </div>
                <div className={classes.inputGroup}>
                  <label>Asset Type</label>
                  <select 
                    className={classes.input}
                    value={formData.asset_type}
                    onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                  >
                    {formConfig && formConfig.origins[formData.origin]?.assetTypes ? (
                      formConfig.origins[formData.origin].assetTypes.map((type: string) => (
                        <option key={type} value={type}>{type}</option>
                      ))
                    ) : (
                      <option value="BOXNHL">BOXNHL</option>
                    )}
                  </select>
                </div>
                <div className={classes.inputGroup}>
                  <label>Wagon Sr. (Sl No.)</label>
                  <input type="text" className={classes.input} value={formData.wagon_sr} onChange={(e) => setFormData({...formData, wagon_sr: e.target.value})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Railway Zone (Rly)</label>
                  <input type="text" className={classes.input} value={formData.rly} onChange={(e) => setFormData({...formData, rly: e.target.value})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Modification (Mod)</label>
                  <input type="text" className={classes.input} value={formData.mod} onChange={(e) => setFormData({...formData, mod: e.target.value})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Built Year</label>
                  <input type="number" className={classes.input} value={formData.built_year} onChange={(e) => setFormData({...formData, built_year: parseInt(e.target.value)})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Action</label>
                  <select 
                    className={classes.input} 
                    value={formData.action} 
                    onChange={(e) => setFormData({...formData, action: e.target.value})}
                  >
                    {formConfig ? formConfig.actions.map((act: any) => (
                      <option key={act.value} value={act.value}>{act.label}</option>
                    )) : (
                      <option value="POH">POH (Periodic Overhaul)</option>
                    )}
                  </select>
                </div>
                {formConfig && formConfig.customFields && formConfig.customFields.map((field: any) => (
                  <div className={classes.inputGroup} key={field.key}>
                    <label>{field.label}</label>
                    <input 
                      type={field.type === 'number' ? 'number' : 'text'} 
                      className={classes.input} 
                      value={formData.custom_fields[field.key] || ''} 
                      onChange={(e) => setFormData({
                        ...formData, 
                        custom_fields: { ...formData.custom_fields, [field.key]: e.target.value }
                      })} 
                    />
                  </div>
                ))}
              </div>
              <button type="submit" className={classes.saveBtn} disabled={saving} style={{ marginTop: '16px' }}>
                {saving ? 'Registering...' : 'Register Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {isEditOpen && editingAsset && (
        <div className={classes.modalOverlay} onClick={() => setIsEditOpen(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={classes.modalHeader}>
              <h3>Edit Asset: {editingAsset.asset_number}</h3>
              <button className={classes.closeBtn} onClick={() => setIsEditOpen(false)}><FiX /></button>
            </div>
            <form className={classes.modalContent} onSubmit={handleEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    {formConfig && formConfig.origins[editingAsset.origin || 'REPAIR']?.assetTypes ? (
                      formConfig.origins[editingAsset.origin || 'REPAIR'].assetTypes.map((type: string) => (
                        <option key={type} value={type}>{type}</option>
                      ))
                    ) : (
                      <option value={editingAsset.asset_type}>{editingAsset.asset_type}</option>
                    )}
                  </select>
                </div>
                <div className={classes.inputGroup}>
                  <label>Wagon Sr. (Sl No.)</label>
                  <input type="text" className={classes.input} value={editingAsset.wagon_sr || ''} onChange={(e) => setEditingAsset({...editingAsset, wagon_sr: e.target.value})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Railway Zone (Rly)</label>
                  <input type="text" className={classes.input} value={editingAsset.rly || ''} onChange={(e) => setEditingAsset({...editingAsset, rly: e.target.value})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Modification (Mod)</label>
                  <input type="text" className={classes.input} value={editingAsset.mod || ''} onChange={(e) => setEditingAsset({...editingAsset, mod: e.target.value})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Built Year</label>
                  <input type="number" className={classes.input} value={editingAsset.built_year || ''} onChange={(e) => setEditingAsset({...editingAsset, built_year: parseInt(e.target.value)})} />
                </div>
                <div className={classes.inputGroup}>
                  <label>Action</label>
                  <select 
                    className={classes.input} 
                    value={editingAsset.action || 'POH'} 
                    onChange={(e) => setEditingAsset({...editingAsset, action: e.target.value})}
                  >
                    {formConfig ? formConfig.actions.map((act: any) => (
                      <option key={act.value} value={act.value}>{act.label}</option>
                    )) : (
                      <option value="POH">POH (Periodic Overhaul)</option>
                    )}
                  </select>
                </div>
                {formConfig && formConfig.customFields && formConfig.customFields.map((field: any) => {
                  const cf = editingAsset.custom_fields || {};
                  return (
                    <div className={classes.inputGroup} key={field.key}>
                      <label>{field.label}</label>
                      <input 
                        type={field.type === 'number' ? 'number' : 'text'} 
                        className={classes.input} 
                        value={cf[field.key] || ''} 
                        onChange={(e) => setEditingAsset({
                          ...editingAsset, 
                          custom_fields: { ...cf, [field.key]: e.target.value }
                        })} 
                      />
                    </div>
                  );
                })}
              </div>
              <button type="submit" className={classes.saveBtn} disabled={saving} style={{ marginTop: '16px' }}>
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
                    {(!timelineAsset.repair_cycles || timelineAsset.repair_cycles.length === 0) ? (
                      <div className={classes.emptyState} style={{ padding: 0 }}>No repair cycles found.</div>
                    ) : (
                      timelineAsset.repair_cycles.map((cycle) => (
                        <Fragment key={cycle.id}>
                          <div className={classes.timelineCycleHeader}>
                            <div className={classes.timelineCycleDot} />
                            <h4 style={{ margin: 0, color: 'var(--color-primary-action)' }}>Repair Visit #{cycle.cycle_number}</h4>
                            {cycle.tat_days !== null && (
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', backgroundColor: '#E5E7EB', padding: '4px 12px', borderRadius: '12px' }}>
                                TAT: {cycle.tat_days} Days
                              </span>
                            )}
                          </div>
                          
                          {(!cycle.movement_logs || cycle.movement_logs.length === 0) ? (
                            <div className={classes.emptyState} style={{ padding: '8px 0', fontSize: '0.85rem' }}>No movement logs for this cycle.</div>
                          ) : (
                            cycle.movement_logs.map((log) => (
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
                                  {log.from_location && log.from_location !== log.to_location 
                                    ? `${log.from_location} ➔ ${log.to_location}` 
                                    : `Location: ${log.to_location}`}
                                </div>
                                
                                <div className={classes.timelineSubtitle}>
                                  Handled by: <strong>{log.handler?.full_name || 'System'}</strong>
                                </div>

                                {log.remarks && (
                                  <div className={classes.timelineRemarks}>
                                    "{log.remarks}"
                                  </div>
                                )}

                                {log.photos && log.photos.length > 0 && (
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                    {log.photos.map((p, idx) => (
                                      <img 
                                        key={idx} 
                                        src={p.photo_url} 
                                        alt="Proof" 
                                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)', cursor: 'pointer' }} 
                                        onClick={() => {
                                          setLightboxImages(log.photos || null);
                                          setLightboxIndex(idx);
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </Fragment>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImages && (
        <div className={classes.modalOverlay} style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.9)' }} onClick={() => setLightboxImages(null)}>
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setLightboxImages(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer' }}
            ><FiX /></button>
            
            {lightboxImages.length > 1 && (
              <button 
                onClick={() => setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxImages.length - 1))}
                style={{ position: 'absolute', left: '24px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '32px', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              ><FiChevronLeft /></button>
            )}

            <img 
              src={lightboxImages[lightboxIndex].photo_url} 
              alt="Fullscreen Proof" 
              style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px' }} 
            />

            {lightboxImages.length > 1 && (
              <button 
                onClick={() => setLightboxIndex((prev) => (prev < lightboxImages.length - 1 ? prev + 1 : 0))}
                style={{ position: 'absolute', right: '24px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '32px', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              ><FiChevronRight /></button>
            )}

            <div style={{ position: 'absolute', bottom: '24px', color: '#fff', fontSize: '16px', background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '16px' }}>
              {lightboxIndex + 1} / {lightboxImages.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
