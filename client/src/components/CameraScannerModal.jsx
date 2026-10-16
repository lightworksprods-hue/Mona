import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function CameraScannerModal({ isOpen, onClose, onScanSuccess }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    let scanner = null;
    const timer = setTimeout(() => {
      try {
        scanner = new Html5QrcodeScanner(
          'camera-reader',
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [0, 1], // Camera
          },
          false
        );

        scanner.render(
          (decodedText) => {
            if (decodedText) {
              onScanSuccess(decodedText);
              if (scanner) {
                scanner.clear().catch(console.error);
              }
              onClose();
            }
          },
          () => {
            // scan failure callback (ignoring continuous frame scanning misses)
          }
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error('Camera scanner init error:', err);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(console.error);
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [isOpen, onClose, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Scan Barcode with Camera</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="camera-scanner-container">
            <div id="camera-reader"></div>
            <div className="camera-guide-box">
              Position the product barcode within the camera viewfinder box.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close Camera
          </button>
        </div>
      </div>
    </div>
  );
}
