# PDF Export Hardening Plan

**Plan Status:** READY FOR APPROVAL

## Goal

Make PDF export predictably safe for text, images, and mixed-content journals; document its rendering model and limits; and establish regression coverage that prevents future pagination fixes from reintroducing earlier defects.

## Scope

- Define durable correctness invariants and supported-content behavior for PDF pagination.
- Refactor pagination into small, testable policies without changing the direct local PDF export architecture.
- Prevent text and images from being silently cut at page boundaries.
- Add unit, browser-rendered, and full-export regression coverage.
- Document the design decision, maintenance rules, user-visible behavior, and known limits.
- Remove remaining magic values, stale assumptions, and redundant workaround code.

## Non-Goals

- Produce selectable/searchable vector text in PDFs.
- Replace `html2canvas` and `jsPDF` unless source inspection proves the current architecture cannot satisfy the defined invariants.
- Add networking, telemetry, or persistence of plaintext export content.
- Redesign the visual appearance of exported journals beyond pagination-required changes.

## Assumptions

- Correct content is more important than filling every page; short pages are acceptable when required to avoid a cut.
- Oversized images should be proportionally scaled to fit within one printable page rather than split.
- Exported PDF pages remain rasterized because the confirmed text fix depends on inspecting the actual rendered pixels.
- If content cannot be paginated safely, export must fail explicitly with a sanitized error instead of silently producing a damaged PDF.
- Test fixtures must use synthetic content only and must never write real diary plaintext to logs or committed artifacts.
- Existing unrelated worktree changes must remain untouched.

## Open Questions

None. The implementation will follow the correctness-first policies above.

## Tasks

### 1. Establish the Pagination Contract

**Status:** NOT STARTED

**Objective:** Define the invariants every implementation and regression test must enforce.

**Steps:**
- Specify that a page boundary must use a blank raster row and must not intersect an image container.
- Specify forward-progress, no-blank-page, final-page, and maximum-page invariants.
- Define behavior for oversized images and content with no safe raster boundary.
- Record the confirmed root cause and rejected DOM-geometry approaches in an architecture decision record.

**Validation:** The decision record contains an explicit invariant checklist and maps each invariant to planned automated coverage.

**Notes:** Historical debugging detail should be summarized, not copied into production code.

### 2. Verify Third-Party Rendering Assumptions

**Status:** NOT STARTED

**Objective:** Confirm the exact behavior relied on from installed `html2canvas`, `jsPDF`, and browser canvas APIs before changing implementation.

**Steps:**
- Inspect installed package source and official documentation for clipping coordinates, canvas limits, image encoding, and page-image placement.
- Verify whether transparent pixels, cloned-element sizing, and nested image containers affect boundary detection.
- Record only actionable constraints in the decision record and implementation comments.

**Validation:** Every third-party-dependent implementation assumption is backed by installed source or official documentation.

**Notes:** Halt implementation if the current library behavior contradicts the planned pagination contract.

### 3. Refactor Pagination Into Explicit Policies

**Status:** NOT STARTED

**Objective:** Make safe-boundary selection, image avoidance, progress checks, and failure behavior independently understandable and testable.

**Steps:**
- Separate raster-row classification, safe-band selection, forbidden-region handling, and page-progress validation.
- Replace magic thresholds and image-size values with named constants derived from the printable page geometry.
- Deduplicate nested image and figure bounds and define their coordinate contract.
- Remove any fallback that can silently cut content; return a typed pagination failure when no safe progress is possible.
- Keep rendering orchestration responsible only for measurement, candidate rendering, cropping, and PDF assembly.

**Validation:** Pure pagination helpers enforce all contract invariants and production has no implicit unsafe-cut fallback.

**Notes:** Avoid reintroducing DOM text-line measurement; rendered pixels are the authoritative boundary source.

### 4. Add Focused Unit Regression Coverage

**Status:** NOT STARTED

**Objective:** Prove boundary-selection policies with deterministic raster fixtures.

**Steps:**
- Cover narrow and wide blank bands, threshold-adjacent pixels, transparent rows, and final-page behavior.
- Cover images at the top, middle, and bottom of a page, nested image bounds, multiple images, and oversized images.
- Cover no-safe-band, no-progress, blank-page, and maximum-page protections.
- Name tests after behavioral guarantees rather than implementation details.

**Validation:** Each pagination invariant has at least one focused unit test that fails when the invariant is violated.

**Notes:** Tests must preserve meaningful expectations even when production behavior is inconvenient.

