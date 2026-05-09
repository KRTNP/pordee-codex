const {
  getEffectiveState,
  STATE_SCHEMA_VERSION,
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
    level: patch.level === undefined ? baseState.level : patch.level,
    lastCommand: patch.lastCommand === undefined ? baseState.lastCommand : patch.lastCommand,
    lastCommandAt: patch.lastCommandAt === undefined ? baseState.lastCommandAt : patch.lastCommandAt,
    lastCommandSource: patch.lastCommandSource === undefined
      ? baseState.lastCommandSource
      : patch.lastCommandSource,
    effectiveScope: patch.effectiveScope === undefined ? baseState.effectiveScope : patch.effectiveScope,
    sessionBoundLevel: patch.sessionBoundLevel === undefined
      ? baseState.sessionBoundLevel
      : patch.sessionBoundLevel,
    sessionBoundAt: patch.sessionBoundAt === undefined ? baseState.sessionBoundAt : patch.sessionBoundAt
  };
}

function writeTriggerState(options, patch, effectiveState) {
  const { homeDir, repoRoot, scope = 'auto' } = options;
  const stateOptions = { homeDir, repoRoot };
  const { globalStatePath, repoStatePath } = resolveStatePaths(stateOptions);

  if (scope === 'global') {
    writeStateFile(globalStatePath, {
      ...patch,
      effectiveScope: 'global'
    });
    return getEffectiveState(stateOptions);
  }

  if (scope === 'repo') {
    if (repoStatePath) {
      writeStateFile(repoStatePath, buildStateWritePatch(effectiveState, {
        ...patch,
        effectiveScope: 'repo'
      }));
      return getEffectiveState(stateOptions);
    }
  }

  const { targetPath } = resolveScopedWriteTarget(stateOptions);
  if (targetPath === repoStatePath) {
    writeStateFile(targetPath, buildStateWritePatch(effectiveState, {
      ...patch,
      effectiveScope: 'repo'
    }));
    return getEffectiveState(stateOptions);
  }

  writeScopedState(stateOptions, {
    ...patch,
    effectiveScope: 'global'
  });
  return getEffectiveState(stateOptions);
}

function buildCommandMetadata(prompt, state) {
  return {
    ...state,
    lastCommand: prompt,
    lastCommandSource: 'user',
    sessionBoundLevel: state.level
  };
}

function persistSessionSnapshot(stateOptions, state) {
  const paths = resolveStatePaths(stateOptions);
  const patch = {
    sessionBoundLevel: state.level,
    effectiveScope: state.stateSource === 'repo' ? 'repo' : 'global'
  };

  if (state.stateSource === 'repo' && paths.repoStatePath) {
    writeStateFile(paths.repoStatePath, buildStateWritePatch(state, patch));
    return getEffectiveState(stateOptions);
  }

  writeStateFile(paths.globalStatePath, buildStateWritePatch(state, patch));
  return getEffectiveState(stateOptions);
}

function handlePrompt({ prompt = '', homeDir, repoRoot, scope = 'auto' } = {}) {
  const statsOptions = { homeDir, repoRoot };
  const sessionKey = `${homeDir || ''}::${repoRoot || ''}`;
  const command = parsePordeeCommand(String(prompt));
  if (command?.kind === 'stats') {
    const state = getEffectiveState(statsOptions);
    const summary = getStatsSummary(statsOptions);
    return {
      kind: 'stats',
      message: renderStatsSummary({
        ...summary,
        mode: state,
        health: {
          repoStateValid: state.repoStateValid,
          globalStateValid: state.globalStateValid,
          lastReadError: state.lastReadError,
          statsSchemaVersion: summary.statsSchemaVersion,
          stateSchemaVersion: STATE_SCHEMA_VERSION
        }
      })
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

  if (!sessionTracker.has(sessionKey)) {
    beginSession(statsOptions);
    sessionTracker.add(sessionKey);
  }

  if (command?.kind === 'toggle') {
    if (scope === 'repo' && !repoRoot) {
      return {
        kind: 'error',
        message: 'repo scope requires repoRoot'
      };
    }

    const effectiveState = getEffectiveState(statsOptions);
    const patch = buildCommandMetadata(
      String(prompt),
      resolveTriggerPatch(command.patch, effectiveState)
    );
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
  const refreshedState = persistSessionSnapshot(statsOptions, state);
  return {
    kind: 'context',
    state: refreshedState,
    additionalContext: renderSessionContext(refreshedState)
  };
}

module.exports = {
  handlePrompt
};
