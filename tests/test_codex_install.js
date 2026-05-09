const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function loadInstaller() {
  try {
    return require('../tools/install-codex-plugin.js');
  } catch (error) {
    assert.fail(`Expected installer module to exist: ${error.message}`);
  }
}

const pluginManifest = {
  name: 'pordee',
  description: 'Thai+English terse communication mode for Codex.',
  skills: [{ name: 'pordee', path: 'skills/pordee/SKILL.md' }]
};

const skillContent = [
  '# pordee',
  '',
  'Use terse, pragmatic communication.',
  '',
  '## Session Truth',
  '',
  'Before every response, read pordee state from the workspace when available.',
  'Never infer current mode from chat history alone.',
  ''
].join('\n');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pordee-install-'));
  const sourceRoot = path.join(root, 'source');
  const targetRoot = path.join(root, 'target');

  fs.mkdirSync(path.join(sourceRoot, 'plugins', 'pordee', '.codex-plugin'), {
    recursive: true
  });
  fs.mkdirSync(path.join(sourceRoot, 'plugins', 'pordee', 'skills', 'pordee'), {
    recursive: true
  });
  fs.writeFileSync(
    path.join(sourceRoot, 'plugins', 'pordee', '.codex-plugin', 'plugin.json'),
    JSON.stringify(pluginManifest, null, 2)
  );
  fs.writeFileSync(
    path.join(sourceRoot, 'plugins', 'pordee', 'skills', 'pordee', 'SKILL.md'),
    skillContent
  );
  fs.mkdirSync(targetRoot, { recursive: true });

  return { root, sourceRoot, targetRoot };
}

function cleanup(env) {
  fs.rmSync(env.root, { recursive: true, force: true });
}

test('installIntoProject copies plugin bundle into .codex-plugins/pordee', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    await installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot });

    const installedManifest = JSON.parse(
      fs.readFileSync(
        path.join(env.targetRoot, '.codex-plugins', 'pordee', '.codex-plugin', 'plugin.json'),
        'utf8'
      )
    );
    const installedSkill = fs.readFileSync(
      path.join(env.targetRoot, '.codex-plugins', 'pordee', 'skills', 'pordee', 'SKILL.md'),
      'utf8'
    );
    const installMetadata = JSON.parse(
      fs.readFileSync(
        path.join(env.targetRoot, '.codex-plugins', 'pordee', '.codex-plugin', 'install.json'),
        'utf8'
      )
    );

    assert.equal(installedManifest.name, 'pordee');
    assert.equal(installedManifest.skills[0].path, 'skills/pordee/SKILL.md');
    assert.match(installedSkill, /## Session Truth/);
    assert.match(
      installedSkill,
      new RegExp(env.targetRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
    assert.match(installedSkill, /\.pordee\/state\.json/);
    assert.equal(installMetadata.plugin, 'pordee');
    assert.equal(installMetadata.targetRoot, env.targetRoot);
    assert.match(installMetadata.installedAt || '', /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    cleanup(env);
  }
});

test('installIntoProject creates marketplace.json when missing', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    await installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot });

    const marketplacePath = path.join(
      env.targetRoot,
      '.agents',
      'plugins',
      'marketplace.json'
    );
    const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));

    assert.equal(marketplace.plugins.length, 1);
    assert.equal(marketplace.plugins[0].name, 'pordee');
    assert.equal(marketplace.plugins[0].path, './.codex-plugins/pordee');
  } finally {
    cleanup(env);
  }
});

test('installIntoProject merges without duplicating pordee entry', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    const marketplaceDir = path.join(env.targetRoot, '.agents', 'plugins');
    fs.mkdirSync(marketplaceDir, { recursive: true });
    fs.writeFileSync(
      path.join(marketplaceDir, 'marketplace.json'),
      JSON.stringify(
        {
          plugins: [
            { name: 'other-plugin', path: './.codex-plugins/other-plugin' },
            { name: 'pordee', path: './.codex-plugins/pordee' }
          ]
        },
        null,
        2
      )
    );

    await installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot });

    const marketplace = JSON.parse(
      fs.readFileSync(path.join(marketplaceDir, 'marketplace.json'), 'utf8')
    );
    const pordeeEntries = marketplace.plugins.filter((plugin) => plugin.name === 'pordee');
    const pordeeEntry = pordeeEntries[0];

    assert.equal(pordeeEntries.length, 1);
    assert.equal(pordeeEntry.path, './.codex-plugins/pordee');
  } finally {
    cleanup(env);
  }
});

