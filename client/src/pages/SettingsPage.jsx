import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/formatters';

export default function SettingsPage({ storeInfo, onStoreUpdate }) {
  const [activeTab, setActiveTab] = useState('store'); // 'store' | 'users' | 'devices' | 'audit'
  const [formData, setFormData] = useState({
    storeName: '',
    storeAddress: '',
    phone: '',
    taxRate: '0.00',
    currencySymbol: '₱',
    receiptFooter: '',
  });

  // User Management State
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'CASHIER',
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (storeInfo) {
      setFormData({
        storeName: storeInfo.storeName || '',
        storeAddress: storeInfo.storeAddress || '',
        phone: storeInfo.phone || '',
        taxRate: (storeInfo.taxRate || 0).toString(),
        currencySymbol: storeInfo.currencySymbol || '₱',
        receiptFooter: storeInfo.receiptFooter || '',
      });
    }
  }, [storeInfo]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'devices') loadDevices();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      const res = await api.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await api.getDevices();
      setDevices(res.data || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load authorized devices');
    }
  };

  const updateDevice = async (device, changes) => {
    try {
      await api.updateDevice(device.id, changes);
      setSuccessMessage(changes.isAuthorized ? `Device "${device.name}" authorized.` : `Device "${device.name}" revoked.`);
      loadDevices();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update device');
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await api.getAuditLogs();
      setAuditLogs(res.data?.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStoreSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await api.updateSettings(formData);
      setSuccessMessage('Store settings updated successfully.');
      if (onStoreUpdate) onStoreUpdate(res.data);
    } catch (err) {
      setErrorMessage(err.message || 'Error updating settings');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.createUser(newUser);
      setSuccessMessage(`User "${newUser.username}" created successfully.`);
      setNewUser({
        username: '',
        fullName: '',
        email: '',
        password: '',
        role: 'CASHIER',
      });
      loadUsers();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create user');
    }
  };

  const handleToggleUser = async (user) => {
    try {
      await api.updateUser(user.id, { isActive: !user.isActive });
      loadUsers();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update user status');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pos-panel-header" style={{ borderRadius: 'var(--radius-sm)' }}>
        <h1 className="pos-panel-title" style={{ fontSize: '18px' }}>Store Settings & Administration</h1>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn ${activeTab === 'store' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('store')}
          >
            Store Information
          </button>
          <button
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('users')}
          >
            User Accounts
          </button>
          <button
            className={`btn ${activeTab === 'devices' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('devices')}
          >
            Authorized Devices
          </button>
          <button
            className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('audit')}
          >
            Security Audit Trail
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* TAB 1: STORE SETTINGS */}
      {activeTab === 'store' && (
        <div className="pos-panel" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div className="pos-panel-header">
            <span className="pos-panel-title">Store & Receipt Configuration</span>
          </div>
          <form onSubmit={handleStoreSubmit} style={{ padding: '20px' }}>
            <div className="form-group">
              <label className="field-label">Store Name</label>
              <input
                type="text"
                required
                className="form-control"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="field-label">Store Address</label>
              <input
                type="text"
                required
                className="form-control"
                value={formData.storeAddress}
                onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="field-label">Store Phone / Contact</label>
              <input
                type="text"
                className="form-control"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="field-label">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="field-label">Currency Symbol</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="field-label">Receipt Footer Message</label>
              <textarea
                rows="2"
                className="form-control"
                value={formData.receiptFooter}
                onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Save Settings
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
          <div className="pos-panel">
            <div className="pos-panel-header">
              <span className="pos-panel-title">System Staff Accounts</span>
            </div>
            <div className="table-container">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{u.username}</td>
                      <td>{u.fullName}</td>
                      <td>
                        <span className="badge-tag">{u.role}</span>
                      </td>
                      <td>
                        <span
                          className="badge-tag"
                          style={{
                            backgroundColor: u.isActive ? 'var(--light-pink)' : 'var(--error-bg)',
                            color: u.isActive ? 'var(--dark-pink)' : 'var(--error)',
                          }}
                        >
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleUser(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pos-panel">
            <div className="pos-panel-header">
              <span className="pos-panel-title">Create New Staff User</span>
            </div>
            <form onSubmit={handleCreateUser} style={{ padding: '16px' }}>
              <div className="form-group">
                <label className="field-label">Username *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="field-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="field-label">Password * (min 6 chars)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="form-control"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="field-label">Role</label>
                <select
                  className="form-control"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="CASHIER">Cashier (Process Sales & Transactions)</option>
                  <option value="ADMIN">Administrator (Full Access)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Add User
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'devices' && (
        <div className="pos-panel">
          <div className="pos-panel-header">
            <div>
              <span className="pos-panel-title">Cashier Device Authorization</span>
              <p style={{ margin: '4px 0 0', color: 'var(--secondary-text)', fontSize: '12px' }}>Only authorized devices can be used for cashier login. Unknown devices appear here after a login attempt.</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadDevices}>Refresh</button>
          </div>
          <div className="table-container">
            <table className="pos-table">
              <thead><tr><th>Device name</th><th>Device ID</th><th>Last seen</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
              <tbody>{devices.length === 0 ? <tr><td colSpan="5" className="empty-state">No devices have requested access yet.</td></tr> : devices.map((device) => (
                <tr key={device.id}>
                  <td><strong>{device.name}</strong></td>
                  <td style={{ maxWidth: '280px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{device.deviceKey}</td>
                  <td>{device.lastSeenAt ? formatDateTime(device.lastSeenAt) : 'Never'}</td>
                  <td><span className="badge-tag" style={{ backgroundColor: device.isAuthorized ? 'var(--light-pink)' : 'var(--warning-bg)', color: device.isAuthorized ? 'var(--dark-pink)' : 'var(--warning)' }}>{device.isAuthorized ? 'Authorized' : 'Pending'}</span></td>
                  <td style={{ textAlign: 'center' }}><button className={`btn btn-sm ${device.isAuthorized ? 'btn-secondary' : 'btn-primary'}`} onClick={() => updateDevice(device, { isAuthorized: !device.isAuthorized })}>{device.isAuthorized ? 'Revoke' : 'Authorize'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="pos-panel">
          <div className="pos-panel-header">
            <span className="pos-panel-title">Security & Transaction Audit Logs</span>
          </div>
          <div className="table-container">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>
                      No audit events logged.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</td>
                      <td>{log.user ? `${log.user.fullName} (${log.user.username})` : 'System'}</td>
                      <td>
                        <span className="badge-tag">{log.action}</span>
                      </td>
                      <td>{log.entity}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
