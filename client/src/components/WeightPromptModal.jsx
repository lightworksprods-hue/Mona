import React, { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/formatters';

export default function WeightPromptModal({ product, onClose, onConfirm }) {
  const [kilograms, setKilograms] = useState('');

  useEffect(() => {
    setKilograms('');
  }, [product]);

  if (!product) return null;

  const weight = Number(kilograms || 0);
  const available = Number(product.stockQuantity);
  const total = weight > 0 ? weight * Number(product.sellingPrice) : 0;
  const isValid = weight > 0 && weight <= available;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isValid) onConfirm(Number(weight.toFixed(3)));
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="weight-modal-title">
      <form className="modal-dialog weight-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2 id="weight-modal-title" className="modal-title">Enter weight</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <strong className="weight-product-name">{product.name}</strong>
          <p>{formatCurrency(product.sellingPrice)} per kg · {available} kg available</p>
          <label className="field-label" htmlFor="input-weight-kilograms">Kilograms</label>
          <input
            id="input-weight-kilograms"
            className="form-control"
            type="number"
            min="0.001"
            max={available}
            step="0.001"
            placeholder="e.g. 1.250"
            value={kilograms}
            onChange={(event) => setKilograms(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            autoFocus
          />
          {weight > available && <p className="weight-error">Only {available} kg is available.</p>}
          <div className="weight-total">Estimated total <strong>{formatCurrency(total)}</strong></div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!isValid}>Add to cart</button>
        </div>
      </form>
    </div>
  );
}
