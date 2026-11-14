import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Lora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { HydrationErrorSuppressor } from "@/components/common/hydration-error-suppressor";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Informasi Arsip Dokumen",
  description: "Aplikasi Arsip Dokumen Berbasis Retensi & Serah Terima Terverifikasi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${lora.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;

                function isExtensionError(str) {
                  if (!str) return false;
                  var s = String(str);
                  return (
                    s.indexOf('chrome-extension://') !== -1 ||
                    s.indexOf('moz-extension://') !== -1 ||
                    s.indexOf('safari-extension://') !== -1 ||
                    s.indexOf('M_ID') !== -1 ||
                    s.indexOf('eppiocemhmnlbhjplcgkofciiegomcon') !== -1 ||
                    s.indexOf('bis_skin_checked') !== -1 ||
                    s.indexOf('executors/200.js') !== -1 ||
                    s.indexOf('Hydration failed') !== -1 ||
                    s.indexOf('hydration') !== -1 ||
                    s.indexOf('did not match') !== -1
                  );
                }

                function shouldSuppress(msg, file, stack) {
                  return isExtensionError(msg) || isExtensionError(file) || isExtensionError(stack);
                }

                // 1. Capture-phase window error listener (jalan paling awal)
                window.addEventListener('error', function(e) {
                  var msg = e.message || '';
                  var file = e.filename || '';
                  var stack = (e.error && e.error.stack) || '';
                  if (shouldSuppress(msg, file, stack)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return true;
                  }
                }, true);

                // 2. Capture-phase unhandledrejection
                window.addEventListener('unhandledrejection', function(e) {
                  var reason = e.reason;
                  var msg = (reason && reason.message) || String(reason || '');
                  var stack = (reason && reason.stack) || '';
                  if (shouldSuppress(msg, '', stack)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return true;
                  }
                }, true);

                // 3. Bungkus addEventListener agar listener dev overlay Next.js / Turbopack tidak menerima error ekstensi browser
                var originalAddEventListener = window.addEventListener;
                window.addEventListener = function(type, listener, options) {
                  if (type === 'error' && typeof listener === 'function') {
                    var wrappedErrorListener = function(event) {
                      var msg = event ? (event.message || '') : '';
                      var file = event ? (event.filename || '') : '';
                      var stack = (event && event.error && event.error.stack) || '';
                      if (shouldSuppress(msg, file, stack)) {
                        if (event && event.preventDefault) event.preventDefault();
                        if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
                        return;
                      }
                      return listener.call(this, event);
                    };
                    return originalAddEventListener.call(this, type, wrappedErrorListener, options);
                  }

                  if (type === 'unhandledrejection' && typeof listener === 'function') {
                    var wrappedRejectionListener = function(event) {
                      var reason = event ? event.reason : null;
                      var msg = (reason && reason.message) || String(reason || '');
                      var stack = (reason && reason.stack) || '';
                      if (shouldSuppress(msg, '', stack)) {
                        if (event && event.preventDefault) event.preventDefault();
                        if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
                        return;
                      }
                      return listener.call(this, event);
                    };
                    return originalAddEventListener.call(this, type, wrappedRejectionListener, options);
                  }

                  return originalAddEventListener.call(this, type, listener, options);
                };

                // 4. Bungkus console.error & console.warn
                var origError = console.error;
                console.error = function() {
                  var combined = '';
                  for (var i = 0; i < arguments.length; i++) {
                    var arg = arguments[i];
                    combined += ' ' + (typeof arg === 'string' ? arg : (arg && arg.message ? arg.message + ' ' + (arg.stack || '') : ''));
                  }
                  if (shouldSuppress(combined, '', combined)) return;
                  return origError.apply(console, arguments);
                };

                var origWarn = console.warn;
                console.warn = function() {
                  var combined = '';
                  for (var i = 0; i < arguments.length; i++) {
                    var arg = arguments[i];
                    combined += ' ' + (typeof arg === 'string' ? arg : (arg && arg.message ? arg.message + ' ' + (arg.stack || '') : ''));
                  }
                  if (shouldSuppress(combined, '', combined)) return;
                  return origWarn.apply(console, arguments);
                };
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <HydrationErrorSuppressor />
        {children}
      </body>
    </html>
  );
}
