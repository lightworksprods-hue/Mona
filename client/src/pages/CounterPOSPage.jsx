import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { formatCurrency, roundMoney } from '../utils/formatters';
import ReceiptModal from '../components/ReceiptModal';
import AlertToast from '../components/AlertToast';
import WeightPromptModal from '../components/WeightPromptModal';
import { cacheProducts, getCachedProducts, isNetworkError, queueSale } from '../utils/offlineStore';
import { useAuth } from '../context/AuthContext';

function formatTenderedInput(value, showDecimals = false) {
  if (value === '') return '';
  const [whole = '', decimal] = String(value).split('.');
  const groupedWhole = Number(whole || 0).toLocaleString('en-PH');
  if (showDecimals) {
    return Number(value || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return decimal === undefined ? groupedWhole : `${groupedWhole}.${decimal}`;
}

export default function CounterPOSPage({ storeInfo, cashDrawerOpen = true, onOpenCashDrawer }) {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [scanQuantity, setScanQuantity] = useState('');
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState(-1);
  const [catalogProducts, setCatalogProducts] = useState([]);

  // Cart State
  const [cart, setCart] = useState([]);
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(0);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [isAmountTenderedFocused, setIsAmountTenderedFocused] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isCustomerDetailsExpanded, setIsCustomerDetailsExpanded] = useState(false);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState(null);
  const [customerRewards, setCustomerRewards] = useState([]);
  const [selectedRewardId, setSelectedRewardId] = useState('');
  const [isRedeemingReward, setIsRedeemingReward] = useState(false);
  const [customerLookupMessage, setCustomerLookupMessage] = useState('');

  // Status & Modals
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingSuccessMessage, setPendingSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [weightProduct, setWeightProduct] = useState(null);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [showDeleteAllTransactionsConfirm, setShowDeleteAllTransactionsConfirm] = useState(false);
  const [isDeletingAllTransactions, setIsDeletingAllTransactions] = useState(false);

  const productInputRef = useRef(null);

  // Keep the destructive history action out of the visible cashier toolbar.
  // Ctrl+D opens the existing confirmation dialog; it never archives directly.
  // Ctrl+Q focuses the scan quantity field and selects its current value so
  // the next number typed replaces it.
  // Ctrl+C opens the existing clear-cart confirmation.
  useEffect(() => {
    const handlePosShortcuts = (event) => {
      if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setShowDeleteAllTransactionsConfirm(true);
      }

      if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        const quantityInput = document.getElementById('input-scan-quantity');
        quantityInput?.focus();
        quantityInput?.select();
      }

      if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c' && cart.length > 0) {
        event.preventDefault();
        setShowClearCartConfirm(true);
      }
    };

    window.addEventListener('keydown', handlePosShortcuts, true);
    return () => window.removeEventListener('keydown', handlePosShortcuts, true);
  }, [cart.length]);

  // Keep one field ready for either product search or a barcode scanner.
  useEffect(() => {
    focusProductInput();
  }, []);

  const focusProductInput = () => {
    if (productInputRef.current) {
      productInputRef.current.focus();
    }
  };

  const handleCustomerLookup = async () => {
    const phone = customerPhone.trim();
    if (!phone) {
      setLoyaltyCustomer(null);
      setCustomerRewards([]);
      setSelectedRewardId('');
      setCustomerLookupMessage('');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setCustomerLookupMessage('Enter at least 7 digits.');
      return;
    }
    try {
      const response = await api.lookupCustomer(phone);
      setLoyaltyCustomer(response.data);
      setCustomerRewards(response.rewards || []);
      setSelectedRewardId('');
      if (response.data?.fullName) setCustomerName(response.data.fullName);
      setCustomerLookupMessage(response.data ? `${response.data.pointsBalance} points available` : 'New customer — points will start after this sale.');
    } catch (error) {
      setLoyaltyCustomer(null);
      setCustomerRewards([]);
      setCustomerLookupMessage(error.message || 'Unable to look up customer.');
    }
  };

  const handleRewardRedemption = async () => {
    if (!loyaltyCustomer || !selectedRewardId) return;
    setIsRedeemingReward(true);
    setErrorMessage('');
    try {
      const response = await api.redeemLoyaltyReward({ phone: customerPhone.trim(), rewardId: selectedRewardId });
      const rewardProduct = { ...response.data.product, isLoyaltyReward: true };
      setCart((current) => {
        if (current.some((item) => item.product.id === rewardProduct.id)) {
          setErrorMessage('Remove the regular item from the cart before adding it as a points reward.');
          return current;
        }
        return [...current, {
          product: rewardProduct,
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          lineTotal: 0,
          loyaltyRewardId: response.data.rewardId,
          isReward: true,
        }];
      });
      setSelectedRewardId('');
      setCustomerLookupMessage(`${rewardProduct.name} added to the cart. Points will be deducted after checkout.`);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to redeem reward.');
    } finally {
      setIsRedeemingReward(false);
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
    if (!query) return false;
    return [product.name, product.sku, product.barcode].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });

  const visibleSearchProducts = filteredCatalogProducts.slice(0, 8);

  useEffect(() => {
    setHighlightedSearchIndex(-1);
  }, [searchQuery]);

  const handleProductSearchKeyDown = (event) => {
    if (!searchQuery.trim() || visibleSearchProducts.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedSearchIndex((current) => (current + 1) % visibleSearchProducts.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedSearchIndex((current) => (
        current <= 0 ? visibleSearchProducts.length - 1 : current - 1
      ));
    } else if (event.key === 'Enter' && highlightedSearchIndex >= 0) {
      event.preventDefault();
      addProductToCart(visibleSearchProducts[highlightedSearchIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setHighlightedSearchIndex(-1);
    }
  };

  // Enter adds an exact barcode/SKU; otherwise the same field filters the catalog.
  const handleProductSubmit = async (e, scannedCode = searchQuery.trim()) => {
    if (e) e.preventDefault();
    const code = scannedCode;
    if (!code) return;

    setErrorMessage('');
    const catalogMatch = catalogProducts.find(
      (product) => product.barcode === code || product.sku.toLowerCase() === code.toLowerCase()
    );

    if (catalogMatch) {
      addProductUsingScanQuantity(catalogMatch);
      return;
    }

    try {
      const res = await api.lookupBarcode(code);
      if (res.success && res.data) {
        addProductUsingScanQuantity(res.data);
      }
    } catch (err) {
      setErrorMessage(err.message || `No product found for code "${code}".`);
    } finally {
      focusProductInput();
    }
  };

  // Barcode guns behave like keyboards and usually finish with Enter. Listen
  // globally so a scan still works even when another POS field has focus.
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleScannerKeyDown = (event) => {
      const now = Date.now();

      if (event.key === 'Enter') {
        const scannedCode = buffer.trim();
        buffer = '';

        if (scannedCode.length >= 4 && now - lastKeyTime < 250) {
          event.preventDefault();
          event.stopPropagation();

          const activeField = event.target?.id;
          if (activeField === 'input-amount-tendered') setAmountTendered('');
          if (activeField === 'customer-phone') setCustomerPhone('');
          if (activeField === 'customer-name') setCustomerName('');
          if (activeField === 'input-payment-ref') setPaymentReference('');
          if (activeField === 'input-order-discount') setOrderDiscountPercent(0);

          handleProductSubmit(null, scannedCode);
        }
        return;
      }

      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;

      buffer = now - lastKeyTime > 100 ? event.key : `${buffer}${event.key}`;
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleScannerKeyDown, true);
    return () => window.removeEventListener('keydown', handleScannerKeyDown, true);
  }, [catalogProducts, scanQuantity]);

  const isWeightProduct = (product) => {
    const unit = product.unit?.trim().toLowerCase();
    const category = product.category?.name?.trim().toLowerCase();
    return ['kg', 'kilogram', 'kilograms'].includes(unit) || category === 'meat & poultry';
  };

  const maxPaidQuantity = (product) => product?.buyOneTakeOne
    ? Math.floor(Number(product.stockQuantity) / 2)
    : Number(product?.stockQuantity || 0);

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

        if (maxPaidQuantity(product) < newQty) {
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
        if (maxPaidQuantity(product) < quantityToAdd) {
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

  const addProductUsingScanQuantity = (product) => {
    // An empty quantity means one unit for quick scanning.
    const quantity = scanQuantity === '' ? 1 : Number(scanQuantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      setErrorMessage('Enter a quantity of at least 1 before scanning.');
      return;
    }

    if (isWeightProduct(product)) {
      setWeightProduct(product);
    } else {
      addProductToCartWithQuantity(product, quantity);
    }
    setScanQuantity('');
  };

  // Update Cart Quantity
  const handleQuantityChange = (productId, newQuantity) => {
    const item = cart.find((cartItem) => cartItem.product.id === productId);
    const qty = isWeightProduct(item?.product) ? parseFloat(newQuantity) : parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (maxPaidQuantity(item.product) < qty) {
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
    setShowClearCartConfirm(true);
  };

  const confirmClearCart = () => {
    setCart([]);
    setAmountTendered('');
    setPaymentReference('');
    setOrderDiscountPercent(0);
    setErrorMessage('');
    setShowClearCartConfirm(false);
    focusProductInput();
  };

  const confirmDeleteAllTransactions = async () => {
    setIsDeletingAllTransactions(true);
    setErrorMessage('');
    try {
      const response = await api.deleteAllTransactions();
      setShowDeleteAllTransactionsConfirm(false);
      setSuccessMessage(response.message || 'All transactions deleted.');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete transactions.');
    } finally {
      setIsDeletingAllTransactions(false);
    }
  };

  useEffect(() => {
    if (!showDeleteAllTransactionsConfirm) return undefined;

    const handleArchiveConfirmationKey = (event) => {
      if (event.key === 'Escape' && !isDeletingAllTransactions) {
        setShowDeleteAllTransactionsConfirm(false);
      } else if (event.key === 'Enter' && !isDeletingAllTransactions) {
        event.preventDefault();
        confirmDeleteAllTransactions();
      }
    };

    window.addEventListener('keydown', handleArchiveConfirmationKey);
    return () => window.removeEventListener('keydown', handleArchiveConfirmationKey);
  }, [showDeleteAllTransactionsConfirm, isDeletingAllTransactions]);

  // Financial Calculations
  const subtotal = roundMoney(cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const itemDiscountsTotal = roundMoney(cart.reduce((sum, item) => sum + Number(item.discount || 0), 0));
  const discountableSubtotal = Math.max(0, subtotal - itemDiscountsTotal);
  const safeOrderDiscountPercent = Math.min(100, Math.max(0, Number(orderDiscountPercent || 0)));
  const safeOrderDiscount = roundMoney(discountableSubtotal * (safeOrderDiscountPercent / 100));
  const taxRate = Number(storeInfo?.taxRate || 0);

  // Product selling prices are VAT-inclusive. Extract the VAT portion for
  // display instead of adding VAT on top of the cashier-entered prices.
  const grossTotal = Math.max(0, subtotal - itemDiscountsTotal - safeOrderDiscount);
  const taxTotal = taxRate > 0
    ? roundMoney(grossTotal - (grossTotal / (1 + (taxRate / 100))))
    : 0;
  const grandTotal = roundMoney(grossTotal);

  const numericTendered = Number(amountTendered || 0);
  const changeDue = Math.max(0, roundMoney(numericTendered - grandTotal));
  const isPaymentValid =
    cart.length > 0 &&
    (paymentMethod === 'CASH'
      ? numericTendered >= grandTotal
      : /^\d{4}$/.test(paymentReference.trim()));

  const drawerUnavailable = paymentMethod === 'CASH' && cashDrawerOpen === false;

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

    if (drawerUnavailable) {
      setErrorMessage('Open the cash drawer before accepting cash payments.');
      onOpenCashDrawer?.();
      return;
    }

    if (paymentMethod !== 'CASH' && !/^\d{4}$/.test(paymentReference.trim())) {
      setErrorMessage(`Please enter the last 4 digits for ${paymentMethod} payment.`);
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
        ...(item.loyaltyRewardId ? { loyaltyRewardId: item.loyaltyRewardId } : {}),
      })),
      orderDiscount: safeOrderDiscount,
      paymentMethod,
      amountTendered: paymentMethod === 'CASH' ? numericTendered : grandTotal,
      paymentReference: paymentReference.trim() || null,
      notes: notes.trim() || null,
      customerPhone: customerPhone.trim() || null,
      customerName: customerName.trim() || null,
    };

    try {
      const res = await api.checkout(payload);

      if (res.success && res.data) {
        if (paymentMethod === 'CASH') {
          // Do not fail a completed sale if the printer is offline. The cashier
          // can use the manual button on the Cash Drawer page to retry.
          api.openCashDrawer().catch(() => {});
        }
        setCompletedSale(res.data);
        // Reset current counter state
        setCart([]);
        setAmountTendered('');
        setPaymentReference('');
        setOrderDiscountPercent(0);
        setNotes('');
        setCustomerPhone('');
        setCustomerName('');
        setLoyaltyCustomer(null);
        setCustomerRewards([]);
        setSelectedRewardId('');
        setCustomerLookupMessage('');
        const earnedPoints = Number(res.data.loyaltyPointsEarned || 0);
        setPendingSuccessMessage(`Transaction ${res.data.transactionNumber} completed!${earnedPoints > 0 ? ` ${earnedPoints} loyalty point${earnedPoints === 1 ? '' : 's'} earned.` : ''}`);
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
        setOrderDiscountPercent(0);
        setNotes('');
        setCustomerPhone('');
        setCustomerName('');
        setLoyaltyCustomer(null);
        setCustomerRewards([]);
        setSelectedRewardId('');
        setCustomerLookupMessage('');
        setSuccessMessage('Sale saved offline. It will sync automatically when the connection returns.');
      } else {
        setErrorMessage(err.message || 'Checkout failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pos-layout">
      {/* LEFT SECTION: PRODUCT SEARCH, BARCODE SCANNER & SHOPPING CART */}
      <div className="counter-workflow-column">
        {/* Prominent running total for the cashier */}
        <div className="grand-total-box counter-total-box">
          <span className="grand-total-label">TOTAL AMOUNT DUE</span>
          <span className="grand-total-value">{formatCurrency(grandTotal)}</span>
        </div>

      <section className="pos-panel" aria-label="Product Search and Cart Section">
        <div className="pos-panel-header">
          <form onSubmit={handleProductSubmit} className="header-product-search">
            <input
              id="input-product-search"
              ref={productInputRef}
              type="text"
              className="search-input"
              placeholder="Find product"
              title="Search by product name, SKU, or barcode. Press Enter to add an exact SKU or barcode."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleProductSearchKeyDown}
              aria-activedescendant={highlightedSearchIndex >= 0 ? `product-search-result-${visibleSearchProducts[highlightedSearchIndex]?.id}` : undefined}
              autoComplete="off"
            />
            <label className="scan-quantity-field" htmlFor="input-scan-quantity">
              <span>Qty</span>
              <input
                id="input-scan-quantity"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={scanQuantity}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusProductInput();
                  }
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setScanQuantity(value === '' ? '' : Math.max(1, parseInt(value, 10) || 1));
                }}
                title="Quantity to add when scanning the next product"
              />
            </label>
          </form>
          <div className="counter-header-actions">
            <button
              id="btn-clear-cart"
              className="btn btn-secondary btn-sm"
              onClick={handleClearCart}
              disabled={cart.length === 0}
            >
              Clear Cart
            </button>
          </div>
        </div>

        {searchQuery.trim() && (
          <div className="search-results-list counter-search-results" aria-label="Matching products">
            {visibleSearchProducts.map((product, index) => (
              <button
                type="button"
                key={product.id}
                id={`product-search-result-${product.id}`}
                className={`search-result-row ${highlightedSearchIndex === index ? 'is-highlighted' : ''}`}
                onClick={() => addProductToCart(product)}
                disabled={maxPaidQuantity(product) < 1}
                aria-selected={highlightedSearchIndex === index}
              >
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.sku} · Stock: {product.stockQuantity}</small>
                </span>
                <b>{formatCurrency(product.sellingPrice)}</b>
              </button>
            ))}
            {filteredCatalogProducts.length === 0 && (
              <div className="empty-state search-empty-state">No matching products found.</div>
            )}
          </div>
        )}

        {/* Messages */}
        {errorMessage && (
          <AlertToast type="error" message={errorMessage} onClose={() => setErrorMessage('')} />
        )}

        {successMessage && (
          <AlertToast message={successMessage} onClose={() => setSuccessMessage('')} />
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
                  <th>Barcode</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={`${item.product.id}-${item.isReward ? 'reward' : 'regular'}`}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{item.product.name} {item.isReward && <span className="promotion-badge">POINTS REWARD</span>} {!item.isReward && item.product.buyOneTakeOne && <span className="promotion-badge">BUY 1 TAKE 1</span>}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {item.product.barcode}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="qty-stepper">
                        <button
                          className="qty-btn"
                          onClick={() => stepQuantity(item.product.id, item.quantity - (isWeightProduct(item.product) ? 0.1 : 1))}
                          disabled={item.isReward || item.quantity <= (isWeightProduct(item.product) ? 0.1 : 1)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className={`qty-input ${isWeightProduct(item.product) ? 'qty-input-decimal' : ''}`}
                          min={isWeightProduct(item.product) ? '0.001' : '1'}
                          step={isWeightProduct(item.product) ? '0.001' : '1'}
                          max={maxPaidQuantity(item.product)}
                          value={quantityDrafts[item.product.id] ?? item.quantity}
                          onChange={(event) => handleQuantityInput(item.product.id, event.target.value)}
                          onBlur={() => commitQuantityInput(item.product.id)}
                          disabled={item.isReward}
                        />
                        <button
                          className="qty-btn"
                          onClick={() => stepQuantity(item.product.id, item.quantity + (isWeightProduct(item.product) ? 0.1 : 1))}
                          disabled={item.isReward || item.quantity >= item.product.stockQuantity}
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
      </div>

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
            <span>Order Discount (%):</span>
            <div className="summary-discount-control">
              <span>₱</span>
              <input
                id="input-order-discount"
                type="number"
                min="0"
                max="100"
                step="1"
                style={{ width: '70px', padding: '2px 6px', textAlign: 'right' }}
                value={orderDiscountPercent || ''}
                onChange={(e) => setOrderDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              />
            </div>
          </div>

          {safeOrderDiscount > 0 && (
            <div className="summary-row" style={{ color: 'var(--success)' }}>
              <span>Discount amount:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>-{formatCurrency(safeOrderDiscount)}</span>
            </div>
          )}

          {taxRate > 0 && (
            <div className="summary-row">
              <span>VAT included ({taxRate}%):</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(taxTotal)}</span>
            </div>
          )}
        </div>

        <div className={`customer-loyalty-box ${isCustomerDetailsExpanded ? 'is-expanded' : ''}`}>
          <button
            type="button"
            className="customer-details-toggle"
            onClick={() => setIsCustomerDetailsExpanded((expanded) => !expanded)}
            aria-expanded={isCustomerDetailsExpanded}
          >
            <span>Customer details</span>
            <span aria-hidden="true">{isCustomerDetailsExpanded ? '−' : '+'}</span>
          </button>

          {isCustomerDetailsExpanded && <>
          <label className="field-label" htmlFor="customer-phone">Customer phone</label>
            <input
              id="customer-phone"
              type="tel"
              className="form-control"
              placeholder="Phone number for points"
              value={customerPhone}
              onChange={(event) => { setCustomerPhone(event.target.value); setLoyaltyCustomer(null); setCustomerRewards([]); setSelectedRewardId(''); setCustomerLookupMessage(''); }}
              onBlur={handleCustomerLookup}
            />
          <label className="field-label" htmlFor="customer-name">Full name <span className="optional-label">(optional)</span></label>
          <input
            id="customer-name"
            type="text"
            className="form-control"
            placeholder="Customer full name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            maxLength={100}
          />
          {customerLookupMessage && <small className={loyaltyCustomer ? 'customer-points-success' : 'customer-points-hint'}>{customerLookupMessage}</small>}
          {loyaltyCustomer && customerRewards.length > 0 && (
            <div className="customer-reward-redemption">
              <label className="field-label" htmlFor="customer-reward">Redeem points</label>
              <div className="customer-reward-redemption-row">
                <select id="customer-reward" className="form-control" value={selectedRewardId} onChange={(event) => setSelectedRewardId(event.target.value)}>
                  <option value="">Select a reward</option>
                  {customerRewards.map((reward) => (
                    <option key={reward.id} value={reward.id} disabled={Number(reward.product.stockQuantity || 0) < 1 || Number(loyaltyCustomer.pointsBalance || 0) < reward.pointsCost}>
                      {reward.product.name} — {reward.pointsCost} pts{Number(reward.product.stockQuantity || 0) < 1 ? ' (out of stock)' : ''}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-secondary btn-sm" disabled={!selectedRewardId || isRedeemingReward} onClick={handleRewardRedemption}>
                  {isRedeemingReward ? 'Redeeming...' : 'Redeem'}
                </button>
              </div>
            </div>
          )}
          </>}
        </div>

        {/* Payment Processing Section */}
        <div className="payment-section">
          <div className="payment-scroll-area">
          <div>
            <label className="field-label">Payment Method</label>
            <div className="payment-method-selector">
              {['CASH', 'GCASH', 'QRPH'].map((method) => (
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
              <label className="field-label">{paymentMethod} Last 4 Digits *</label>
              <input
                id="input-payment-ref"
                type="text"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                className="form-control"
                placeholder="Enter last 4 digits"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
          )}

          {/* Cash Amount Received & Quick Tender */}
          {paymentMethod === 'CASH' && (
            <div className="tendered-field-group">
              <label className="field-label">Amount Received</label>
              <div className="money-input-wrapper">
                <span className="money-input-prefix" aria-hidden="true">₱</span>
                <input
                  id="input-amount-tendered"
                  type="text"
                  inputMode="decimal"
                  className="input-money"
                  placeholder="0.00"
                  value={formatTenderedInput(amountTendered, !isAmountTenderedFocused)}
                  onFocus={() => setIsAmountTenderedFocused(true)}
                  onBlur={() => {
                    setIsAmountTenderedFocused(false);
                    if (amountTendered !== '') setAmountTendered(Number(amountTendered).toFixed(2));
                  }}
                  onChange={(event) => {
                    const rawValue = event.target.value.replace(/,/g, '');
                    if (/^\d*(?:\.\d{0,2})?$/.test(rawValue)) {
                      setAmountTendered(rawValue);
                    }
                  }}
                />
              </div>

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

          </div>

          {/* Checkout Action Button */}
          <div className="checkout-action">
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

      {showClearCartConfirm && (
        <div className="modal-overlay" onMouseDown={() => setShowClearCartConfirm(false)}>
          <div
            className="modal-dialog clear-cart-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-cart-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title" id="clear-cart-dialog-title">Clear current cart?</div>
              <button className="modal-close-btn" type="button" onClick={() => setShowClearCartConfirm(false)} aria-label="Close">×</button>
            </div>
            <div className="modal-body clear-cart-body">
              This will cancel the current sale and remove all items from the cart.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setShowClearCartConfirm(false)}>Keep Cart</button>
              <button className="btn btn-primary" type="button" onClick={confirmClearCart}>Clear Cart</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllTransactionsConfirm && (
        <div className="modal-overlay" onMouseDown={() => !isDeletingAllTransactions && setShowDeleteAllTransactionsConfirm(false)}>
          <div
            className="modal-dialog clear-cart-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-all-transactions-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title" id="delete-all-transactions-dialog-title">Archive all transactions?</div>
              <button className="modal-close-btn" type="button" onClick={() => setShowDeleteAllTransactionsConfirm(false)} aria-label="Close" disabled={isDeletingAllTransactions}>×</button>
            </div>
            <div className="modal-body clear-cart-body">
              This hides all sales transaction and inventory movement history from the POS. The records are kept in the database and can be restored later. Product stock quantities, customers, and loyalty balances will not be changed.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteAllTransactionsConfirm(false)} disabled={isDeletingAllTransactions}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={confirmDeleteAllTransactions} disabled={isDeletingAllTransactions}>
                {isDeletingAllTransactions ? 'Archiving...' : 'Archive All Transactions'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        onAfterPrint={() => {
          setCompletedSale(null);
          setSuccessMessage(pendingSuccessMessage);
          setPendingSuccessMessage('');
          focusProductInput();
        }}
        onNewSale={() => {
          setCompletedSale(null);
          setSuccessMessage(pendingSuccessMessage);
          setPendingSuccessMessage('');
          focusProductInput();
        }}
      />
    </div>
  );
}
