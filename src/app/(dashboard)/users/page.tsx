'use client';
import { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { 
  FiUsers, FiUserPlus, FiTrash2, FiEdit2, FiSearch, 
  FiCheckCircle, FiAlertCircle, FiX, FiKey, FiLock, FiMapPin, 
  FiShield, FiRefreshCw, FiEye, FiEyeOff 
} from 'react-icons/fi';

interface RoleItem {
  id: string;
  role_name: string;
  name: string;
  description?: string;
  is_system_role?: boolean;
}

interface UserItem {
  id: string;
  employee_id: string;
  employee_uuid: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string | null;
  status: string;
  is_active: boolean;
  role: {
    id: string;
    role_name: string;
    description?: string;
  };
  roles: string[];
  assigned_location_id?: string | null;
  assigned_location?: {
    location_id: string;
    location_type: string;
    zone?: string;
  } | null;
  department?: string;
  designation?: string;
  last_login_at?: string | null;
  createdAt: string;
}

interface LocationOption {
  location_id: string;
  zone?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserItem | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role_name: 'REPAIR_SUPERVISOR',
    assigned_location_id: '',
    department: 'Mechanical (Carriage & Wagon)',
    designation: 'Senior Section Engineer (SSE)',
    status: 'ACTIVE',
  });

  const toast = useToast();

  const fetchUsersAndRoles = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [usersRes, rolesRes, locsRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/roles').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/locations').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (usersRes.data?.success) {
        setUsers(usersRes.data.data || []);
      }
      if (rolesRes.data?.success) {
        setRoles(rolesRes.data.data || []);
      }
      if (locsRes.data?.success) {
        setLocations(locsRes.data.data || []);
      }
    } catch (err: any) {
      toast.error('Load Error', err.response?.data?.message || 'Failed to fetch user directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (selectedRole !== 'ALL') {
        const hasRole = u.roles?.includes(selectedRole) || u.role?.role_name === selectedRole;
        if (!hasRole) return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'ACTIVE' && u.status !== 'ACTIVE') return false;
        if (selectedStatus === 'SUSPENDED' && u.status === 'ACTIVE') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = u.full_name.toLowerCase().includes(q);
        const matchesEmpId = u.employee_id.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesLoc = (u.assigned_location_id || '').toLowerCase().includes(q);
        const matchesDept = (u.department || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmpId && !matchesEmail && !matchesLoc && !matchesDept) return false;
      }

      return true;
    });
  }, [users, selectedRole, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'ACTIVE').length;
    const admins = users.filter((u) => u.roles.includes('SYSTEM_ADMIN') || u.role?.role_name === 'SYSTEM_ADMIN').length;
    const supervisors = users.filter((u) => 
      u.roles.some((r) => ['REPAIR_SUPERVISOR', 'MANUFACTURING_SUPERVISOR', 'YARD_CONTROLLER', 'QA_INSPECTOR'].includes(r))
    ).length;

    return { total, active, admins, supervisors };
  }, [users]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      employee_number: '',
      first_name: '',
      last_name: '',
      email: '',
      password: 'Password@123',
      role_name: 'REPAIR_SUPERVISOR',
      assigned_location_id: 'WRS-1',
      department: 'Mechanical (Carriage & Wagon)',
      designation: 'Senior Section Engineer (SSE)',
      status: 'ACTIVE',
    });
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UserItem) => {
    setUserToEdit(user);
    setFormData({
      employee_number: user.employee_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      password: '',
      role_name: user.role?.role_name || user.roles[0] || 'VIEWER',
      assigned_location_id: user.assigned_location_id || '',
      department: user.department || 'Jamalpur Workshop',
      designation: user.designation || 'Supervisor',
      status: user.status || 'ACTIVE',
    });
    setIsEditOpen(true);
  };

  // Create User Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_number || !formData.first_name || !formData.email || !formData.password) {
      toast.error('Validation Error', 'Please complete all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/users', {
        employee_number: formData.employee_number.trim().toUpperCase(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role_name: formData.role_name,
        assigned_location_id: formData.assigned_location_id || null,
        department: formData.department,
        designation: formData.designation,
      });

      if (res.data?.success) {
        toast.success('User Registered', res.data.message || `User #${formData.employee_number} created.`);
        setIsCreateOpen(false);
        fetchUsersAndRoles(true);
      }
    } catch (err: any) {
      toast.error('Registration Failed', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;

    try {
      setSubmitting(true);
      const payload: any = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        role_name: formData.role_name,
        assigned_location_id: formData.assigned_location_id || null,
        department: formData.department,
        designation: formData.designation,
        status: formData.status,
      };

      if (formData.password && formData.password.trim().length >= 6) {
        payload.password = formData.password.trim();
      }

      const res = await api.patch(`/users/${userToEdit.id}`, payload);
      if (res.data?.success) {
        toast.success('User Updated', `Updated profile for ${formData.first_name} (${userToEdit.employee_id})`);
        setIsEditOpen(false);
        setUserToEdit(null);
        fetchUsersAndRoles(true);
      }
    } catch (err: any) {
      toast.error('Update Failed', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle User Status
  const handleToggleStatus = async (user: UserItem) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/users/${user.id}`, { status: nextStatus });
      toast.success('Status Changed', `User #${user.employee_id} is now ${nextStatus}`);
      fetchUsersAndRoles(true);
    } catch (err: any) {
      toast.error('Status Update Failed', err.response?.data?.message || err.message);
    }
  };

  // Delete User
  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      setSubmitting(true);
      const res = await api.delete(`/users/${userToDelete.id}`);
      if (res.data?.success) {
        toast.success('User Removed', res.data.message || `User #${userToDelete.employee_id} deleted.`);
        setUserToDelete(null);
        fetchUsersAndRoles(true);
      }
    } catch (err: any) {
      toast.error('Deletion Failed', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: Generate Random Strong Password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pwd }));
    setShowPassword(true);
  };

  // Role Badge Color Mapper
  const getRoleBadge = (roleName: string) => {
    switch (roleName?.toUpperCase()) {
      case 'SYSTEM_ADMIN':
        return { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5', label: 'Admin' };
      case 'REPAIR_SUPERVISOR':
        return { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', label: 'Repair Supervisor' };
      case 'MANUFACTURING_SUPERVISOR':
        return { bg: '#FDF4FF', color: '#86198F', border: '#F0ABFC', label: 'Mfg Supervisor' };
      case 'YARD_CONTROLLER':
        return { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D', label: 'Yard Controller' };
      case 'QA_INSPECTOR':
        return { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', label: 'QA Inspector' };
      case 'MANAGEMENT':
        return { bg: '#F1F5F9', color: '#334155', border: '#CBD5E1', label: 'Management' };
      default:
        return { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB', label: roleName || 'Viewer' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
            Workshop User & Access Management
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
            Full control over workshop personnel, role assignments, station scoping, and account credentials
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => fetchUsersAndRoles(true)}
            disabled={refreshing}
            style={btnSecondaryStyle}
            title="Refresh Directory"
          >
            <FiRefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={btnPrimaryStyle}
          >
            <FiUserPlus size={15} />
            <span>+ Add New User</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={kpiBoxStyle}>
          <div style={kpiTitleStyle}>Total Registered Personnel</div>
          <div style={kpiValStyle}>{stats.total}</div>
        </div>

        <div style={kpiBoxStyle}>
          <div style={kpiTitleStyle}>Active Accounts</div>
          <div style={{ ...kpiValStyle, color: '#16A34A' }}>{stats.active}</div>
        </div>

        <div style={kpiBoxStyle}>
          <div style={kpiTitleStyle}>Floor Supervisors & Controllers</div>
          <div style={{ ...kpiValStyle, color: '#0A74DA' }}>{stats.supervisors}</div>
        </div>

        <div style={kpiBoxStyle}>
          <div style={kpiTitleStyle}>System Administrators</div>
          <div style={{ ...kpiValStyle, color: '#DC2626' }}>{stats.admins}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Role Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Role:</span>
            {['ALL', 'SYSTEM_ADMIN', 'REPAIR_SUPERVISOR', 'MANUFACTURING_SUPERVISOR', 'YARD_CONTROLLER', 'QA_INSPECTOR'].map((r) => {
              const isSelected = selectedRole === r;
              const label = r === 'ALL' ? 'All Roles' : r.replace('_', ' ');
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 500,
                    backgroundColor: isSelected ? '#0F172A' : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : '#475569',
                    border: `1px solid ${isSelected ? '#0F172A' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <FiSearch size={13} style={{ position: 'absolute', left: '10px', color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search by Name, Emp ID, Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                width: '240px',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Users List Table */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden' }}>
        {loading && users.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
            Loading personnel directory...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>No users found matching current filters.</p>
            <p style={{ margin: '6px 0 0', fontSize: '12px' }}>Try adjusting your search criteria or register a new user.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                  <th style={{ padding: '10px 14px' }}>EMPLOYEE ID</th>
                  <th style={{ padding: '10px 14px' }}>NAME & CREDENTIALS</th>
                  <th style={{ padding: '10px 14px' }}>ASSIGNED ROLE</th>
                  <th style={{ padding: '10px 14px' }}>ASSIGNED LOCATION</th>
                  <th style={{ padding: '10px 14px' }}>DEPARTMENT & TITLE</th>
                  <th style={{ padding: '10px 14px' }}>STATUS</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const roleBadge = getRoleBadge(user.role?.role_name || user.roles[0]);
                  const isActive = user.status === 'ACTIVE';

                  return (
                    <tr 
                      key={user.id} 
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Employee ID */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                        #{user.employee_id}
                      </td>

                      {/* Name & Email */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{user.full_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{user.email}</div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: roleBadge.bg,
                            color: roleBadge.color,
                            border: `1px solid ${roleBadge.border}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {roleBadge.label}
                        </span>
                      </td>

                      {/* Assigned Location */}
                      <td style={{ padding: '12px 14px' }}>
                        {user.assigned_location_id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#1E40AF' }}>
                            <FiMapPin size={11} /> {user.assigned_location_id}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>All Workshop</span>
                        )}
                      </td>

                      {/* Department & Designation */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ color: '#334155' }}>{user.department || 'Workshop Operations'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{user.designation || 'Supervisor'}</div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: isActive ? '#DCFCE7' : '#FEF3C7',
                            color: isActive ? '#15803D' : '#B45309',
                            border: `1px solid ${isActive ? '#86EFAC' : '#FCD34D'}`,
                          }}
                        >
                          {isActive ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '11px',
                              borderRadius: '3px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: isActive ? '#B45309' : '#15803D',
                              cursor: 'pointer',
                            }}
                            title={isActive ? 'Suspend User Access' : 'Activate User Access'}
                          >
                            {isActive ? 'Suspend' : 'Activate'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              borderRadius: '3px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#0F172A',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Edit User"
                          >
                            <FiEdit2 size={11} /> Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              borderRadius: '3px',
                              border: '1px solid #FCA5A5',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Delete User"
                          >
                            <FiTrash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add New User */}
      {isCreateOpen && (
        <div style={modalBackdropStyle} onClick={(e) => { if (e.target === e.currentTarget) setIsCreateOpen(false); }}>
          <div style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>👤</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                  Register New Workshop User
                </h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={iconBtnStyle}><FiX size={18} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Employee Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. JMP-2045"
                    value={formData.employee_number}
                    onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Official Email *</label>
                  <input
                    type="email"
                    placeholder="e.g. name@rsmts.gov.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Password with Generate Option */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={labelStyle}>Initial Password *</label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    style={{ background: 'none', border: 'none', color: '#0A74DA', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    [ Generate Random ]
                  </button>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    style={{ ...inputStyle, paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                  >
                    {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label style={labelStyle}>Assigned Role *</label>
                <select
                  value={formData.role_name}
                  onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                  style={inputStyle}
                >
                  <option value="REPAIR_SUPERVISOR">Repair Supervisor (WRS 1–4, DPS Overhauls)</option>
                  <option value="MANUFACTURING_SUPERVISOR">Manufacturing Supervisor (GIF / Crane Shop)</option>
                  <option value="YARD_CONTROLLER">Yard Controller (NSY, Lines 1–56 Shunting)</option>
                  <option value="QA_INSPECTOR">QA Inspector (WRS-5 Air Brake & Fit Certs)</option>
                  <option value="SYSTEM_ADMIN">System Administrator (Full Workshop Control)</option>
                  <option value="MANAGEMENT">Management / Dy. CME (Read & Analytics)</option>
                  <option value="VIEWER">Viewer (Read-only)</option>
                </select>
              </div>

              {/* Station / Location Scoping */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Primary Location</label>
                  <select
                    value={formData.assigned_location_id}
                    onChange={(e) => setFormData({ ...formData, assigned_location_id: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">All Workshop Locations</option>
                    <optgroup label="Operational Shops">
                      <option value="WRS-1">WRS-1 (Wagon Repair Shop 1)</option>
                      <option value="WRS-2">WRS-2 (Wagon Repair Shop 2)</option>
                      <option value="WRS-3">WRS-3 (Wagon Repair Shop 3)</option>
                      <option value="WRS-4">WRS-4 (Wagon Repair Shop 4)</option>
                      <option value="DPS">DPS (Diesel Power Shed)</option>
                      <option value="GIF">GIF (General Iron Foundry)</option>
                      <option value="CRANE">CRANE (Crane Shop)</option>
                      <option value="WRS-5">WRS-5 (QA Testing)</option>
                    </optgroup>
                    <optgroup label="Yards & Tracks">
                      <option value="NSY">NSY (New Sorting Yard)</option>
                      <option value="Trial Yard">Trial Yard</option>
                      <option value="Tower Car Line">Tower Car Line</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Mechanical"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Designation / Official Title</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Section Engineer"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" disabled={submitting} style={btnPrimaryStyle}>
                  {submitting ? 'Registering...' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {isEditOpen && userToEdit && (
        <div style={modalBackdropStyle} onClick={(e) => { if (e.target === e.currentTarget) setIsEditOpen(false); }}>
          <div style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiEdit2 size={16} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                  Edit User: {userToEdit.full_name} (#{userToEdit.employee_id})
                </h3>
              </div>
              <button onClick={() => setIsEditOpen(false)} style={iconBtnStyle}><FiX size={18} /></button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Assigned Role *</label>
                  <select
                    value={formData.role_name}
                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="REPAIR_SUPERVISOR">Repair Supervisor</option>
                    <option value="MANUFACTURING_SUPERVISOR">Manufacturing Supervisor</option>
                    <option value="YARD_CONTROLLER">Yard Controller</option>
                    <option value="QA_INSPECTOR">QA Inspector</option>
                    <option value="SYSTEM_ADMIN">System Administrator</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Account Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="ACTIVE">ACTIVE (Access Granted)</option>
                    <option value="SUSPENDED">SUSPENDED (Access Blocked)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Assigned Location</label>
                  <select
                    value={formData.assigned_location_id}
                    onChange={(e) => setFormData({ ...formData, assigned_location_id: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">All Workshop Locations</option>
                    <option value="WRS-1">WRS-1</option>
                    <option value="WRS-2">WRS-2</option>
                    <option value="WRS-3">WRS-3</option>
                    <option value="WRS-4">WRS-4</option>
                    <option value="DPS">DPS</option>
                    <option value="GIF">GIF</option>
                    <option value="CRANE">CRANE</option>
                    <option value="WRS-5">WRS-5</option>
                    <option value="NSY">NSY</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Optional Password Reset */}
              <div>
                <label style={labelStyle}>Reset Password (Optional - leave blank to keep current)</label>
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" disabled={submitting} style={btnPrimaryStyle}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete User */}
      {userToDelete && (
        <div style={modalBackdropStyle} onClick={(e) => { if (e.target === e.currentTarget) setUserToDelete(null); }}>
          <div style={{ ...modalBoxStyle, maxWidth: '420px' }}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#DC2626' }}>
                Confirm User Deletion
              </h3>
              <button onClick={() => setUserToDelete(null)} style={iconBtnStyle}><FiX size={18} /></button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                Are you sure you want to permanently delete user <strong>{userToDelete.full_name}</strong> (Employee ID: <strong>#{userToDelete.employee_id}</strong>)?
              </p>
              <div style={{ padding: '8px 10px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '4px', fontSize: '11px', color: '#991B1B' }}>
                ⚠️ Warning: This will revoke their device login and authentication tokens immediately.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setUserToDelete(null)} style={cancelBtnStyle}>Cancel</button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={submitting}
                  style={{ ...btnPrimaryStyle, backgroundColor: '#DC2626' }}
                >
                  {submitting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling Constants
const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.65)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
};

const modalBoxStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  width: '100%',
  maxWidth: '520px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #E5E7EB',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#F9FAFB',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#6B7280',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  backgroundColor: '#0F172A',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  backgroundColor: '#FFFFFF',
  color: '#374151',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 500,
  backgroundColor: '#F3F4F6',
  color: '#374151',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  cursor: 'pointer',
};

const kpiBoxStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  padding: '14px 16px',
};

const kpiTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const kpiValStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0F172A',
  marginTop: '4px',
};
