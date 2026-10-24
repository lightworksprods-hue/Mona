import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AlertToast from '../components/AlertToast';
import { formatCurrency, formatQuantity } from '../utils/formatters';
import { downloadCsv, printReport } from '../utils/reportExport';

export default function ReportsPage() {
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadReport();
  }, [period, selectedDate]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.getReports({ period, startDate: selectedDate, endDate: selectedDate });
      setReportData(res.data);
    } catch (err) {
      setErrorMessage(err.message || 'Error generating report');
    } finally {
      setIsLoading(false);
    }
  };

  const reportLabel = selectedDate || (period === 'daily' ? 'Today' : period === 'weekly' ? 'Past 7 Days' : 'Past 30 Days');
  const formatPeakHour = (hour) => {
    const numericHour = Number(hour);
    const suffix = numericHour >= 12 ? 'PM' : 'AM';
    const displayHour = numericHour % 12 || 12;
    return `${displayHour}:00 ${suffix}`;
  };
  const summary = reportData?.summary || {};
  const paymentEntries = Object.entries(reportData?.paymentBreakdown || {}).filter(([, amount]) => Number(amount) > 0);
  const paymentTotal = paymentEntries.reduce((total, [, amount]) => total + Number(amount), 0);
  const bestSellers = reportData?.bestSellers || [];
  const maxProductQuantity = Math.max(...bestSellers.map((item) => Number(item.quantity || 0)), 1);
  const averageBasket = Number(summary.transactionCount || 0) > 0
    ? Number(summary.netSales || 0) / Number(summary.transactionCount)
    : 0;

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
          <label className="report-date-picker">
            <span>Report date</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
          <span className="export-toolbar-divider" />
          <button className="btn btn-secondary btn-sm" onClick={exportSalesCsv} disabled={!reportData}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={printSalesReport} disabled={!reportData}>Print / PDF</button>
        </div>
      </div>

      {errorMessage && <AlertToast type="error" message={errorMessage} onClose={() => setErrorMessage('')} />}

      {/* DASHBOARD REAL-TIME KPI CARDS */}
      {reportData && (
        <>
          <div className="report-kpi-grid">
            <div className="report-kpi-card report-kpi-sales"><span>Net sales</span><strong>{formatCurrency(summary.netSales)}</strong><small>After refunds</small></div>
            <div className="report-kpi-card"><span>Transactions</span><strong>{summary.transactionCount || 0}</strong><small>Completed sales</small></div>
            <div className="report-kpi-card"><span>Items sold</span><strong>{formatQuantity(summary.totalItemsSold)}</strong><small>{formatCurrency(summary.totalTax)} tax collected</small></div>
            <div className="report-kpi-card"><span>Average basket</span><strong>{formatCurrency(averageBasket)}</strong><small>Net sales per transaction</small></div>
            <div className="report-kpi-card report-kpi-profit"><span>Estimated profit</span><strong>{formatCurrency(summary.estimatedProfit)}</strong><small>Based on recorded cost</small></div>
          </div>

          <div className="report-chart-grid">
            <div className="pos-panel report-chart-panel">
              <div className="report-section-heading"><div><span className="eyebrow">CHANNEL MIX</span><h3>Sales by payment method</h3></div><span className="report-heading-total">{formatCurrency(paymentTotal)}</span></div>
              <div className="payment-chart">
                {paymentEntries.length === 0 ? <div className="empty-state">No payment data for this period.</div> : paymentEntries.map(([method, amount]) => {
                  const percentage = paymentTotal ? (Number(amount) / paymentTotal) * 100 : 0;
                  return <div className="payment-chart-row" key={method}><div className="payment-chart-label"><strong>{method}</strong><span>{percentage.toFixed(0)}%</span></div><div className="report-progress-track"><span style={{ width: `${percentage}%` }} /></div><div className="payment-chart-value">{formatCurrency(amount)}</div></div>;
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {reportData && (
        <div className="analytics-grid">
          <div className="pos-panel analytics-panel">
            <div className="pos-panel-header"><span className="pos-panel-title">Cashier Performance</span></div>
            <div className="table-container">
              <table className="pos-table analytics-table"><thead><tr><th>Cashier</th><th>Transactions</th><th>Items</th><th style={{ textAlign: 'right' }}>Sales</th></tr></thead>
                <tbody>{(reportData.cashierPerformance || []).length === 0 ? <tr><td colSpan="4" className="empty-state">No cashier sales recorded.</td></tr> : reportData.cashierPerformance.map((item) => <tr key={item.cashierId}><td><strong>{item.cashierName}</strong><div className="analytics-muted">Avg. {formatCurrency(item.averageSale)}</div></td><td>{item.transactions}</td><td>{formatQuantity(item.itemsSold)}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.sales)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div className="pos-panel analytics-panel">
            <div className="pos-panel-header"><span className="pos-panel-title">Peak Hours</span></div>
            <div className="table-container">
              <table className="pos-table analytics-table"><thead><tr><th>Time</th><th>Transactions</th><th style={{ textAlign: 'right' }}>Sales</th></tr></thead>
                <tbody>{(reportData.peakHours || []).length === 0 ? <tr><td colSpan="3" className="empty-state">No hourly sales recorded.</td></tr> : reportData.peakHours.map((item) => <tr key={item.hour}><td><strong>{formatPeakHour(item.hour)} – {formatPeakHour((Number(item.hour) + 1) % 24)}</strong></td><td>{item.transactions}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.sales)}</td></tr>)}</tbody>
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
                    bestSellers.map((item) => (
                      <tr key={item.productId}>
                        <td><strong>{item.productName}</strong><div className="product-sales-bar"><span style={{ width: `${(Number(item.quantity) / maxProductQuantity) * 100}%` }} /></div></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{item.sku}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{formatQuantity(item.quantity)}</td>
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
