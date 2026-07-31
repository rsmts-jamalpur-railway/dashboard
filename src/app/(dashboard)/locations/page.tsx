'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FiBook, FiX, FiEdit2 } from 'react-icons/fi';
import classes from './page.module.css';

interface Location {
  location_id: string;
  max_capacity: number;
  standard_tat_hours: number;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editFormData, setEditFormData] = useState({ max_capacity: 0, standard_tat_hours: 0 });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/locations');
      if (res.data.success) {
        setLocations(res.data.data || []);
      }
    } catch (err: any) {
      setError('Failed to fetch locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleEditClick = (loc: Location) => {
    setEditingLocation(loc);
    setEditFormData({
      max_capacity: loc.max_capacity,
      standard_tat_hours: loc.standard_tat_hours,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    
    try {
      setSaving(true);
      await api.patch(`/locations/${editingLocation.location_id}`, editFormData);
      toast.success('Location Updated', `${editingLocation.location_id} capacity/TAT updated.`);
      setEditingLocation(null);
      fetchLocations();
    } catch (err: any) {
      toast.error('Failed to update location', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <h1 className={classes.title}>Workshop Locations</h1>
      </div>

      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>Location ID</th>
              <th>Max Capacity</th>
              <th>Standard TAT (Hours)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className={classes.emptyState}>Loading locations...</td>
              </tr>
            ) : locations.length === 0 ? (
              <tr>
                <td colSpan={4} className={classes.emptyState}>No locations found.</td>
              </tr>
            ) : (
              locations.filter(loc => loc.location_id !== 'OUT').map((loc) => (
                <tr key={loc.location_id}>
                  <td><strong>{loc.location_id}</strong></td>
                  <td>{loc.max_capacity} wagons</td>
                  <td>{loc.standard_tat_hours} hours</td>
                  <td>
                      <button 
                        className={classes.actionBtn}
                        onClick={() => handleEditClick(loc)}
                      >
                        <FiEdit2 style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Edit Capacity
                      </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 300, color: 'var(--color-text-secondary)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontWeight: 400 }}><FiBook style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Locations Terminology Reference</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
          <div>NSY: New Sick Yard (Initial intake & sorting area)</div>
          <div>WRS (1-5): Wagon Repair Shops (Specific repair lines)</div>
          <div>GIF: Goods Inspection Facility</div>
          <div>Max Capacity: The physical limit of wagons a shop can hold</div>
          <div>Standard TAT (Hours): The expected target Turn-Around Time for a location</div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingLocation && (
        <div className={classes.modalOverlay} onClick={() => setEditingLocation(null)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>Edit {editingLocation.location_id}</h3>
              <button className={classes.closeBtn} onClick={() => setEditingLocation(null)}><FiX /></button>
            </div>
            <form className={classes.modalContent} onSubmit={handleSave}>
              <div className={classes.inputGroup}>
                <label>Max Capacity (Wagons)</label>
                <input 
                  type="number"
                  min="0"
                  className={classes.input}
                  value={editFormData.max_capacity}
                  onChange={(e) => setEditFormData({...editFormData, max_capacity: parseInt(e.target.value) || 0})}
                  required
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Standard Turnaround Time (Hours)</label>
                <input 
                  type="number"
                  min="0"
                  className={classes.input}
                  value={editFormData.standard_tat_hours}
                  onChange={(e) => setEditFormData({...editFormData, standard_tat_hours: parseInt(e.target.value) || 0})}
                  required
                />
              </div>
              <button type="submit" className={classes.saveBtn} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
