const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TRACKER_MODULE_PATH = path.join(__dirname, '..', 'adapters', 'claude', 'pordee-mode-tracker.js');
const CONFIG_MODULE_PATH = path.join(__dirname, '..', 'adapters', 'claude', 'pordee-config.js');

function sequentialTest(name, fn) {
  test(name, { concurrency: false }, fn);
}

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-test-'));
}

function loadTracker(home) {
  process.env.PORDEE_HOME = home;
  delete require.cache[TRACKER_MODULE_PATH];
  delete require.cache[CONFIG_MODULE_PATH];
  return require(TRACKER_MODULE_PATH);
}

function cleanup(home) {
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env.PORDEE_HOME;
  delete require.cache[TRACKER_MODULE_PATH];
  delete require.cache[CONFIG_MODULE_PATH];
}

function runTracker(prompt, home) {
  const { handleTrackerInput } = loadTracker(home);
  return {
    status: 0,
    stdout: handleTrackerInput(JSON.stringify({ prompt })),
    stderr: ''
  };
}

function runRawTrackerInput(input, home) {
  const { handleTrackerInput } = loadTracker(home);
  return {
    status: 0,
    stdout: handleTrackerInput(input),
    stderr: ''
  };
}

function readState(home) {
  const p = path.join(home, 'state.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readStats(home) {
  const p = path.join(home, '.pordee', 'stats.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

sequentialTest('tracker exits 0 with empty stdout when state disabled and no trigger', () => {
  const home = makeTempHome();
  try {
    const result = runTracker('hello world', home);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker emits hookSpecificOutput JSON when pordee enabled', () => {
  const home = makeTempHome();
  try {
    fs.writeFileSync(path.join(home, 'state.json'),
      JSON.stringify({ enabled: true, level: 'full', version: 1 }));
    const result = runTracker('regular prompt', home);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(parsed.hookSpecificOutput.additionalContext, /PORDEE MODE ACTIVE/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /full/);
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker returns stats summary for /pordee stats without mutating state', () => {
  const home = makeTempHome();
  try {
    const result = runTracker('/pordee stats', home);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.match(parsed.hookSpecificOutput.additionalContext, /^pordee stats/m);
    assert.equal(readState(home), null);
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker returns status summary for /pordee status without mutating state', () => {
  const home = makeTempHome();
  try {
    const result = runTracker('/pordee status', home);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.additionalContext, 'pordee status: off (full)');
    assert.equal(readState(home), null);
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker exits 0 on malformed stdin JSON (silent)', () => {
  const home = makeTempHome();
  try {
    const result = runRawTrackerInput('{not valid json', home);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker ignores trigger inside code fence', () => {
  const home = makeTempHome();
  try {
    const promptWithFence = 'see this:\n```\n/pordee lite\n```\nthat was inside a fence';
    const result = runTracker(promptWithFence, home);
    assert.equal(result.status, 0);
    const state = readState(home);
    assert.ok(state === null || state.enabled === false,
      'state should NOT be enabled when trigger is inside code fence');
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker activates with /pordee', () => {
  const home = makeTempHome();
  try {
    runTracker('/pordee', home);
    const state = readState(home);
    const stats = readStats(home);
    assert.ok(state, 'state file should be written');
    assert.equal(state.enabled, true);
    assert.equal(stats.lifetime.enableCount, 1);
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker switches level with /pordee lite', () => {
  const home = makeTempHome();
  try {
    runTracker('/pordee lite', home);
    const state = readState(home);
    assert.equal(state.enabled, true);
    assert.equal(state.level, 'lite');
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker accepts Thai prefixed toggle and status commands', () => {
  const home = makeTempHome();
  try {
    let result = runTracker('พอดี lite', home);
    assert.equal(result.status, 0);

    result = runTracker('พอดี status', home);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.additionalContext, 'pordee status: active (lite)');

    result = runTracker('พอดี stop', home);
    assert.equal(result.status, 0);
    assert.equal(readState(home).enabled, false);
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker disables with /pordee stop', () => {
  const home = makeTempHome();
  try {
    fs.writeFileSync(path.join(home, 'state.json'),
      JSON.stringify({ enabled: true, level: 'full', version: 1 }));
    runTracker('/pordee stop', home);
    const state = readState(home);
    assert.equal(state.enabled, false);
  } finally {
    cleanup(home);
  }
});

sequentialTest('tracker records active prompt stats when pordee enabled', () => {
  const home = makeTempHome();
  try {
    fs.writeFileSync(path.join(home, 'state.json'),
      JSON.stringify({ enabled: true, level: 'full', version: 1 }));
    runTracker('regular prompt', home);
    const stats = readStats(home);
    assert.equal(stats.lifetime.activePromptCount, 1);
    assert.ok(stats.lifetime.estimatedTokensSaved > 0);
  } finally {
    cleanup(home);
  }
});
