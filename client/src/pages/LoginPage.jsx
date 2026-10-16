import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      await login(username.trim(), password);
    } catch (err) {
      setErrorMessage(err.code === 'DEVICE_NOT_AUTHORIZED'
        ? 'This device is not authorized. Ask an administrator to approve it.'
        : (err.message || 'Invalid username or password.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--soft-pink-bg)',
        padding: '20px',
      }}
    >
      <div
        className="pos-panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img
            src="/mona-removebg-preview.png"
            alt="Mona's Grocery Store logo"
            style={{
              width: '92px',
              height: '92px',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto 10px',
            }}
          />
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '800',
              color: 'var(--dark-pink)',
              marginBottom: '4px',
            }}
          >
            Mona's Grocery Store
          </h1>
          <p style={{ color: 'var(--secondary-text)', fontSize: '13px' }}>
            Grocery Store Point of Sale
          </p>
        </div>

        {errorMessage && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>{errorMessage}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="field-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              className="form-control"
              placeholder="Enter your cashier username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            id="btn-login"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '15px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}
