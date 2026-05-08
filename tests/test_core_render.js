const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLevel,
  renderSessionContext,
  renderPromptReminder
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