test('installIntoProject keeps marketplace and existing bundle unchanged when bundle replacement fails', async () => {
  const env = makeEnv();
  const originalRenameSync = fs.renameSync;

  try {
    const { installIntoProject } = loadInstaller();
    const marketplaceDir = path.join(env.targetRoot, '.agents', 'plugins');
    const marketplacePath = path.join(marketplaceDir, 'marketplace.json');
    const installedRoot = path.join(env.targetRoot, '.codex-plugins', 'pordee');

    fs.mkdirSync(marketplaceDir, { recursive: true });
    fs.writeFileSync(
      marketplacePath,
      JSON.stringify(
        {
          plugins: [{ name: 'existing-plugin', path: './.codex-plugins/existing-plugin' }]
        },
        null,
        2
      )
    );
    fs.mkdirSync(path.join(installedRoot, '.codex-plugin'), { recursive: true });
    fs.mkdirSync(path.join(installedRoot, 'skills', 'pordee'), { recursive: true });
    fs.writeFileSync(
      path.join(installedRoot, '.codex-plugin', 'plugin.json'),
      JSON.stringify({ name: 'stale', skills: [] }, null, 2)
    );
    fs.writeFileSync(path.join(installedRoot, 'skills', 'pordee', 'SKILL.md'), 'stale skill\n');

    fs.renameSync = (from, to) => {
      if (
        from.includes(`${path.sep}.codex-plugins${path.sep}pordee.staging-`) &&
        to === installedRoot
      ) {
        throw new Error('simulated replacement failure');
      }

      return originalRenameSync(from, to);
    };

    await assert.rejects(
      installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot }),
      /simulated replacement failure/
    );

    const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
    const installedManifest = JSON.parse(
      fs.readFileSync(path.join(installedRoot, '.codex-plugin', 'plugin.json'), 'utf8')
    );
    const installedSkill = fs.readFileSync(
      path.join(installedRoot, 'skills', 'pordee', 'SKILL.md'),
      'utf8'
    );

    assert.deepEqual(marketplace.plugins, [
      { name: 'existing-plugin', path: './.codex-plugins/existing-plugin' }
    ]);
    assert.equal(installedManifest.name, 'stale');
    assert.equal(installedSkill, 'stale skill\n');
  } finally {
    fs.renameSync = originalRenameSync;
    cleanup(env);
  }
});

test('installIntoProject fails on invalid marketplace JSON', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    const marketplaceDir = path.join(env.targetRoot, '.agents', 'plugins');
    fs.mkdirSync(marketplaceDir, { recursive: true });
    fs.writeFileSync(path.join(marketplaceDir, 'marketplace.json'), '{bad json');

    await assert.rejects(
      installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot }),
      /marketplace/i
    );
  } finally {
    cleanup(env);
  }
});

test('installIntoProject does not mutate stale plugin bundle when marketplace JSON is invalid', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    const marketplaceDir = path.join(env.targetRoot, '.agents', 'plugins');
    const installedRoot = path.join(env.targetRoot, '.codex-plugins', 'pordee');

    fs.mkdirSync(marketplaceDir, { recursive: true });
    fs.writeFileSync(path.join(marketplaceDir, 'marketplace.json'), '{bad json');
    fs.mkdirSync(path.join(installedRoot, '.codex-plugin'), { recursive: true });
    fs.mkdirSync(path.join(installedRoot, 'skills', 'pordee'), { recursive: true });
    fs.writeFileSync(
      path.join(installedRoot, '.codex-plugin', 'plugin.json'),
      JSON.stringify({ name: 'stale', skills: [] }, null, 2)
    );
    fs.writeFileSync(path.join(installedRoot, 'skills', 'pordee', 'SKILL.md'), 'stale skill\n');

    await assert.rejects(
      installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot }),
      /marketplace/i
    );

    const installedManifest = JSON.parse(
      fs.readFileSync(path.join(installedRoot, '.codex-plugin', 'plugin.json'), 'utf8')
    );
    const installedSkill = fs.readFileSync(
      path.join(installedRoot, 'skills', 'pordee', 'SKILL.md'),
      'utf8'
    );

    assert.equal(installedManifest.name, 'stale');
    assert.equal(installedSkill, 'stale skill\n');
  } finally {
    cleanup(env);
  }
});

