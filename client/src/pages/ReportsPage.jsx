import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { downloadCsv, printReport } from '../utils/reportExport';

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

  const reportLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'Past 7 Days' : 'Past 30 Days';

  const exportSalesCsv = () => {
    if (!reportData) return;
    const summary = reportData.summary || {};
    downloadCsv(`mona-sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`, [
      {
        title: `Sales Summary - ${reportLabel}`,
        headers: ['Metric', 'Value'],
        rows: [
          ['Gross sales', summary.totalSales], ['Net sales', summary.netSales],
          ['Discounts', summary.totalDiscount], ['Refunds', summary.totalRefunded],
          ['Estimated profit', summary.estimatedProfit],
          ['Transactions', summary.transactionCount], ['Items sold', summary.totalItemsSold],
          ['Tax', summary.totalTax],
        ],
      },
      {
        title: 'Sales by Payment Method', headers: ['Payment method', 'Amount'],
        rows: Object.entries(reportData.paymentBreakdown || {}).map(([method, amount]) => [method, amount]),
      },
      {
        title: 'Best Selling Products', headers: ['Product', 'SKU', 'Quantity sold', 'Revenue'],
        rows: (reportData.bestSellers || []).map((item) => [item.productName, item.sku, item.quantity, item.revenue]),
      },
      {
        title: 'Cashier Performance', headers: ['Cashier', 'Transactions', 'Items sold', 'Sales', 'Average sale'],
        rows: (reportData.cashierPerformance || []).map((item) => [item.cashierName, item.transactions, item.itemsSold, item.sales, item.averageSale]),
      },
      {
        title: 'Peak Hours', headers: ['Hour', 'Transactions', 'Sales'],
        rows: (reportData.peakHours || []).map((item) => [`${String(item.hour).padStart(2, '0')}:00`, item.transactions, item.sales]),
      },
    ]);
  };

  const printSalesReport = () => {
    if (!reportData) return;
    const summary = reportData.summary || {};
    printReport({
      title: 'Sales Report', subtitle: reportLabel,
      summary: [['Net sales', formatCurrency(summary.netSales)], ['Estimated profit', formatCurrency(summary.estimatedProfit)], ['Transactions', summary.transactionCount], ['Items sold', summary.totalItemsSold]],
      columns: ['Product', 'SKU', 'Quantity sold', 'Revenue'],
      rows: (reportData.bestSellers || []).map((item) => [item.productName, item.sku, item.quantity, formatCurrency(item.revenue)]),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pos-panel-header" style={{ borderRadius: 'var(--radius-sm)' }}>
        <h1 className="pos-panel-title" style={{ fontSize: '18px' }}>Store Performance & Reports</h1>
        <div className="report-toolbar-actions">
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
          <span className="export-toolbar-divider" />
          <button className="btn btn-secondary btn-sm" onClick={exportSalesCsv} disabled={!reportData}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={printSalesReport} disabled={!reportData}>Print / PDF</button>
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
          <div className="metric-card metric-card-highlight">
            <div className="metric-card-label">Estimated Profit Today</div>
            <div className="metric-card-value">{formatCurrency(dashboardStats.today?.estimatedProfit ?? 0)}</div>
          </div>
        </div>
      )}

      {reportData && (
        <div className="analytics-grid">
          <div className="pos-panel analytics-panel">
            <div className="pos-panel-header"><span className="pos-panel-title">Cashier Performance</span></div>
            <div className="table-container">
              <table className="pos-table analytics-table"><thead><tr><th>Cashier</th><th>Transactions</th><th>Items</th><th style={{ textAlign: 'right' }}>Sales</th></tr></thead>
                <tbody>{(reportData.cashierPerformance || []).length === 0 ? <tr><td colSpan="4" className="empty-state">No cashier sales recorded.</td></tr> : reportData.cashierPerformance.map((item) => <tr key={item.cashierId}><td><strong>{item.cashierName}</strong><div className="analytics-muted">Avg. {formatCurrency(item.averageSale)}</div></td><td>{item.transactions}</td><td>{item.itemsSold}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.sales)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div className="pos-panel analytics-panel">
            <div className="pos-panel-header"><span className="pos-panel-title">Peak Hours</span></div>
            <div className="table-container">
              <table className="pos-table analytics-table"><thead><tr><th>Time</th><th>Transactions</th><th style={{ textAlign: 'right' }}>Sales</th></tr></thead>
                <tbody>{(reportData.peakHours || []).length === 0 ? <tr><td colSpan="3" className="empty-state">No hourly sales recorded.</td></tr> : reportData.peakHours.map((item) => <tr key={item.hour}><td><strong>{`${String(item.hour).padStart(2, '0')}:00 – ${String((item.hour + 1) % 24).padStart(2, '0')}:00`}</strong></td><td>{item.transactions}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.sales)}</td></tr>)}</tbody>
              </table>
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
            <div className="pos-panel-header" style={{ borderTop: '1px solid var(--border-color)' }}>
              <span className="pos-panel-title">Estimated Profit</span>
            </div>
            <div className="profit-callout">
              <strong>{formatCurrency(reportData.summary?.estimatedProfit)}</strong>
              <span>Revenue less recorded product cost and refunds</span>
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
