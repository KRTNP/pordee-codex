#!/usr/bin/env node
// pordee — UserPromptSubmit hook.
// Reads stdin: { prompt, transcript_path?, ... }
// Parses prompt for triggers (skipping content inside ``` code fences).
// Updates state.json. Emits hookSpecificOutput when pordee enabled.
// Always exits 0.

const { getState, setState, logError } = require('./pordee-config');
const { STATE_SCHEMA_VERSION } = require('../../core/pordee-state');
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

function buildCommandMetadata(prompt, state) {
  return {
    ...state,
    lastCommand: prompt,
    lastCommandSource: 'user',
    sessionBoundLevel: state.level
  };
}

function handleTrackerInput(input) {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').toString();
    const command = parsePordeeCommand(prompt);
    let handledToggle = false;

    if (command?.kind === 'stats') {
      const state = getState();
      const summary = getStatsSummary(buildStatsOptions());
      return emitAdditionalContext(renderStatsSummary({
        ...summary,
        mode: state,
        health: {
          repoStateValid: state.repoStateValid,
          globalStateValid: state.globalStateValid,
          lastReadError: state.lastReadError,
          statsSchemaVersion: summary.statsSchemaVersion,
          stateSchemaVersion: STATE_SCHEMA_VERSION
        }
      }));
    }

    if (command?.kind === 'status') {
      return emitAdditionalContext(renderStatusSummary(getState()));
    }

    if (command?.kind === 'toggle') {
      const currentState = getState();
      const nextState = setState(buildCommandMetadata(prompt, {
        enabled: command.patch.enabled === undefined ? currentState.enabled : command.patch.enabled,
        level: command.patch.level === undefined ? currentState.level : command.patch.level,
        effectiveScope: currentState.stateSource === 'repo' ? 'repo' : 'global'
      }));
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
      setState({
        sessionBoundLevel: state.level,
        effectiveScope: state.stateSource === 'repo' ? 'repo' : 'global'
      });
      recordActivePrompt(buildStatsOptions(), state.level);
      return emitActiveReminder(getState());
    } else if (state.enabled && handledToggle) {
      return emitActiveReminder(getState());
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
