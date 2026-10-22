import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AlertToast from '../components/AlertToast';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import ReceiptModal from '../components/ReceiptModal';
import { useAuth } from '../context/AuthContext';
import { downloadCsv, printReport } from '../utils/reportExport';

const TRANSACTIONS_PER_PAGE = 10;

export default function TransactionsPage({ storeInfo }) {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSales, setTotalSales] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Selected Sale for viewing/reprinting
  const [selectedSale, setSelectedSale] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);

  // Refund Modal State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [saleToRefund, setSaleToRefund] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [restockOnRefund, setRestockOnRefund] = useState(true);
  const [refundQuantities, setRefundQuantities] = useState({});
  const [refundLoading, setRefundLoading] = useState(false);

  const getRefundedQuantities = (sale) => {
    const refunded = {};
    (sale?.refunds || []).forEach((refund) => {
      const items = Array.isArray(refund.itemsJson) ? refund.itemsJson : [];
      items.forEach((item) => {
        refunded[item.productId] = (refunded[item.productId] || 0) + Number(item.quantity || 0);
      });
    });
    return refunded;
  };

  const getRemainingQuantity = (item) => Math.max(0, Number(item.quantity || 0) - (getRefundedQuantities(saleToRefund)[item.productId] || 0));

  const refundTotal = (saleToRefund?.items || []).reduce((total, item) => {
    const quantity = Number(refundQuantities[item.productId] || 0);
    const unitPrice = Number(item.quantity) > 0 ? Number(item.lineTotal) / Number(item.quantity) : 0;
    return total + (unitPrice * quantity);
  }, 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSales();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, paymentFilter, statusFilter, startDate, endDate, currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalSales / TRANSACTIONS_PER_PAGE));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedSales = sales;

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSales({
        search,
        paymentMethod: paymentFilter,
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        limit: TRANSACTIONS_PER_PAGE,
      });
      setSales(res.data?.sales || []);
      setTotalSales(Number(res.data?.total || 0));
    } catch (err) {
      setErrorMessage(err.message || 'Error fetching transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReceipt = async (id) => {
    try {
      const res = await api.getSaleById(id);
      setSelectedSale(res.data.sale);
    } catch (err) {
      setErrorMessage(err.message || 'Error loading receipt');
    }
  };

  const handleOpenOrderDetails = async (id) => {
    try {
      const res = await api.getSaleById(id);
      setOrderDetails(res.data.sale);
    } catch (err) {
      setErrorMessage(err.message || 'Error loading order details');
    }
  };

  const exportTransactionsCsv = () => {
    downloadCsv(`mona-transactions-${new Date().toISOString().slice(0, 10)}.csv`, [{
      title: 'Sales Transactions',
      headers: ['Transaction', 'Date', 'Cashier', 'Items', 'Payment method', 'Total', 'Status'],
      rows: sales.map((sale) => [
        sale.transactionNumber,
        formatDateTime(sale.createdAt),
        sale.cashier?.fullName || sale.cashier?.username || '',
        sale.items ? sale.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0,
        sale.paymentMethod,
        sale.totalAmount,
        sale.status,
      ]),
    }]);
  };

  const printTransactionsReport = () => {
    printReport({
      title: 'Transaction History',
      subtitle: startDate || endDate ? `${startDate || 'Start'} to ${endDate || 'Today'}` : 'Current filtered transactions',
      summary: [
        ['Transactions', sales.length],
        ['Sales total', formatCurrency(sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0))],
        ['Completed', sales.filter((sale) => sale.status === 'COMPLETED').length],
        ['Refunded', sales.filter((sale) => sale.status !== 'COMPLETED').length],
      ],
      columns: ['Transaction', 'Date', 'Cashier', 'Items', 'Method', 'Total', 'Status'],
      rows: sales.map((sale) => [
        sale.transactionNumber,
        formatDateTime(sale.createdAt),
        sale.cashier?.fullName || sale.cashier?.username || '',
        sale.items ? sale.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0,
        sale.paymentMethod,
        formatCurrency(sale.totalAmount),
        sale.status,
      ]),
    });
  };

  const handleOpenRefund = async (sale) => {
    setRefundLoading(true);
    try {
      const response = await api.getSaleById(sale.id);
      const freshSale = response.data.sale;
      setSaleToRefund(freshSale);
      setRefundQuantities(Object.fromEntries((freshSale.items || []).map((item) => [item.productId, ''])));
    } catch (err) {
      setErrorMessage(err.message || 'Unable to load sale items for refund.');
      return;
    } finally {
      setRefundLoading(false);
    }
    setRefundReason('');
    setRestockOnRefund(true);
    setRefundModalOpen(true);
  };

  const handleProcessRefundSubmit = async (e) => {
    e.preventDefault();
    if (!saleToRefund) return;

    try {
      const itemsToRefund = saleToRefund.items
        .map((i) => ({
        productId: i.productId,
          quantity: Number(refundQuantities[i.productId] || 0),
        }))
        .filter((item) => item.quantity > 0);

      if (itemsToRefund.length === 0) {
        setErrorMessage('Enter a refund quantity for at least one item.');
        return;
      }

      await api.processRefund({
        saleId: saleToRefund.id,
        reason: refundReason,
        items: itemsToRefund,
        restockItems: restockOnRefund,
      });

      setSuccessMessage(`Refund of ${formatCurrency(refundTotal)} processed for ${saleToRefund.transactionNumber}.`);
      setRefundModalOpen(false);
      loadSales();
    } catch (err) {
      setErrorMessage(err.message || 'Refund processing failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pos-panel-header" style={{ borderRadius: 'var(--radius-sm)' }}>
        <h1 className="pos-panel-title" style={{ fontSize: '18px' }}>Sales & Transaction History</h1>
        <div className="report-toolbar-actions">
          {isAdmin && <>
            <button className="btn btn-secondary btn-sm" onClick={exportTransactionsCsv}>Export CSV</button>
            <button className="btn btn-primary btn-sm" onClick={printTransactionsReport}>Print / PDF</button>
            <span className="export-toolbar-divider" />
          </>}
          <button className="btn btn-secondary btn-sm" onClick={loadSales}>Refresh History</button>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="pos-panel transaction-filters">
        <label className="filter-field filter-search-field">
          <span>Search transactions</span>
          <input
            type="text"
            className="search-input"
            placeholder="Transaction number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </label>

        <label className="filter-field">
          <span>Payment method</span>
          <select
            className="form-control"
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All methods</option>
            <option value="CASH">Cash</option>
            <option value="GCASH">GCash</option>
            <option value="QRPH">QRPH</option>
          </select>
        </label>

        <label className="filter-field">
          <span>Status</span>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PARTIALLY_REFUNDED">Partially refunded</option>
          </select>
        </label>

        <div className="filter-field date-range-field">
          <span>Date range</span>
          <div className="date-range-inputs">
            <input
              type="date"
              className="form-control"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            />
            <span>to</span>
            <input
              type="date"
              className="form-control"
              aria-label="End date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

      </div>

      {errorMessage && <AlertToast type="error" message={errorMessage} onClose={() => setErrorMessage('')} />}
      {successMessage && <AlertToast message={successMessage} onClose={() => setSuccessMessage('')} />}

      {/* Transactions Table */}
      <div className="pos-panel">
        <div className="table-container">
          <table className="pos-table" id="transactions-table">
            <thead>
              <tr>
                <th>Receipt / Trans #</th>
                <th>Date & Time</th>
                <th>Cashier</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th style={{ textAlign: 'center' }}>Method</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                    {isLoading ? 'Loading transactions...' : 'No transactions found.'}
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale) => (
                  <tr key={sale.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {sale.transactionNumber}
                    </td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td>{sale.cashier?.fullName || sale.cashier?.username}</td>
                    <td style={{ textAlign: 'center' }}>
                      {sale.items ? sale.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0) : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge-tag">{sale.paymentMethod}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="badge-tag"
                        style={{
                          backgroundColor:
                            sale.status === 'REFUNDED'
                              ? 'var(--error-bg)'
                              : sale.status === 'PARTIALLY_REFUNDED'
                              ? 'var(--warning-bg)'
                              : 'var(--light-pink)',
                          color:
                            sale.status === 'REFUNDED'
                              ? 'var(--error)'
                              : sale.status === 'PARTIALLY_REFUNDED'
                              ? 'var(--warning)'
                              : 'var(--dark-pink)',
                        }}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: '6px' }}
                        onClick={() => handleOpenOrderDetails(sale.id)}
                      >
                        Order Details
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: '6px' }}
                        onClick={() => handleOpenReceipt(sale.id)}
                      >
                        Reprint Receipt
                      </button>
                      {isAdmin && sale.status !== 'REFUNDED' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--error)' }}
                          onClick={() => handleOpenRefund(sale)}
                          disabled={refundLoading}
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalSales > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--secondary-text)', fontSize: '13px' }}>
              Showing {(visiblePage - 1) * TRANSACTIONS_PER_PAGE + 1}-{Math.min(visiblePage * TRANSACTIONS_PER_PAGE, totalSales)} of {totalSales} transactions
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={visiblePage === 1}
              >
                Previous
              </button>
              <span aria-live="polite" style={{ fontSize: '13px', minWidth: '76px', textAlign: 'center' }}>
                Page {visiblePage} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={visiblePage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reprint Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedSale)}
        saleData={selectedSale}
        storeInfo={storeInfo}
        onClose={() => setSelectedSale(null)}
      />

      {orderDetails && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setOrderDetails(null)}>
          <div className="modal-dialog order-details-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">TRANSACTION DETAILS</p>
                <h2 className="modal-title">{orderDetails.transactionNumber}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setOrderDetails(null)} aria-label="Close order details">&times;</button>
            </div>

            <div className="modal-body order-details-body">
              <div className="order-details-meta">
                <span><strong>Date:</strong> {formatDateTime(orderDetails.createdAt)}</span>
                <span><strong>Cashier:</strong> {orderDetails.cashier?.fullName || orderDetails.cashier?.username || '—'}</span>
                <span><strong>Status:</strong> {orderDetails.status}</span>
                <span><strong>Payment:</strong> {orderDetails.paymentMethod}</span>
              </div>

              <div className="table-container order-details-table-wrap">
                <table className="pos-table order-details-table">
                  <thead><tr><th>Product</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Discount</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>{(orderDetails.items || []).map((item) => {
                    const refundedQuantity = getRefundedQuantities(orderDetails)[item.productId] || 0;
                    const originalQuantity = Number(item.quantity || 0);
                    const refundLabel = refundedQuantity >= originalQuantity
                      ? 'REFUNDED'
                      : refundedQuantity > 0
                        ? `PARTIALLY REFUNDED (${refundedQuantity})`
                        : '';

                    return (
                    <tr key={item.id}>
                      <td><strong>{item.productName}</strong><small>{item.sku} {item.barcode ? `· ${item.barcode}` : ''}</small></td>
                      <td data-label="Qty" style={{ textAlign: 'center' }}>
                        {item.quantity}
                        {refundLabel && <small style={{ display: 'block', color: 'var(--dark-pink)', fontWeight: 700 }}>{refundLabel}</small>}
                      </td>
                      <td data-label="Price" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.unitPrice)}</td>
                      <td data-label="Discount" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.discount)}</td>
                      <td data-label="Total" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{formatCurrency(item.lineTotal)}</td>
                    </tr>
                    );
                  })}</tbody>
                </table>
              </div>

              <div className="order-details-summary">
                <div><span>Subtotal</span><strong>{formatCurrency(orderDetails.subtotal)}</strong></div>
                <div><span>Discounts</span><strong>-{formatCurrency(Number(orderDetails.itemDiscountTotal || 0) + Number(orderDetails.orderDiscountTotal || 0))}</strong></div>
                <div><span>VAT included</span><strong>{formatCurrency(orderDetails.taxTotal)}</strong></div>
                <div className="order-details-grand-total"><span>Total</span><strong>{formatCurrency(orderDetails.totalAmount)}</strong></div>
                <div><span>Amount received</span><strong>{formatCurrency(orderDetails.amountTendered)}</strong></div>
                <div><span>Change</span><strong>{formatCurrency(orderDetails.changeDue)}</strong></div>
              </div>

              {orderDetails.refunds?.length > 0 && (
                <div className="order-refund-history">
                  <h3>Refund history</h3>
                  {orderDetails.refunds.map((refund) => <div key={refund.id}><span>{refund.refundNumber} · {formatDateTime(refund.createdAt)}</span><strong>{formatCurrency(refund.amount)}</strong></div>)}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setOrderDetails(null)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => { setSelectedSale(orderDetails); setOrderDetails(null); }}>Reprint Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Refund Modal */}
      {refundModalOpen && saleToRefund && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Authorize Partial Refund</h2>
              <button className="modal-close-btn" onClick={() => setRefundModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleProcessRefundSubmit}>
              <div className="modal-body refund-modal-body">
                <p style={{ marginBottom: '10px' }}>
                  Transaction: <strong>{saleToRefund.transactionNumber}</strong>
                </p>

                <div className="refund-items-list">
                  <div className="refund-items-heading"><span>Item</span><span>Remaining</span><span>Refund qty</span></div>
                  {saleToRefund.items.map((item) => {
                    const remaining = getRemainingQuantity(item);
                    return (
                      <div className="refund-item-row" key={item.id}>
                        <div><strong>{item.productName}</strong><small>{formatCurrency(item.unitPrice)} each</small></div>
                        <span>{remaining} available</span>
                        <input
                          className="form-control refund-quantity-input"
                          type="number"
                          min="0"
                          max={remaining}
                          step="0.001"
                          value={refundQuantities[item.productId] || ''}
                          disabled={remaining <= 0}
                          onChange={(event) => setRefundQuantities((current) => ({ ...current, [item.productId]: event.target.value }))}
                          placeholder="0"
                          aria-label={`Refund quantity for ${item.productName}`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="refund-total-callout"><span>Refund amount</span><strong>{formatCurrency(refundTotal)}</strong></div>

                <div className="form-group">
                  <label className="field-label">Reason for Return / Refund *</label>
                  <textarea
                    required
                    rows="3"
                    className="form-control"
                    placeholder="e.g. Defective item, customer changed mind, wrong product scanned"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="chk-restock"
                    checked={restockOnRefund}
                    onChange={(e) => setRestockOnRefund(e.target.checked)}
                  />
                  <label htmlFor="chk-restock" className="field-label" style={{ marginBottom: 0 }}>
                    Restock items back into active inventory
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRefundModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