### 5. Add Full-Pipeline Browser Regression Coverage

**Status:** NOT STARTED

**Objective:** Exercise the real browser rendering and page-generation path rather than testing only a helper in isolation.

**Steps:**
- Create deterministic synthetic fixtures for long text, mixed formatting, tall portrait images, multiple images, images near boundaries, and long mixed-content documents.
- Invoke the same export path used by production in Chromium.
- Inspect generated page raster boundaries for cut text and verify each image appears wholly on one page.
- Assert page count, non-empty pages, forward progress, and stable completion.
- Keep a small fixture matrix that is fast enough for routine CI execution.

**Validation:** The browser suite fails against known unsafe pagination behavior and passes against the hardened implementation.

**Notes:** Helper-level browser tests may remain only where they prove browser-specific pixel behavior not covered by the full pipeline.

### 6. Add Operational Safeguards and Diagnostics

**Status:** NOT STARTED

**Objective:** Prevent hangs, runaway memory use, and untraceable failures without exposing diary content.

**Steps:**
- Add maximum-page and no-progress guards with sanitized error messages.
- Define and test canvas-dimension and oversized-document limits based on verified browser behavior.
- Return non-sensitive failure context such as page number and failure category, never rendered pixels or diary text.
- Ensure temporary styles, canvases, and cloned state are released on every success and failure path.

**Validation:** Synthetic failure cases terminate predictably, expose no plaintext, and leave no temporary export state behind.

**Notes:** Do not add telemetry or persist diagnostic artifacts.

### 7. Document the Feature and Maintenance Rules

**Status:** NOT STARTED

**Objective:** Make the rendering model, limitations, and required verification discoverable to users and future maintainers.

**Steps:**
- Add an architecture decision record for raster-based pagination and rejected alternatives.
- Add PDF-specific regression and maintenance guidance to the frontend best-practices documentation.
- Add a concise pointer and gotcha to `src/CLAUDE.md` following context-file best practices.
- Update user export documentation to explain rasterized PDFs, image scaling, and explicit failure behavior.
- Update the changelog after the final behavior is verified.

**Validation:** User docs and maintainer docs accurately describe the implemented behavior and verification requirements.

**Notes:** Documentation must describe durable rules, not the chronology of failed fixes.

### 8. Remove Remaining Workaround Debt

**Status:** NOT STARTED

**Objective:** Leave one coherent implementation and one authoritative regression suite.

**Steps:**
- Audit recent PDF-related changes and current files for stale algorithms, duplicate styles, obsolete comments, and redundant tests.
- Remove temporary investigation artifacts and helpers made unnecessary by the hardened design.
- Confirm export styling has a single authoritative source.
- Review the final diff for unrelated changes.

**Validation:** Searches find no obsolete pagination approaches, duplicated export styles, or temporary diagnostic artifacts.

**Notes:** Cleanup happens only after equivalent or stronger regression coverage exists.

### 9. Final Verification and Acceptance

**Status:** NOT STARTED

**Objective:** Prove the hardened feature is ready to ship across automated and real-app workflows.

**Steps:**
- Run focused PDF unit and Playwright suites after each implementation task.
- Run full frontend tests, type-check, lint, format, and build.
- Manually export the original long mixed-content journal in the real Tauri app.
- Manually verify long text, tall portrait images, multiple images, and mixed content across page boundaries.
- Inspect the final PDF and confirm no text or image cuts, blank pages, hangs, or silent failures.

**Validation:** All automated checks pass and the real-app acceptance matrix is confirmed against a newly generated PDF.

**Notes:** Manual acceptance is required because prior helper tests passed while real exports remained damaged.

## Final Verification

- `cmd.exe /c bun run test:run`
- `cmd.exe /c bun run test:print`
- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run format`
- `cmd.exe /c bun run build`
- Real Tauri export of the original long mixed-content journal
- Manual PDF inspection for long text, tall images, multiple images, and mixed content
- Final stale-reference and unrelated-diff audit

## Approval Gate

Implementation starts only after this plan is approved. Any discovered third-party limitation that contradicts the pagination contract must be surfaced before proceeding.

## Self-Check

- Scope includes implementation, regression coverage, documentation, cleanup, operational safeguards, and real-app acceptance.
- The plan preserves the confirmed raster-boundary root-cause model and explicitly rejects unsafe silent fallbacks.
- Each task has observable validation and cleanup is sequenced after stronger coverage.
- No unanswered questions block execution.
