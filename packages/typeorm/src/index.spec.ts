import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('plugin manifest', () => {
  it('registers scaffold generators and aliases', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const manifestPath = join(currentDir, 'index.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      generators?: Record<string, { implementation: string; schema: string }>;
    };

    expect(manifest.generators).toEqual(
      expect.objectContaining({
        'migration-create': {
          implementation: './generators/migration-create/generator',
          schema: './generators/migration-create/schema.json',
        },
        migration: {
          implementation: './generators/migration-create/generator',
          schema: './generators/migration-create/schema.json',
        },
        'migration-api': {
          implementation: './generators/migration-api/generator',
          schema: './generators/migration-api/schema.json',
        },
        'migration-api-lib': {
          implementation: './generators/migration-api/generator',
          schema: './generators/migration-api/schema.json',
        },
        'entity-create': {
          implementation: './generators/entity-create/generator',
          schema: './generators/entity-create/schema.json',
        },
        entity: {
          implementation: './generators/entity-create/generator',
          schema: './generators/entity-create/schema.json',
        },
        'subscriber-create': {
          implementation: './generators/subscriber-create/generator',
          schema: './generators/subscriber-create/schema.json',
        },
        subscriber: {
          implementation: './generators/subscriber-create/generator',
          schema: './generators/subscriber-create/schema.json',
        },
      })
    );
  });
});
