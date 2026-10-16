import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { formatCurrency, roundMoney } from '../utils/formatters';
import CameraScannerModal from '../components/CameraScannerModal';
import ReceiptModal from '../components/ReceiptModal';
import WeightPromptModal from '../components/WeightPromptModal';
import { cacheProducts, getCachedProducts, isNetworkError, queueSale } from '../utils/offlineStore';

function formatTenderedInput(value) {
  if (value === '') return '';
  const [whole = '', decimal] = String(value).split('.');
  const groupedWhole = Number(whole || 0).toLocaleString('en-PH');
  return decimal === undefined ? groupedWhole : `${groupedWhole}.${decimal}`;
}

export default function CounterPOSPage({ storeInfo }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogProducts, setCatalogProducts] = useState([]);

  // Cart State
  const [cart, setCart] = useState([]);
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');

  // Status & Modals
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [weightProduct, setWeightProduct] = useState(null);

  const productInputRef = useRef(null);

  // Keep one field ready for either product search or a barcode scanner.
  useEffect(() => {
    focusProductInput();
  }, []);

  const focusProductInput = () => {
    if (productInputRef.current) {
      productInputRef.current.focus();
    }
  };

  // Load the complete active catalog so cashiers can choose products without a barcode.
  useEffect(() => {
    const loadCatalog = async () => {
      const cachedProducts = getCachedProducts();
      if (cachedProducts.length > 0) {
        setCatalogProducts(cachedProducts);
      }

      try {
        const res = await api.getProducts({ activeOnly: true });
        setCatalogProducts(res.data || []);
        cacheProducts(res.data || []);
      } catch (err) {
        if (cachedProducts.length > 0) {
          setSuccessMessage('Offline mode: using the last saved product catalog.');
        } else {
          setErrorMessage(err.message || 'Unable to load products.');
        }
      }
    };

    loadCatalog();
  }, []);

  const filteredCatalogProducts = catalogProducts.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [product.name, product.sku, product.barcode].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });

  // Enter adds an exact barcode/SKU; otherwise the same field filters the catalog.
  const handleProductSubmit = async (e) => {
    if (e) e.preventDefault();
    const code = searchQuery.trim();
    if (!code) return;

    setErrorMessage('');
    const catalogMatch = catalogProducts.find(
      (product) => product.barcode === code || product.sku.toLowerCase() === code.toLowerCase()
    );

    if (catalogMatch) {
      addProductToCart(catalogMatch);
      return;
    }

    try {
      const res = await api.lookupBarcode(code);
      if (res.success && res.data) {
        addProductToCart(res.data);
      }
    } catch (err) {
      setErrorMessage(err.message || `No product found for code "${code}".`);
    } finally {
      focusProductInput();
    }
  };

  const isWeightProduct = (product) => {
    const unit = product.unit?.trim().toLowerCase();
    const category = product.category?.name?.trim().toLowerCase();
    return ['kg', 'kilogram', 'kilograms'].includes(unit) || category === 'meat & poultry';
  };

  // Products sold by weight ask the cashier for kilograms before adding to the cart.
  const addProductToCart = (product) => {
    if (isWeightProduct(product)) {
      setWeightProduct(product);
      return;
    }

    addProductToCartWithQuantity(product, 1);
  };

  const addProductToCartWithQuantity = (product, requestedQuantity) => {
    const quantityToAdd = Number(requestedQuantity);
    if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) return;

    setErrorMessage('');
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);

      if (existingIndex > -1) {
        const updated = [...prevCart];
        const currentQty = updated[existingIndex].quantity;
        const newQty = Number((currentQty + quantityToAdd).toFixed(3));

        if (Number(product.stockQuantity) < newQty) {
          setErrorMessage(`Cannot add more. "${product.name}" only has ${product.stockQuantity} in stock.`);
          return prevCart;
        }

        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          lineTotal: roundMoney(newQty * Number(product.sellingPrice) - updated[existingIndex].discount),
        };
        return updated;
      } else {
        if (Number(product.stockQuantity) < quantityToAdd) {
          setErrorMessage(`Product "${product.name}" is currently out of stock.`);
          return prevCart;
        }

        const newItem = {
          product,
          quantity: quantityToAdd,
          unitPrice: Number(product.sellingPrice),
          discount: 0,
          lineTotal: roundMoney(quantityToAdd * Number(product.sellingPrice)),
        };
        return [...prevCart, newItem];
      }
    });

    setSearchQuery('');
  };

  // Update Cart Quantity
  const handleQuantityChange = (productId, newQuantity) => {
    const item = cart.find((cartItem) => cartItem.product.id === productId);
    const qty = isWeightProduct(item?.product) ? parseFloat(newQuantity) : parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (Number(item.product.stockQuantity) < qty) {
            setErrorMessage(`Maximum stock for "${item.product.name}" is ${item.product.stockQuantity}.`);
            return item;
          }
          const price = Number(item.product.sellingPrice);
          return {
            ...item,
            quantity: Number(qty.toFixed(3)),
            lineTotal: roundMoney(qty * price - item.discount),
          };
        }
        return item;
      })
    );
  };

  const handleQuantityInput = (productId, value) => {
    setQuantityDrafts((current) => ({ ...current, [productId]: value }));
    if (value !== '') handleQuantityChange(productId, value);
  };

  const commitQuantityInput = (productId) => {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  };

  const stepQuantity = (productId, value) => {
    commitQuantityInput(productId);
    handleQuantityChange(productId, value);
  };

  // Remove Item from Cart
  const handleRemoveItem = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
    focusProductInput();
  };

  // Clear Entire Cart with confirmation
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Are you sure you want to cancel current sale and clear the cart?')) {
      setCart([]);
      setAmountTendered('');
      setPaymentReference('');
      setOrderDiscount(0);
      setErrorMessage('');
      focusProductInput();
    }
  };

  // Financial Calculations
  const subtotal = roundMoney(cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const itemDiscountsTotal = roundMoney(cart.reduce((sum, item) => sum + Number(item.discount || 0), 0));
  const safeOrderDiscount = roundMoney(Number(orderDiscount || 0));
  const taxRate = Number(storeInfo?.taxRate || 0);

  const taxableBase = Math.max(0, subtotal - itemDiscountsTotal - safeOrderDiscount);
  const taxTotal = taxRate > 0 ? roundMoney((taxableBase * taxRate) / 100) : 0;
  const grandTotal = roundMoney(taxableBase + taxTotal);

  const numericTendered = Number(amountTendered || 0);
  const changeDue = Math.max(0, roundMoney(numericTendered - grandTotal));
  const isPaymentValid =
    cart.length > 0 &&
    (paymentMethod === 'CASH' ? numericTendered >= grandTotal : true);

  // Fast cash tender buttons (₱100, ₱500, ₱1,000, Exact)
  const handleQuickCash = (amount) => {
    if (amount === 'exact') {
      setAmountTendered(grandTotal.toString());
    } else {
      setAmountTendered(amount.toString());
    }
  };

  // Submit Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setErrorMessage('Shopping cart is empty.');
      return;
    }

    if (paymentMethod === 'CASH' && numericTendered < grandTotal) {
      setErrorMessage(`Insufficient payment. Amount tendered is less than ₱${grandTotal.toFixed(2)}.`);
      return;
    }

    if (paymentMethod !== 'CASH' && !paymentReference.trim()) {
      setErrorMessage(`Please enter transaction/reference number for ${paymentMethod} payment.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const payload = {
      offlineId: globalThis.crypto?.randomUUID?.() || `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        discount: item.discount,
      })),
      orderDiscount: safeOrderDiscount,
      paymentMethod,
      amountTendered: paymentMethod === 'CASH' ? numericTendered : grandTotal,
      paymentReference: paymentReference.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      const res = await api.checkout(payload);

      if (res.success && res.data) {
        setCompletedSale(res.data);
        // Reset current counter state
        setCart([]);
        setAmountTendered('');
        setPaymentReference('');
        setOrderDiscount(0);
        setNotes('');
        setSuccessMessage(`Transaction ${res.data.transactionNumber} completed!`);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        if (paymentMethod !== 'CASH') {
          setErrorMessage('Offline checkout supports cash payments only.');
          return;
        }

        queueSale(payload);
        setCart([]);
        setAmountTendered('');
        setPaymentReference('');
        setOrderDiscount(0);
        setNotes('');
        setSuccessMessage('Sale saved offline. It will sync automatically when the connection returns.');
      } else {
        setErrorMessage(err.message || 'Checkout failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`pos-layout ${isCartExpanded ? 'cart-expanded' : ''}`}>
      {/* LEFT SECTION: PRODUCT SEARCH, BARCODE SCANNER & SHOPPING CART */}
      <section className="pos-panel" aria-label="Product Search and Cart Section">
        <div className="pos-panel-header">
          <span className="pos-panel-title">Counter Workstation</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              id="btn-scan-camera"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsCameraOpen(true)}
            >
              Scan with Camera
            </button>
            <button
              id="btn-clear-cart"
              className="btn btn-secondary btn-sm"
              onClick={handleClearCart}
              disabled={cart.length === 0}
            >
              Clear Cart
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsCartExpanded((expanded) => !expanded)}
              aria-pressed={isCartExpanded}
            >
              {isCartExpanded ? 'Show Products' : 'Expand Cart'}
            </button>
          </div>
        </div>

        {/* Unified product search and barcode scanner field */}
        <div className="scanner-strip">
          <form onSubmit={handleProductSubmit} className="unified-product-input">
            <input
              id="input-product-search"
              ref={productInputRef}
              type="text"
              className="search-input"
              placeholder="Find product"
              title="Search by product name, SKU, or barcode. Press Enter to add an exact SKU or barcode."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </form>
        </div>

        <div className="product-catalog" aria-label="Product catalog">
          <div className="product-catalog-header">
            <strong>Products</strong>
            <span>{filteredCatalogProducts.length} available</span>
          </div>
          <div className="product-catalog-grid">
            {filteredCatalogProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="product-card"
                onClick={() => addProductToCart(product)}
                disabled={product.stockQuantity < 1}
              >
                <strong>{product.name}</strong>
                <span>{product.sku}</span>
                <b>{formatCurrency(product.sellingPrice)}</b>
                <small>{product.stockQuantity > 0 ? `Stock: ${product.stockQuantity}` : 'Out of stock'}</small>
              </button>
            ))}
            {filteredCatalogProducts.length === 0 && (
              <div className="empty-state">No matching products found.</div>
            )}
          </div>
        </div>

        {/* Messages */}
        {errorMessage && (
          <div className="alert alert-error" style={{ margin: '8px 14px' }}>
            <span>{errorMessage}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setErrorMessage('')}>
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" style={{ margin: '8px 14px' }}>
            <span>{successMessage}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setSuccessMessage('')}>
              Dismiss
            </button>
          </div>
        )}

        {/* Cart Items Table */}
        <div className="table-container">
          {cart.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Cart is currently empty</div>
              <p>Ready for scanner input. Scan a product barcode or search product name above.</p>
            </div>
          ) : (
            <table className="pos-table" id="cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode / SKU</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.product.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{item.product.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--secondary-text)' }}>
                        Unit: {item.product.unit} | Stock: {item.product.stockQuantity}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {item.product.barcode}
                      <div style={{ fontSize: '10px', color: 'var(--secondary-text)' }}>{item.product.sku}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="qty-stepper">
                        <button
                          className="qty-btn"
                          onClick={() => stepQuantity(item.product.id, item.quantity - (isWeightProduct(item.product) ? 0.1 : 1))}
                          disabled={item.quantity <= (isWeightProduct(item.product) ? 0.1 : 1)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="qty-input"
                          min={isWeightProduct(item.product) ? '0.001' : '1'}
                          step={isWeightProduct(item.product) ? '0.001' : '1'}
                          max={item.product.stockQuantity}
                          value={quantityDrafts[item.product.id] ?? item.quantity}
                          onChange={(event) => handleQuantityInput(item.product.id, event.target.value)}
                          onBlur={() => commitQuantityInput(item.product.id)}
                        />
                        <button
                          className="qty-btn"
                          onClick={() => stepQuantity(item.product.id, item.quantity + (isWeightProduct(item.product) ? 0.1 : 1))}
                          disabled={item.quantity >= item.product.stockQuantity}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(item.lineTotal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--error)' }}
                        onClick={() => handleRemoveItem(item.product.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* RIGHT SECTION: ORDER SUMMARY & CHECKOUT */}
      <section className="pos-panel summary-panel" aria-label="Order Summary and Checkout Section">
        <div className="pos-panel-header">
          <span className="pos-panel-title">Order Summary</span>
          <span className="badge-tag">{cart.length} items</span>
        </div>

        {/* Calculation Rows */}
        <div className="summary-rows">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(subtotal)}</span>
          </div>

          {itemDiscountsTotal > 0 && (
            <div className="summary-row" style={{ color: 'var(--success)' }}>
              <span>Item Discounts:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>-{formatCurrency(itemDiscountsTotal)}</span>
            </div>
          )}

          <div className="summary-row">
            <span>Order Discount:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>₱</span>
              <input
                id="input-order-discount"
                type="number"
                min="0"
                step="0.5"
                style={{ width: '70px', padding: '2px 6px', textAlign: 'right' }}
                value={orderDiscount}
                onChange={(e) => setOrderDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          </div>

          {taxRate > 0 && (
            <div className="summary-row">
              <span>VAT ({taxRate}%):</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(taxTotal)}</span>
            </div>
          )}
        </div>

        {/* Big Grand Total Box */}
        <div className="grand-total-box">
          <span className="grand-total-label">Final Payable Total</span>
          <span className="grand-total-value">{formatCurrency(grandTotal)}</span>
        </div>

        {/* Payment Processing Section */}
        <div className="payment-section">
          <div>
            <label className="field-label">Payment Method</label>
            <div className="payment-method-selector">
              {['CASH', 'GCASH', 'MAYA'].map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`payment-method-btn ${paymentMethod === method ? 'selected' : ''}`}
                  onClick={() => {
                    setPaymentMethod(method);
                    if (method !== 'CASH') {
                      setAmountTendered(grandTotal.toString());
                    }
                  }}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Electronic Payment Reference */}
          {paymentMethod !== 'CASH' && (
            <div className="tendered-field-group">
              <label className="field-label">{paymentMethod} Reference Number *</label>
              <input
                id="input-payment-ref"
                type="text"
                className="form-control"
                placeholder={`Enter ${paymentMethod} confirmation reference...`}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          )}

          {/* Cash Amount Tendered & Quick Tender */}
          {paymentMethod === 'CASH' && (
            <div className="tendered-field-group">
              <label className="field-label">Amount Tendered</label>
              <input
                id="input-amount-tendered"
                type="text"
                inputMode="decimal"
                className="input-money"
                placeholder="0.00"
                value={formatTenderedInput(amountTendered)}
                onChange={(event) => {
                  const rawValue = event.target.value.replace(/,/g, '');
                  if (/^\d*(?:\.\d{0,2})?$/.test(rawValue)) {
                    setAmountTendered(rawValue);
                  }
                }}
              />

              {/* Quick Cash Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickCash('exact')}>
                  Exact
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickCash(100)}>
                  ₱100
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickCash(500)}>
                  ₱500
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickCash(1000)}>
                  ₱1,000
                </button>
              </div>

              {/* Change Due Display */}
              <div className="change-box" style={{ marginTop: '10px' }}>
                <span>Change Due:</span>
                <strong id="display-change-due">{formatCurrency(changeDue)}</strong>
              </div>
            </div>
          )}

          {/* Checkout Action Button */}
          <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
            <button
              id="btn-checkout"
              type="button"
              className="btn btn-checkout"
              onClick={handleCheckout}
              disabled={!isPaymentValid || isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'Checkout'}
            </button>
          </div>
        </div>
      </section>

      {/* Camera Barcode Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={(code) => {
          setSearchQuery(code);
          const product = catalogProducts.find((item) => item.barcode === code || item.sku === code);
          if (product) {
            addProductToCart(product);
          } else {
            api.lookupBarcode(code)
              .then((res) => res.data && addProductToCart(res.data))
              .catch((err) => setErrorMessage(err.message || `No product found for code "${code}".`));
          }
        }}
      />

      <WeightPromptModal
        product={weightProduct}
        onClose={() => setWeightProduct(null)}
        onConfirm={(kilograms) => {
          addProductToCartWithQuantity(weightProduct, kilograms);
          setWeightProduct(null);
        }}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(completedSale)}
        saleData={completedSale}
        storeInfo={storeInfo}
        onClose={() => setCompletedSale(null)}
        onNewSale={() => {
          setCompletedSale(null);
          focusProductInput();
        }}
      />
    </div>
  );
}
