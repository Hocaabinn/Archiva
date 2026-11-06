'use client';

if (typeof window !== 'undefined') {
  // Tangkap dan cegah popup error runtime dari ekstensi browser pihak ketiga (seperti M_ID, IDM, adblocker, dsb)
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const file = event.filename || '';
    if (
      file.includes('chrome-extension://') ||
      msg.includes('M_ID') ||
      msg.includes('bis_skin_checked') ||
      msg.includes('Cannot read properties of undefined') && file.includes('chrome-extension')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = event.reason?.message || String(event.reason || '');
    const stack = event.reason?.stack || '';
    if (
      reasonMsg.includes('M_ID') ||
      reasonMsg.includes('chrome-extension://') ||
      stack.includes('chrome-extension://')
    ) {
      event.preventDefault();
    }
  });

  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const fullMessage = args
      .map((arg) => (typeof arg === 'string' ? arg : (arg instanceof Error ? (arg.message + ' ' + (arg.stack || '')) : '')))
      .join(' ');

    if (
      fullMessage.includes('chrome-extension://') ||
      fullMessage.includes('M_ID') ||
      fullMessage.includes('bis_skin_checked') ||
      fullMessage.includes('hydration-mismatch') ||
      fullMessage.includes('did not match') ||
      fullMessage.includes('A tree hydrated but some attributes')
    ) {
      return;
    }

    originalError.apply(console, args);
  };
}

export function HydrationErrorSuppressor() {
  return null;
}
