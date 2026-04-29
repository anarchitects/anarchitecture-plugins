import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CreateNodesContextV2, CreateNodesResult } from '@nx/devkit';
import { createNodesV2 } from './index.js';

describe('nest plugin inference', () => {
  let workspaceRoot: string;
  let context: CreateNodesContextV2;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-nest-plugin-'));
    context = {
      workspaceRoot,
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['default'],
        },
      },
    } as CreateNodesContextV2;
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('ignores config files that are not attached to a project root', async () => {
    writeFile('apps/api/nest-cli.json', '{}');

    const results = await createNodes(['apps/api/nest-cli.json']);
    const projects = mergeProjects(results);

    expect(projects).toEqual({});
  });

  it('infers build and serve targets for a detected Nest project', async () => {
    writeFile('apps/api/project.json', '{"name":"api"}');
    writeFile('apps/api/nest-cli.json', '{"sourceRoot":"src"}');
    writeFile('apps/api/src/main.ts', "import '@nestjs/core';\n");

    const results = await createNodes(['apps/api/nest-cli.json']);
    const projects = mergeProjects(results);

    expect(projects['apps/api']?.root).toBe('apps/api');
    expect(projects['apps/api']?.targets?.build).toEqual(
      expect.objectContaining({
        command: 'nest build',
        cache: true,
        dependsOn: ['^build'],
        outputs: ['{workspaceRoot}/dist/{projectRoot}'],
        options: { cwd: 'apps/api' },
        metadata: expect.objectContaining({
          technologies: ['nest'],
          description: 'Build Nest project',
        }),
      })
    );
    expect(projects['apps/api']?.targets?.build?.inputs).toEqual([
      'production',
      '^production',
      '{workspaceRoot}/apps/api/nest-cli.json',
      { externalDependencies: ['@nestjs/cli'] },
    ]);
    expect(projects['apps/api']?.targets?.serve).toEqual(
      expect.objectContaining({
        command: 'nest start',
        continuous: true,
        cache: false,
        options: { cwd: 'apps/api' },
        metadata: expect.objectContaining({
          technologies: ['nest'],
          description: 'Start Nest application',
        }),
      })
    );
  });

  it('infers a Vitest test target when Vitest is detected', async () => {
    writeFile('apps/api/project.json', '{"name":"api"}');
    writeFile('apps/api/nest-cli.json', '{}');
    writeFile('apps/api/src/main.ts', "import '@nestjs/core';\n");
    writeFile('apps/api/vitest.config.ts', 'export default {};');

    const results = await createNodes(['apps/api/nest-cli.json']);
    const projects = mergeProjects(results);

    expect(projects['apps/api']?.targets?.test).toEqual(
      expect.objectContaining({
        command: 'vitest run',
        cache: true,
        outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
        options: { cwd: 'apps/api' },
        metadata: expect.objectContaining({
          technologies: ['nest', 'vitest'],
          description: 'Run Nest tests',
        }),
      })
    );
    expect(projects['apps/api']?.targets?.test?.inputs).toEqual([
      'default',
      '^default',
      { externalDependencies: ['vitest'] },
      { env: 'CI' },
    ]);
  });

  it('infers a Jest test target when Jest is detected', async () => {
    writeFile('apps/api/project.json', '{"name":"api"}');
    writeFile('apps/api/nest-cli.json', '{}');
    writeFile('apps/api/src/main.ts', "import '@nestjs/core';\n");
    writeFile('apps/api/jest.config.ts', 'export default {};');

    const results = await createNodes(['apps/api/nest-cli.json']);
    const projects = mergeProjects(results);

    expect(projects['apps/api']?.targets?.test).toEqual(
      expect.objectContaining({
        command: 'jest',
        cache: true,
        options: { cwd: 'apps/api' },
        metadata: expect.objectContaining({
          technologies: ['nest', 'jest'],
        }),
      })
    );
  });

  it('does not infer a test target when no runner is detected', async () => {
    writeFile('apps/api/project.json', '{"name":"api"}');
    writeFile('apps/api/nest-cli.json', '{}');
    writeFile('apps/api/src/main.ts', "import '@nestjs/core';\n");

    const results = await createNodes(['apps/api/nest-cli.json']);
    const projects = mergeProjects(results);

    expect(projects['apps/api']?.targets?.test).toBeUndefined();
  });

  it('infers a lint target only when lint tooling is detected', async () => {
    writeFile('apps/api/project.json', '{"name":"api"}');
    writeFile('apps/api/nest-cli.json', '{}');
    writeFile('apps/api/src/main.ts', "import '@nestjs/core';\n");
    writeFile('apps/api/eslint.config.mjs', 'export default [];');

    const results = await createNodes(['apps/api/nest-cli.json']);
    const projects = mergeProjects(results);

    expect(projects['apps/api']?.targets?.lint).toEqual(
      expect.objectContaining({
        command: 'eslint .',
        cache: true,
        options: { cwd: 'apps/api' },
        inputs: ['default', '^default', { externalDependencies: ['eslint'] }],
        metadata: expect.objectContaining({
          technologies: ['nest', 'eslint'],
        }),
      })
    );
  });

  it('supports custom target names via plugin options', async () => {
    writeFile('apps/api/project.json', '{"name":"api"}');
    writeFile('apps/api/nest-cli.json', '{}');
    writeFile('apps/api/src/main.ts', "import '@nestjs/core';\n");
    writeFile('apps/api/jest.config.ts', 'export default {};');
    writeFile('apps/api/eslint.config.mjs', 'export default [];');

    const results = await createNodes(['apps/api/nest-cli.json'], {
      buildTargetName: 'bundle',
      serveTargetName: 'dev',
      testTargetName: 'spec',
      lintTargetName: 'check',
    });
    const projects = mergeProjects(results);
    const targetNames = Object.keys(projects['apps/api']?.targets ?? {});

    expect(targetNames).toEqual(
      expect.arrayContaining(['bundle', 'dev', 'spec', 'check'])
    );
    expect(targetNames).not.toEqual(
      expect.arrayContaining(['build', 'serve', 'test', 'lint'])
    );
  });

  async function createNodes(
    configFiles: string[],
    options?: {
      buildTargetName?: string;
      serveTargetName?: string;
      testTargetName?: string;
      lintTargetName?: string;
    }
  ) {
    const [, createNodesFn] = createNodesV2;
    return createNodesFn(configFiles, options, context);
  }

  function writeFile(path: string, contents: string) {
    const target = join(workspaceRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
});

function mergeProjects(
  results: readonly (readonly [string, CreateNodesResult])[]
) {
  const projects: Record<
    string,
    { root?: string; targets?: Record<string, unknown> }
  > = {};
  for (const [, result] of results) {
    Object.assign(projects, result.projects ?? {});
  }
  return projects;
}
