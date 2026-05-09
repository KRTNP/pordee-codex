const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ACTIVATE_MODULE_PATH = path.join(__dirname, '..', 'adapters', 'claude', 'pordee-activate.js');
const CONFIG_MODULE_PATH = path.join(__dirname, '..', 'adapters', 'claude', 'pordee-config.js');

function loadActivate(home) {
  process.env.PORDEE_HOME = home;
  delete require.cache[ACTIVATE_MODULE_PATH];
  delete require.cache[CONFIG_MODULE_PATH];
  return require(ACTIVATE_MODULE_PATH);
}

function cleanup(home) {
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env.PORDEE_HOME;
  delete require.cache[ACTIVATE_MODULE_PATH];
  delete require.cache[CONFIG_MODULE_PATH];
}

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-test-'));
}

test('activate exits 0 when state file missing (silent)', () => {
  const home = makeTempHome();
  try {
    const { handleActivate } = loadActivate(home);
    assert.equal(handleActivate().trim(), '', 'should emit nothing when state missing/disabled');
  } finally {
    cleanup(home);
  }
});

test('activate exits 0 silently when enabled=false', () => {
  const home = makeTempHome();
  try {
    fs.writeFileSync(path.join(home, 'state.json'),
      JSON.stringify({ enabled: false, level: 'full', version: 1 }));
    const { handleActivate } = loadActivate(home);
    assert.equal(handleActivate().trim(), '');
  } finally {
    cleanup(home);
  }
});

test('activate emits reminder when enabled=true level=full', () => {
  const home = makeTempHome();
  try {
    fs.writeFileSync(path.join(home, 'state.json'),
      JSON.stringify({ enabled: true, level: 'full', version: 1 }));
    const { handleActivate } = loadActivate(home);
    const output = handleActivate();
    assert.match(output, /PORDEE MODE ACTIVE/);
    assert.match(output, /level: full/);
    assert.match(output, /Thai/);
  } finally {
    cleanup(home);
  }
});

test('activate emits reminder when enabled=true level=lite', () => {
  const home = makeTempHome();
  try {
    fs.writeFileSync(path.join(home, 'state.json'),
      JSON.stringify({ enabled: true, level: 'lite', version: 1 }));
    const { handleActivate } = loadActivate(home);
    assert.match(handleActivate(), /level: lite/);
  } finally {
    cleanup(home);
  }
});

test('activate exits 0 even on internal error (never blocks)', () => {
  const home = makeTempHome();
  try {
    fs.mkdirSync(path.join(home, 'state.json'));
    const { handleActivate } = loadActivate(home);
    assert.equal(handleActivate(), '');
  } finally {
    cleanup(home);
  }
});
