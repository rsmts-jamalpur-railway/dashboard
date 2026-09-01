'use client';
import { useEffect, useState, useRef, useCallback, Fragment, useContext } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { AuthContext } from '@/contexts/AuthContext';
import { FiSearch, FiCamera, FiEdit2, FiX, FiBook, FiChevronLeft, FiChevronRight, FiKey, FiType, FiCalendar, FiClock, FiHash, FiDownload, FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
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
  estimated_tat_days: number | null;
  extended_tat_reason: string | null;
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
  asset_category: string;
  loco_type?: string;
  crane_age_tag?: string;
  tc_variant?: string;
  tc_zone?: string;
  is_active: boolean;
  repair_cycles?: RepairCycle[];
  movement_logs?: MovementLog[];
}

export default function AssetsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams.get('search') || '';
  const { user } = useContext(AuthContext);
  const isAdmin = (user?.role as any)?.role_name === 'Administrator' || user?.role === 'Administrator';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [photoModalAsset, setPhotoModalAsset] = useState<string | null>(null);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState(search);

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineAsset, setTimelineAsset] = useState<Asset | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'true' | 'all' | 'false'>('true');

  // Lightbox State
  const [lightboxImages, setLightboxImages] = useState<{ photo_url: string }[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Admin God Mode State
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminActionAsset, setAdminActionAsset] = useState<Asset | null>(null);
  const [adminActionType, setAdminActionType] = useState<string>('');
  const [adminTargetShop, setAdminTargetShop] = useState<string>('WRS-1');
  
  const [formData, setFormData] = useState({
    asset_number: '',
    asset_category: 'WAGON',
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
  const [locations, setLocations] = useState<any[]>([]);
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
    
    if (searchParams.get('modal') === 'new') {
      setIsRegisterOpen(true);
      router.replace('/assets');
    } else if (searchParams.get('focus') === 'search') {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
      router.replace('/assets');
    }
  }, [search, activeFilter, searchParams, router]); // re-fetch / filter if search or activeFilter changes

  const handleSearch = () => {
    router.push(`/assets?search=${searchInput}`);
  };

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
        
        const locRes = await api.get('/locations');
        if (locRes.data.success) {
          setLocations(locRes.data.data.filter((l: any) => !l.is_parking_line));
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

  const handleHardDelete = async (asset_number: string) => {
    if (!confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY DELETE asset ${asset_number}? This action cannot be undone and will destroy all movement history.`)) return;
    try {
      await api.delete(`/assets/${asset_number}?hard=true`);
      toast.success('Asset Permanently Deleted', `Wagon ${asset_number} was completely wiped from the database.`);
      fetchAssets();
    } catch (err) {
      toast.error('Failed to Permanently Delete', err);
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
      setFormData({ asset_number: '', asset_category: 'WAGON', asset_type: formConfig ? formConfig.wagonTypes[0] : 'BOXNHL', origin: 'REPAIR', wagon_sr: '', rly: '', mod: '', built_year: new Date().getFullYear(), action: 'POH', custom_fields: {} });
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
      await api.patch(`/assets/${editingAsset.asset_number}`, { 
        asset_type: editingAsset.asset_type,
        current_status: editingAsset.current_status,
        current_location: editingAsset.current_location,
        wagon_sr: editingAsset.wagon_sr,
        rly: editingAsset.rly,
        mod: editingAsset.mod,
        built_year: editingAsset.built_year,
        action: editingAsset.action
      });
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

      <div className={classes.searchBar}>
        <FiSearch className={classes.searchIcon} />
        <input 
          type="text" 
          ref={searchInputRef}
          placeholder="Search by 11-digit Wagon Number..." 
          className={classes.searchInput}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
        />
        {searchInput && <button onClick={() => {setSearchInput(''); router.push('/assets');}} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><FiX /></button>}
      </div>

      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      {(() => {
        const missingCount = assets.filter(a => a.current_status === 'Missing').length;
        const condemnedCount = assets.filter(a => a.current_status === 'Condemned').length;
        if (missingCount === 0 && condemnedCount === 0) return null;
        return (
          <div style={{ padding: '16px', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiAlertTriangle /> Critical Exceptions Require Admin Attention
              </h3>
              <div style={{ color: '#7f1d1d', fontSize: '0.9rem' }}>
                {missingCount > 0 && <span><strong>{missingCount}</strong> Wagons reported Missing. </span>}
                {condemnedCount > 0 && <span><strong>{condemnedCount}</strong> Wagons flagged for Condemnation (Scrap).</span>}
              </div>
            </div>
            <button 
              onClick={() => setIsAdminModalOpen(true)}
              style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              Resolve Exceptions
            </button>
          </div>
        );
      })()}

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>

              <th>
                <div className={classes.tableHeaderCell}>
                  <FiClock style={{ color: 'var(--color-primary-action)' }} /> NSY In <span className={classes.typeIndicator}>timestamp</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiType /> RS Sr <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiHash style={{ color: 'var(--color-primary-action)' }} /> RS No <span className={classes.typeIndicator}>text</span>
                </div>
              </th>
              <th>
                <div className={classes.tableHeaderCell}>
                  <FiBook style={{ color: 'var(--color-primary-action)' }} /> Category <span className={classes.typeIndicator}>text</span>
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
                  <td>
                    <span style={{ fontWeight: 600 }}>{asset.asset_category}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      {asset.loco_type && <span>{asset.loco_type}</span>}
                      {asset.crane_age_tag && <span>{asset.crane_age_tag}</span>}
                      {asset.tc_variant && <span>{asset.tc_variant} ({asset.tc_zone})</span>}
                    </div>
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
                      {isAdmin && (
                        <button 
                          className={classes.actionBtn}
                          style={{ color: '#ef4444', borderColor: '#ef4444' }}
                          onClick={() => handleHardDelete(asset.asset_number)}
                          title="Permanently Delete (God Mode)"
                        >
                          <FiTrash2 />
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
                  <label>RS Number</label>
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
                  <input 
                    type="text" 
                    className={classes.input} 
                    value={formData.origin} 
                    onChange={(e) => setFormData({...formData, origin: e.target.value})} 
                  />
                </div>
                <div className={classes.inputGroup}>
                  <label>Asset Category</label>
                  <select 
                    className={classes.input}
                    value={formData.asset_category}
                    onChange={(e) => {
                      const newCategory = e.target.value;
                      let newType = 'BOXNHL';
                      if (formConfig) {
                        if (newCategory === 'WAGON') newType = formConfig.wagonTypes[0];
                        if (newCategory === 'LOCO') newType = formConfig.locoTypes[0];
                        if (newCategory === 'CRANE') newType = formConfig.craneTypes[0];
                      }
                      setFormData({...formData, asset_category: newCategory, asset_type: newType});
                    }}
                  >
                    <option value="WAGON">WAGON</option>
                    <option value="LOCO">LOCOMOTIVE</option>
                    <option value="CRANE">CRANE</option>
                    <option value="TOWER_CAR">TOWER CAR</option>
                  </select>
                </div>
                <div className={classes.inputGroup}>
                  <label>Asset Type</label>
                  <select 
                    className={classes.input}
                    value={formData.asset_type}
                    onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                  >
                    {formConfig ? (
                      formData.asset_category === 'WAGON' ? formConfig.wagonTypes.map((t: string) => <option key={t} value={t}>{t}</option>) :
                      formData.asset_category === 'LOCO' ? formConfig.locoTypes.map((t: string) => <option key={t} value={t}>{t}</option>) :
                      formData.asset_category === 'CRANE' ? formConfig.craneTypes.map((t: string) => <option key={t} value={t}>{t}</option>) :
                      <option value="DETC">DETC</option>
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
                    {formConfig ? formConfig.actions.map((act: string) => (
                      <option key={act} value={act}>{act}</option>
                    )) : (
                      <option value="POH">POH</option>
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
                    {formConfig ? (
                      editingAsset.asset_category === 'WAGON' ? formConfig.wagonTypes.map((t: string) => <option key={t} value={t}>{t}</option>) :
                      editingAsset.asset_category === 'LOCO' ? formConfig.locoTypes.map((t: string) => <option key={t} value={t}>{t}</option>) :
                      editingAsset.asset_category === 'CRANE' ? formConfig.craneTypes.map((t: string) => <option key={t} value={t}>{t}</option>) :
                      <option value="DETC">DETC</option>
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
                    value={editingAsset.action} 
                    onChange={(e) => setEditingAsset({...editingAsset, action: e.target.value})}
                  >
                    {formConfig ? formConfig.actions.map((act: string) => (
                      <option key={act} value={act}>{act}</option>
                    )) : (
                      <option value="POH">POH</option>
                    )}
                  </select>
                </div>
                {isAdmin && (
                  <>
                    <div className={classes.inputGroup} style={{ gridColumn: 'span 2' }}>
                      <h4 style={{ color: '#ef4444', marginBottom: '8px', borderBottom: '1px solid #fee2e2', paddingBottom: '4px' }}>🛡️ Admin God Mode (Force Overrides)</h4>
                    </div>
                    <div className={classes.inputGroup}>
                      <label>Force Status Override</label>
                      <input type="text" className={classes.input} value={editingAsset.current_status || ''} onChange={(e) => setEditingAsset({...editingAsset, current_status: e.target.value})} style={{ borderColor: '#ef4444' }} />
                    </div>
                    <div className={classes.inputGroup}>
                      <label>Force Location Override</label>
                      <input type="text" className={classes.input} value={editingAsset.current_location || ''} onChange={(e) => setEditingAsset({...editingAsset, current_location: e.target.value})} style={{ borderColor: '#ef4444' }} />
                    </div>
                  </>
                )}
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
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {cycle.tat_days !== null && (
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', backgroundColor: '#E5E7EB', padding: '4px 12px', borderRadius: '12px' }}>
                                  Actual TAT: {cycle.tat_days} Days
                                </span>
                              )}
                              {cycle.estimated_tat_days !== null && (
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e', backgroundColor: '#fef3c7', padding: '4px 12px', borderRadius: '12px' }}>
                                  Est. TAT: {cycle.estimated_tat_days} Days
                                </span>
                              )}
                            </div>
                            {cycle.extended_tat_reason && (
                              <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '4px', fontStyle: 'italic' }}>
                                Reason: "{cycle.extended_tat_reason}"
                              </div>
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

      {/* Admin God Mode Modal */}
      {isAdminModalOpen && (
        <div className={classes.modalOverlay} onClick={() => setIsAdminModalOpen(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={classes.modalHeader}>
              <h3 style={{ color: '#ef4444' }}><FiAlertTriangle /> Resolve Critical Exceptions</h3>
              <button className={classes.closeBtn} onClick={() => setIsAdminModalOpen(false)}><FiX /></button>
            </div>
            <div className={classes.modalContent}>
              <p>The following assets require manual override by an Administrator.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                {assets.filter(a => ['Missing', 'Condemned', 'Hold'].includes(a.current_status)).map(asset => (
                  <div key={asset.asset_number} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--color-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0' }}>{asset.asset_number}</h4>
                        <span style={{ fontSize: '0.85rem', color: asset.current_status === 'Missing' ? '#ef4444' : '#f59e0b', fontWeight: 600, padding: '4px 8px', backgroundColor: asset.current_status === 'Missing' ? '#fee2e2' : '#fef3c7', borderRadius: '4px' }}>
                          {asset.current_status}
                        </span>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                          Last Known Location: {asset.allocated_shop || asset.current_location || 'Unknown'}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {asset.current_status === 'Missing' && (
                          <>
                            <button 
                              className={classes.primaryBtn} 
                              onClick={() => { setAdminActionAsset(asset); setAdminActionType('Re-route'); }}
                            >
                              Force Re-Route
                            </button>
                            <button 
                              style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                              onClick={() => { setAdminActionAsset(asset); setAdminActionType('Mark Found'); }}
                            >
                              Mark Found (Shop In)
                            </button>
                          </>
                        )}
                        {asset.current_status === 'Condemned' && (
                          <button 
                            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => { setAdminActionAsset(asset); setAdminActionType('Scrap'); }}
                          >
                            Approve Condemnation
                          </button>
                        )}
                        {asset.current_status === 'Hold' && (
                          <button 
                            style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => { setAdminActionAsset(asset); setAdminActionType('Release Hold'); }}
                          >
                            Release Hold
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action form drops down if selected */}
                    {adminActionAsset?.asset_number === asset.asset_number && (
                      <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <h5 style={{ margin: '0 0 12px 0' }}>Action: {adminActionType}</h5>
                        
                        {adminActionType === 'Re-route' && (
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>Select Destination Shop</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {locations.map(loc => (
                                <button 
                                  key={loc.location_id}
                                  onClick={() => setAdminTargetShop(loc.location_id)}
                                  style={{
                                    padding: '8px 16px',
                                    backgroundColor: adminTargetShop === loc.location_id ? '#0f172a' : '#fff',
                                    color: adminTargetShop === loc.location_id ? '#fff' : '#0f172a',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {loc.location_id}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            onClick={async () => {
                              try {
                                setSaving(true);
                                let payload = {
                                  asset_number: asset.asset_number,
                                  new_status: '',
                                  to_location: undefined as string | undefined,
                                  remarks: ''
                                };
                                
                                if (adminActionType === 'Re-route') {
                                  payload.new_status = 'Allocated';
                                  payload.to_location = adminTargetShop;
                                  payload.remarks = 'Admin Force Re-Routed to ' + adminTargetShop;
                                } else if (adminActionType === 'Mark Found') {
                                  payload.new_status = 'Shop In';
                                  payload.remarks = 'Admin Marked Found in Shop';
                                } else if (adminActionType === 'Scrap') {
                                  payload.new_status = 'Scrapped';
                                  payload.to_location = 'Scrapped';
                                  payload.remarks = 'Admin Approved Condemnation (Scrapped)';
                                } else if (adminActionType === 'Release Hold') {
                                  payload.new_status = 'Shop In';
                                  payload.remarks = 'Admin Released Hold';
                                }

                                await api.post('/movement', payload);
                                toast.success('Success', 'Admin action completed for ' + asset.asset_number);
                                setAdminActionAsset(null);
                                fetchAssets(page);
                              } catch (err: any) {
                                toast.error('Action Failed', err);
                              } finally {
                                setSaving(false);
                              }
                            }}
                            disabled={saving}
                          >
                            {saving ? 'Processing...' : 'Confirm Action'}
                          </button>
                          <button 
                            className={classes.actionBtn}
                            onClick={() => setAdminActionAsset(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {assets.filter(a => ['Missing', 'Condemned', 'Hold'].includes(a.current_status)).length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No critical exceptions found. System is healthy.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
