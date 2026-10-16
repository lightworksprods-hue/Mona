/**
 * Utility functions for monetary formatting, decimal calculation, and transaction codes
 */

// Format monetary number to Philippine Peso (PHP) format: ₱1,250.00
function formatCurrency(amount) {
  const numeric = Number(amount || 0);
  return `₱${numeric.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Ensure 2-decimal rounded precision for financial calculations
function roundMoney(amount) {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

// Generate unique transaction number: e.g., POS-20261016-8924
function generateTransactionNumber(prefix = 'POS') {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${randomSuffix}`;
}

// Generate refund reference: e.g., REF-20261016-1234
function generateRefundNumber() {
  return generateTransactionNumber('REF');
}

module.exports = {
  formatCurrency,
  roundMoney,
  generateTransactionNumber,
  generateRefundNumber,
};
