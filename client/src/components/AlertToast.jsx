import React, { useEffect } from 'react';

export default function AlertToast({ type = 'success', message, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  useEffect(() => {
    if (type !== 'success') return undefined;
    const handleEnter = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEnter, true);
    return () => window.removeEventListener('keydown', handleEnter, true);
  }, [type, onClose]);

  return (
    <div className="alert-modal-backdrop">
      <div className={`alert-modal-card ${type}`} role={type === 'error' ? 'alert' : 'status'}>
        <div className="alert-modal-icon" aria-hidden="true">{type === 'error' ? '!' : '✓'}</div>
        <h3>{type === 'error' ? 'Something went wrong' : 'Success'}</h3>
        <p>{message}</p>
        <button type="button" className="alert-modal-ok" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}
