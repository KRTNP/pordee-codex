const {
  getEffectiveState,
  resolveStatePaths,
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

function writeTriggerState(options, patch) {
  const { homeDir, repoRoot, scope = 'auto' } = options;

  if (scope === 'global') {
    const { globalStatePath } = resolveStatePaths({ homeDir, repoRoot });
    return writeStateFile(globalStatePath, patch);
  }

  if (scope === 'repo') {
    const { repoStatePath } = resolveStatePaths({ homeDir, repoRoot });
    if (repoStatePath) {
      return writeStateFile(repoStatePath, patch);
    }
  }

  return writeScopedState({ homeDir, repoRoot }, patch);
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
    const state = writeTriggerState({ homeDir, repoRoot, scope }, patch);
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
