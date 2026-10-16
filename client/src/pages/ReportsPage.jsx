import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export default function ReportsPage() {
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [dashboardStats, setDashboardStats] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadReport();
  }, [period]);

  const loadDashboard = async () => {
    try {
      const res = await api.getDashboardStats();
      setDashboardStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.getReports({ period });
      setReportData(res.data);
    } catch (err) {
      setErrorMessage(err.message || 'Error generating report');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pos-panel-header" style={{ borderRadius: 'var(--radius-sm)' }}>
        <h1 className="pos-panel-title" style={{ fontSize: '18px' }}>Store Performance & Reports</h1>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn ${period === 'daily' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setPeriod('daily')}
          >
            Today
          </button>
          <button
            className={`btn ${period === 'weekly' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setPeriod('weekly')}
          >
            Past 7 Days
          </button>
          <button
            className={`btn ${period === 'monthly' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setPeriod('monthly')}
          >
            Past 30 Days
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      {/* DASHBOARD REAL-TIME KPI CARDS */}
      {dashboardStats && (
        <div className="dashboard-grid">
          <div className="metric-card">
            <div className="metric-card-label">Today's Total Sales</div>
            <div className="metric-card-value">{formatCurrency(dashboardStats.today?.salesTotal)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Transactions Processed</div>
            <div className="metric-card-value">{dashboardStats.today?.transactionCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Total Units Sold Today</div>
            <div className="metric-card-value">{dashboardStats.today?.itemsSold} pcs</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Average Basket Size</div>
            <div className="metric-card-value">
              {formatCurrency(dashboardStats.today?.averageTransactionValue)}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED PERIOD REPORT */}
      {reportData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Revenue Breakdown */}
          <div className="pos-panel">
            <div className="pos-panel-header">
              <span className="pos-panel-title">Sales Summary ({period.toUpperCase()})</span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="summary-row">
                <span>Gross Revenue:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(reportData.summary?.totalSales)}
                </strong>
              </div>
              <div className="summary-row">
                <span>Discounts Given:</span>
                <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                  -{formatCurrency(reportData.summary?.totalDiscount)}
                </span>
              </div>
              <div className="summary-row">
                <span>Refunds / Returns:</span>
                <span style={{ color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>
                  -{formatCurrency(reportData.summary?.totalRefunded)} ({reportData.summary?.refundCount})
                </span>
              </div>
              <div className="summary-row" style={{ borderTop: '2px solid var(--border-color)', paddingTop: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>NET SALES:</span>
                <strong style={{ fontSize: '18px', color: 'var(--dark-pink)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(reportData.summary?.netSales)}
                </strong>
              </div>
            </div>

            <div className="pos-panel-header" style={{ borderTop: '1px solid var(--border-color)' }}>
              <span className="pos-panel-title">Sales by Payment Channel</span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(reportData.paymentBreakdown || {}).map(([method, amount]) => (
                <div key={method} className="summary-row">
                  <span>{method}:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="pos-panel">
            <div className="pos-panel-header">
              <span className="pos-panel-title">Best Selling Products</span>
            </div>
            <div className="table-container">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'center' }}>Qty Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {!reportData.bestSellers || reportData.bestSellers.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>
                        No sales recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    reportData.bestSellers.map((item) => (
                      <tr key={item.productId}>
                        <td><strong>{item.productName}</strong></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{item.sku}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(item.revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
