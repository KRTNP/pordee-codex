#!/usr/bin/env node
// pordee — shared state helper.
// Maintains backward-compatible wrapper behavior while delegating storage logic
// to the shared state core.

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  DEFAULT_STATE,
  VALID_LEVELS,
  resolveStatePaths,
  readStateFile,
  writeStateFile,
  getEffectiveState,
  resolveScopedWriteTarget,
  writeScopedState
} = require('../core/pordee-state');

const HOME_DIR = process.env.PORDEE_HOME || os.homedir();
const PATHS = resolveStatePaths({
  homeDir: HOME_DIR,
  repoRoot: process.cwd()
});
const STATE_PATH = PATHS.globalStatePath;
const ERROR_LOG_PATH = PATHS.errorLogPath;
const LEGACY_STATE_PATH = process.env.PORDEE_HOME ? path.join(HOME_DIR, 'state.json') : null;

function logError(msg) {
  try {
    fs.mkdirSync(path.dirname(ERROR_LOG_PATH), { recursive: true });
    fs.appendFileSync(ERROR_LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    // Logging is best-effort.
  }
}

function getState() {
  try {
    const state = getEffectiveState({
      homeDir: HOME_DIR,
      repoRoot: process.cwd()
    });

    if (
      LEGACY_STATE_PATH &&
      !fs.existsSync(STATE_PATH) &&
      fs.existsSync(LEGACY_STATE_PATH) &&
      !(PATHS.repoStatePath && fs.existsSync(PATHS.repoStatePath))
    ) {
      return readStateFile(LEGACY_STATE_PATH);
    }

    return state;
  } catch (e) {
    logError(`getState: ${e.message}`);
    return { ...DEFAULT_STATE };
  }
}

function setState(patch) {
  try {
    const { targetPath } = resolveScopedWriteTarget({
      homeDir: HOME_DIR,
      repoRoot: process.cwd()
    });

    const state = writeScopedState({
      homeDir: HOME_DIR,
      repoRoot: process.cwd()
    }, patch);

    if (LEGACY_STATE_PATH && targetPath === STATE_PATH && STATE_PATH !== LEGACY_STATE_PATH) {
      try {
        writeStateFile(LEGACY_STATE_PATH, patch);
      } catch (mirrorError) {
        // Compatibility mirror is best-effort.
      }
    }

    return state;
  } catch (e) {
    logError(`setState: ${e.message}`);
    return null;
  }
}

module.exports = {
  STATE_PATH,
  ERROR_LOG_PATH,
  DEFAULT_STATE,
  VALID_LEVELS,
  getState,
  setState,
  logError
};
