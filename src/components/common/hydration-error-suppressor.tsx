'use client';

if (typeof window !== 'undefined') {
  const isExtensionError = (str?: string | null) => {
    if (!str) return false;
    const s = String(str);
    return (
      s.includes('chrome-extension://') ||
      s.includes('moz-extension://') ||
      s.includes('safari-extension://') ||
      s.includes('M_ID') ||
      s.includes('eppiocemhmnlbhjplcgkofciiegomcon') ||
      s.includes('bis_skin_checked') ||
      s.includes('executors/200.js') ||
      s.includes('Hydration failed') ||
      s.includes('hydration') ||
      s.includes('did not match') ||
      s.includes('A tree hydrated but some attributes') ||
      s.includes('Recoverable Error')
    );
  };

  // Tangkap dan cegah popup error runtime dari ekstensi browser pihak ketiga (Urban VPN, IDM, adblocker, dsb)
  window.addEventListener(
    'error',
    (event) => {
      const msg = event.message || '';
      const file = event.filename || '';
      const stack = event.error?.stack || '';
      if (isExtensionError(msg) || isExtensionError(file) || isExtensionError(stack)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reasonMsg = event.reason?.message || String(event.reason || '');
      const stack = event.reason?.stack || '';
      if (isExtensionError(reasonMsg) || isExtensionError(stack)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    const fullMessage = args
      .map((arg) => (typeof arg === 'string' ? arg : (arg instanceof Error ? (arg.message + ' ' + (arg.stack || '')) : '')))
      .join(' ');

    if (isExtensionError(fullMessage)) {
      return;
    }

    originalError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    const fullMessage = args
      .map((arg) => (typeof arg === 'string' ? arg : (arg instanceof Error ? (arg.message + ' ' + (arg.stack || '')) : '')))
      .join(' ');

    if (isExtensionError(fullMessage)) {
      return;
    }

    originalWarn.apply(console, args);
  };
}

export function HydrationErrorSuppressor() {
  return null;
}
