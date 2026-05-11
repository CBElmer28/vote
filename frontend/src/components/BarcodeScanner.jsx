import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';

export default function BarcodeScanner({ onScanSuccess, onScanError, isOpen, onClose }) {
  const { t } = useTranslation();
  const scannerRef = useRef(null);

  useEffect(() => {
    if (isOpen && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        "barcode-reader",
        { 
          fps: 10, 
          qrbox: { width: 300, height: 150 },
          formatsToSupport: [ Html5QrcodeSupportedFormats.CODE_39 ]
        },
        false
      );

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText);
          scanner.clear();
          scannerRef.current = null;
        },
        (error) => {
          if (onScanError) onScanError(error);
        }
      );

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScanSuccess, onScanError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-surface-border rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-text-main">{t('login.barcode_modal_title')}</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-full transition-colors text-text-muted"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <p className="text-sm text-text-muted mb-6 text-center">
          {t('login.barcode_modal_desc')}
        </p>
        <div id="barcode-reader" className="overflow-hidden rounded-2xl border-2 border-surface-border bg-bg-main"></div>
        <div className="mt-6 flex justify-center">
          <button 
            onClick={onClose}
            className="glass-button secondary !w-auto py-2 px-8"
          >
            {t('login.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
