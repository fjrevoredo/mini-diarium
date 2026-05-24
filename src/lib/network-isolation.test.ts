import { describe, it, expect } from 'vitest';
import { NETWORK_ISOLATION_SCRIPT } from './network-isolation-script';

const REQUIRED_TARGETS = [
  'RTCPeerConnection',
  'WebTransport',
  'open',
  'Worker',
  'SharedWorker',
  'serviceWorker',
  'sendBeacon',
  'connection',
  'Object.defineProperty',
];

describe('network-isolation-script', () => {
  REQUIRED_TARGETS.forEach((target) => {
    it(`kills '${target}'`, () => {
      expect(NETWORK_ISOLATION_SCRIPT).toContain(target);
    });
  });
});
