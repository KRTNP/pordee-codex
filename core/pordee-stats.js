const fs = require('node:fs');
const { resolveStatePaths } = require('./pordee-state.js');

const DEFAULT_VERSION = 1;

const BENCHMARK_SAMPLES = Object.freeze([
  {
    normal: 'แน่นอนครับ ผมยินดีจะอธิบายให้นะครับ จริงๆ แล้วเหตุผลที่ React component ของคุณ re-render นั้น น่าจะเกิดจากการที่คุณส่ง object reference ใหม่เป็น prop ในทุกครั้งที่ component ถูก render ซึ่งทำให้ React มองว่า prop เปลี่ยน และทำการ re-render component ลูก ดังนั้นคุณอาจจะลองใช้ useMemo เพื่อ memoize object นั้นดูครับ',
    lite: 'React component re-render เพราะส่ง object reference ใหม่เป็น prop ทุกครั้งที่ render ทำให้ React มองว่า prop เปลี่ยน และ re-render component ลูก ลองใช้ useMemo เพื่อ memoize object นั้น',
    full: 'Object ref ใหม่ทุก render. Inline object prop = ref ใหม่ = re-render. ห่อด้วย useMemo.'
  },
  {
    normal: 'ครับ ผมตรวจสอบให้แล้วนะครับ ปัญหาที่คุณเจอน่าจะเกิดจาก bug ใน auth middleware ครับ จริงๆ แล้วในส่วนของ token expiry check นั้น โค้ดใช้เครื่องหมาย < แทนที่จะเป็น <= ซึ่งทำให้ token ที่หมดอายุพอดีไม่ถูก reject ดังนั้นเราควรจะแก้ตรงจุดนี้ครับ',
    lite: 'Bug อยู่ที่ auth middleware ส่วน token expiry check ใช้ < แทนที่จะเป็น <= ทำให้ token ที่หมดอายุพอดีไม่ถูก reject แก้:',
    full: 'Bug ที่ auth middleware. Token expiry ใช้ < ไม่ใช่ <=. Fix:'
  },
  {
    normal: 'ครับ ถ้าคุณอยากไปเที่ยวเชียงใหม่ ผมแนะนำว่าน่าจะไปช่วงเดือนพฤศจิกายนถึงกุมภาพันธ์ครับ เพราะว่าเป็นช่วงที่อากาศเย็นสบาย ไม่ร้อนเกินไป และไม่มีฝนตกบ่อยเหมือนช่วงอื่นๆ จริงๆ แล้วเดือนธันวาคมก็เป็นเดือนที่นิยมที่สุดเลยนะครับ แต่ก็จะคนเยอะหน่อย',
    lite: 'ไปเชียงใหม่ ช่วงพฤศจิกายน-กุมภาพันธ์ดีที่สุด อากาศเย็นสบาย ไม่ร้อน ฝนน้อย ธันวาคมนิยมที่สุดแต่คนเยอะ',
    full: 'พ.ย.-ก.พ. ดีสุด. อากาศเย็น, ฝนน้อย. ธ.ค. คนเยอะ.'
  }
]);

