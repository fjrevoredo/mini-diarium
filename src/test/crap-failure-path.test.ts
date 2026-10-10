import { expect, test } from 'vitest';

// Disposable CI control. NEVER merge or include this branch in a baseline.
test('CRAP acceptance: deliberate failure still attempts coverage uploads', () => {
  expect('deliberate failure').toBe('successful test');
});
