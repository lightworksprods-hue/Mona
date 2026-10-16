import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import ReceiptModal from '../components/ReceiptModal';
import { useAuth } from '../context/AuthContext';

export default function TransactionsPage({ storeInfo }) {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Selected Sale for viewing/reprinting
  const [selectedSale, setSelectedSale] = useState(null);

  // Refund Modal State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [saleToRefund, setSaleToRefund] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [restockOnRefund, setRestockOnRefund] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSales();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, paymentFilter, statusFilter, startDate, endDate]);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSales({
        search,
        paymentMethod: paymentFilter,
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setSales(res.data?.sales || []);
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

  const handleOpenRefund = (sale) => {
    setSaleToRefund(sale);
    setRefundReason('');
    setRestockOnRefund(true);
    setRefundModalOpen(true);
  };

  const handleProcessRefundSubmit = async (e) => {
    e.preventDefault();
    if (!saleToRefund) return;

    try {
      // Refund all items on the sale
      const itemsToRefund = saleToRefund.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      }));

      await api.processRefund({
        saleId: saleToRefund.id,
        reason: refundReason,
        items: itemsToRefund,
        restockItems: restockOnRefund,
      });

      setSuccessMessage(`Refund processed for ${saleToRefund.transactionNumber}.`);
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
        <button className="btn btn-secondary btn-sm" onClick={loadSales}>
          Refresh History
        </button>
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
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <label className="filter-field">
          <span>Payment method</span>
          <select
            className="form-control"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="">All methods</option>
            <option value="CASH">Cash</option>
            <option value="GCASH">GCash</option>
            <option value="MAYA">Maya</option>
          </select>
        </label>

        <label className="filter-field">
          <span>Status</span>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span>to</span>
            <input
              type="date"
              className="form-control"
              aria-label="End date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

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
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {sale.transactionNumber}
                    </td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td>{sale.cashier?.fullName || sale.cashier?.username}</td>
                    <td style={{ textAlign: 'center' }}>
                      {sale.items ? sale.items.reduce((sum, i) => sum + i.quantity, 0) : '-'}
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
                        onClick={() => handleOpenReceipt(sale.id)}
                      >
                        Reprint Receipt
                      </button>
                      {isAdmin && sale.status === 'COMPLETED' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--error)' }}
                          onClick={() => handleOpenRefund(sale)}
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
      </div>

      {/* Reprint Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedSale)}
        saleData={selectedSale}
        storeInfo={storeInfo}
        onClose={() => setSelectedSale(null)}
      />

      {/* Refund Confirmation Modal */}
      {refundModalOpen && saleToRefund && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Authorize Sale Refund</h2>
              <button className="modal-close-btn" onClick={() => setRefundModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleProcessRefundSubmit}>
              <div className="modal-body">
                <p style={{ marginBottom: '10px' }}>
                  Transaction: <strong>{saleToRefund.transactionNumber}</strong>
                </p>
                <p style={{ marginBottom: '14px' }}>
                  Refund Amount: <strong style={{ color: 'var(--error)' }}>{formatCurrency(saleToRefund.totalAmount)}</strong>
                </p>

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
