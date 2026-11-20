import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import pg from 'pg';

// Use installed archives and public generators/targets, without patching the
// generated datasource, module mode, or compiler configuration.
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
function show(name, extraEnv) {
  return run(
    'yarn',
    ['nx', 'run', `${name}:db:migrate:show`, '--skipNxCache'],
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
      `--directory=apps/api-${mode}`,
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
    const project = JSON.parse(nx('show', 'project', name, '--json'));
    probeClosedPort(name);
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
    nx('run', `${name}:compile`);
    probeClosedPort(name);
    console.log(
      `PASS ${mode}: inferred datasource loads before and after compile`
    );
    if (!database) continue;

    const client = new pg.Client({ connectionString: database });
    const schema = `inferred_${randomUUID().replaceAll('-', '')}`;
    const migration = `Probe1700000000000`;
    const dbEnv = { DATABASE_URL: database, TYPEORM_SCHEMA: schema };
    try {
      await client.connect();
      await client.query(`CREATE SCHEMA "${schema}"`);
      // The generated datasource's documented default is workspace-relative
      // dist/tools/typeorm/migrations/*.js. Supply a consumer-owned migration.
      write('dist/tools/typeorm/migrations/package.json', { type: 'commonjs' });
      write(
        'dist/tools/typeorm/migrations/1700000000000-probe.js',
        `exports.${migration} = class ${migration} {
  async up(q) { await q.query('CREATE TABLE "${schema}".probe (id integer PRIMARY KEY)'); }
  async down(q) { await q.query('DROP TABLE "${schema}".probe'); }
};\n`
      );
      assert.match(show(name, dbEnv), new RegExp(`\\[ \\].*${migration}`));
      for (let attempt = 0; attempt < 2; attempt++) {
        run(
          'yarn',
          ['nx', 'run', `${name}:db:migrate:run`, '--skipNxCache'],
          root,
          dbEnv
        );
      }
      assert.match(show(name, dbEnv), new RegExp(`\\[X\\].*${migration}`));
      assert.match(
        run(
          'yarn',
          ['nx', 'run', `${name}:typeorm:show`, '--skipNxCache'],
          root,
          dbEnv
        ),
        new RegExp(`\\[X\\].*${migration}`)
      );
      assert.equal(
        (
          await client.query(
            `SELECT count(*)::int AS count FROM "${schema}".migrations`
          )
        ).rows[0].count,
        1
      );
      assert.notEqual(
        (
          await client.query('SELECT to_regclass($1) AS relation', [
            `${schema}.probe`,
          ])
        ).rows[0].relation,
        null
      );
      run(
        'yarn',
        ['nx', 'run', `${name}:db:migrate:revert`, '--skipNxCache'],
        root,
        dbEnv
      );
      assert.match(show(name, dbEnv), new RegExp(`\\[ \\].*${migration}`));
      assert.equal(
        (
          await client.query('SELECT to_regclass($1) AS relation', [
            `${schema}.probe`,
          ])
        ).rows[0].relation,
        null
      );
      assert.equal(
        (
          await client.query(
            `SELECT count(*)::int AS count FROM "${schema}".migrations`
          )
        ).rows[0].count,
        0
      );
      console.log(
        `PASS ${mode}: inferred PostgreSQL status, run, idempotence, revert`
      );
    } finally {
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await client.end();
      }
    }
  }
  if (!database)
    console.log(
      'PostgreSQL lifecycle not run: set PG_COMPAT_DATABASE_URL to a disposable local database.'
    );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
