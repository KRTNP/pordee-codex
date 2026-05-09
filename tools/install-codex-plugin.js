const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_NAME = 'pordee';
const MARKETPLACE_RELATIVE_PATH = path.join('.agents', 'plugins', 'marketplace.json');
const INSTALLED_PLUGIN_PATH = `./.codex-plugins/${PLUGIN_NAME}`;
const REQUIRED_BUNDLE_FILES = [
  path.join('.codex-plugin', 'plugin.json'),
  path.join('skills', 'pordee', 'SKILL.md')
];

function resolveTargetRoot(project) {
  if (project === undefined || project === null || project === '') {
    return process.cwd();
  }

  return path.resolve(project);
}

function readMarketplace(targetRoot) {
  const marketplacePath = path.join(targetRoot, MARKETPLACE_RELATIVE_PATH);

  if (!fs.existsSync(marketplacePath)) {
    return { plugins: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Marketplace file must contain a JSON object.');
    }

    if (parsed.plugins === undefined) {
      return { ...parsed, plugins: [] };
    }

    if (!Array.isArray(parsed.plugins)) {
      throw new Error('Marketplace "plugins" must be an array.');
    }

    return parsed;
  } catch (error) {
    throw new Error(`Invalid marketplace JSON at ${marketplacePath}: ${error.message}`);
  }
}

function upsertPordeePlugin(marketplace) {
  const plugins = Array.isArray(marketplace?.plugins) ? marketplace.plugins : [];
  const withoutPordee = plugins.filter((plugin) => plugin?.name !== PLUGIN_NAME);

  return {
    ...marketplace,
    plugins: [...withoutPordee, { name: PLUGIN_NAME, path: INSTALLED_PLUGIN_PATH }]
  };
}

function validateSourceBundle(sourcePluginRoot) {
  if (!fs.existsSync(sourcePluginRoot)) {
    throw new Error(`Missing packaged plugin bundle: ${sourcePluginRoot}`);
  }

  for (const relativePath of REQUIRED_BUNDLE_FILES) {
    const absolutePath = path.join(sourcePluginRoot, relativePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing required packaged plugin file: ${absolutePath}`);
    }

    const stat = fs.statSync(absolutePath);

    if (!stat.isFile()) {
      throw new Error(`Required packaged plugin path must be a file: ${absolutePath}`);
    }
  }
}

async function installIntoProject(options = {}) {
  const sourceRoot = options.sourceRoot ? path.resolve(options.sourceRoot) : path.resolve(__dirname, '..');
  const targetRoot = resolveTargetRoot(options.targetRoot ?? options.project);
  const sourcePluginRoot = path.join(sourceRoot, 'plugins', PLUGIN_NAME);
  const installedPluginRoot = path.join(targetRoot, '.codex-plugins', PLUGIN_NAME);
  const marketplacePath = path.join(targetRoot, MARKETPLACE_RELATIVE_PATH);
  const marketplace = upsertPordeePlugin(readMarketplace(targetRoot));

  validateSourceBundle(sourcePluginRoot);

  fs.mkdirSync(path.dirname(installedPluginRoot), { recursive: true });
  fs.rmSync(installedPluginRoot, { recursive: true, force: true });
  fs.cpSync(sourcePluginRoot, installedPluginRoot, { recursive: true });

  fs.mkdirSync(path.dirname(marketplacePath), { recursive: true });
  fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);
}

module.exports = {
  installIntoProject,
  readMarketplace,
  resolveTargetRoot,
  upsertPordeePlugin
};
