// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { consumerEnvironment as environment } from '../consumer-environment';
import { usePackedPlugin, nx, write, dependencies } from '../packed-plugin';
import { fixtures } from '../fixtures';
import { standardSchemaFixture } from '../standard-schema-fixture';

describe('packed Nest standard-schema', () => {
  const suite = usePackedPlugin();
  it.each(['esm', 'cjs'])(
    'runs Standard Schema HTTP, TCP, serialization, and OpenAPI with native %s resources',
    (mode) => {
      const root = suite.createWorkspace({
        ...fixtures[0],
        name: `standard-schema-${mode}`,
        files: {},
      });
      try {
        nx(root, [
          'generate',
          '@anarchitects/nest:application',
          'backend',
          '--directory=services/backend',
          ...(mode === 'cjs' ? ['--type=cjs'] : []),
          '--no-interactive',
        ]);
        const owner = join(root, 'services/backend');
        const manifest = JSON.parse(
          readFileSync(join(owner, 'package.json'), 'utf8')
        );
        manifest.dependencies['@nestjs/swagger'] =
          dependencies['@nestjs/swagger'];
        manifest.dependencies['@nestjs/microservices'] =
          dependencies['@nestjs/microservices'];
        write(owner, 'package.json', manifest);
        for (const [name, type] of [
          ['users', 'rest'],
          ['events', 'microservice'],
        ])
          nx(root, [
            'generate',
            '@anarchitects/nest:resource',
            name,
            '--project=backend',
            '--type=' + type,
            '--crud=true',
            '--spec=false',
            '--no-interactive',
          ]);
        const nativeFiles = [
          'src/app.module.ts',
          'src/main.ts',
          'src/users/users.controller.ts',
          'src/users/users.service.ts',
          'src/users/dto/update-user.dto.ts',
          'src/events/events.controller.ts',
          'src/events/events.service.ts',
          'tsconfig.json',
          'nest-cli.json',
          'package.json',
        ];
        const before = nativeFiles.map(
          (path) => [path, readFileSync(join(owner, path), 'utf8')] as const
        );
        // Consumer-owned code uses generated services/modules without rewriting
        // native sources, toolchain config, or installing a schema vendor.
        write(owner, 'src/compatibility.ts', standardSchemaFixture);
        write(owner, 'tsconfig.compatibility.json', {
          extends: './tsconfig.json',
          compilerOptions: {
            rootDir: 'src',
            outDir: 'dist-compatibility',
            types: ['node'],
            incremental: false,
          },
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.spec.ts'],
        });
        const project = JSON.parse(
          readFileSync(join(owner, 'project.json'), 'utf8')
        );
        project.targets = {
          ...project.targets,
          'verify-standard-schema': {
            executor: 'nx:run-commands',
            options: {
              command: 'tsc -p tsconfig.compatibility.json',
              cwd: 'services/backend',
            },
          },
        };
        write(owner, 'project.json', project);
        nx(root, [
          'run',
          'backend:verify-standard-schema',
          '--outputStyle=static',
        ]);
        const output = execFileSync(
          process.execPath,
          [join(owner, 'dist-compatibility/compatibility.js')],
          {
            cwd: owner,
            env: environment(root),
            encoding: 'utf8',
            timeout: 30_000,
            stdio: 'pipe',
          }
        );
        expect(output).toContain('STANDARD_SCHEMA_COMPATIBILITY_OK');
        for (const [path, contents] of before)
          expect(readFileSync(join(owner, path), 'utf8')).toBe(contents);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
