import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function InventoryPage() {
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'movements' | 'adjust'
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Stock Adjustment Form
  const [adjustmentData, setAdjustmentData] = useState({
    productId: '',
    type: 'RESTOCK',
    quantity: 1,
    reason: '',
  });

  useEffect(() => {
    loadSummary();
    loadMovements();
    loadProducts();
  }, []);

  const loadSummary = async () => {
    try {
      const res = await api.getInventorySummary();
      setSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const res = await api.getMovements({ limit: 100 });
      setMovements(res.data?.movements || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.getProducts({ activeOnly: true });
      setProducts(res.data || []);
      if (res.data?.length > 0 && !adjustmentData.productId) {
        setAdjustmentData((prev) => ({ ...prev, productId: res.data[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await api.adjustStock(adjustmentData);
      setSuccessMessage('Stock adjustment successfully applied and logged.');
      setAdjustmentData({
        productId: products[0]?.id || '',
        type: 'RESTOCK',
        quantity: 1,
        reason: '',
      });
      loadSummary();
      loadMovements();
      loadProducts();
      setActiveTab('movements');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to record stock adjustment');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pos-panel-header" style={{ borderRadius: 'var(--radius-sm)' }}>
        <h1 className="pos-panel-title" style={{ fontSize: '18px' }}>Inventory & Stock Control</h1>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('summary')}
          >
            Overview & Alerts
          </button>
          <button
            className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('movements')}
          >
            Movement Log
          </button>
          <button
            className={`btn ${activeTab === 'adjust' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('adjust')}
          >
            + Adjust Stock
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* OVERVIEW METRICS */}
      {summary && (
        <div className="dashboard-grid">
          <div className="metric-card">
            <div className="metric-card-label">Total Inventory Valuation (Cost)</div>
            <div className="metric-card-value">{formatCurrency(summary.totalValuationCost)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Retail Value (Expected Revenue)</div>
            <div className="metric-card-value">{formatCurrency(summary.totalValuationRetail)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Out of Stock Items</div>
            <div className="metric-card-value" style={{ color: 'var(--error)' }}>
              {summary.outOfStockCount}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Low Stock Alerts</div>
            <div className="metric-card-value" style={{ color: 'var(--warning)' }}>
              {summary.lowStockCount}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: LOW STOCK ALERTS TABLE */}
      {activeTab === 'summary' && (
        <div className="pos-panel">
          <div className="pos-panel-header">
            <span className="pos-panel-title">Low & Depleted Stock Items</span>
          </div>
          <div className="table-container">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th style={{ textAlign: 'center' }}>Current Stock</th>
                  <th style={{ textAlign: 'center' }}>Min Level</th>
                  <th style={{ textAlign: 'center' }}>Alert State</th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--success)' }}>
                      All active products are adequately stocked above minimum levels.
                    </td>
                  </tr>
                ) : (
                  summary.lowStockItems.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{p.sku}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{p.barcode}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {p.stockQuantity} {p.unit}
                      </td>
                      <td style={{ textAlign: 'center' }}>{p.minStockLevel}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge-tag"
                          style={{
                            backgroundColor: p.stockQuantity <= 0 ? 'var(--error-bg)' : 'var(--warning-bg)',
                            color: p.stockQuantity <= 0 ? 'var(--error)' : 'var(--warning)',
                          }}
                        >
                          {p.stockQuantity <= 0 ? 'OUT OF STOCK' : 'LOW STOCK ALERT'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL OF MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="pos-panel">
          <div className="pos-panel-header">
            <span className="pos-panel-title">Stock Movement History (Sales, Restocks, Adjustments)</span>
          </div>
          <div className="table-container">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Type</th>
                  <th style={{ textAlign: 'right' }}>Quantity Delta</th>
                  <th style={{ textAlign: 'right' }}>Balance After</th>
                  <th>Reason / Reference</th>
                  <th>Staff Responsible</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>
                      {isLoading ? 'Loading stock movements...' : 'No inventory movements recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(m.createdAt)}</td>
                      <td>
                        <strong>{m.product?.name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--secondary-text)' }}>
                          Barcode: {m.product?.barcode}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge-tag">{m.type}</span>
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 'bold',
                          color: m.quantity > 0 ? 'var(--success)' : 'var(--error)',
                        }}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {m.balanceAfter}
                      </td>
                      <td>{m.reason || (m.sale ? `Sale #${m.sale.transactionNumber}` : '-')}</td>
                      <td>{m.user?.fullName || m.user?.username || 'System'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ADJUST STOCK FORM */}
      {activeTab === 'adjust' && (
        <div className="pos-panel" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div className="pos-panel-header">
            <span className="pos-panel-title">Record Stock Intake / Adjustment</span>
          </div>
          <form onSubmit={handleAdjustSubmit} style={{ padding: '20px' }}>
            <div className="form-group">
              <label className="field-label">Select Product *</label>
              <select
                className="form-control"
                required
                value={adjustmentData.productId}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, productId: e.target.value })}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current Stock: {p.stockQuantity} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="field-label">Adjustment Type *</label>
              <select
                className="form-control"
                value={adjustmentData.type}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, type: e.target.value })}
              >
                <option value="RESTOCK">Restock (Add stock from supplier)</option>
                <option value="MANUAL_ADJUSTMENT">Manual Inventory Count Adjustment</option>
                <option value="DAMAGE">Damaged Goods (Deduct stock)</option>
                <option value="EXPIRED">Expired Stock (Deduct stock)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="field-label">Quantity to Adjust *</label>
              <input
                type="number"
                min="1"
                required
                className="form-control"
                value={adjustmentData.quantity}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: parseInt(e.target.value, 10) || 1 })}
              />
            </div>

            <div className="form-group">
              <label className="field-label">Reason / Supplier PO / Note *</label>
              <input
                type="text"
                required
                placeholder="e.g. PO#1042 Delivery, Physical Inventory Count, Bottle Broken"
                className="form-control"
                value={adjustmentData.reason}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Confirm and Log Stock Movement
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
