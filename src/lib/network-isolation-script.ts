// NOTE: keep in sync with the NETWORK_ISOLATION_SCRIPT const in src-tauri/src/lib.rs
export const NETWORK_ISOLATION_SCRIPT = `(function() {
  'use strict';
  const kill = (obj, prop) => {
    try {
      Object.defineProperty(obj, prop, {
        value: undefined,
        writable: false,
        configurable: false,
      });
    } catch (_) {}
  };
  // WebRTC
  kill(window, 'RTCPeerConnection');
  kill(window, 'webkitRTCPeerConnection');
  kill(window, 'mozRTCPeerConnection');
  kill(window, 'RTCSessionDescription');
  // Network transports that are not required for Tauri IPC
  kill(window, 'WebTransport');
  // NOTE: fetch/XMLHttpRequest/WebSocket/EventSource stay available because
  // Tauri IPC and the dev server depend on them. External requests are blocked
  // by CSP and platform WebView request handlers.
  // Popup navigation
  kill(window, 'open');
  // Worker constructors (CSP worker-src none is primary; this is defense-in-depth)
  kill(window, 'Worker');
  kill(window, 'SharedWorker');
  // Navigator network APIs
  if (navigator) {
    kill(navigator, 'serviceWorker');
    kill(navigator, 'sendBeacon');
    kill(navigator, 'connection');
  }
})();`;
