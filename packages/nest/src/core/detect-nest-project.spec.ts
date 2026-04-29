import { Tree, writeJson } from '@nx/devkit';
import { detectNestProject } from './detect-nest-project.js';

let createTreeWithEmptyWorkspace: (() => Tree) | undefined;

describe('detectNestProject', () => {
  let tree: Tree;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
  });

  it('detects a Nest project from a project-level nest-cli.json file', () => {
    writeJson(tree, 'apps/api/nest-cli.json', {
      sourceRoot: 'src',
    });
    tree.write('apps/api/src/main.ts', "import '@nestjs/core';\n");

    const result = detectNestProject(tree, 'apps/api');

    expect(result).toEqual(
      expect.objectContaining({
        isNestProject: true,
        projectRoot: 'apps/api',
        sourceRoot: 'apps/api/src',
        hasNestCliJson: true,
        hasMainEntrypoint: true,
        compiler: 'tsc',
      })
    );
  });

  it('detects a Nest project from a project-level @nestjs/core dependency', () => {
    writeJson(tree, 'apps/api/package.json', {
      name: 'api',
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
    });

    const result = detectNestProject(tree, 'apps/api');

    expect(result.isNestProject).toBe(true);
    expect(result.hasNestCoreDependency).toBe(true);
    expect(result.hasNestCliJson).toBe(false);
  });

  it('does not detect a generic Node project from src/main.ts alone', () => {
    tree.write('apps/service/src/main.ts', "console.log('hello');\n");

    const result = detectNestProject(tree, 'apps/service');

    expect(result.isNestProject).toBe(false);
    expect(result.hasMainEntrypoint).toBe(true);
    expect(result.hasNestCoreDependency).toBe(false);
    expect(result.hasNestCliJson).toBe(false);
  });

  it('detects ESM from package.json type module', () => {
    writeJson(tree, 'apps/api/package.json', {
      name: 'api',
      type: 'module',
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
    });

    const result = detectNestProject(tree, 'apps/api');

    expect(result.moduleSystem).toBe('esm');
  });

  it('detects CJS when package.json type is missing', () => {
    writeJson(tree, 'apps/api/package.json', {
      name: 'api',
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
    });

    const result = detectNestProject(tree, 'apps/api');

    expect(result.moduleSystem).toBe('cjs');
  });

  it('detects Vitest from a project-level config even when the workspace has Jest', () => {
    tree.write('jest.config.ts', 'export default {};');
    tree.write('apps/api/vitest.config.ts', 'export default {};');
    writeJson(tree, 'package.json', {
      name: 'workspace',
      devDependencies: {
        jest: '^30.0.0',
      },
    });

    const result = detectNestProject(tree, 'apps/api');

    expect(result.testRunner).toBe('vitest');
  });

  it('detects Jest from package scripts', () => {
    writeJson(tree, 'apps/api/package.json', {
      name: 'api',
      scripts: {
        test: 'jest --runInBand',
      },
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
    });

    const result = detectNestProject(tree, 'apps/api');

    expect(result.testRunner).toBe('jest');
  });

  it('detects SWC only from explicit project-local signals', () => {
    writeJson(tree, 'apps/api/package.json', {
      name: 'api',
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
      devDependencies: {
        '@swc/core': '^1.0.0',
      },
    });
    tree.write('apps/api/tsconfig.json', '{}');

    const result = detectNestProject(tree, 'apps/api');

    expect(result.compiler).toBe('swc');
  });

  it('handles ambiguous Jest and Vitest signals conservatively', () => {
    tree.write('apps/api/jest.config.ts', 'export default {};');
    tree.write('apps/api/vitest.config.ts', 'export default {};');
    writeJson(tree, 'apps/api/package.json', {
      name: 'api',
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
    });

    const result = detectNestProject(tree, 'apps/api');

    expect(result.testRunner).toBeUndefined();
  });

  it('detects ESLint from a workspace-level config', () => {
    tree.write('eslint.config.mjs', 'export default [];');
    writeJson(tree, 'package.json', {
      name: 'workspace',
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
    });
    tree.write(
      'apps/api/src/main.ts',
      "import { NestFactory } from '@nestjs/core';\n"
    );

    const result = detectNestProject(tree, 'apps/api');

    expect(result.lintRunner).toBe('eslint');
  });

  it('detects oxlint from a project-level config', () => {
    writeJson(tree, 'apps/api/nest-cli.json', {
      sourceRoot: 'src',
    });
    tree.write('apps/api/src/main.ts', "import '@nestjs/core';\n");
    tree.write('apps/api/oxlint.json', '{}');

    const result = detectNestProject(tree, 'apps/api');

    expect(result.lintRunner).toBe('oxlint');
  });

  it('detects a Nest project from workspace dependencies only when main.ts imports @nestjs/core', () => {
    writeJson(tree, 'package.json', {
      name: 'workspace',
      dependencies: {
        '@nestjs/core': '^11.0.0',
      },
    });
    tree.write(
      'apps/api/src/main.ts',
      "import { NestFactory } from '@nestjs/core';\n"
    );

    const result = detectNestProject(tree, 'apps/api');

    expect(result.isNestProject).toBe(true);
    expect(result.hasNestCoreDependency).toBe(true);
    expect(result.hasMainEntrypoint).toBe(true);
  });
});

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
