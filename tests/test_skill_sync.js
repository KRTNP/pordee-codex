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
