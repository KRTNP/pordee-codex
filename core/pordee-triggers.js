function stripCodeFences(text) {
  // Remove triple-backtick fenced blocks (multi-line and inline ```...```).
  return text.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*$/, '');
}

function parseTrigger(prompt) {
  const cleaned = stripCodeFences(prompt);
  const trimmed = cleaned.trim();

  // Slash commands — case-insensitive on the command, exact on args.
  const slashMatch = trimmed.match(/^\/pordee(?:\s+(\w+))?$/i);
  if (slashMatch) {
    const arg = (slashMatch[1] || '').toLowerCase();
    if (arg === 'lite') return { enabled: true, level: 'lite' };
    if (arg === 'full') return { enabled: true, level: 'full' };
    if (arg === 'stop') return { enabled: false };
    if (arg === '') return { enabled: true };  // bare /pordee
    // Unknown subcommand — ignore.
    return null;
  }

  // Thai phrase triggers — match only when the trigger is the entire trimmed input.
  // Disable triggers checked first so "หยุดพอดี" wins over "พอดี" substring.
  const enableThai = ['พอดีโหมด', 'พูดสั้นๆ', 'พอดี'];
  const disableThai = ['หยุดพอดี', 'พูดปกติ'];

  for (const phrase of disableThai) {
    if (trimmed === phrase) return { enabled: false };
  }
  for (const phrase of enableThai) {
    if (trimmed === phrase) return { enabled: true };
  }

  return null;
}

module.exports = {
  stripCodeFences,
  parseTrigger
};
