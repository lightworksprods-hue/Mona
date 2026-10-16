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
      setErrorMessage(err.message || 'Invalid username or password.');
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
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '800',
              color: 'var(--dark-pink)',
              marginBottom: '4px',
            }}
          >
            Counter POS System
          </h1>
          <p style={{ color: 'var(--secondary-text)', fontSize: '13px' }}>
            Cashier Station & Point of Sale Terminal
          </p>
        </div>

        {errorMessage && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            {errorMessage}
          </div>
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
            {isLoading ? 'Authenticating...' : 'Sign In to POS'}
          </button>
        </form>

      </div>
    </div>
  );
}
