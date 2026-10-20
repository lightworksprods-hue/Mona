import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';
import TopBar from './layouts/TopBar';
import CounterPOSPage from './pages/CounterPOSPage';
import LoginPage from './pages/LoginPage';

const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CashDrawerPage = lazy(() => import('./pages/CashDrawerPage'));
import {
  cacheSettings,
  getFailedSales,
  getCachedSettings,
  getPendingSales,
  isNetworkError,
  markSaleFailed,
  removePendingSale,
  retryFailedSales,
} from './utils/offlineStore';

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('mona-active-tab') || 'pos');
  const [cashDrawerOpen, setCashDrawerOpen] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('mona-theme') || 'light');
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingSales, setPendingSales] = useState(() => getPendingSales().length);
  const [failedSales, setFailedSales] = useState(() => getFailedSales().length);
  const [queueVersion, setQueueVersion] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mona-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('mona-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      const cached = getCachedSettings();
      if (cached) setStoreInfo(cached);
      loadStoreSettings();
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    if (!user || isAdmin) {
      setCashDrawerOpen(isAdmin ? true : null);
      return undefined;
    }

    api.getCashCurrent()
      .then((response) => {
        if (!cancelled) setCashDrawerOpen(Boolean(response.data?.session));
      })
      .catch(() => {
        if (!cancelled) setCashDrawerOpen(false);
      });

    return () => { cancelled = true; };
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && !isAdmin && cashDrawerOpen === false) setActiveTab('cash');
  }, [user, isAdmin, cashDrawerOpen]);

  useEffect(() => {
    if (user && !isAdmin && !['pos', 'transactions', 'cash'].includes(activeTab)) {
      setActiveTab(cashDrawerOpen === false ? 'cash' : 'pos');
    }
  }, [user, isAdmin, activeTab, cashDrawerOpen]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    const updateQueueCount = () => {
      setPendingSales(getPendingSales().length);
      setFailedSales(getFailedSales().length);
    };
    const requestQueueRetry = () => setQueueVersion((version) => version + 1);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('offline_queue_changed', updateQueueCount);
    window.addEventListener('offline_retry_requested', requestQueueRetry);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('offline_queue_changed', updateQueueCount);
      window.removeEventListener('offline_retry_requested', requestQueueRetry);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || !user) return undefined;

    const syncPendingSales = async () => {
      const pending = getPendingSales();
      for (const sale of pending) {
        try {
          await api.checkout(sale.payload);
          removePendingSale(sale.id);
        } catch (error) {
          if (isNetworkError(error) || error.status === 401) break;
          if (error.status === 400 || error.status === 409) {
            markSaleFailed(sale.id, error.message || 'The sale was rejected by the server.');
            continue;
          }
          break;
        }
      }
      setPendingSales(getPendingSales().length);
    };

    syncPendingSales();
    const timer = setInterval(syncPendingSales, 30000);
    return () => clearInterval(timer);
  }, [isOnline, user, queueVersion]);

  const loadStoreSettings = async () => {
    try {
      const res = await api.getSettings();
      setStoreInfo(res.data);
      cacheSettings(res.data);
    } catch (err) {
      const cached = getCachedSettings();
      if (cached) setStoreInfo(cached);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--soft-pink-bg)',
          color: 'var(--dark-pink)',
          fontWeight: 'bold',
          fontSize: '16px',
        }}
      >
        Initializing Counter POS System...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-container">
      <TopBar
        storeInfo={storeInfo}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        canUsePOS={isAdmin || cashDrawerOpen === true}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      />

      <main className={`main-viewport ${activeTab === 'pos' ? 'pos-main-viewport' : ''}`}>
        {failedSales > 0 && (
          <div className="offline-queue-warning">
            <span>{failedSales} offline sale{failedSales === 1 ? '' : 's'} need attention because the server rejected them.</span>
            <button className="btn btn-secondary btn-sm" onClick={retryFailedSales}>Retry failed sales</button>
          </div>
        )}
        <Suspense fallback={<div className="page-state">Loading page...</div>}>
          {activeTab === 'pos' && (isAdmin || cashDrawerOpen === true) && <CounterPOSPage storeInfo={storeInfo} />}
          {activeTab === 'products' && isAdmin && <ProductsPage />}
          {activeTab === 'inventory' && isAdmin && <InventoryPage />}
          {activeTab === 'transactions' && <TransactionsPage storeInfo={storeInfo} />}
          {activeTab === 'cash' && <CashDrawerPage onSessionChange={setCashDrawerOpen} />}
          {activeTab === 'reports' && isAdmin && <ReportsPage />}
          {activeTab === 'settings' && isAdmin && (
            <SettingsPage storeInfo={storeInfo} onStoreUpdate={setStoreInfo} />
          )}
        </Suspense>
      </main>
    </div>
  );
}
