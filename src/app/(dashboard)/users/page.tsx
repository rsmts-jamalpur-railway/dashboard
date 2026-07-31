'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FiBook, FiX, FiEdit2 } from 'react-icons/fi';
import classes from './page.module.css';

interface Role {
  id: number;
  role_name: string;
}

interface User {
  id: string;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  is_active: boolean;
  role: Role;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    password: '',
    department: '',
    designation: '',
    role_id: 2, // default Management / Operator
  });
  const toast = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (err: any) {
      setError('Failed to fetch users. Ensure you are an Administrator.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles');
      if (res.data.success) {
        setRoles(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch roles');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const toggleUserStatus = async (user: User) => {
    if (!confirm(`Are you sure you want to ${user.is_active ? 'revoke' : 'activate'} device access for ${user.full_name}?`)) return;
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      toast.success('Access Updated', `User ${user.full_name} is now ${!user.is_active ? 'active' : 'revoked'}.`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update status', err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/users', formData);
      setIsRegisterOpen(false);
      setFormData({
        employee_id: '', full_name: '', password: '', department: '', designation: '', role_id: 2
      });
      toast.success('User Added', `${formData.full_name} has been added to the system.`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Failed to Add User', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setSaving(true);
      await api.patch(`/users/${editingUser.id}`, {
        full_name: editingUser.full_name,
        department: editingUser.department,
        designation: editingUser.designation,
        role_id: editingUser.role?.id,
      });
      setIsEditOpen(false);
      setEditingUser(null);
      toast.success('User Updated', `${editingUser.full_name} has been updated.`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Failed to Update User', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <h1 className={classes.title}>Users & Devices</h1>
        <div className={classes.actions}>
          <button className={classes.primaryBtn} onClick={() => setIsRegisterOpen(true)}>
            + Add User
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Full Name</th>
              <th>Department</th>
              <th>Role</th>
              <th>Device Access</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={classes.emptyState}>Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className={classes.emptyState}>No users found.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.employee_id}</strong></td>
                  <td>{u.full_name}</td>
                  <td>{u.department}</td>
                  <td>{u.role?.role_name || 'N/A'}</td>
                  <td>
                    <span className={`${classes.statusBadge} ${u.is_active ? classes.statusActive : classes.statusInactive}`}>
                      {u.is_active ? 'ACTIVE' : 'REVOKED'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={classes.actionBtn}
                        onClick={() => {
                          setEditingUser(u);
                          setIsEditOpen(true);
                        }}
                      >
                        <FiEdit2 style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Edit
                      </button>
                      <button 
                        className={classes.actionBtn}
                        onClick={() => toggleUserStatus(u)}
                      >
                        {u.is_active ? 'Revoke Device' : 'Activate Device'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 300, color: 'var(--color-text-secondary)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-secondary)', fontWeight: 400 }}><FiBook style={{ verticalAlign: 'middle', marginRight: '4px' }} /> User Roles & Device Terminology</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
          <div>Admin: Full dashboard access including Security Audit and settings</div>
          <div>Management / Operator: Standard access for shop-floor tracking and reporting</div>
          <div>Viewer: Read-only access to dashboard and analytics</div>
          <div>Active Device: User is currently permitted to log in and sync offline data</div>
          <div>Revoked Device: User's session is terminated and sync is blocked</div>
        </div>
      </div>

      {/* Register User Modal */}
      {isRegisterOpen && (
        <div className={classes.modalOverlay} onClick={() => setIsRegisterOpen(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>Add New User</h3>
              <button className={classes.closeBtn} onClick={() => setIsRegisterOpen(false)}><FiX /></button>
            </div>
            <form className={classes.modalContent} onSubmit={handleRegister}>
              <div className={classes.inputGroup}>
                <label>Employee ID</label>
                <input 
                  type="text" required className={classes.input}
                  value={formData.employee_id}
                  onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Full Name</label>
                <input 
                  type="text" required className={classes.input}
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Password</label>
                <input 
                  type="password" required className={classes.input}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Department</label>
                <input 
                  type="text" required className={classes.input}
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Designation</label>
                <input 
                  type="text" required className={classes.input}
                  value={formData.designation}
                  onChange={(e) => setFormData({...formData, designation: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Role</label>
                <select 
                  className={classes.input}
                  value={formData.role_id}
                  onChange={(e) => setFormData({...formData, role_id: Number(e.target.value)})}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className={classes.saveBtn} disabled={saving}>
                {saving ? 'Adding...' : 'Add User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditOpen && editingUser && (
        <div className={classes.modalOverlay} onClick={() => setIsEditOpen(false)}>
          <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>Edit User: {editingUser.employee_id}</h3>
              <button className={classes.closeBtn} onClick={() => setIsEditOpen(false)}><FiX /></button>
            </div>
            <form className={classes.modalContent} onSubmit={handleEdit}>
              <div className={classes.inputGroup}>
                <label>Employee ID</label>
                <input 
                  type="text"
                  disabled
                  className={classes.input}
                  value={editingUser.employee_id}
                  style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Full Name</label>
                <input 
                  type="text" required className={classes.input}
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Department</label>
                <input 
                  type="text" required className={classes.input}
                  value={editingUser.department}
                  onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Designation</label>
                <input 
                  type="text" required className={classes.input}
                  value={editingUser.designation}
                  onChange={(e) => setEditingUser({...editingUser, designation: e.target.value})}
                />
              </div>
              <div className={classes.inputGroup}>
                <label>Role</label>
                <select 
                  className={classes.input}
                  value={editingUser.role?.id}
                  onChange={(e) => setEditingUser({
                    ...editingUser, 
                    role: { ...editingUser.role, id: Number(e.target.value) }
                  })}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                  ))}
                </select>
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
