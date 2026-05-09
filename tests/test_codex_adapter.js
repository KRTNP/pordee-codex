const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-codex-'));
  return {
    root,
    homeDir: path.join(root, 'home'),
    repoRoot: path.join(root, 'repo')
  };
}

function cleanup(env) {
  fs.rmSync(env.root, { recursive: true, force: true });
}

function readStats(env) {
  return JSON.parse(
    fs.readFileSync(path.join(env.homeDir, '.pordee', 'stats.json'), 'utf8')
  );
}

test('handlePrompt updates state for trigger prompt and does not fall through to context', () => {
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const result = handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'trigger');
    assert.equal(result.message, 'pordee lite active');
    assert.equal('additionalContext' in result, false);

    const statePath = path.join(env.homeDir, '.pordee', 'state.json');
    const written = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(written.enabled, true);
    assert.equal(written.level, 'lite');
  } finally {
    cleanup(env);
  }
});

test('handlePrompt returns full activation confirmation for bare trigger prompt', () => {
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const result = handlePrompt({
      prompt: '/pordee',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'trigger');
    assert.equal(result.message, 'pordee full active');
  } finally {
    cleanup(env);
  }
});

test('handlePrompt preserves effective level when re-enabling with bare trigger prompt', () => {
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    handlePrompt({
      prompt: '/pordee stop',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    const result = handlePrompt({
      prompt: '/pordee',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'trigger');
    assert.equal(result.message, 'pordee lite active');
    assert.equal(result.state.enabled, true);
    assert.equal(result.state.level, 'lite');
  } finally {
    cleanup(env);
  }
});

test('handlePrompt returns off confirmation for stop trigger prompt', () => {
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    const result = handlePrompt({
      prompt: '/pordee stop',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'trigger');
    assert.equal(result.message, 'pordee off');
    assert.equal(result.state.enabled, false);
  } finally {
    cleanup(env);
  }
});

test('handlePrompt returns pass when state disabled', () => {
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const result = handlePrompt({
      prompt: 'explain project',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'pass');
  } finally {
    cleanup(env);
  }
});

test('handlePrompt returns stats result for /pordee stats', () => {
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const result = handlePrompt({
      prompt: '/pordee stats',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'stats');
    assert.match(result.message, /^pordee stats/m);
  } finally {
    cleanup(env);
  }
});

test('handlePrompt resolves enabled context using shared global and repo precedence', () => {
  const { resolveStatePaths, writeStateFile } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeDir, repoRoot: env.repoRoot });

    writeStateFile(paths.globalStatePath, { enabled: true, level: 'full' });
    writeStateFile(paths.repoStatePath, { enabled: true, level: 'lite' });

    const result = handlePrompt({
      prompt: 'regular prompt',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'context');
    assert.equal(result.state.enabled, true);
    assert.equal(result.state.level, 'lite');
    assert.match(result.additionalContext, /PORDEE MODE ACTIVE/);
    assert.match(result.additionalContext, /level: lite/);
  } finally {
    cleanup(env);
  }
});

test('handlePrompt keeps default auto scope behavior for first trigger write', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeDir, repoRoot: env.repoRoot });

    const result = handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'trigger');
    assert.ok(fs.existsSync(paths.globalStatePath));
    assert.equal(fs.existsSync(paths.repoStatePath), false);
  } finally {
    cleanup(env);
  }
});

test('handlePrompt writes first trigger to repo scope when requested explicitly', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeDir, repoRoot: env.repoRoot });

    const result = handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot,
      scope: 'repo'
    });

    assert.equal(result.kind, 'trigger');
    assert.ok(fs.existsSync(paths.repoStatePath));
    assert.equal(fs.existsSync(paths.globalStatePath), false);

    const written = JSON.parse(fs.readFileSync(paths.repoStatePath, 'utf8'));
    assert.equal(written.enabled, true);
    assert.equal(written.level, 'lite');
  } finally {
    cleanup(env);
  }
});

test('handlePrompt preserves inherited lite level for repo-scoped stop and re-enable flows', () => {
  const { resolveStatePaths, writeStateFile } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeDir, repoRoot: env.repoRoot });

    writeStateFile(paths.globalStatePath, { enabled: true, level: 'lite' });
    fs.mkdirSync(path.dirname(paths.repoStatePath), { recursive: true });
    fs.writeFileSync(
      paths.repoStatePath,
      JSON.stringify({ enabled: true, version: 1 }, null, 2)
    );

    const stopped = handlePrompt({
      prompt: '/pordee stop',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot,
      scope: 'repo'
    });
    assert.equal(stopped.kind, 'trigger');
    assert.equal(stopped.message, 'pordee off');

    const reenabled = handlePrompt({
      prompt: '/pordee',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot,
      scope: 'repo'
    });

    assert.equal(reenabled.kind, 'trigger');
    assert.equal(reenabled.message, 'pordee lite active');
    assert.equal(reenabled.state.enabled, true);
    assert.equal(reenabled.state.level, 'lite');

    const written = JSON.parse(fs.readFileSync(paths.repoStatePath, 'utf8'));
    assert.equal(written.enabled, true);
    assert.equal(written.level, 'lite');
  } finally {
    cleanup(env);
  }
});

test('handlePrompt returns error for repo scope when repoRoot is missing', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeDir });

    const result = handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      scope: 'repo'
    });

    assert.deepEqual(result, {
      kind: 'error',
      message: 'repo scope requires repoRoot'
    });
    assert.equal(fs.existsSync(paths.globalStatePath), false);
  } finally {
    cleanup(env);
  }
});

test('handlePrompt returns effective state after global write under repo override', () => {
  const { resolveStatePaths, writeStateFile } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    const paths = resolveStatePaths({ homeDir: env.homeDir, repoRoot: env.repoRoot });

    writeStateFile(paths.globalStatePath, { enabled: true, level: 'full' });
    writeStateFile(paths.repoStatePath, { enabled: true, level: 'lite' });

    const result = handlePrompt({
      prompt: '/pordee stop',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot,
      scope: 'global'
    });

    assert.equal(result.kind, 'trigger');
    assert.equal(result.message, 'pordee lite active');
    assert.equal(result.state.enabled, true);
    assert.equal(result.state.level, 'lite');

    const globalWritten = JSON.parse(fs.readFileSync(paths.globalStatePath, 'utf8'));
    assert.equal(globalWritten.enabled, false);
    assert.equal(globalWritten.level, 'full');
  } finally {
    cleanup(env);
  }
});

test('handlePrompt returns context when state enabled', () => {
  const { writeScopedState } = require('../core/pordee-state.js');
  const { handlePrompt } = require('../adapters/codex/pordee-codex.js');
  const env = makeEnv();
  try {
    writeScopedState(
      { homeDir: env.homeDir, repoRoot: env.repoRoot },
      { enabled: true, level: 'full' }
    );

    const result = handlePrompt({
      prompt: 'regular prompt',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'context');
    assert.match(result.additionalContext, /PORDEE MODE ACTIVE/);
    assert.equal(readStats(env).lifetime.activePromptCount, 1);
  } finally {
    cleanup(env);
  }
});
