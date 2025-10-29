import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';
import seedDatabase from './executor.js';

describe('seed executor', () => {
  let tempDir: string;
  let context: ExecutorContext;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    tempDir = mkdtempSync(join(process.cwd(), 'nx-typeorm-seed-'));
    context = {
      root: tempDir,
      projectName: 'api',
      projectsConfigurations: {
        version: 2,
        projects: {
          api: {
            root: 'apps/api',
            projectType: 'application',
          },
        },
      },
    } as unknown as ExecutorContext;

    logSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
    // cleanup potential globals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__seedPayload = undefined;
  });

  it('executes the default export from the seed file', async () => {
    const projectRoot = join(tempDir, 'apps/api');
    const seedsDir = join(projectRoot, 'tools');
    mkdirSync(seedsDir, { recursive: true });
    const seedPath = join(seedsDir, 'seed.js');
    writeFileSync(
      seedPath,
      `module.exports = async (args) => {
  globalThis.__seedPayload = args;
  return true;
};
`
    );

    const result = await seedDatabase(
      {
        projectRoot: 'apps/api',
        file: 'tools/seed.js',
        args: ['value'],
      },
      context
    );

    expect(result).toEqual({ success: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).__seedPayload).toEqual(['value']);
    expect(logSpy).toHaveBeenCalled();
  });

  it('supports invoking a named export', async () => {
    const projectRoot = join(tempDir, 'apps/api');
    const seedsDir = join(projectRoot, 'tools');
    mkdirSync(seedsDir, { recursive: true });
    const seedPath = join(seedsDir, 'seed.js');
    writeFileSync(
      seedPath,
      `exports.runSeed = async () => {
  globalThis.__seedPayload = 'named';
};
`
    );

    await seedDatabase(
      {
        projectRoot: 'apps/api',
        file: 'tools/seed.js',
        export: 'runSeed',
      },
      context
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).__seedPayload).toBe('named');
  });

  it('throws when the seed file is missing', async () => {
    await expect(
      seedDatabase(
        {
          projectRoot: 'apps/api',
          file: 'tools/missing.js',
        },
        context
      )
    ).rejects.toThrow('Seed file not found');
  });

  it('throws when the export is not a function', async () => {
    const projectRoot = join(tempDir, 'apps/api');
    const seedsDir = join(projectRoot, 'tools');
    mkdirSync(seedsDir, { recursive: true });
    const seedPath = join(seedsDir, 'seed.js');
    writeFileSync(seedPath, 'module.exports.other = 42;\n');

    await expect(
      seedDatabase(
        {
          projectRoot: 'apps/api',
          file: 'tools/seed.js',
          export: 'other',
        },
        context
      )
    ).rejects.toThrow('Export "other" is not a function');
  });
});
