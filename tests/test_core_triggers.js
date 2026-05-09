const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parsePordeeCommand, parseTrigger, stripCodeFences } = require('../core/pordee-triggers.js');

test('parseTrigger matches slash commands case-insensitively on the whole trimmed prompt', () => {
  assert.deepEqual(parseTrigger('  /PORDee  '), { enabled: true });
  assert.deepEqual(parseTrigger('/pordee lite'), { enabled: true, level: 'lite' });
  assert.deepEqual(parseTrigger('/pordee FULL'), { enabled: true, level: 'full' });
  assert.deepEqual(parseTrigger('/pordee stop'), { enabled: false });
});

test('parseTrigger ignores unknown slash subcommands', () => {
  assert.equal(parseTrigger('/pordee banana'), null);
});

test('parsePordeeCommand detects stats commands', () => {
  assert.deepEqual(parsePordeeCommand('/pordee stats'), { kind: 'stats' });
  assert.deepEqual(parsePordeeCommand('พอดีสถิติ'), { kind: 'stats' });
});

test('parseTrigger matches Thai enable and disable phrases only when exact', () => {
  assert.deepEqual(parseTrigger('พอดี'), { enabled: true });
  assert.deepEqual(parseTrigger('พอดีโหมด'), { enabled: true });
  assert.deepEqual(parseTrigger('พูดสั้นๆ'), { enabled: true });
  assert.deepEqual(parseTrigger('หยุดพอดี'), { enabled: false });
  assert.deepEqual(parseTrigger('พูดปกติ'), { enabled: false });
  assert.equal(parseTrigger('ไม่พอดีกับขนาดของกล่อง'), null);
});

test('parseTrigger ignores triggers inside fenced code blocks', () => {
  const prompt = 'before\n```js\n/pordee lite\n```\nafter';
  assert.equal(stripCodeFences(prompt).trim(), 'before\n\nafter');
  assert.equal(parseTrigger(prompt), null);
});
