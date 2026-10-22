import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const numberValue = (value) => Number(value || 0);

function friendlyCashDrawerError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (error.code === 'CASH_DRAWER_HARDWARE_ERROR' || error.status === 502) {
    return 'The cash drawer could not open. Check that the XP-T80A printer is turned on, connected, and ready.';
  }
  if (error.status === 503) {
    return 'Cash drawer hardware is available only on the Windows POS computer.';
  }
  if (error.name === 'TypeError' || /network|fetch failed|failed to fetch/i.test(error.message || '')) {
    return 'The POS could not reach the printer service. Make sure the POS server is running on this computer.';
  }
  return error.message || fallback;
}

export default function CashDrawerPage({ onSessionChange }) {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementType, setMovementType] = useState('WITHDRAWAL');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingHardware, setOpeningHardware] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [currentResponse, historyResponse] = await Promise.all([
        api.getCashCurrent(),
        api.getCashHistory(),
      ]);
      setSummary(currentResponse.data);
      onSessionChange?.(Boolean(currentResponse.data?.session));
      setHistory(historyResponse.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: friendlyCashDrawerError(error, 'Unable to load cash drawer data.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const sessionOpen = Boolean(summary?.session);
  const expectedCash = numberValue(summary?.expectedCash);
  const closingVariance = useMemo(() => numberValue(closingCash) - expectedCash, [closingCash, expectedCash]);

  const runAction = async (action, successText) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: friendlyCashDrawerError(error, 'The action could not be completed.') });
      return false;
    } finally {
      setSaving(false);
    }
    return true;
  };

  const openDrawer = (event) => {
    event.preventDefault();
    runAction(
      () => api.openCashSession({ openingCash: numberValue(openingCash), notes }),
      'Cash drawer opened successfully.'
    );
  };

  const recordMovement = (event) => {
    event.preventDefault();
    runAction(
      () => api.addCashMovement({ type: movementType, amount: numberValue(movementAmount), reason: movementReason }),
      movementType === 'WITHDRAWAL' ? 'Withdrawal recorded.' : 'Cash-in recorded.'
    ).then((completed) => {
      if (completed) {
        setMovementAmount('');
        setMovementReason('');
      }
    });
  };

  const closeDrawer = (event) => {
    event.preventDefault();
    runAction(
      () => api.closeCashSession({ closingCash: numberValue(closingCash), notes }),
      'Cash drawer closed and reconciled.'
    ).then((completed) => {
      if (completed) setClosingCash('');
    });
  };

  const openPhysicalDrawer = async () => {
    setOpeningHardware(true);
    setMessage({ type: '', text: '' });
    try {
      await api.openCashDrawer();
      setMessage({ type: 'success', text: 'Cash drawer opened.' });
    } catch (error) {
      setMessage({ type: 'error', text: friendlyCashDrawerError(error, 'Unable to open the cash drawer.') });
    } finally {
      setOpeningHardware(false);
    }
  };

  if (loading) return <div className="page-state">Loading cash drawer...</div>;

  return (
    <section className="cash-drawer-page">
      <div className="cash-drawer-header">
        <div>
          <p className="eyebrow">END-OF-DAY CONTROL</p>
          <h1>Cash drawer reconciliation</h1>
          <p>Track the money in the drawer from opening float to closing count.</p>
        </div>
        <div className="cash-drawer-header-actions">
          <button type="button" className="btn btn-secondary" onClick={openPhysicalDrawer} disabled={openingHardware}>
            {openingHardware ? 'Opening...' : 'Open cash drawer'}
          </button>
          <span className={`status-pill ${sessionOpen ? 'status-open' : 'status-closed'}`}>
            {sessionOpen ? 'Shift started' : 'Shift not started'}
          </span>
        </div>
      </div>

      {message.text && (
        <div className={`cash-message-card ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
          <span className="cash-message-icon" aria-hidden="true">{message.type === 'error' ? '!' : '✓'}</span>
          <div>
            <strong>{message.type === 'error' ? 'Drawer not opened' : 'Done'}</strong>
            <p>{message.text}</p>
            {message.type === 'error' && <small>Try again after checking the printer connection.</small>}
          </div>
        </div>
      )}

      {!sessionOpen ? (
        <div className="pos-panel cash-open-card">
          <div className="pos-panel-header"><h2>Open today’s drawer</h2></div>
          <form onSubmit={openDrawer} className="cash-form-row">
            <label>Opening cash
              <input className="form-control" type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="0.00" required />
            </label>
            <label>Notes <span className="optional-label">(optional)</span>
              <input className="form-control" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Starting float, shift notes..." />
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving}>Open drawer</button>
          </form>
        </div>
      ) : (
        <>
          <div className="cash-summary-grid">
            <div className="metric-card"><span>Opening cash</span><strong>{formatCurrency(summary.session.openingCash)}</strong></div>
            <div className="metric-card"><span>Cash sales</span><strong>{formatCurrency(summary.netCashSales)}</strong><small>After refunds: {formatCurrency(summary.refunded)}</small></div>
            <div className="metric-card"><span>Withdrawals</span><strong>{formatCurrency(summary.withdrawals)}</strong><small>Cash-in: {formatCurrency(summary.cashIns)}</small></div>
            <div className="metric-card metric-card-highlight"><span>Expected cash</span><strong>{formatCurrency(expectedCash)}</strong><small>Count this amount before closing</small></div>
          </div>

          <div className="cash-action-grid">
            <div className="pos-panel">
              <div className="pos-panel-header"><h2>Record drawer movement</h2></div>
              <form onSubmit={recordMovement} className="cash-form-stack">
                <div className="cash-toggle-row">
                  <button type="button" className={movementType === 'WITHDRAWAL' ? 'active' : ''} onClick={() => setMovementType('WITHDRAWAL')}>Withdrawal</button>
                  <button type="button" className={movementType === 'CASH_IN' ? 'active' : ''} onClick={() => setMovementType('CASH_IN')}>Cash in</button>
                </div>
                <label>Amount<input className="form-control" type="number" min="0.01" step="0.01" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} placeholder="0.00" required /></label>
                <label>Reason<input className="form-control" value={movementReason} onChange={(event) => setMovementReason(event.target.value)} placeholder="Petty cash, supplier payment..." required /></label>
                <button className="btn btn-secondary" type="submit" disabled={saving}>Save movement</button>
              </form>
            </div>

            <div className="pos-panel cash-close-card">
              <div className="pos-panel-header"><h2>Close and reconcile</h2></div>
              <form onSubmit={closeDrawer} className="cash-form-stack">
                <label>Actual closing cash<input className="form-control" type="number" min="0" step="0.01" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} placeholder="Count the drawer" required /></label>
                <div className={`variance-preview ${closingCash === '' ? '' : closingVariance === 0 ? 'is-balanced' : closingVariance > 0 ? 'is-over' : 'is-short'}`}>
                  <span>Cashier variance</span><strong>{closingCash === '' ? '—' : formatCurrency(closingVariance)}</strong>
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving}>Close drawer</button>
              </form>
            </div>
          </div>

          <div className="pos-panel cash-movements-panel">
            <div className="pos-panel-header"><h2>Today’s movements</h2><span>{summary.movements?.length || 0} entries</span></div>
            {summary.movements?.length ? <div className="cash-movement-list">{summary.movements.map((movement) => <div className="cash-movement-row" key={movement.id}><span className={`movement-tag ${movement.type === 'CASH_IN' ? 'cash-in' : 'withdrawal'}`}>{movement.type === 'CASH_IN' ? 'Cash in' : 'Withdrawal'}</span><span>{movement.reason}</span><small>{formatDateTime(movement.createdAt)}</small><strong>{movement.type === 'CASH_IN' ? '+' : '-'}{formatCurrency(movement.amount)}</strong></div>)}</div> : <p className="empty-state">No withdrawals or cash-ins recorded for this drawer.</p>}
          </div>
        </>
      )}

      <div className="pos-panel cash-history-panel">
        <div className="pos-panel-header"><h2>Reconciliation history</h2><span>Last 100 sessions</span></div>
        <div className="cash-history-table-wrap"><table className="cash-history-table"><thead><tr><th>Opened</th><th>Cashier</th><th>Opening</th><th>Expected</th><th>Closing</th><th>Variance</th><th>Status</th></tr></thead><tbody>{history.length ? history.map((item) => <tr key={item.id}><td>{formatDateTime(item.openedAt)}</td><td>{item.cashier?.fullName || item.cashier?.username || '—'}</td><td>{formatCurrency(item.openingCash)}</td><td>{item.expectedCash == null ? '—' : formatCurrency(item.expectedCash)}</td><td>{item.closingCash == null ? '—' : formatCurrency(item.closingCash)}</td><td className={numberValue(item.variance) < 0 ? 'variance-negative' : numberValue(item.variance) > 0 ? 'variance-positive' : ''}>{item.variance == null ? '—' : formatCurrency(item.variance)}</td><td><span className={`status-pill ${item.status === 'OPEN' ? 'status-open' : 'status-closed'}`}>{item.status}</span></td></tr>) : <tr><td colSpan="7" className="empty-state">No cash sessions yet.</td></tr>}</tbody></table></div>
      </div>
    </section>
  );
}
