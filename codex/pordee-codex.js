const {
  getEffectiveState,
  resolveStatePaths,
  resolveScopedWriteTarget,
  writeScopedState,
  writeStateFile
} = require('../core/pordee-state.js');
const { parseTrigger } = require('../core/pordee-triggers.js');
const { renderSessionContext } = require('../core/pordee-render.js');

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
  const trigger = parseTrigger(String(prompt));
  if (trigger) {
    if (scope === 'repo' && !repoRoot) {
      return {
        kind: 'error',
        message: 'repo scope requires repoRoot'
      };
    }

    const effectiveState = getEffectiveState({ homeDir, repoRoot });
    const patch = resolveTriggerPatch(trigger, effectiveState);
    const state = writeTriggerState({ homeDir, repoRoot, scope }, patch, effectiveState);
    return {
      kind: 'trigger',
      message: buildTriggerMessage(state),
      state
    };
  }

  const state = getEffectiveState({ homeDir, repoRoot });
  if (!state.enabled) {
    return { kind: 'pass', state };
  }

  return {
    kind: 'context',
    state,
    additionalContext: renderSessionContext(state)
  };
}

module.exports = {
  handlePrompt
};
