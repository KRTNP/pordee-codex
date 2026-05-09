const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('packaged Codex skill stays in sync with root pordee skill', () => {
  const rootSkill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'pordee', 'SKILL.md'),
    'utf8'
  );
  const packagedSkill = fs.readFileSync(
    path.join(__dirname, '..', 'plugins', 'pordee', 'skills', 'pordee', 'SKILL.md'),
    'utf8'
  );

  assert.equal(packagedSkill, rootSkill);
});

test('root pordee skill includes session-truth rules for Codex', () => {
  const rootSkill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'pordee', 'SKILL.md'),
    'utf8'
  );

  assert.match(rootSkill, /## Session Truth/);
  assert.match(rootSkill, /Before every response, read pordee state/i);
  assert.match(rootSkill, /Never infer current mode from chat history alone/i);
});
