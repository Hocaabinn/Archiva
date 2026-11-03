'use client';

if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    // Periksa semua argumen / formatting template React untuk hydration error atau browser extensions
    const fullMessage = args
      .map((arg) => (typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : '')))
      .join(' ');

    if (
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
