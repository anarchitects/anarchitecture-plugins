import { Tree } from '@nx/devkit';
import {
  createFileIfMissing,
  updateJsonConfig,
} from './additive-transform.guard.js';

let createTreeWithEmptyWorkspace: (() => Tree) | undefined;

describe('additive transform guard', () => {
  let tree: Tree;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
  });

  it('creates a missing file', () => {
    createFileIfMissing(tree, {
      path: 'apps/api/src/health.controller.ts',
      content: 'export class HealthController {}\n',
    });

    expect(tree.read('apps/api/src/health.controller.ts', 'utf-8')).toBe(
      'export class HealthController {}\n'
    );
  });

  it('throws when creating an existing file without override', () => {
    tree.write('apps/api/src/health.controller.ts', 'old\n');

    expect(() =>
      createFileIfMissing(tree, {
        path: 'apps/api/src/health.controller.ts',
        content: 'new\n',
      })
    ).toThrow(/overwrite existing file/i);
  });

  it('allows overwrite when allowOverwrite is true and justification is provided', () => {
    tree.write('apps/api/src/health.controller.ts', 'old\n');

    createFileIfMissing(tree, {
      path: 'apps/api/src/health.controller.ts',
      content: 'new\n',
      allowOverwrite: true,
      justification: 'Align with explicit generator output.',
    });

    expect(tree.read('apps/api/src/health.controller.ts', 'utf-8')).toBe(
      'new\n'
    );
  });

  it('throws when override is requested without justification', () => {
    tree.write('apps/api/src/health.controller.ts', 'old\n');

    expect(() =>
      createFileIfMissing(tree, {
        path: 'apps/api/src/health.controller.ts',
        content: 'new\n',
        allowOverwrite: true,
      })
    ).toThrow(/justification/i);
  });

  it('creates a missing JSON config file', () => {
    updateJsonConfig(tree, 'apps/api/tsconfig.json', () => ({
      compilerOptions: {
        strict: true,
      },
    }));

    expect(tree.read('apps/api/tsconfig.json', 'utf-8')).toBe(
      '{\n  "compilerOptions": {\n    "strict": true\n  }\n}\n'
    );
  });

  it('updates an existing JSON config file', () => {
    tree.write('apps/api/package.json', '{\n  "name": "api"\n}\n');

    updateJsonConfig(tree, 'apps/api/package.json', (value) => {
      const packageJson = value as {
        name?: string;
        scripts?: Record<string, string>;
      };

      packageJson.scripts = {
        ...(packageJson.scripts ?? {}),
        start: 'nest start',
      };
    });

    expect(tree.read('apps/api/package.json', 'utf-8')).toBe(
      '{\n  "name": "api",\n  "scripts": {\n    "start": "nest start"\n  }\n}\n'
    );
  });

  it('keeps JSON updates idempotent for repeated equivalent updates', () => {
    updateJsonConfig(tree, 'apps/api/tsconfig.json', (value) => {
      const tsconfig = value as {
        compilerOptions?: Record<string, unknown>;
      };

      tsconfig.compilerOptions = {
        ...(tsconfig.compilerOptions ?? {}),
        strict: true,
      };
    });

    const firstWrite = tree.read('apps/api/tsconfig.json', 'utf-8');

    updateJsonConfig(tree, 'apps/api/tsconfig.json', (value) => {
      const tsconfig = value as {
        compilerOptions?: Record<string, unknown>;
      };

      tsconfig.compilerOptions = {
        ...(tsconfig.compilerOptions ?? {}),
        strict: true,
      };
    });

    expect(tree.read('apps/api/tsconfig.json', 'utf-8')).toBe(firstWrite);
  });

  it('prevents overwriting protected Nest-generated files by default', () => {
    tree.write('apps/api/src/main.ts', 'old\n');

    expect(() =>
      createFileIfMissing(tree, {
        path: 'apps/api/src/main.ts',
        content: 'new\n',
      })
    ).toThrow(/protected Nest-generated file/i);
  });

  it('allows protected overwrite only with explicit override and justification', () => {
    tree.write('apps/api/src/main.ts', 'old\n');

    createFileIfMissing(tree, {
      path: 'apps/api/src/main.ts',
      content: 'new\n',
      allowOverwrite: true,
      justification: 'Apply an intentional project-level bootstrap change.',
    });

    expect(tree.read('apps/api/src/main.ts', 'utf-8')).toBe('new\n');
  });
});

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
