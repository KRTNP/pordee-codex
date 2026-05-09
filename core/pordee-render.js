function normalizeLevel(level) {
  if (level === 'lite') return 'lite';
  if (level === 'full') return 'full';
  return 'full';
}

function renderSessionContext(state = {}) {
  const level = normalizeLevel(state.level);

  return (
    `PORDEE MODE ACTIVE — level: ${level}\n\n` +
    'Respond terse like simple Thai. Keep technical English terms. ' +
    'Drop polite particles (ครับ, ค่ะ, นะคะ, นะครับ), hedging (อาจจะ, น่าจะ, จริงๆแล้ว), ' +
    'pleasantries (ได้เลยครับ, แน่นอน), and English-style filler (just/really/basically/actually/simply). ' +
    'Fragments OK. Use short Thai synonyms (ดู not ตรวจสอบ, แก้ not ทำการแก้ไข, เพราะ not เนื่องจาก).\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift. Off only via "หยุดพอดี", "พูดปกติ", or "/pordee stop".\n\n' +
    `Current level: **${level}**. Switch: \`/pordee lite|full\`.\n\n` +
    '## Pattern\n\n' +
    '`[ของ] [ทำ] [เหตุผล]. [ขั้นต่อ].`\n\n' +
    '## Auto-Clarity\n\n' +
    'Drop pordee for: security warnings, irreversible actions (DROP TABLE, rm -rf, git push --force, git reset --hard), ' +
    'multi-step sequences where order matters, user asks "อะไรนะ" / "พูดอีกที" / "อธิบายชัดๆ". ' +
    'Resume after clarification done.\n\n' +
    '## Boundaries\n\n' +
    'Code/commits/PRs/code comments: write normal English. Errors: exact quote. ' +
    'File paths, URLs, identifiers, function names: exact.'
  );
}

function renderPromptReminder(state = {}) {
  const level = normalizeLevel(state.level);

  return (
    `PORDEE MODE ACTIVE (${level}). ` +
    'ตอบไทยกระชับ. Keep technical English terms. ' +
    'Drop polite particles, hedging, pleasantries. Fragments OK. ' +
    'Code/commits/security: write normal.'
  );
}

function renderStatsSummary(summary = {}) {
  const mode = summary.mode || {};
  const session = summary.session || {};
  const lifetime = summary.lifetime || {};
  const benchmark = summary.benchmark || {};
  const health = summary.health || {};
  const currentLevel = normalizeLevel(mode.level);
  const currentStatus = mode.enabled === true ? 'active' : 'off';
  const repoHealth = health.repoStateValid === true ? 'valid' : health.repoStateValid === false ? 'invalid' : 'unknown';
  const globalHealth = health.globalStateValid === true ? 'valid' : health.globalStateValid === false ? 'invalid' : 'unknown';
  const lastReadError = health.lastReadError || 'none';

  return [
    'pordee stats',
    '',
    'mode:',
    `- current: ${currentStatus} (${currentLevel})`,
    `- source: ${mode.stateSource || 'unknown'}`,
    `- scope: ${mode.effectiveScope || 'unknown'}`,
    `- session bound: ${mode.sessionBoundLevel || 'unknown'}`,
    '',
    'usage:',
    `- session: ${session.activePromptCount || 0} active prompts, ${session.toggles || 0} toggles`,
    `- lifetime: ${lifetime.activePromptCount || 0} active prompts, ${lifetime.toggles || 0} toggles`,
    '',
    'savings:',
    `- session est.: ${session.estimatedTokensSaved || 0} tokens saved`,
    `- lifetime est.: ${lifetime.estimatedTokensSaved || 0} tokens saved`,
    `- benchmark: lite ${benchmark.liteSavingsPct || 0}% avg, full ${benchmark.fullSavingsPct || 0}% avg across ${benchmark.sampleCount || 0} built-in samples`,
    '',
    'health:',
    `- repo state: ${repoHealth}`,
    `- global state: ${globalHealth}`,
    `- last read error: ${lastReadError}`,
    `- stats schema: v${health.statsSchemaVersion || summary.statsSchemaVersion || 0}`,
    `- state schema: v${health.stateSchemaVersion || 0}`
  ].join('\n');
}

function renderStatusSummary(state = {}) {
  const level = normalizeLevel(state.level);
  const enabled = state.enabled === true;
  const lines = [`pordee status: ${enabled ? 'active' : 'off'} (${level})`];

  if (state.stateSource || state.effectiveScope || state.sessionBoundLevel) {
    lines.push([
      state.stateSource ? `source: ${state.stateSource}` : null,
      state.effectiveScope ? `scope: ${state.effectiveScope}` : null,
      state.sessionBoundLevel ? `session: ${state.sessionBoundLevel}` : null
    ].filter(Boolean).join(', '));
  }

  if (state.repoStateValid !== undefined || state.globalStateValid !== undefined) {
    lines.push([
      state.repoStateValid !== undefined ? `repo valid: ${state.repoStateValid ? 'yes' : 'no'}` : null,
      state.globalStateValid !== undefined ? `global valid: ${state.globalStateValid ? 'yes' : 'no'}` : null
    ].filter(Boolean).join(', '));
  }

  if (state.lastReadError) {
    lines.push(`read error: ${state.lastReadError}`);
  }

  return lines.join('\n');
}

module.exports = {
  normalizeLevel,
  renderSessionContext,
  renderPromptReminder,
  renderStatsSummary,
  renderStatusSummary
};
