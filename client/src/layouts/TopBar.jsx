import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function TopBar({ storeInfo, activeTab, setActiveTab, theme, onToggleTheme }) {
  const { user, logout, isAdmin } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' | ' + currentTime.toLocaleTimeString('en-PH', { hour12: true });

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  useEffect(() => {
    if (!showLogoutConfirm) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowLogoutConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirm]);

  return (
    <header>
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="brand-title">{storeInfo?.storeName || 'Counter POS'}</span>
          <span className="badge-tag">Point of Sale</span>
        </div>

        <div className="top-bar-center">
          {formattedTime}
        </div>

        <div className="top-bar-right">
          <span className="user-status">
            Staff: <strong>{user?.fullName || user?.username}</strong>
          </span>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '☾ Dark' : '☀ Light'}
          </button>
          <button id="btn-logout" className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <nav className="nav-bar">
        <button
          id="nav-pos"
          className={`nav-tab ${activeTab === 'pos' ? 'active' : ''}`}
          onClick={() => setActiveTab('pos')}
        >
          Counter POS
        </button>

        {isAdmin && (
          <button
            id="nav-products"
            className={`nav-tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Products
          </button>
        )}

        {isAdmin && (
          <button
            id="nav-inventory"
            className={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
        )}

        <button
          id="nav-transactions"
          className={`nav-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>

        <button
          id="nav-cash"
          className={`nav-tab ${activeTab === 'cash' ? 'active' : ''}`}
          onClick={() => setActiveTab('cash')}
        >
          Cash Drawer
        </button>

        {isAdmin && (
          <button
            id="nav-reports"
            className={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports & Stats
          </button>
        )}

        {isAdmin && (
          <button
            id="nav-settings"
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        )}
      </nav>

      {showLogoutConfirm && (
        <div className="modal-overlay logout-overlay" onMouseDown={() => setShowLogoutConfirm(false)}>
          <div
            className="modal-dialog logout-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title" id="logout-dialog-title">Confirm logout</div>
              <button className="modal-close-btn" type="button" onClick={() => setShowLogoutConfirm(false)} aria-label="Close">×</button>
            </div>
            <div className="modal-body logout-body">
              <div className="logout-icon">↪</div>
              <div>
                <h2>Leave MONA POS?</h2>
                <p>Your current session will be signed out securely.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="btn btn-primary logout-confirm-btn" type="button" onClick={logout}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
