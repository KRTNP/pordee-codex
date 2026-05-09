const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLevel,
  renderSessionContext,
  renderPromptReminder,
  renderStatsSummary,
  renderStatusSummary
} = require('../core/pordee-render.js');

test('normalizeLevel keeps supported levels and defaults invalid input to full', () => {
  assert.equal(normalizeLevel('lite'), 'lite');
  assert.equal(normalizeLevel('full'), 'full');
  assert.equal(normalizeLevel(undefined), 'full');
  assert.equal(normalizeLevel('bogus'), 'full');
});

test('renderSessionContext includes level and persistence rules', () => {
  const text = renderSessionContext({ enabled: true, level: 'lite' });

  assert.match(text, /PORDEE MODE ACTIVE/);
  assert.match(text, /level: lite/);
  assert.match(text, /Off only via "หยุดพอดี"/);
});

test('renderSessionContext defaults missing or invalid level to full', () => {
  assert.match(renderSessionContext({ enabled: true }), /level: full/);
  assert.match(renderSessionContext({ enabled: true, level: 'bogus' }), /level: full/);
});

test('renderPromptReminder returns single-line reminder', () => {
  const text = renderPromptReminder({ enabled: true, level: 'full' });

  assert.equal(text.includes('\n'), false);
  assert.match(text, /PORDEE MODE ACTIVE \(full\)/);
});

test('renderPromptReminder defaults missing or invalid level to full', () => {
  assert.match(renderPromptReminder({ enabled: true }), /PORDEE MODE ACTIVE \(full\)/);
  assert.match(renderPromptReminder({ enabled: true, level: 'bogus' }), /PORDEE MODE ACTIVE \(full\)/);
});

test('renderStatsSummary renders structured mode, usage, savings, and health sections', () => {
  const text = renderStatsSummary({
    mode: {
      enabled: true,
      level: 'lite',
      stateSource: 'repo',
      effectiveScope: 'repo',
      sessionBoundLevel: 'lite'
    },
    session: { activePromptCount: 2, toggles: 1, estimatedTokensSaved: 42 },
    lifetime: { activePromptCount: 10, toggles: 4, estimatedTokensSaved: 210 },
    benchmark: { liteSavingsPct: 10, fullSavingsPct: 40, sampleCount: 3 },
    health: {
      repoStateValid: true,
      globalStateValid: false,
      lastReadError: 'global state invalid: bad json',
      statsSchemaVersion: 1,
      stateSchemaVersion: 2
    }
  });

  assert.match(text, /^pordee stats/m);
  assert.match(text, /\nmode:\n/);
  assert.match(text, /- current: active \(lite\)/);
  assert.match(text, /- source: repo/);
  assert.match(text, /- scope: repo/);
  assert.match(text, /- session bound: lite/);
  assert.match(text, /\nusage:\n/);
  assert.match(text, /- session: 2 active prompts, 1 toggles/);
  assert.match(text, /- lifetime: 10 active prompts, 4 toggles/);
  assert.match(text, /\nsavings:\n/);
  assert.match(text, /- session est\.: 42 tokens saved/);
  assert.match(text, /- lifetime est\.: 210 tokens saved/);
  assert.match(text, /- benchmark: lite 10% avg, full 40% avg across 3 built-in samples/);
  assert.match(text, /\nhealth:\n/);
  assert.match(text, /- repo state: valid/);
  assert.match(text, /- global state: invalid/);
  assert.match(text, /- last read error: global state invalid: bad json/);
  assert.match(text, /- stats schema: v1/);
  assert.match(text, /- state schema: v2/);
});

test('renderStatusSummary renders current state in one line', () => {
  assert.equal(renderStatusSummary({ enabled: true, level: 'lite' }), 'pordee status: active (lite)');
  assert.equal(renderStatusSummary({ enabled: false, level: 'bogus' }), 'pordee status: off (full)');
});

test('renderStatusSummary includes metadata and health details when present', () => {
  const text = renderStatusSummary({
    enabled: true,
    level: 'lite',
    stateSource: 'repo',
    effectiveScope: 'repo',
    sessionBoundLevel: 'lite',
    repoStateValid: true,
    globalStateValid: false,
    lastReadError: 'global state invalid: bad json'
  });

  assert.match(text, /^pordee status: active \(lite\)/);
  assert.match(text, /source: repo/);
  assert.match(text, /scope: repo/);
  assert.match(text, /session: lite/);
  assert.match(text, /repo valid: yes/);
  assert.match(text, /global valid: no/);
  assert.match(text, /read error: global state invalid: bad json/);
});
