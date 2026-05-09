function stripCodeFences(text) {
  // Remove triple-backtick fenced blocks (multi-line and inline ```...```).
  return text.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*$/, '');
}

function parseCommandArg(arg) {
  if (arg === 'stats') return { kind: 'stats' };
  if (arg === 'status') return { kind: 'status' };
  if (arg === 'lite') return { kind: 'toggle', patch: { enabled: true, level: 'lite' } };
  if (arg === 'full') return { kind: 'toggle', patch: { enabled: true, level: 'full' } };
  if (arg === 'stop') return { kind: 'toggle', patch: { enabled: false } };
  if (arg === '') return { kind: 'toggle', patch: { enabled: true } };
  return null;
}

function parsePordeeCommand(prompt) {
  const cleaned = stripCodeFences(prompt);
  const trimmed = cleaned.trim();

  // Slash commands — case-insensitive on the command, exact on args.
  const slashMatch = trimmed.match(/^\/pordee(?:\s+(\w+))?$/i);
  if (slashMatch) {
    return parseCommandArg((slashMatch[1] || '').toLowerCase());
  }

  if (trimmed === 'พอดีสถิติ') {
    return { kind: 'stats' };
  }
  if (trimmed === 'พอดีสถานะ') {
    return { kind: 'status' };
  }

  const thaiPrefixMatch = trimmed.match(/^พอดี(?:โหมด)?(?:\s+([A-Za-z]+))?$/i);
  if (thaiPrefixMatch) {
    return parseCommandArg((thaiPrefixMatch[1] || '').toLowerCase());
  }

  // Thai phrase triggers — match only when the trigger is the entire trimmed input.
  // Disable triggers checked first so "หยุดพอดี" wins over "พอดี" substring.
  const enableThai = ['พอดีโหมด', 'พูดสั้นๆ', 'พอดี'];
  const disableThai = ['หยุดพอดี', 'พูดปกติ'];

  for (const phrase of disableThai) {
    if (trimmed === phrase) return { kind: 'toggle', patch: { enabled: false } };
  }
  for (const phrase of enableThai) {
    if (trimmed === phrase) return { kind: 'toggle', patch: { enabled: true } };
  }

  return null;
}

function parseTrigger(prompt) {
  const command = parsePordeeCommand(prompt);
  if (!command || command.kind !== 'toggle') {
    return null;
  }

  return command.patch;
}

module.exports = {
  stripCodeFences,
  parsePordeeCommand,
  parseTrigger
};
