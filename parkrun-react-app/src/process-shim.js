// Runtime shim to ensure a minimal `process.env` exists in the browser.
// Some older libraries or bundles expect a `process` global and crash when it's missing.
// This file is plain JS to avoid TypeScript parsing issues in tooling that doesn't fully support TS syntax.
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  window.process = { env: {} };
}
