const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_NAME = 'pordee';
const MARKETPLACE_RELATIVE_PATH = path.join('.agents', 'plugins', 'marketplace.json');
const INSTALLED_PLUGIN_PATH = `./.codex-plugins/${PLUGIN_NAME}`;
const REQUIRED_BUNDLE_FILES = [
  path.join('.codex-plugin', 'plugin.json'),
  path.join('skills', 'pordee', 'SKILL.md')
];

function printUsage() {
  console.log([
    'Usage: node tools/install-codex-plugin.js [--project <path>]',
    '',
    'Installs the packaged pordee Codex plugin into the given project.',
    'If --project is omitted, the current working directory is used.'
  ].join('\n'));
}

function ensureWritableMarketplaceParent(targetRoot) {
  const agentsDir = path.join(targetRoot, '.agents');

  if (!fs.existsSync(agentsDir)) {
    return;
  }

  try {
    fs.accessSync(agentsDir, fs.constants.W_OK);
  } catch (error) {
    throw new Error(`Cannot write under existing .agents directory at ${agentsDir}: ${error.message}`);
  }
}

function ensureNotSourceCheckout(targetRoot, sourceRoot) {
  if (path.resolve(targetRoot) === path.resolve(sourceRoot)) {
    throw new Error(
      `Refusing to install into this source checkout at ${targetRoot}. ` +
      'Pass --project <path> to target a separate project directory.'
    );
  }
}

function makeUniqueSiblingPath(basePath, suffix) {
  return `${basePath}.${suffix}-${process.pid}-${Date.now()}`;
}

function writeMarketplaceAtomically(targetRoot, marketplace) {
  const marketplacePath = path.join(targetRoot, MARKETPLACE_RELATIVE_PATH);
  const tempPath = makeUniqueSiblingPath(marketplacePath, 'tmp');

  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(marketplace, null, 2)}\n`);
    fs.renameSync(tempPath, marketplacePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }

  return marketplacePath;
}

function replaceDirectoryAtomically(targetPath, stagedPath) {
  const backupPath = makeUniqueSiblingPath(targetPath, 'backup');
  const targetExists = fs.existsSync(targetPath);
  let movedTargetToBackup = false;

  try {
    if (targetExists) {
      fs.renameSync(targetPath, backupPath);
      movedTargetToBackup = true;
    }

    fs.renameSync(stagedPath, targetPath);
  } catch (error) {
    if (movedTargetToBackup) {
      try {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }

        fs.renameSync(backupPath, targetPath);
      } catch (restoreError) {
        throw new Error(
          `Failed to replace existing plugin bundle and restore the previous version: ${restoreError.message}. ` +
          `Original error: ${error.message}`
        );
      }
    }

    throw error;
  } finally {
    fs.rmSync(stagedPath, { recursive: true, force: true });
  }

  return {
    commit() {
      fs.rmSync(backupPath, { recursive: true, force: true });
    },
    rollback() {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }

      if (movedTargetToBackup) {
        fs.renameSync(backupPath, targetPath);
      } else {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
    }
  };
}

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
  const stagingPluginRoot = makeUniqueSiblingPath(installedPluginRoot, 'staging');
  const marketplacePath = path.join(targetRoot, MARKETPLACE_RELATIVE_PATH);
  const marketplaceDir = path.dirname(marketplacePath);
  const marketplace = upsertPordeePlugin(readMarketplace(targetRoot));

  validateSourceBundle(sourcePluginRoot);
  ensureNotSourceCheckout(targetRoot, sourceRoot);
  ensureWritableMarketplaceParent(targetRoot);

  try {
    fs.mkdirSync(marketplaceDir, { recursive: true });
  } catch (error) {
    throw new Error(`Cannot create marketplace directory at ${marketplaceDir}: ${error.message}`);
  }

  fs.mkdirSync(path.dirname(stagingPluginRoot), { recursive: true });

  try {
    fs.rmSync(stagingPluginRoot, { recursive: true, force: true });
    fs.cpSync(sourcePluginRoot, stagingPluginRoot, { recursive: true });
    const replacedBundle = replaceDirectoryAtomically(installedPluginRoot, stagingPluginRoot);

    try {
      writeMarketplaceAtomically(targetRoot, marketplace);
    } catch (error) {
      try {
        replacedBundle.rollback();
      } catch (rollbackError) {
        throw new Error(
          `Failed to update marketplace and restore the previous plugin bundle: ${rollbackError.message}. ` +
          `Original error: ${error.message}`
        );
      }

      throw error;
    }

    replacedBundle.commit();
  } finally {
    fs.rmSync(stagingPluginRoot, { recursive: true, force: true });
  }

  return {
    marketplacePath,
    pluginTarget: installedPluginRoot,
    targetRoot
  };
}

function parseCliArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--project') {
      const project = argv[index + 1];

      if (project === undefined) {
        throw new Error('Missing value for --project.');
      }

      parsed.project = project;
      index += 1;
      continue;
    }

    if (arg.startsWith('--project=')) {
      parsed.project = arg.slice('--project='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

async function main(argv = process.argv.slice(2)) {
  const parsed = parseCliArgs(argv);

  if (parsed.help) {
    printUsage();
    return;
  }

  const result = await installIntoProject({ project: parsed.project });

  console.log(`Installed pordee to ${result.pluginTarget}`);
  console.log(`Updated marketplace: ${result.marketplacePath}`);
  console.log('Next: restart Codex and enable pordee from Plugins UI.');
}

module.exports = {
  main,
  parseCliArgs,
  installIntoProject,
  readMarketplace,
  resolveTargetRoot,
  upsertPordeePlugin,
  writeMarketplaceAtomically
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
