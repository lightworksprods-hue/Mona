import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage({ storeInfo, onStoreUpdate }) {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('store'); // 'store' | 'users' | 'devices' | 'customers' | 'rewards' | 'audit'
  const [formData, setFormData] = useState({
    storeName: '',
    storeAddress: '',
    phone: '',
    taxRate: '0.00',
    currencySymbol: '₱',
    receiptFooter: '',
    receiptPaperWidth: '80mm',
    loyaltyPointsPerHundred: '1.00',
  });

  // User Management State
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerForm, setCustomerForm] = useState({ fullName: '', phone: '' });
  const [products, setProducts] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [rewardForm, setRewardForm] = useState({ productId: '', pointsCost: '' });
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
        receiptPaperWidth: storeInfo.receiptPaperWidth || '80mm',
        loyaltyPointsPerHundred: (storeInfo.loyaltyPointsPerHundred ?? 1).toString(),
      });
    }
  }, [storeInfo]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'devices') loadDevices();
    if (activeTab === 'customers') loadCustomers();
    if (activeTab === 'rewards') loadRewards();
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

  const loadCustomers = async (search = customerSearch) => {
    try {
      const res = await api.getCustomers(search);
      setCustomers(res.data || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load customers');
    }
  };

  const handleCreateCustomer = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.createCustomer(customerForm);
      setCustomerForm({ fullName: '', phone: '' });
      setSuccessMessage('Customer added to the loyalty program.');
      loadCustomers();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to add customer');
    }
  };

  const loadRewards = async () => {
    try {
      const [rewardResponse, productResponse] = await Promise.all([
        api.getLoyaltyRewards(),
        api.getProducts({ activeOnly: true }),
      ]);
      setRewards(rewardResponse.data || []);
      setProducts(productResponse.data || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load loyalty rewards');
    }
  };

  const handleCreateReward = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    try {
      await api.createLoyaltyReward(rewardForm);
      setRewardForm({ productId: '', pointsCost: '' });
      setSuccessMessage('Loyalty reward added.');
      loadRewards();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to add loyalty reward');
    }
  };

  const handleToggleReward = async (reward) => {
    try {
      await api.updateLoyaltyReward(reward.id, { isActive: !reward.isActive });
      loadRewards();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update loyalty reward');
    }
  };

  const handleDeleteReward = async (reward) => {
    if (!window.confirm(`Remove ${reward.product.name} from the rewards catalog?`)) return;
    try {
      await api.deleteLoyaltyReward(reward.id);
      setSuccessMessage('Loyalty reward removed.');
      loadRewards();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to remove loyalty reward');
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

  const handleSystemToggle = async () => {
    const nextStatus = storeInfo?.systemActive === false;
    const action = nextStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} the POS system?`)) return;
    try {
      const res = await api.updateSystemStatus(nextStatus);
      setSuccessMessage(res.message || `System ${nextStatus ? 'activated' : 'deactivated'}.`);
      if (onStoreUpdate) onStoreUpdate(res.data);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to change system status');
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
        <div className="settings-tab-list">
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
            className={`btn ${activeTab === 'customers' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('customers')}
          >
            Customers & Loyalty
          </button>
          <button
            className={`btn ${activeTab === 'rewards' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('rewards')}
          >
            Rewards Catalog
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
            {isSuperAdmin && (
              <div className={`system-control-card ${storeInfo?.systemActive === false ? 'is-inactive' : ''}`}>
                <div>
                  <strong>System control</strong>
                  <p>{storeInfo?.systemActive === false ? 'The POS is deactivated for admins and cashiers.' : 'The POS is currently active.'}</p>
                </div>
                <button type="button" className={storeInfo?.systemActive === false ? 'btn btn-primary' : 'btn btn-danger'} onClick={handleSystemToggle}>
                  {storeInfo?.systemActive === false ? 'Activate system' : 'Deactivate system'}
                </button>
              </div>
            )}
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

            <div className="receipt-settings-card">
              <div>
                <strong>Receipt Printing</strong>
                <p>Choose the paper width used by your thermal printer. Printing uses the computer's default printer automatically.</p>
              </div>
              <label className="field-label">Paper size
                <select
                  className="form-control"
                  value={formData.receiptPaperWidth}
                  onChange={(e) => setFormData({ ...formData, receiptPaperWidth: e.target.value })}
                >
                  <option value="58mm">58 mm thermal</option>
                  <option value="80mm">80 mm thermal</option>
                  <option value="A4">A4 / office printer</option>
                </select>
              </label>
            </div>

            <div className="loyalty-settings-card">
              <div>
                <strong>Customer Loyalty Points</strong>
                <p>Cashiers can enter a customer's phone number at checkout. Points are awarded from the final sale total.</p>
              </div>
              <label className="field-label">Points per ₱100 spent
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={formData.loyaltyPointsPerHundred}
                  onChange={(e) => setFormData({ ...formData, loyaltyPointsPerHundred: e.target.value })}
                />
              </label>
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

      {activeTab === 'customers' && (
        <div className="pos-panel customer-management-panel">
          <div className="pos-panel-header customer-management-header">
            <div>
              <span className="pos-panel-title">Customers & Loyalty Points</span>
              <p>View customers identified by phone number, their points balance, and spending.</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => loadCustomers()}>Refresh</button>
          </div>
          <form className="customer-create-row" onSubmit={handleCreateCustomer}>
            <input
              className="form-control"
              placeholder="Customer name (optional)"
              value={customerForm.fullName}
              onChange={(e) => setCustomerForm({ ...customerForm, fullName: e.target.value })}
            />
            <input
              className="form-control"
              type="tel"
              required
              placeholder="Phone number"
              value={customerForm.phone}
              onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
            />
            <button className="btn btn-primary" type="submit">Add Customer</button>
          </form>
          <div className="customer-search-row">
            <input
              className="form-control"
              placeholder="Search by phone number or customer name..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadCustomers(); }}
            />
            <button className="btn btn-primary" onClick={() => loadCustomers()}>Search</button>
          </div>
          <div className="table-container">
            <table className="pos-table customer-table">
              <thead><tr><th>Customer</th><th>Phone</th><th>Points</th><th>Total spent</th><th>Sales</th><th>Last activity</th></tr></thead>
              <tbody>
                {customers.length === 0 ? <tr><td colSpan="6" className="empty-state">No loyalty customers found.</td></tr> : customers.map((customer) => (
                  <tr key={customer.id}>
                    <td><strong>{customer.fullName || 'Unnamed customer'}</strong></td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{customer.phone}</td>
                    <td><span className="customer-points-badge">{customer.pointsBalance} pts</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(customer.totalSpent)}</td>
                    <td>{customer._count?.sales || 0}</td>
                    <td>{formatDateTime(customer.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="loyalty-rewards-admin">
          <div className="pos-panel">
            <div className="pos-panel-header customer-management-header">
              <div>
                <span className="pos-panel-title">Points Redemption Rules</span>
                <p>Choose which products customers can claim and set the points required for one unit.</p>
              </div>
            </div>
            <form className="reward-create-form" onSubmit={handleCreateReward}>
              <label className="field-label">Product
                <select className="form-control" required value={rewardForm.productId} onChange={(e) => setRewardForm({ ...rewardForm, productId: e.target.value })}>
                  <option value="">Select a product</option>
                  {products.filter((product) => !rewards.some((reward) => reward.productId === product.id)).map((product) => (
                    <option key={product.id} value={product.id}>{product.name} — {formatCurrency(product.sellingPrice)}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">Points required
                <input className="form-control" type="number" min="1" step="1" required value={rewardForm.pointsCost} onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: e.target.value })} placeholder="e.g. 100" />
              </label>
              <button className="btn btn-primary" type="submit">Add reward</button>
            </form>
          </div>
          <div className="pos-panel">
            <div className="table-container">
              <table className="pos-table">
                <thead><tr><th>Product</th><th>Points required</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {rewards.length === 0 ? <tr><td colSpan="5" className="empty-state">No rewards configured yet.</td></tr> : rewards.map((reward) => (
                    <tr key={reward.id}>
                      <td><strong>{reward.product.name}</strong><br /><small>{reward.product.sku}</small></td>
                      <td><span className="customer-points-badge">{reward.pointsCost} pts</span></td>
                      <td>{Number(reward.product.stockQuantity || 0).toLocaleString()}</td>
                      <td>{reward.isActive ? 'Active' : 'Disabled'}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleToggleReward(reward)}>{reward.isActive ? 'Disable' : 'Enable'}</button>{' '}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteReward(reward)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
