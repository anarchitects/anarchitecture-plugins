import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import ensureSchema from '../../packages/typeorm/dist/executors/ensure-schema/executor.js';
import runMigrations from '../../packages/typeorm/dist/executors/run/executor.js';
import runQuery from '../../packages/typeorm/dist/executors/query/executor.js';
import revertMigrations from '../../packages/typeorm/dist/executors/revert/executor.js';

const root = resolve(import.meta.dirname, '../..');
const connectionString = process.env.PG_COMPAT_DATABASE_URL;
assert.ok(
  connectionString,
  'Set PG_COMPAT_DATABASE_URL to a disposable local database'
);
const url = new URL(connectionString);
assert.ok(
  ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
  'Only a local test database is allowed'
);
const expectedMajor = Number(process.env.PG_COMPAT_EXPECTED_MAJOR);
assert.ok(
  Number.isInteger(expectedMajor) && expectedMajor > 0,
  'Set PG_COMPAT_EXPECTED_MAJOR'
);
const schema = `compat_${randomUUID().replaceAll('-', '')}`;
const table = `"${schema}"."probe"`;
const client = new pg.Client({ connectionString });
await mkdir(resolve(root, 'tmp'), { recursive: true });
const fixture = await mkdtemp(resolve(root, 'tmp/typeorm-postgres-'));
try {
  await client.connect();
  const version = (await client.query('SHOW server_version_num')).rows[0]
    .server_version_num;
  assert.equal(Math.floor(Number(version) / 10000), expectedMajor);
  console.log(`Testing nx-typeorm against PostgreSQL ${version}`);
  await writeFile(
    resolve(fixture, 'data-source.mjs'),
    `
import { DataSource } from 'typeorm';
export default new DataSource({
  type: 'postgres', url: process.env.PG_COMPAT_DATABASE_URL,
  schema: ${JSON.stringify(schema)}, synchronize: false,
  migrations: [${JSON.stringify(resolve(fixture, '1700000000000-probe.mjs'))}]
});
`
  );
  await writeFile(
    resolve(fixture, '1700000000000-probe.mjs'),
    `
export class Probe1700000000000 {
  async up(queryRunner) { await queryRunner.query('CREATE TABLE ${table} (id integer PRIMARY KEY, value jsonb NOT NULL)'); }
  async down(queryRunner) { await queryRunner.query('DROP TABLE ${table}'); }
}
`
  );
  const context = { root, projectName: 'nx-typeorm', isVerbose: false };
  const options = {
    projectRoot: fixture,
    dataSource: 'data-source.mjs',
    moduleSystem: 'esm',
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(
      (await ensureSchema({ ...options, schema }, context)).success,
      true
    );
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await runMigrations(options, context)).success, true);
  }
  assert.equal(
    (
      await client.query(
        `SELECT count(*)::int AS count FROM "${schema}"."migrations"`
      )
    ).rows[0].count,
    1
  );
  assert.equal(
    (
      await runQuery(
        { ...options, query: `INSERT INTO ${table} VALUES (1, '{"ok":true}')` },
        context
      )
    ).success,
    true
  );
  assert.deepEqual(
    (await client.query(`SELECT id, value FROM ${table}`)).rows,
    [{ id: 1, value: { ok: true } }]
  );
  assert.equal((await revertMigrations(options, context)).success, true);
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
        `SELECT count(*)::int AS count FROM "${schema}"."migrations"`
      )
    ).rows[0].count,
    0
  );
  assert.equal((await runMigrations(options, context)).success, true);
  assert.equal(
    (await client.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0]
      .count,
    0
  );
  console.log(
    'PASS: schema idempotence, migration idempotence, JSONB query, revert and reapply'
  );
} finally {
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
    await rm(fixture, { recursive: true, force: true });
  }
}
