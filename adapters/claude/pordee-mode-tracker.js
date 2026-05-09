#!/usr/bin/env node
// pordee — UserPromptSubmit hook.
// Reads stdin: { prompt, transcript_path?, ... }
// Parses prompt for triggers (skipping content inside ``` code fences).
// Updates state.json. Emits hookSpecificOutput when pordee enabled.
// Always exits 0.

const { getState, setState, logError } = require('./pordee-config');
const { parsePordeeCommand } = require('../../core/pordee-triggers');
const { getStatsSummary, recordActivePrompt, recordToggle } = require('../../core/pordee-stats');
const {
  renderPromptReminder,
  renderStatsSummary,
  renderStatusSummary
} = require('../../core/pordee-render');

function buildStatsOptions() {
  return {
    homeDir: process.env.PORDEE_HOME,
    repoRoot: process.cwd()
  };
}

function emitActiveReminder(state) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: renderPromptReminder(state)
    }
  });
}

function emitAdditionalContext(text) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: text
    }
  });
}

function handleTrackerInput(input) {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').toString();
    const command = parsePordeeCommand(prompt);
    let handledToggle = false;

    if (command?.kind === 'stats') {
      return emitAdditionalContext(renderStatsSummary(getStatsSummary(buildStatsOptions())));
    }

    if (command?.kind === 'status') {
      return emitAdditionalContext(renderStatusSummary(getState()));
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
      return emitActiveReminder(state);
    } else if (state.enabled && handledToggle) {
      return emitActiveReminder(state);
    }
  } catch (e) {
    // Silent fail to never block prompts; log to ~/.pordee/error.log per spec §4.4.
    logError(`mode-tracker: ${e.message}`);
  }
  return '';
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const output = handleTrackerInput(input);
  if (output) {
    process.stdout.write(output);
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  handleTrackerInput
};
