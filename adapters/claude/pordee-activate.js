#!/usr/bin/env node
// pordee — Claude Code SessionStart activation hook.
// Reads state, emits Thai mode reminder via stdout when enabled.
// Stdout becomes additionalContext for the session.
// Always exits 0 — never blocks session start.

let getState;
let logError = () => {};

try {
  ({ getState, logError } = require('./pordee-config'));
  const { beginSession } = require('../../core/pordee-stats');
  const { renderSessionContext } = require('../../core/pordee-render');
  beginSession({ homeDir: process.env.PORDEE_HOME, repoRoot: process.cwd() });
  const state = getState();

  if (!state.enabled) {
    process.exit(0);
  }
  process.stdout.write(renderSessionContext(state));
  process.exit(0);
} catch (e) {
  try {
    logError(`activate: ${e.message}`);
  } catch {
    // Never block session start, even if logging is unavailable.
  }
  process.exit(0);
}
