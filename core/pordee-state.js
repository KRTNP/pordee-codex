const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_STATE = Object.freeze({
  enabled: false,
  level: 'full',
  version: 1
});

const VALID_LEVELS = new Set(['lite', 'full']);

function resolveStatePaths(options = {}) {
  const {
    homeDir = process.env.PORDEE_HOME || os.homedir(),
    repoRoot = null
  } = options;

  const stateBaseDir = path.join(homeDir, '.pordee');

  return {
    globalStatePath: path.join(stateBaseDir, 'state.json'),
    repoStatePath: repoRoot ? path.join(repoRoot, '.pordee', 'state.json') : null,
    errorLogPath: path.join(stateBaseDir, 'error.log')
  };
}

function normalizeState(raw = {}) {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_STATE.enabled,
    level: VALID_LEVELS.has(raw.level) ? raw.level : DEFAULT_STATE.level,
    version: typeof raw.version === 'number' ? raw.version : DEFAULT_STATE.version,
    lastChanged: typeof raw.lastChanged === 'string' ? raw.lastChanged : undefined
  };
}

function normalizeStateOverlay(raw = {}) {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : undefined,
    level: VALID_LEVELS.has(raw.level) ? raw.level : undefined,
    version: typeof raw.version === 'number' ? raw.version : undefined,
    lastChanged: typeof raw.lastChanged === 'string' ? raw.lastChanged : undefined
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
      return { exists: false, valid: false, state: {} };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { exists: true, valid: true, state: normalizeStateOverlay(parsed) };
  } catch {
    return { exists: true, valid: false, state: {} };
  }
}

function writeStateFile(filePath, patch = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = readStateFile(filePath);
  const merged = normalizeState({
    ...current,
    ...patch,
    version: 1,
    lastChanged: new Date().toISOString()
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
    return mergeState(globalState, repoSource.state);
  }

  return globalState;
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
  DEFAULT_STATE,
  VALID_LEVELS,
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
