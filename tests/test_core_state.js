const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-core-'));
  return {
    root,
    homeRoot: path.join(root, 'home'),
    repoRoot: path.join(root, 'repo')
  };
}

function cleanup(env) {
  fs.rmSync(env.root, { recursive: true, force: true });
}

test('resolveStatePaths returns global and repo paths', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    assert.equal(paths.globalStatePath, path.join(env.homeRoot, '.pordee', 'state.json'));
    assert.equal(paths.repoStatePath, path.join(env.repoRoot, '.pordee', 'state.json'));
    assert.equal(paths.errorLogPath, path.join(env.homeRoot, '.pordee', 'error.log'));
  } finally {
    cleanup(env);
  }
});

test('getEffectiveState prefers repo override over global', () => {
  const { writeStateFile, getEffectiveState } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const globalStatePath = path.join(env.homeRoot, '.pordee', 'state.json');
    const repoStatePath = path.join(env.repoRoot, '.pordee', 'state.json');

    writeStateFile(globalStatePath, { enabled: true, level: 'full' });
    writeStateFile(repoStatePath, { enabled: true, level: 'lite' });

    const state = getEffectiveState({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    assert.equal(state.enabled, true);
    assert.equal(state.level, 'lite');
  } finally {
    cleanup(env);
  }
});

test('getEffectiveState inherits missing fields from global when repo override is partial', () => {
  const { writeStateFile, getEffectiveState } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const globalStatePath = path.join(env.homeRoot, '.pordee', 'state.json');
    const repoStatePath = path.join(env.repoRoot, '.pordee', 'state.json');

    writeStateFile(globalStatePath, { enabled: true, level: 'full' });
    fs.mkdirSync(path.dirname(repoStatePath), { recursive: true });
    fs.writeFileSync(repoStatePath, JSON.stringify({ level: 'lite' }));

    const state = getEffectiveState({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    assert.equal(state.enabled, true);
    assert.equal(state.level, 'lite');
    assert.equal(state.version, 1);
  } finally {
    cleanup(env);
  }
});

test('getEffectiveState falls back when repo JSON malformed', () => {
  const { writeStateFile, getEffectiveState } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const globalStatePath = path.join(env.homeRoot, '.pordee', 'state.json');
    const repoStatePath = path.join(env.repoRoot, '.pordee', 'state.json');

    writeStateFile(globalStatePath, { enabled: true, level: 'full' });
    fs.mkdirSync(path.dirname(repoStatePath), { recursive: true });
    fs.writeFileSync(repoStatePath, '{bad json');

    const state = getEffectiveState({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    assert.equal(state.enabled, true);
    assert.equal(state.level, 'full');
  } finally {
    cleanup(env);
  }
});

test('getEffectiveState falls back to defaults when global JSON malformed', () => {
  const { getEffectiveState } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const globalStatePath = path.join(env.homeRoot, '.pordee', 'state.json');

    fs.mkdirSync(path.dirname(globalStatePath), { recursive: true });
    fs.writeFileSync(globalStatePath, '{bad json');

    const state = getEffectiveState({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    assert.equal(state.enabled, false);
    assert.equal(state.level, 'full');
    assert.equal(state.version, 1);
  } finally {
    cleanup(env);
  }
});

test('getEffectiveState uses repo state when global JSON malformed', () => {
  const { writeStateFile, getEffectiveState } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const globalStatePath = path.join(env.homeRoot, '.pordee', 'state.json');
    const repoStatePath = path.join(env.repoRoot, '.pordee', 'state.json');

    fs.mkdirSync(path.dirname(globalStatePath), { recursive: true });
    fs.writeFileSync(globalStatePath, '{bad json');
    writeStateFile(repoStatePath, { enabled: true, level: 'lite' });

    const state = getEffectiveState({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    assert.equal(state.enabled, true);
    assert.equal(state.level, 'lite');
  } finally {
    cleanup(env);
  }
});

test('writeScopedState writes global by default when no repo override exists', () => {
  const { writeScopedState, resolveStatePaths } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    writeScopedState({ homeDir: env.homeRoot, repoRoot: env.repoRoot }, { enabled: true, level: 'full' });

    assert.ok(fs.existsSync(paths.globalStatePath), 'global state should be written');
    assert.ok(!fs.existsSync(paths.repoStatePath), 'repo override should not be created');
  } finally {
    cleanup(env);
  }
});

test('writeStateFile is atomic and leaves no .tmp behind', () => {
  const { writeStateFile } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const statePath = path.join(env.homeRoot, '.pordee', 'state.json');
    writeStateFile(statePath, { enabled: true, level: 'full' });

    assert.ok(fs.existsSync(statePath), 'state file should exist');
    assert.ok(!fs.existsSync(`${statePath}.tmp`), '.tmp file should be removed');
  } finally {
    cleanup(env);
  }
});

test('writeScopedState writes repo state only when repo override exists', () => {
  const { writeScopedState, resolveStatePaths } = require('../core/pordee-state.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeRoot, repoRoot: env.repoRoot });
    fs.mkdirSync(path.dirname(paths.repoStatePath), { recursive: true });
    fs.writeFileSync(paths.repoStatePath, JSON.stringify({ enabled: false, level: 'full', version: 1 }));

    writeScopedState({ homeDir: env.homeRoot, repoRoot: env.repoRoot }, { enabled: true, level: 'lite' });

    assert.ok(fs.existsSync(paths.repoStatePath), 'repo state should exist');
    assert.ok(!fs.existsSync(paths.globalStatePath), 'global state should not be created');

    const written = JSON.parse(fs.readFileSync(paths.repoStatePath, 'utf8'));
    assert.equal(written.enabled, true);
    assert.equal(written.level, 'lite');
  } finally {
    cleanup(env);
  }
});
