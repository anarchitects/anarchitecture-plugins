// SPDX-License-Identifier: MIT
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';

const suite = usePackedPlugin();
it.each(['references', 'paths'])(
  'links an Nx-native library in a %s workspace without replacing compiler policy',
  (model) => {
    const root = join(suite.root, model);
    const { yarn } = createInstalledConsumer(root, suite.tarball, {
      workspaces: ['libs/*'],
    });
    const read = (file: string) => readFileSync(join(root, file), 'utf8');
    const json = (file: string) => JSON.parse(read(file));
    const write = (file: string, content: string) => {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), content);
    };
    const writeJson = (file: string, value: unknown) =>
      write(file, JSON.stringify(value));
    const modern = model === 'references';
    if (modern) {
      yarn(['add', '--dev', '@nx/js@23.2.0']);
      const nx = json('nx.json');
      writeJson('nx.json', {
        ...nx,
        plugins: [
          ...nx.plugins,
          {
            plugin: '@nx/js/typescript',
            options: { typecheck: { targetName: 'typecheck' } },
          },
        ],
      });
    }
    const base = {
      compilerOptions: {
        target: 'ES2022',
        module: 'preserve',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        ...(modern
          ? { composite: true, declaration: true }
          : {
              paths: { '@legacy/contracts': ['./libs/contracts/src/index.ts'] },
            }),
      },
      angularCompilerOptions: {
        strictTemplates: true,
        strictInjectionParameters: true,
      },
    };
    writeJson('tsconfig.base.json', base);
    const rootConfig = {
      extends: './tsconfig.base.json',
      files: [],
      ...(modern
        ? {
            references: [
              { path: './libs/contracts' },
              { path: './libs/consumer' },
            ],
          }
        : {}),
    };
    writeJson('tsconfig.json', rootConfig);
    for (const name of ['contracts', 'consumer']) {
      writeJson(`libs/${name}/package.json`, {
        name: `@acme/${name}`,
        version: '0.0.0',
        private: true,
        type: 'module',
        exports: {
          '.': { types: './src/index.ts', default: './src/index.ts' },
        },
      });
      writeJson(`libs/${name}/tsconfig.json`, {
        extends: '../../tsconfig.base.json',
        files: [],
        include: [],
        references: [{ path: './tsconfig.lib.json' }],
      });
      writeJson(`libs/${name}/tsconfig.lib.json`, {
        extends: './tsconfig.json',
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          experimentalDecorators: true,
          rootDir: modern ? 'src' : '../..',
          outDir: 'dist',
          composite: modern,
          declaration: true,
          ...(modern
            ? { tsBuildInfoFile: 'dist/tsconfig.lib.tsbuildinfo' }
            : {}),
        },
        include: ['src/**/*.ts'],
        ...(modern
          ? {
              references:
                name === 'consumer'
                  ? [{ path: '../contracts/tsconfig.lib.json' }]
                  : [],
            }
          : {}),
      });
    }
    write(
      'libs/contracts/src/index.ts',
      'export interface Contract { id: string }\nexport const contract: Contract = { id: "shared" };\n'
    );
    write('libs/consumer/src/index.ts', 'export const placeholder = true;\n');
    const beforeBase = read('tsconfig.base.json');
    const beforeRoot = read('tsconfig.json');
    const generate = [
      'nx',
      'g',
      '@anarchitects/nest:library',
      '@acme/users',
      '--directory=libs/users',
      '--no-interactive',
    ];
    yarn([...generate, '--dry-run']);
    expect(read('tsconfig.base.json')).toBe(beforeBase);
    expect(read('tsconfig.json')).toBe(beforeRoot);
    yarn(generate);
    if (modern) {
      expect(read('tsconfig.base.json')).toBe(beforeBase);
      expect(json('tsconfig.json').references).toEqual([
        ...(rootConfig.references ?? []),
        { path: './libs/users' },
      ]);
      expect(json('tsconfig.base.json').compilerOptions.paths).toBeUndefined();
    } else {
      expect(read('tsconfig.json')).toBe(beforeRoot);
      expect(json('tsconfig.base.json')).toEqual({
        ...base,
        compilerOptions: {
          ...base.compilerOptions,
          paths: {
            '@legacy/contracts': ['./libs/contracts/src/index.ts'],
            '@acme/users': ['./libs/users/src/index.ts'],
          },
        },
      });
    }
    const linking = [read('tsconfig.json'), read('tsconfig.base.json')];
    expect(() => yarn(generate)).toThrow('already exists');
    expect([read('tsconfig.json'), read('tsconfig.base.json')]).toEqual(
      linking
    );

    // The legacy alias intentionally differs from the package name: Node's
    // workspace resolution cannot hide a missing inherited paths mapping.
    const contractsImport = modern ? '@acme/contracts' : '@legacy/contracts';
    write(
      'libs/users/src/workspace-contract.ts',
      `import { contract, type Contract } from "${contractsImport}";\nexport const userContract: Contract = contract;\n`
    );
    write(
      'libs/users/src/index.ts',
      read('libs/users/src/index.ts') +
        '\nexport * from "./workspace-contract.js";\n'
    );
    write(
      'libs/consumer/src/index.ts',
      `import { UsersModule, userContract } from "@acme/users";\nimport type { Contract } from "${contractsImport}";\nexport { UsersModule };\nexport const value: Contract = userContract;\n`
    );
    // Resolve sibling packages using the package manager's real workspace links.
    yarn(['workspace', '@acme/users', 'add', '@acme/contracts@workspace:*']);
    yarn([
      'workspace',
      '@acme/consumer',
      'add',
      '@acme/users@workspace:*',
      '@acme/contracts@workspace:*',
    ]);
    if (modern) {
      yarn(['nx', 'sync']);
      expect(json('libs/users/tsconfig.lib.json').references).toContainEqual({
        path: '../contracts/tsconfig.lib.json',
      });
      expect(json('libs/consumer/tsconfig.lib.json').references).toEqual(
        expect.arrayContaining([
          { path: '../contracts/tsconfig.lib.json' },
          { path: '../users/tsconfig.lib.json' },
        ])
      );
      yarn(['nx', 'run', '@acme/consumer:typecheck', '--skipNxCache']);
      expect(read('libs/consumer/dist/index.d.ts')).toContain('UsersModule');
      expect(read('libs/users/dist/workspace-contract.d.ts')).toContain(
        'Contract'
      );
    } else {
      writeJson('libs/consumer/project.json', {
        name: '@acme/consumer',
        targets: {
          check: {
            command: 'tsc --project libs/consumer/tsconfig.lib.json --noEmit',
          },
        },
      });
      // Check the generated library itself, including its external alias import.
      writeJson('libs/users/project.json', {
        ...json('libs/users/project.json'),
        targets: {
          check: {
            command: 'tsc --project libs/users/tsconfig.lib.json --noEmit',
          },
        },
      });
      yarn([
        'nx',
        'run-many',
        '-t',
        'check',
        '-p',
        '@acme/consumer,@acme/users',
        '--skipNxCache',
      ]);
      const source = read('libs/consumer/src/index.ts');
      write(
        'libs/consumer/src/index.ts',
        source + '\nconst invalid: number = value.id;\n'
      );
      expect(() =>
        yarn(['nx', 'run', '@acme/consumer:check', '--skipNxCache'])
      ).toThrow('TS2322');
      write('libs/consumer/src/index.ts', source);
    }
    expect(json('tsconfig.base.json').angularCompilerOptions).toEqual(
      base.angularCompilerOptions
    );
    expect(json('tsconfig.base.json').compilerOptions.module).toBe('preserve');
    expect(
      json('tsconfig.base.json').compilerOptions.experimentalDecorators
    ).toBeUndefined();
  },
  240_000
);
