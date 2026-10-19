import React, { useRef } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function ReceiptModal({ saleData, storeInfo, isOpen, onClose, onNewSale }) {
  const receiptRef = useRef();

  if (!isOpen || !saleData) return null;

  const handlePrint = () => {
    const paperWidth = ['58mm', '80mm', 'A4'].includes(storeInfo?.receiptPaperWidth)
      ? storeInfo.receiptPaperWidth
      : '80mm';
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;
    const receiptHtml = receiptRef.current?.innerHTML || '';
    printWindow.document.write(`<!doctype html><html><head><title>${saleData.transactionNumber || 'Receipt'}</title><style>
      @page { size: ${paperWidth === 'A4' ? 'A4' : `${paperWidth} auto`}; margin: ${paperWidth === 'A4' ? '12mm' : '0'}; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      body { width: ${paperWidth === 'A4' ? '100%' : paperWidth}; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.35; }
      .receipt-paper { width: 100%; padding: ${paperWidth === 'A4' ? '0' : '3mm'}; }
      .receipt-header { text-align: center; margin-bottom: 10px; }
      .receipt-store-name { font-size: 16px; font-weight: bold; }
      .receipt-separator { border-top: 1px dashed #000; margin: 7px 0; }
      .receipt-row { display: flex; justify-content: space-between; gap: 8px; }
      .receipt-row > span:last-child, .receipt-row > strong:last-child { text-align: right; }
      .receipt-footer { text-align: center; margin-top: 12px; font-size: 10px; }
    </style></head><body><div class="receipt-paper">${receiptHtml}</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: '440px' }}>
        <div className="modal-header no-print">
          <h2 className="modal-title">Sale Complete - Receipt</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Strict Text-Based Receipt Paper */}
          <div className={`receipt-paper receipt-paper-${storeInfo?.receiptPaperWidth || '80mm'}`} ref={receiptRef}>
            <div className="receipt-header">
              <div className="receipt-store-name">{storeInfo?.storeName || 'COUNTER POS STORE'}</div>
              <div>{storeInfo?.storeAddress || '123 Market St, Manila'}</div>
              <div>Tel: {storeInfo?.phone || '+63 900 000 0000'}</div>
            </div>

            <div className="receipt-separator" />

            <div className="receipt-row">
              <span>Receipt #:</span>
              <strong>{saleData.transactionNumber}</strong>
            </div>
            <div className="receipt-row">
              <span>Date:</span>
              <span>{formatDateTime(saleData.createdAt)}</span>
            </div>
            <div className="receipt-row">
              <span>Cashier:</span>
              <span>{saleData.cashier?.fullName || saleData.cashier?.username || 'Counter Staff'}</span>
            </div>

            <div className="receipt-separator" />

            {/* Line Items */}
            <div style={{ marginBottom: '8px' }}>
              {saleData.items && saleData.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '6px' }}>
                  <div style={{ fontWeight: '600' }}>{item.productName}</div>
                  <div className="receipt-row" style={{ fontSize: '12px', color: '#444' }}>
                    <span>
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                      {Number(item.discount) > 0 && ` (-${formatCurrency(item.discount)})`}
                    </span>
                    <span>{formatCurrency(item.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="receipt-separator" />

            <div className="receipt-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(saleData.subtotal)}</span>
            </div>
            {Number(saleData.itemDiscountTotal) > 0 && (
              <div className="receipt-row">
                <span>Item Discounts:</span>
                <span>-{formatCurrency(saleData.itemDiscountTotal)}</span>
              </div>
            )}
            {Number(saleData.orderDiscountTotal) > 0 && (
              <div className="receipt-row">
                <span>Order Discount:</span>
                <span>-{formatCurrency(saleData.orderDiscountTotal)}</span>
              </div>
            )}
            {Number(saleData.taxTotal) > 0 && (
              <div className="receipt-row">
                <span>VAT included:</span>
                <span>{formatCurrency(saleData.taxTotal)}</span>
              </div>
            )}

            <div className="receipt-separator" />

            <div className="receipt-row" style={{ fontSize: '15px', fontWeight: 'bold' }}>
              <span>TOTAL DUE:</span>
              <span>{formatCurrency(saleData.totalAmount)}</span>
            </div>

            <div className="receipt-row">
              <span>Payment ({saleData.paymentMethod}):</span>
              <span>{formatCurrency(saleData.amountTendered)}</span>
            </div>

            <div className="receipt-row" style={{ fontWeight: 'bold' }}>
              <span>CHANGE DUE:</span>
              <span>{formatCurrency(saleData.changeDue)}</span>
            </div>

            {saleData.paymentReference && (
              <div className="receipt-row" style={{ fontSize: '11px', marginTop: '4px' }}>
                <span>Ref #:</span>
                <span>{saleData.paymentReference}</span>
              </div>
            )}

            <div className="receipt-separator" />

            <div className="receipt-footer">
              <p>{storeInfo?.receiptFooter || 'Thank you for shopping with us! Please come again.'}</p>
              <p style={{ marginTop: '4px', fontSize: '10px' }}>Items sold in good condition.</p>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button id="btn-print-receipt" className="btn btn-primary" onClick={handlePrint}>
            Print Receipt
          </button>
          <button
            id="btn-new-sale"
            className="btn btn-success"
            onClick={() => {
              onClose();
              if (onNewSale) onNewSale();
            }}
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
