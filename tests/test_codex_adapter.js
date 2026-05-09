const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CODEX_ADAPTER_MODULE_PATH = path.join(__dirname, '..', 'adapters', 'codex', 'pordee-codex.js');

function sequentialTest(name, fn) {
  test(name, { concurrency: false }, fn);
}

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
  delete require.cache[CODEX_ADAPTER_MODULE_PATH];
}

function readStats(env) {
  return JSON.parse(
    fs.readFileSync(path.join(env.homeDir, '.pordee', 'stats.json'), 'utf8')
  );
}

function readState(env) {
  return JSON.parse(
    fs.readFileSync(path.join(env.homeDir, '.pordee', 'state.json'), 'utf8')
  );
}

function loadHandlePrompt() {
  delete require.cache[CODEX_ADAPTER_MODULE_PATH];
  return require(CODEX_ADAPTER_MODULE_PATH).handlePrompt;
}

sequentialTest('handlePrompt updates state for trigger prompt and does not fall through to context', () => {
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt persists command metadata on trigger writes', () => {
  const handlePrompt = loadHandlePrompt();
  const env = makeEnv();
  try {
    handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    const written = readState(env);
    assert.equal(written.lastCommand, '/pordee lite');
    assert.equal(written.lastCommandSource, 'user');
    assert.equal(written.effectiveScope, 'global');
    assert.equal(written.sessionBoundLevel, 'lite');
    assert.match(written.lastCommandAt || '', /^\d{4}-\d{2}-\d{2}T/);
    assert.match(written.sessionBoundAt || '', /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    cleanup(env);
  }
});

sequentialTest('handlePrompt returns full activation confirmation for bare trigger prompt', () => {
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt preserves effective level when re-enabling with bare trigger prompt', () => {
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt returns off confirmation for stop trigger prompt', () => {
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt returns pass when state disabled', () => {
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt returns stats result for /pordee stats', () => {
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt returns pordee stats for Thai stats aliases', () => {
  const handlePrompt = loadHandlePrompt();
  const env = makeEnv();
  try {
    let result = handlePrompt({
      prompt: 'พอดี stats',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'stats');
    assert.match(result.message, /^pordee stats/m);

    result = handlePrompt({
      prompt: 'พอดีสถิติ',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'stats');
    assert.match(result.message, /^pordee stats/m);
  } finally {
    cleanup(env);
  }
});

sequentialTest('handlePrompt returns status result for /pordee status without mutating state', () => {
  const handlePrompt = loadHandlePrompt();
  const env = makeEnv();
  try {
    const result = handlePrompt({
      prompt: '/pordee status',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'status');
    assert.match(result.message, /^pordee status: off \(full\)/);
    assert.match(result.message, /source: global/);
  } finally {
    cleanup(env);
  }
});

sequentialTest('handlePrompt accepts Thai prefixed commands for toggle and status', () => {
  const handlePrompt = loadHandlePrompt();
  const env = makeEnv();
  try {
    const enableResult = handlePrompt({
      prompt: 'พอดี lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });
    assert.equal(enableResult.kind, 'trigger');
    assert.equal(enableResult.message, 'pordee lite active');

    const statusResult = handlePrompt({
      prompt: 'พอดี status',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });
    assert.equal(statusResult.kind, 'status');
    assert.match(statusResult.message, /^pordee status: active \(lite\)/);
    assert.match(statusResult.message, /session: lite/);

    const stopResult = handlePrompt({
      prompt: 'พอดี stop',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });
    assert.equal(stopResult.kind, 'trigger');
    assert.equal(stopResult.message, 'pordee off');
  } finally {
    cleanup(env);
  }
});

sequentialTest('handlePrompt resolves enabled context using shared global and repo precedence', () => {
  const { resolveStatePaths, writeStateFile } = require('../core/pordee-state.js');
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt refreshes session snapshot from effective state on regular prompts', () => {
  const { resolveStatePaths, writeStateFile } = require('../core/pordee-state.js');
  const handlePrompt = loadHandlePrompt();
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
    assert.equal(result.state.sessionBoundLevel, 'lite');
    assert.equal(result.state.stateSource, 'repo');

    const written = JSON.parse(fs.readFileSync(paths.repoStatePath, 'utf8'));
    assert.equal(written.sessionBoundLevel, 'lite');
    assert.match(written.sessionBoundAt || '', /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    cleanup(env);
  }
});

sequentialTest('handlePrompt keeps default auto scope behavior for first trigger write', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt writes first trigger to repo scope when requested explicitly', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt preserves inherited lite level for repo-scoped stop and re-enable flows', () => {
  const { resolveStatePaths, writeStateFile } = require('../core/pordee-state.js');
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt returns error for repo scope when repoRoot is missing', () => {
  const { resolveStatePaths } = require('../core/pordee-state.js');
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt returns effective state after global write under repo override', () => {
  const { resolveStatePaths, writeStateFile } = require('../core/pordee-state.js');
  const handlePrompt = loadHandlePrompt();
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

sequentialTest('handlePrompt stats preserves current session counters across module reload', () => {
  const env = makeEnv();
  try {
    let handlePrompt = loadHandlePrompt();
    handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });
    handlePrompt({
      prompt: 'regular prompt',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    const before = readStats(env);
    assert.equal(before.currentSession.activePromptCount, 1);

    handlePrompt = loadHandlePrompt();
    const result = handlePrompt({
      prompt: '/pordee stats',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'stats');
    assert.match(result.message, /session: 1 active prompts, 1 toggles/);
    assert.deepEqual(readStats(env).currentSession, before.currentSession);
  } finally {
    cleanup(env);
  }
});

sequentialTest('handlePrompt status preserves current session counters across module reload', () => {
  const env = makeEnv();
  try {
    let handlePrompt = loadHandlePrompt();
    handlePrompt({
      prompt: '/pordee lite',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });
    handlePrompt({
      prompt: 'regular prompt',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    const before = readStats(env);
    assert.equal(before.currentSession.activePromptCount, 1);

    handlePrompt = loadHandlePrompt();
    const result = handlePrompt({
      prompt: '/pordee status',
      homeDir: env.homeDir,
      repoRoot: env.repoRoot
    });

    assert.equal(result.kind, 'status');
    assert.match(result.message, /^pordee status: active \(lite\)/);
    assert.match(result.message, /session: lite/);
    assert.deepEqual(readStats(env).currentSession, before.currentSession);
  } finally {
    cleanup(env);
  }
});

sequentialTest('handlePrompt returns context when state enabled', () => {
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
