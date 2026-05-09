const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-stats-'));
  return {
    root,
    homeDir: path.join(root, 'home'),
    repoRoot: path.join(root, 'repo')
  };
}

function cleanup(env) {
  fs.rmSync(env.root, { recursive: true, force: true });
}

test('beginSession creates stats file with currentSession', () => {
  const { beginSession, getStatsPath, readStats } = require('../core/pordee-stats.js');
  const env = makeEnv();
  try {
    const written = beginSession({ homeDir: env.homeDir, repoRoot: env.repoRoot });
    assert.ok(fs.existsSync(getStatsPath({ homeDir: env.homeDir, repoRoot: env.repoRoot })));
    assert.equal(typeof written.currentSession.sessionStartedAt, 'string');
    assert.equal(readStats({ homeDir: env.homeDir }).currentSession.toggles, 0);
  } finally {
    cleanup(env);
  }
});

test('recordToggle updates lifetime and session counters', () => {
  const { beginSession, recordToggle, readStats } = require('../core/pordee-stats.js');
  const env = makeEnv();
  try {
    beginSession({ homeDir: env.homeDir });
    recordToggle({ homeDir: env.homeDir }, { enabled: true, level: 'lite' });
    recordToggle({ homeDir: env.homeDir }, { enabled: false, level: 'lite' });
    const stats = readStats({ homeDir: env.homeDir });

    assert.equal(stats.lifetime.toggles, 2);
    assert.equal(stats.currentSession.toggles, 2);
    assert.equal(stats.lifetime.enableCount, 1);
    assert.equal(stats.lifetime.disableCount, 1);
    assert.equal(stats.lifetime.liteCount, 1);
  } finally {
    cleanup(env);
  }
});

test('recordActivePrompt increments counters and estimated saved tokens', () => {
  const {
    beginSession,
    recordActivePrompt,
    readStats,
    BENCHMARK_PROFILE
  } = require('../core/pordee-stats.js');
  const env = makeEnv();
  try {
    beginSession({ homeDir: env.homeDir });
    recordActivePrompt({ homeDir: env.homeDir }, 'full');
    const stats = readStats({ homeDir: env.homeDir });

    assert.equal(stats.lifetime.activePromptCount, 1);
    assert.equal(stats.currentSession.activePromptCount, 1);
    assert.equal(stats.lifetime.estimatedTokensSaved, BENCHMARK_PROFILE.fullSavedTokensPerPrompt);
  } finally {
    cleanup(env);
  }
});

test('getStatsSummary exposes benchmark and counter data', () => {
  const {
    beginSession,
    recordToggle,
    recordActivePrompt,
    getStatsSummary
  } = require('../core/pordee-stats.js');
  const env = makeEnv();
  try {
    beginSession({ homeDir: env.homeDir });
    recordToggle({ homeDir: env.homeDir }, { enabled: true, level: 'full' });
    recordActivePrompt({ homeDir: env.homeDir }, 'full');
    const summary = getStatsSummary({ homeDir: env.homeDir });

    assert.equal(summary.session.toggles, 1);
    assert.equal(summary.session.activePromptCount, 1);
    assert.ok(summary.benchmark.fullSavingsPct > 0);
    assert.ok(summary.benchmark.sampleCount > 0);
  } finally {
    cleanup(env);
  }
});
