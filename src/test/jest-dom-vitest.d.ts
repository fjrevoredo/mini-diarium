/**
 * Vitest 5 type augmentation for `@testing-library/jest-dom` DOM matchers.
 *
 * Why this file exists: Vitest 5 changed its exported assertion types — `Assertion`
 * now carries two type parameters (`Assertion<R, T>`) and `JestAssertion` no longer
 * extends the global `jest.Matchers` namespace. `@testing-library/jest-dom` 7.0.1
 * augments the old shapes (`interface Assertion<T = any>` at
 * `@testing-library/jest-dom/vitest`, plus the global `jest.Matchers`), so neither
 * augmentation merges under Vitest 5 and every DOM matcher (`toBeInTheDocument`,
 * `toBeDisabled`, `toHaveTextContent`, ...) fails `tsc --noEmit` with TS2339.
 * Runtime behavior is unaffected: `import '@testing-library/jest-dom'` in
 * `src/test/setup.ts` still registers the matchers through `expect.extend`.
 *
 * This re-declares jest-dom's own matcher types against Vitest 5's `Matchers<R, T>`
 * interface (which `Assertion` extends). Remove this file once
 * `@testing-library/jest-dom` ships Vitest 5 support.
 */

/*
 * `no-empty-object-type`: the interface body must stay empty so it inherits the
 * matcher set from `TestingLibraryMatchers` (same shape Vitest's own declaration
 * uses). `no-unused-vars`: `T` must stay in the type-parameter list because
 * TypeScript requires every declaration of `Matchers` to have identical type
 * parameters, even though jest-dom's matchers never read the received type.
 */
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */

import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
