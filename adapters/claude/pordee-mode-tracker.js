#!/usr/bin/env node
// pordee — UserPromptSubmit hook.
// Reads stdin: { prompt, transcript_path?, ... }
// Parses prompt for triggers (skipping content inside ``` code fences).
// Updates state.json. Emits hookSpecificOutput when pordee enabled.
// Always exits 0.

const { getState, setState, logError } = require('./pordee-config');
const { parsePordeeCommand } = require('../../core/pordee-triggers');
const { getStatsSummary, recordActivePrompt, recordToggle } = require('../../core/pordee-stats');
const { renderPromptReminder, renderStatsSummary } = require('../../core/pordee-render');

function buildStatsOptions() {
  return {
    homeDir: process.env.PORDEE_HOME,
    repoRoot: process.cwd()
  };
}

function emitActiveReminder(state) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: renderPromptReminder(state)
    }
  }));
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').toString();
    const command = parsePordeeCommand(prompt);
    let handledToggle = false;

    if (command?.kind === 'stats') {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: renderStatsSummary(getStatsSummary(buildStatsOptions()))
        }
      }));
      process.exit(0);
    }

    if (command?.kind === 'toggle') {
      const nextState = setState(command.patch);
      if (nextState) {
        handledToggle = true;
        recordToggle(buildStatsOptions(), {
          enabled: nextState.enabled,
          level: nextState.level
        });
      }
    }

    const state = getState();
    if (state.enabled && !handledToggle) {
      recordActivePrompt(buildStatsOptions(), state.level);
      emitActiveReminder(state);
    } else if (state.enabled && handledToggle) {
      emitActiveReminder(state);
    }
  } catch (e) {
    // Silent fail to never block prompts; log to ~/.pordee/error.log per spec §4.4.
    logError(`mode-tracker: ${e.message}`);
  }
  process.exit(0);
});
process.stdin.resume();