function estimateTokenCount(text = '') {
  const normalized = String(text).trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNumber(value) {
  return Math.round(value);
}

function buildBenchmarkProfile() {
  const liteSavingsPct = average(BENCHMARK_SAMPLES.map((sample) => {
    const normalTokens = estimateTokenCount(sample.normal);
    const liteTokens = estimateTokenCount(sample.lite);
    return ((normalTokens - liteTokens) / normalTokens) * 100;
  }));

  const fullSavingsPct = average(BENCHMARK_SAMPLES.map((sample) => {
    const normalTokens = estimateTokenCount(sample.normal);
    const fullTokens = estimateTokenCount(sample.full);
    return ((normalTokens - fullTokens) / normalTokens) * 100;
  }));

  const liteSavedTokens = average(BENCHMARK_SAMPLES.map((sample) => {
    return estimateTokenCount(sample.normal) - estimateTokenCount(sample.lite);
  }));

  const fullSavedTokens = average(BENCHMARK_SAMPLES.map((sample) => {
    return estimateTokenCount(sample.normal) - estimateTokenCount(sample.full);
  }));

  return Object.freeze({
    sampleCount: BENCHMARK_SAMPLES.length,
    liteSavingsPct: roundNumber(liteSavingsPct),
    fullSavingsPct: roundNumber(fullSavingsPct),
    liteSavedTokensPerPrompt: roundNumber(liteSavedTokens),
    fullSavedTokensPerPrompt: roundNumber(fullSavedTokens)
  });
}

const BENCHMARK_PROFILE = buildBenchmarkProfile();

function createCounters(extra = {}) {
  return {
    sessionStartedAt: typeof extra.sessionStartedAt === 'string'
      ? extra.sessionStartedAt
      : new Date().toISOString(),
    toggles: typeof extra.toggles === 'number' ? extra.toggles : 0,
    enableCount: typeof extra.enableCount === 'number' ? extra.enableCount : 0,
    disableCount: typeof extra.disableCount === 'number' ? extra.disableCount : 0,
    liteCount: typeof extra.liteCount === 'number' ? extra.liteCount : 0,
    fullCount: typeof extra.fullCount === 'number' ? extra.fullCount : 0,
    activePromptCount: typeof extra.activePromptCount === 'number' ? extra.activePromptCount : 0,
    estimatedTokensSaved: typeof extra.estimatedTokensSaved === 'number'
      ? extra.estimatedTokensSaved
      : 0
  };
}

function createDefaultStats() {
  const now = new Date().toISOString();
  return {
    version: DEFAULT_VERSION,
    createdAt: now,
    updatedAt: now,
    lifetime: createCounters({ sessionStartedAt: now }),
    currentSession: createCounters({ sessionStartedAt: now })
  };
}

function normalizeStats(raw = {}) {
  const defaults = createDefaultStats();
  return {
    version: typeof raw.version === 'number' ? raw.version : defaults.version,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : defaults.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : defaults.updatedAt,
    lifetime: createCounters(raw.lifetime),
    currentSession: createCounters(raw.currentSession)
  };
}

function getStatsPath(options = {}) {
  return resolveStatePaths(options).globalStatsPath;
}

function readStats(options = {}) {
  const statsPath = getStatsPath(options);
  try {
    if (!fs.existsSync(statsPath)) {
      return createDefaultStats();
    }

    const parsed = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    return normalizeStats(parsed);
  } catch {
    return createDefaultStats();
  }
}

function writeStats(options = {}, stats) {
  const statsPath = getStatsPath(options);
  const normalized = normalizeStats({
    ...stats,
    updatedAt: new Date().toISOString()
  });
  const tmpPath = `${statsPath}.tmp`;

  fs.mkdirSync(require('node:path').dirname(statsPath), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2));
  fs.renameSync(tmpPath, statsPath);
  return normalized;
}

function ensureSession(options = {}) {
  const stats = readStats(options);
  if (stats.currentSession && typeof stats.currentSession.sessionStartedAt === 'string') {
    return stats;
  }

  stats.currentSession = createCounters();
  return writeStats(options, stats);
}

function beginSession(options = {}) {
  const stats = readStats(options);
  stats.currentSession = createCounters();
  return writeStats(options, stats);
}

function applyToggleCounters(counters, state) {
  counters.toggles += 1;
  if (state.enabled) {
    counters.enableCount += 1;
    if (state.level === 'lite') {
      counters.liteCount += 1;
    } else {
      counters.fullCount += 1;
    }
  } else {
    counters.disableCount += 1;
  }
}

function recordToggle(options = {}, state = {}) {
  const stats = ensureSession(options);
  applyToggleCounters(stats.lifetime, state);
  applyToggleCounters(stats.currentSession, state);
  return writeStats(options, stats);
}

function estimatedSavedTokensForLevel(level) {
  return level === 'lite'
    ? BENCHMARK_PROFILE.liteSavedTokensPerPrompt
    : BENCHMARK_PROFILE.fullSavedTokensPerPrompt;
}

function recordActivePrompt(options = {}, level = 'full') {
  const stats = ensureSession(options);
  const estimatedSavedTokens = estimatedSavedTokensForLevel(level);

  stats.lifetime.activePromptCount += 1;
  stats.currentSession.activePromptCount += 1;
  stats.lifetime.estimatedTokensSaved += estimatedSavedTokens;
  stats.currentSession.estimatedTokensSaved += estimatedSavedTokens;

  return writeStats(options, stats);
}

function getStatsSummary(options = {}) {
  const stats = ensureSession(options);
  return {
    session: { ...stats.currentSession },
    lifetime: { ...stats.lifetime },
    benchmark: {
      liteSavingsPct: BENCHMARK_PROFILE.liteSavingsPct,
      fullSavingsPct: BENCHMARK_PROFILE.fullSavingsPct,
      sampleCount: BENCHMARK_PROFILE.sampleCount
    }
  };
}

module.exports = {
  BENCHMARK_SAMPLES,
  BENCHMARK_PROFILE,
  estimateTokenCount,
  createCounters,
  createDefaultStats,
  normalizeStats,
  getStatsPath,
  readStats,
  writeStats,
  ensureSession,
  beginSession,
  recordToggle,
  recordActivePrompt,
  getStatsSummary
};
