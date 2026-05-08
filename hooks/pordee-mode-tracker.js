#!/usr/bin/env node
// pordee — UserPromptSubmit hook.
// Reads stdin: { prompt, transcript_path?, ... }
// Parses prompt for triggers (skipping content inside ``` code fences).
// Updates state.json. Emits hookSpecificOutput when pordee enabled.
// Always exits 0.

const { getState, setState, logError } = require('./pordee-config');
const { parseTrigger } = require('../core/pordee-triggers');

function emitActiveReminder(state) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        `PORDEE MODE ACTIVE (${state.level}). ` +
        `ตอบไทยกระชับ. Keep technical English terms. ` +
        `Drop polite particles, hedging, pleasantries. Fragments OK. ` +
        `Code/commits/security: write normal.`
    }
  }));
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').toString();

    const trigger = parseTrigger(prompt);
    if (trigger) {
      setState(trigger);
    }

    const state = getState();
    if (state.enabled) {
      emitActiveReminder(state);
    }
  } catch (e) {
    // Silent fail to never block prompts; log to ~/.pordee/error.log per spec §4.4.
    logError(`mode-tracker: ${e.message}`);
  }
  process.exit(0);
});
