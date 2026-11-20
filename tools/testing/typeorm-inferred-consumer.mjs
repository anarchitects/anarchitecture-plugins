import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import pg from 'pg';

// Use installed archives and public generators/targets, without patching the
// generated datasource, module mode, or compiler configuration. The migration
// lifecycle uses unedited output from the public migration-create generator.
const repository = process.cwd();
const temporary = mkdtempSync(join(tmpdir(), 'typeorm-inferred-'));
const root = join(temporary, 'consumer');
const database = process.env.PG_COMPAT_DATABASE_URL;
if (database) {
  assert(
    ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(database).hostname)
  );
}
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !/^(NX_|TS_NODE_|TYPEORM_)/.test(key) &&
      !['NODE_OPTIONS', 'DATABASE_URL', 'VSCODE_INSPECTOR_OPTIONS'].includes(
        key
      )
  )
);
Object.assign(env, {
  NX_DAEMON: 'false',
  NX_ISOLATE_PLUGINS: 'false',
  NX_NO_CLOUD: 'true',
  NX_INTERACTIVE: 'false',
  NX_TUI: 'false',
  CI: 'true',
  FORCE_COLOR: '0',
  YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
});
function write(path, value) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'
  );
}
function run(command, args, cwd = root, extraEnv = {}) {
  if (command === 'yarn' && args[0] === 'nx' && args[1] === 'run') {
    args = [...args, '--output-style=static'];
  }
  try {
    return execFileSync(command, args, {
      cwd,
      env: { ...env, ...extraEnv },
      encoding: 'utf8',
      timeout: 240_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${error.stdout ?? ''}\n${
        error.stderr ?? ''
      }`
    );
  }
}
const nx = (...args) => run('yarn', ['nx', ...args]);
function generate(...args) {
  nx('g', ...args, '--no-interactive', '--dry-run');
  nx('g', ...args, '--no-interactive');
}
function show(name, extraEnv, flags = []) {
  return run(
    'yarn',
    ['nx', 'run', `${name}:db:migrate:show`, '--skipNxCache', ...flags],
    root,
    extraEnv
  );
}
function probeClosedPort(name) {
  const result = spawnSync(
    'yarn',
    [
      'nx',
      'run',
      `${name}:db:migrate:show`,
      '--skipNxCache',
      '--output-style=static',
    ],
    {
      cwd: root,
      env: { ...env, TYPEORM_HOST: '127.0.0.1', TYPEORM_PORT: '1' },
      encoding: 'utf8',
      timeout: 120_000,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /ECONNREFUSED/, output);
  assert.doesNotMatch(
    output,
    /ERR_MODULE_NOT_FOUND|Unable to open file|TSError/
  );
}
try {
  const archives = {};
  for (const directory of ['typeorm', 'nest']) {
    const [archive] = JSON.parse(
      run(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary],
        join(repository, 'packages', directory)
      )
    );
    archives[directory] = `file:${join(temporary, archive.filename)}`;
  }
  write('package.json', {
    name: 'typeorm-inferred-consumer',
    private: true,
    packageManager: 'yarn@4.18.1',
    dependencies: {
      nx: '24.0.1',
      '@nx/devkit': '24.0.1',
      '@nx/js': '24.0.1',
      '@anarchitects/nest': archives.nest,
      '@anarchitects/nx-typeorm': archives.typeorm,
      '@nestjs/cli': '12.0.13',
      typescript: '6.0.3',
      'ts-node': '10.9.2',
      typeorm: '1.1.3',
      pg: '8.23.1',
      'reflect-metadata': '0.2.2',
    },
    resolutions: {
      '@nestjs/common': '12.5.1',
      '@nestjs/core': '12.5.1',
      '@nestjs/platform-express': '12.5.1',
      '@nestjs/testing': '12.5.1',
      '@nestjs/typeorm': '12.0.3',
      typeorm: '1.1.3',
      pg: '8.23.1',
    },
  });
  write('.yarnrc.yml', 'nodeLinker: node-modules\n');
  write('nx.json', { plugins: [] });
  write('.gitignore', 'node_modules\n.nx\ndist\n');
  console.log(
    'Installing packed TypeORM/Nest plugins in a clean Yarn consumer'
  );
  run('yarn', ['install']);
  generate('@anarchitects/nest:init', '--buildTargetName=compile');
  generate('@anarchitects/nx-typeorm:init', '--skipInstall');
  for (const mode of ['esm', 'cjs']) {
    generate(
      '@anarchitects/nest:application',
      `api-${mode}`,
      `--directory=apps/blueprint/api-${mode}`,
      `--type=${mode}`,
      '--packageManager=yarn',
      '--skipInstall'
    );
    generate(
      '@anarchitects/nx-typeorm:bootstrap',
      `--project=api-${mode}`,
      '--db=postgres',
      '--migrationDatasource',
      '--skipInstall'
    );
  }
  run('yarn', ['install']);
  for (const mode of ['esm', 'cjs']) {
    const name = `api-${mode}`;
    const projectRoot = `apps/blueprint/${name}`;
    const migrationName = 'ToolingProbe1795219200000';
    const migrationFile = '1795219200000-tooling-probe';
    generate(
      '@anarchitects/nx-typeorm:migration-create',
      `--project=${name}`,
      '--name=tooling-probe',
      '--timestamp=1795219200000'
    );
    const project = JSON.parse(nx('show', 'project', name, '--json'));
    for (const target of [
      'db:migrate:show',
      'db:migrate:run',
      'db:migrate:revert',
      'typeorm:show',
    ]) {
      assert.equal(project.targets[target].options.moduleSystem, undefined);
      assert.equal(
        project.targets[target].options.dataSource,
        'tools/typeorm/datasource.migrations.ts'
      );
    }
    const client = database
      ? new pg.Client({ connectionString: database })
      : undefined;
    const schema = `inferred_${randomUUID().replaceAll('-', '')}`;
    const dbEnv = { DATABASE_URL: database, TYPEORM_SCHEMA: schema };
    try {
      if (client) {
        await client.connect();
        await client.query(`CREATE SCHEMA "${schema}"`);
      }
      probeClosedPort(name);
      if (client) await verifyLifecycle('before host build');
      nx('run', `${name}:compile`);
      probeClosedPort(name);
      if (client) await verifyLifecycle('after host build');

      // Native Nest builds only src. Compile the generated migration config
      // separately; no fixture-written tsconfig or migration glob is involved.
      nx(
        'exec',
        `--projects=${name}`,
        '--',
        'tsc',
        '-p',
        'tools/typeorm/tsconfig.migrations.json'
      );
      const compiledDatasource =
        'dist/typeorm/tools/typeorm/datasource.migrations.js';
      assert(existsSync(join(root, projectRoot, compiledDatasource)));
      assert(
        existsSync(join(root, projectRoot, 'dist/typeorm/src/data-source.js'))
      );
      assert(
        existsSync(
          join(
            root,
            projectRoot,
            `dist/typeorm/tools/typeorm/migrations/${migrationFile}.js`
          )
        )
      );
      const sourceMigration = join(
        root,
        projectRoot,
        `tools/typeorm/migrations/${migrationFile}.ts`
      );
      const compiledMigration = join(
        root,
        projectRoot,
        `dist/typeorm/tools/typeorm/migrations/${migrationFile}.js`
      );
      assert(readFileSync(sourceMigration, 'utf8').includes(migrationName));
      assert(readFileSync(compiledMigration, 'utf8').includes(migrationName));
      if (client) {
        // Both trees coexist: source discovery must still find exactly one.
        await verifyLifecycle('source with compiled copies present');
        const savedRuntime = join(temporary, `runtime-${mode}.ts`);
        const savedMigration = join(temporary, `migration-${mode}.ts`);
        const runtime = join(root, projectRoot, 'src/data-source.ts');
        renameSync(runtime, savedRuntime);
        renameSync(sourceMigration, savedMigration);
        try {
          await verifyLifecycle(
            'compiled with source runtime and migration unavailable',
            [`--dataSource=${compiledDatasource}`]
          );
        } finally {
          renameSync(savedRuntime, runtime);
          renameSync(savedMigration, sourceMigration);
        }
      }
      console.log(
        `PASS ${mode}: nested generated source and compiled migration discovery`
      );
    } finally {
      if (client) {
        try {
          await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        } finally {
          await client.end();
        }
      }
    }

    async function verifyLifecycle(phase, flags = []) {
      const pending = new RegExp(`\\[ \\].*${migrationName}`);
      const applied = new RegExp(`\\[X\\].*${migrationName}`);
      assert.match(show(name, dbEnv, flags), pending);
      assert.match(runTarget('typeorm:show', flags), pending);
      runTarget('db:migrate:run', flags);
      runTarget('typeorm:run', flags);
      assert.match(show(name, dbEnv, flags), applied);
      assert.match(runTarget('typeorm:show', flags), applied);
      const rows = (
        await client.query(
          `SELECT name FROM "${schema}".migrations ORDER BY id`
        )
      ).rows;
      assert.deepEqual(rows, [{ name: migrationName }]);
      runTarget('db:migrate:revert', flags);
      assert.match(show(name, dbEnv, flags), pending);
      assert.deepEqual(
        (await client.query(`SELECT name FROM "${schema}".migrations`)).rows,
        []
      );
      console.log(
        `PASS ${mode}: ${phase}: pending, run, second-run, aliases, exact ledger and revert`
      );
    }
    function runTarget(target, flags) {
      return run(
        'yarn',
        ['nx', 'run', `${name}:${target}`, '--skipNxCache', ...flags],
        root,
        dbEnv
      );
    }
  }
  if (!database)
    console.log(
      'PostgreSQL lifecycle not run: set PG_COMPAT_DATABASE_URL to a disposable local database.'
    );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
