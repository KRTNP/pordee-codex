const {
  getEffectiveState,
  resolveStatePaths,
  resolveScopedWriteTarget,
  writeScopedState,
  writeStateFile
} = require('../../core/pordee-state.js');
const { parsePordeeCommand } = require('../../core/pordee-triggers.js');
const {
  beginSession,
  getStatsSummary,
  recordActivePrompt,
  recordToggle
} = require('../../core/pordee-stats.js');
const {
  renderSessionContext,
  renderStatsSummary,
  renderStatusSummary
} = require('../../core/pordee-render.js');

const sessionTracker = new Set();

function buildTriggerMessage(state) {
  if (state.enabled === false) {
    return 'pordee off';
  }

  return state.level === 'lite'
    ? 'pordee lite active'
    : 'pordee full active';
}

function resolveTriggerPatch(trigger, state) {
  if (trigger.enabled === true && trigger.level === undefined) {
    return {
      enabled: true,
      level: state.level || 'full'
    };
  }

  return trigger;
}

function buildStateWritePatch(baseState, patch) {
  return {
    enabled: patch.enabled === undefined ? baseState.enabled : patch.enabled,
    level: patch.level === undefined ? baseState.level : patch.level
  };
}

function writeTriggerState(options, patch, effectiveState) {
  const { homeDir, repoRoot, scope = 'auto' } = options;
  const stateOptions = { homeDir, repoRoot };
  const { globalStatePath, repoStatePath } = resolveStatePaths(stateOptions);

  if (scope === 'global') {
    writeStateFile(globalStatePath, patch);
    return getEffectiveState(stateOptions);
  }

  if (scope === 'repo') {
    if (repoStatePath) {
      writeStateFile(repoStatePath, buildStateWritePatch(effectiveState, patch));
      return getEffectiveState(stateOptions);
    }
  }

  const { targetPath } = resolveScopedWriteTarget(stateOptions);
  if (targetPath === repoStatePath) {
    writeStateFile(targetPath, buildStateWritePatch(effectiveState, patch));
    return getEffectiveState(stateOptions);
  }

  writeScopedState(stateOptions, patch);
  return getEffectiveState(stateOptions);
}

function handlePrompt({ prompt = '', homeDir, repoRoot, scope = 'auto' } = {}) {
  const statsOptions = { homeDir, repoRoot };
  const sessionKey = `${homeDir || ''}::${repoRoot || ''}`;

  if (!sessionTracker.has(sessionKey)) {
    beginSession(statsOptions);
    sessionTracker.add(sessionKey);
  }

  const command = parsePordeeCommand(String(prompt));
  if (command?.kind === 'stats') {
    return {
      kind: 'stats',
      message: renderStatsSummary(getStatsSummary(statsOptions))
    };
  }
  if (command?.kind === 'status') {
    const state = getEffectiveState(statsOptions);
    return {
      kind: 'status',
      message: renderStatusSummary(state),
      state
    };
  }

  if (command?.kind === 'toggle') {
    if (scope === 'repo' && !repoRoot) {
      return {
        kind: 'error',
        message: 'repo scope requires repoRoot'
      };
    }

    const effectiveState = getEffectiveState(statsOptions);
    const patch = resolveTriggerPatch(command.patch, effectiveState);
    const state = writeTriggerState({ homeDir, repoRoot, scope }, patch, effectiveState);
    recordToggle(statsOptions, {
      enabled: state.enabled,
      level: state.level
    });
    return {
      kind: 'trigger',
      message: buildTriggerMessage(state),
      state
    };
  }

  const state = getEffectiveState(statsOptions);
  if (!state.enabled) {
    return { kind: 'pass', state };
  }

  recordActivePrompt(statsOptions, state.level);
  return {
    kind: 'context',
    state,
    additionalContext: renderSessionContext(state)
  };
}

module.exports = {
  handlePrompt
};
