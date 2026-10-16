import React, { useState } from 'react';
import { api } from '../services/api';

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

export default function PointsTrackerPage() {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [showRewards, setShowRewards] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    setResult(null);
    setHasChecked(false);
    setErrorMessage('');

    if (normalizedPhone.replace(/\D/g, '').length < 7) {
      setErrorMessage('Please enter a valid phone number with at least 7 digits.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.lookupCustomerPoints(normalizedPhone);
      setResult(response.data);
      setRewards(response.rewards || []);
      setShowRewards(false);
      setHasChecked(true);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to check points right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="points-tracker-page">
      <section className="points-tracker-card" aria-labelledby="points-tracker-title">
        <div className="points-tracker-brand">MONA</div>
        <h1 id="points-tracker-title">Check your points</h1>
        <p className="points-tracker-intro">
          Enter the phone number you used at checkout to view your loyalty points balance.
        </p>

        <form onSubmit={handleSubmit} className="points-tracker-form">
          <label htmlFor="points-phone">Phone number</label>
          <input
            id="points-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. 09171234567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <button className="btn btn-primary points-tracker-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Check points'}
          </button>
        </form>

        {errorMessage && <p className="points-tracker-message is-error" role="alert">{errorMessage}</p>}

        {result && (
          <div className="points-tracker-result" role="status">
            <span className="points-tracker-result-label">Available points</span>
            <strong>{Number(result.pointsBalance || 0).toLocaleString()}</strong>
            <span className="points-tracker-result-caption">loyalty points</span>
            {result.updatedAt && (
              <small>Last updated {new Date(result.updatedAt).toLocaleDateString()}</small>
            )}
          </div>
        )}

        {hasChecked && rewards.length > 0 && (
          <div className="points-tracker-rewards">
            <button type="button" className="btn btn-secondary points-tracker-rewards-toggle" onClick={() => setShowRewards((visible) => !visible)}>
              {showRewards ? 'Hide available rewards' : 'Show available rewards'}
            </button>
            {showRewards && (
              <div className="points-tracker-rewards-list">
                <h2>Available rewards</h2>
                {rewards.map((reward) => (
                  <div className="points-tracker-reward" key={reward.id}>
                    <div>
                      <div className="points-tracker-reward-name">{reward.product.name}</div>
                      <div className="points-tracker-reward-meta">{Number(reward.product.stockQuantity || 0) > 0 ? 'Available in store' : 'Currently out of stock'}</div>
                    </div>
                    <span className="customer-points-badge">{reward.pointsCost} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {hasChecked && result === null && !errorMessage && !isLoading && (
          <p className="points-tracker-message">No loyalty account was found for that phone number.</p>
        )}

        <p className="points-tracker-help">Points are added after each completed purchase.</p>
      </section>
    </main>
  );
}
