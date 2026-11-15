// SPDX-License-Identifier: MIT
import { nodeHttpSource, transformNodeApplication } from './node-application';

const bootstrap = `import { NestFactory as Factory } from '@nestjs/core';
import { ApiModule } from './api.module.js';
async function start() {
  // Keep the owner's bootstrap options and comments.
  const api = await Factory.create(ApiModule, { logger: false });
  await api.listen(0);
}
await start();
`;

it('preserves aliases, options and unrelated bytes and is idempotent', () => {
  const transformed = nodeHttpSource(bootstrap, 'main.ts', 'bootstrap');
  expect(transformed).toContain(
    'Factory.create<NestNodeApplication>(ApiModule, new NodeAdapter(), { logger: false })'
  );
  expect(transformed).toContain('// Keep the owner');
  expect(transformed).toContain("from './api.module.js'");
  expect(transformed).toContain('await start();');
  expect(nodeHttpSource(transformed, 'main.ts', 'bootstrap')).toBe(transformed);
});

it.each([
  bootstrap + '\nclass NodeAdapter {}',
  bootstrap + '\ntype NestNodeApplication = unknown;',
  bootstrap.replace('const api =', 'const Factory = custom; const api ='),
  bootstrap.replace('await api.listen(0)', 'await Factory.create(ApiModule)'),
  bootstrap.replace('{ logger: false }', 'customOptions'),
  bootstrap.replace("'@nestjs/core'", "'custom-factory'"),
  bootstrap.replace('Factory.create', 'Factory.createMicroservice'),
])('rejects ambiguous or non-HTTP source without guessing', (source) => {
  expect(() => nodeHttpSource(source, 'custom/main.ts', 'bootstrap')).toThrow(
    'custom/main.ts'
  );
});

it('rejects unreviewed schematic versions before changing a snapshot', () => {
  const snapshot = new Map([['api/src/main.ts', Buffer.from(bootstrap)]]);
  const before = new Map(snapshot);
  expect(() => transformNodeApplication(snapshot, 'api', '12.0.7')).toThrow(
    'audited @nestjs/schematics 12.0.6'
  );
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
  expect(() => transformNodeApplication(snapshot, 'api', '12.0.6')).toThrow(
    'does not admit'
  );
  expect(snapshot).toEqual(before);
});
