// SPDX-License-Identifier: MIT
import { httpSource, transformHttpApplication } from './http-application';

const bootstrap = `import { NestFactory as Factory } from '@nestjs/core';
import { ApiModule } from './api.module.js';
async function start() {
  // Keep the owner's bootstrap options and comments.
  const api = await Factory.create(ApiModule, { logger: false });
  await api.listen(0);
}
await start();
`;

describe.each([
  {
    platform: 'node' as const,
    adapter: 'NodeAdapter',
    application: 'NestNodeApplication',
  },
  {
    platform: 'express' as const,
    adapter: 'ExpressAdapter',
    application: 'NestExpressApplication',
  },
  {
    platform: 'fastify' as const,
    adapter: 'FastifyAdapter',
    application: 'NestFastifyApplication',
  },
])('$platform overlay', ({ platform, adapter, application }) => {
  it('preserves aliases, options and unrelated bytes and is idempotent', () => {
    const transformed = httpSource(bootstrap, 'main.ts', 'bootstrap', platform);
    expect(transformed).toContain(
      `Factory.create<${application}>(ApiModule, new ${adapter}(), { logger: false })`
    );
    expect(transformed).toContain('// Keep the owner');
    expect(transformed).toContain("from './api.module.js'");
    expect(transformed).toContain('await start();');
    expect(httpSource(transformed, 'main.ts', 'bootstrap', platform)).toBe(
      transformed
    );
  });

  it.each([
    bootstrap + `\nclass ${adapter} {}`,
    bootstrap + `\ntype ${application} = unknown;`,
    bootstrap.replace('const api =', 'const Factory = custom; const api ='),
    bootstrap.replace('await api.listen(0)', 'await Factory.create(ApiModule)'),
    bootstrap.replace('{ logger: false }', 'customOptions'),
    bootstrap.replace("'@nestjs/core'", "'custom-factory'"),
    bootstrap.replace('Factory.create', 'Factory.createMicroservice'),
  ])('rejects ambiguous or non-HTTP source without guessing', (source) => {
    expect(() =>
      httpSource(source, 'custom/main.ts', 'bootstrap', platform)
    ).toThrow('custom/main.ts');
  });

  it('rejects unreviewed schematic versions before changing a snapshot', () => {
    const snapshot = new Map([['api/src/main.ts', Buffer.from(bootstrap)]]);
    const before = new Map(snapshot);
    expect(() =>
      transformHttpApplication(snapshot, 'api', '12.0.7', platform)
    ).toThrow('audited @nestjs/schematics 12.0.13');
    expect(snapshot).toEqual(before);
  });

  it('rejects incompatible runtime declarations without partial source changes', () => {
    const snapshot = new Map([
      ['api/src/main.ts', Buffer.from(bootstrap)],
      [
        'api/package.json',
        Buffer.from(
          JSON.stringify({ dependencies: { '@nestjs/common': '12.0.1' } })
        ),
      ],
    ]);
    const before = new Map(snapshot);
    expect(() =>
      transformHttpApplication(snapshot, 'api', '12.0.13', platform)
    ).toThrow('does not admit');
    expect(snapshot).toEqual(before);
  });
});

const httpTest = `import { TestingModule as Fixture } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
let api: INestApplication<App>;
async function prepare() {
  const fixture: Fixture = await compileFixture();
  api = fixture.createNestApplication();
  await api.init();
  // Preserve subsequent assertions and cleanup owned by the native test.
}
`;
const ready = 'await api.getHttpAdapter().getInstance().ready();';

it('adds one awaited Fastify readiness call after initialization and preserves aliases', () => {
  const output = httpSource(httpTest, 'api.e2e.ts', 'test', 'fastify');
  expect(output).toContain('let api: NestFastifyApplication');
  expect(output).toContain(
    'fixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter())'
  );
  expect(output).toContain(`await api.init();\n  ${ready}`);
  expect(output).toContain('// Preserve subsequent assertions');
  expect(httpSource(output, 'api.e2e.ts', 'test', 'fastify')).toBe(output);
  const windows = httpSource(
    httpTest.replace(/\n/g, '\r\n'),
    'api.e2e.ts',
    'test',
    'fastify'
  );
  expect(windows).toContain(`await api.init();\r\n  ${ready}`);
});

it.each([
  httpTest.replace('await api.init();', ''),
  httpTest.replace('await api.init();', 'api.init();'),
  httpTest.replace('await api.init();', 'await other.init();'),
  httpTest.replace('await api.init();', 'await api.init(); await api.init();'),
  httpTest.replace('await api.init();', 'if (enabled) { await api.init(); }'),
  httpTest.replace('api = fixture', 'other = fixture'),
  httpTest.replace(
    'async function prepare()',
    'async function prepare(api: unknown)'
  ),
  httpTest.replace(
    'async function prepare()',
    'function api() {}\nasync function prepare()'
  ),
  httpTest.replace('await api.init();', `${ready}\n  await api.init();`),
])(
  'rejects ambiguous Fastify lifecycle setup before snapshot mutation',
  (test) => {
    const snapshot = new Map([
      ['api/src/main.ts', Buffer.from(bootstrap)],
      ['api/test/app.e2e-spec.ts', Buffer.from(test)],
      [
        'api/package.json',
        Buffer.from(
          JSON.stringify({
            dependencies: {
              '@nestjs/common': '^12.0.1',
              '@nestjs/core': '^12.0.1',
              '@nestjs/platform-express': '^12.0.1',
            },
            devDependencies: { '@nestjs/testing': '^12.0.1' },
          })
        ),
      ],
    ]);
    const before = new Map(snapshot);
    expect(() =>
      transformHttpApplication(snapshot, 'api', '12.0.13', 'fastify')
    ).toThrow('api/test/app.e2e-spec.ts');
    expect(snapshot).toEqual(before);
  }
);

it.each([
  (text: string) => text.replace(ready, ''),
  (text: string) => text.replace(ready, ready + '\n' + ready),
  (text: string) => text.replace(ready, ready.replace('await ', '')),
  (text: string) =>
    text
      .replace(ready, '')
      .replace('await api.init();', ready + '\nawait api.init();'),
])(
  'rejects incomplete or conflicting previously explicit Fastify test output',
  (change) => {
    const output = httpSource(httpTest, 'api.e2e.ts', 'test', 'fastify');
    expect(() =>
      httpSource(change(output), 'api.e2e.ts', 'test', 'fastify')
    ).toThrow('api.e2e.ts');
  }
);
