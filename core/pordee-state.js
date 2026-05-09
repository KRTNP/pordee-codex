const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATE_SCHEMA_VERSION = 2;
const DEFAULT_STATE = Object.freeze({
  enabled: false,
  level: 'full',
  version: STATE_SCHEMA_VERSION
});

const VALID_LEVELS = new Set(['lite', 'full']);
const VALID_SCOPES = new Set(['global', 'repo']);

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeOptionalScope(value) {
  return VALID_SCOPES.has(value) ? value : undefined;
}

function resolveStatePaths(options = {}) {
  const {
    homeDir = process.env.PORDEE_HOME || os.homedir(),
    repoRoot = null
  } = options;

  const stateBaseDir = path.join(homeDir, '.pordee');

  return {
    globalStatePath: path.join(stateBaseDir, 'state.json'),
    globalStatsPath: path.join(stateBaseDir, 'stats.json'),
    repoStatePath: repoRoot ? path.join(repoRoot, '.pordee', 'state.json') : null,
    errorLogPath: path.join(stateBaseDir, 'error.log')
  };
}

function normalizeState(raw = {}) {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_STATE.enabled,
    level: VALID_LEVELS.has(raw.level) ? raw.level : DEFAULT_STATE.level,
    version: typeof raw.version === 'number'
      ? Math.max(raw.version, STATE_SCHEMA_VERSION)
      : DEFAULT_STATE.version,
    lastChanged: normalizeOptionalString(raw.lastChanged),
    lastCommand: normalizeOptionalString(raw.lastCommand),
    lastCommandAt: normalizeOptionalString(raw.lastCommandAt),
    lastCommandSource: normalizeOptionalString(raw.lastCommandSource),
    effectiveScope: normalizeOptionalScope(raw.effectiveScope),
    sessionBoundLevel: VALID_LEVELS.has(raw.sessionBoundLevel) ? raw.sessionBoundLevel : undefined,
    sessionBoundAt: normalizeOptionalString(raw.sessionBoundAt)
  };
}

function normalizeStateOverlay(raw = {}) {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : undefined,
    level: VALID_LEVELS.has(raw.level) ? raw.level : undefined,
    version: typeof raw.version === 'number'
      ? Math.max(raw.version, STATE_SCHEMA_VERSION)
      : undefined,
    lastChanged: normalizeOptionalString(raw.lastChanged),
    lastCommand: normalizeOptionalString(raw.lastCommand),
    lastCommandAt: normalizeOptionalString(raw.lastCommandAt),
    lastCommandSource: normalizeOptionalString(raw.lastCommandSource),
    effectiveScope: normalizeOptionalScope(raw.effectiveScope),
    sessionBoundLevel: VALID_LEVELS.has(raw.sessionBoundLevel) ? raw.sessionBoundLevel : undefined,
    sessionBoundAt: normalizeOptionalString(raw.sessionBoundAt)
  };
}

function mergeState(base, overlay) {
  const definedOverlay = Object.fromEntries(
    Object.entries(overlay || {}).filter(([, value]) => value !== undefined)
  );

  return normalizeState({
    ...base,
    ...definedOverlay
  });
}

function readStateFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { ...DEFAULT_STATE };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return normalizeState(parsed);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function readStateSource(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { exists: false, valid: false, state: {}, error: undefined };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { exists: true, valid: true, state: normalizeStateOverlay(parsed), error: undefined };
  } catch (error) {
    return { exists: true, valid: false, state: {}, error: error?.message || 'invalid state file' };
  }
}

function writeStateFile(filePath, patch = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = readStateFile(filePath);
  const now = new Date().toISOString();
  const merged = normalizeState({
    ...current,
    ...patch,
    version: STATE_SCHEMA_VERSION,
    lastChanged: now,
    lastCommandAt: patch.lastCommand !== undefined
      ? (normalizeOptionalString(patch.lastCommandAt) || now)
      : current.lastCommandAt,
    sessionBoundAt: patch.sessionBoundLevel !== undefined
      ? (normalizeOptionalString(patch.sessionBoundAt) || now)
      : current.sessionBoundAt
  });

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2));
  fs.renameSync(tmpPath, filePath);
  return merged;
}

function getEffectiveState(options = {}) {
  const paths = resolveStatePaths(options);
  const globalSource = readStateSource(paths.globalStatePath);
  const repoSource = readStateSource(paths.repoStatePath);

  const globalState = globalSource.valid
    ? mergeState(DEFAULT_STATE, globalSource.state)
    : { ...DEFAULT_STATE };

  if (repoSource.exists && repoSource.valid) {
    return {
      ...mergeState(globalState, repoSource.state),
      stateSource: 'repo',
      repoStateValid: true,
      globalStateValid: globalSource.exists ? globalSource.valid : undefined,
      lastReadError: globalSource.exists && !globalSource.valid
        ? `global state invalid: ${globalSource.error || 'invalid JSON'}`
        : undefined
    };
  }

  return {
    ...globalState,
    stateSource: 'global',
    repoStateValid: repoSource.exists ? repoSource.valid : undefined,
    globalStateValid: globalSource.exists ? globalSource.valid : undefined,
    lastReadError: repoSource.exists && !repoSource.valid
      ? `repo state invalid: ${repoSource.error || 'invalid JSON'}`
      : globalSource.exists && !globalSource.valid
        ? `global state invalid: ${globalSource.error || 'invalid JSON'}`
        : undefined
  };
}

function resolveScopedWriteTarget(options = {}) {
  const paths = resolveStatePaths(options);
  return {
    ...paths,
    targetPath: paths.repoStatePath && fs.existsSync(paths.repoStatePath)
      ? paths.repoStatePath
      : paths.globalStatePath
  };
}

function writeScopedState(options = {}, patch = {}) {
  const { targetPath } = resolveScopedWriteTarget(options);

  return writeStateFile(targetPath, patch);
}

module.exports = {
  STATE_SCHEMA_VERSION,
  DEFAULT_STATE,
  VALID_LEVELS,
  VALID_SCOPES,
  resolveStatePaths,
  normalizeState,
  normalizeStateOverlay,
  mergeState,
  readStateFile,
  writeStateFile,
  getEffectiveState,
  resolveScopedWriteTarget,
  writeScopedState
};