test('installIntoProject refreshes stale plugin bundle content on reinstall', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    const installedRoot = path.join(env.targetRoot, '.codex-plugins', 'pordee');
    fs.mkdirSync(path.join(installedRoot, '.codex-plugin'), { recursive: true });
    fs.mkdirSync(path.join(installedRoot, 'skills', 'pordee'), { recursive: true });
    fs.writeFileSync(
      path.join(installedRoot, '.codex-plugin', 'plugin.json'),
      JSON.stringify({ name: 'stale', skills: [] }, null, 2)
    );
    fs.writeFileSync(path.join(installedRoot, 'skills', 'pordee', 'SKILL.md'), 'stale skill\n');

    await installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot });

    const installedManifest = JSON.parse(
      fs.readFileSync(path.join(installedRoot, '.codex-plugin', 'plugin.json'), 'utf8')
    );
    const installedSkill = fs.readFileSync(
      path.join(installedRoot, 'skills', 'pordee', 'SKILL.md'),
      'utf8'
    );

    assert.equal(installedManifest.name, 'pordee');
    assert.equal(installedManifest.skills[0].path, 'skills/pordee/SKILL.md');
    assert.match(installedSkill, /## Session Truth/);
    assert.match(
      installedSkill,
      new RegExp(env.targetRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  } finally {
    cleanup(env);
  }
});

test('resolveTargetRoot defaults to the current directory when project is not provided', () => {
  const env = makeEnv();
  const originalCwd = process.cwd();

  try {
    const { resolveTargetRoot } = loadInstaller();
    process.chdir(env.targetRoot);

    assert.equal(resolveTargetRoot(), env.targetRoot);
    assert.equal(resolveTargetRoot(''), env.targetRoot);
  } finally {
    process.chdir(originalCwd);
    cleanup(env);
  }
});

test('installIntoProject fails cleanly when required source bundle files are missing', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    fs.rmSync(path.join(env.sourceRoot, 'plugins', 'pordee', 'skills', 'pordee', 'SKILL.md'));

    await assert.rejects(
      installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot }),
      /SKILL\.md|bundle|missing/i
    );

    assert.equal(
      fs.existsSync(path.join(env.targetRoot, '.codex-plugins', 'pordee')),
      false
    );
    assert.equal(
      fs.existsSync(path.join(env.targetRoot, '.agents', 'plugins', 'marketplace.json')),
      false
    );
  } finally {
    cleanup(env);
  }
});

test('installIntoProject fails cleanly when a required source bundle path is a directory', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();
    const manifestPath = path.join(
      env.sourceRoot,
      'plugins',
      'pordee',
      '.codex-plugin',
      'plugin.json'
    );

    fs.rmSync(manifestPath);
    fs.mkdirSync(manifestPath);

    await assert.rejects(
      installIntoProject({ sourceRoot: env.sourceRoot, targetRoot: env.targetRoot }),
      /plugin\.json|bundle|missing|file/i
    );

    assert.equal(
      fs.existsSync(path.join(env.targetRoot, '.codex-plugins', 'pordee')),
      false
    );
    assert.equal(
      fs.existsSync(path.join(env.targetRoot, '.agents', 'plugins', 'marketplace.json')),
      false
    );
  } finally {
    cleanup(env);
  }
});

test('installIntoProject rejects explicit project paths that resolve to the source checkout root', async () => {
  const env = makeEnv();

  try {
    const { installIntoProject } = loadInstaller();

    await assert.rejects(
      installIntoProject({ sourceRoot: env.sourceRoot, project: env.sourceRoot }),
      /source checkout|separate project directory/i
    );
  } finally {
    cleanup(env);
  }
});

test('writeMarketplaceAtomically updates marketplace via temp file rename', () => {
  const env = makeEnv();
  const originalRenameSync = fs.renameSync;

  try {
    const { writeMarketplaceAtomically } = loadInstaller();
    const marketplaceDir = path.join(env.targetRoot, '.agents', 'plugins');
    const marketplacePath = path.join(marketplaceDir, 'marketplace.json');
    const renameCalls = [];

    fs.mkdirSync(marketplaceDir, { recursive: true });
    fs.writeFileSync(marketplacePath, JSON.stringify({ plugins: [] }, null, 2));

    fs.renameSync = (from, to) => {
      renameCalls.push([from, to]);
      return originalRenameSync(from, to);
    };

    writeMarketplaceAtomically(env.targetRoot, {
      plugins: [{ name: 'pordee', path: './.codex-plugins/pordee' }]
    });

    const updatedMarketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));

    assert.equal(renameCalls.length, 1);
    assert.match(renameCalls[0][0], /marketplace\.json\.tmp-/);
    assert.equal(renameCalls[0][1], marketplacePath);
    assert.deepEqual(updatedMarketplace.plugins, [
      { name: 'pordee', path: './.codex-plugins/pordee' }
    ]);
    assert.equal(
      fs.readdirSync(marketplaceDir).some((entry) => entry.includes('marketplace.json.tmp-')),
      false
    );
  } finally {
    fs.renameSync = originalRenameSync;
    cleanup(env);
  }
});
