// SPDX-License-Identifier: MIT
import type { ProjectConfiguration } from '@nx/devkit';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { usePackedPlugin, nx, assertStarts } from '../packed-plugin';
import { fixtures } from '../fixtures';

describe('packed Nest discovery', () => {
  const suite = usePackedPlugin();
  it.each(fixtures)(
    '$name: discovers, builds, restores outputs, and starts',
    async (fixture) => {
      const root = suite.createWorkspace(fixture);
      try {
        const buildName = fixture.buildTargetName ?? 'build';
        const startName = fixture.startTargetName ?? 'start';
        const initArgs = [
          'generate',
          '@anarchitects/nest:init',
          '--no-interactive',
        ];
        if (fixture.buildTargetName)
          initArgs.push(`--buildTargetName=${buildName}`);
        if (fixture.startTargetName)
          initArgs.push(`--startTargetName=${startName}`);
        const manifest = readFileSync(join(root, 'package.json'), 'utf8');
        const nestConfig = readFileSync(
          join(root, fixture.root, 'nest-cli.json'),
          'utf8'
        );
        nx(root, initArgs);
        const initialized = readFileSync(join(root, 'nx.json'), 'utf8');
        nx(root, initArgs);
        expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(initialized);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest);
        expect(
          readFileSync(join(root, fixture.root, 'nest-cli.json'), 'utf8')
        ).toBe(nestConfig);
        const graphFile = join(root, 'graph.json');
        nx(root, ['graph', '--file', graphFile]);
        const nodes: Record<string, { data: ProjectConfiguration }> =
          JSON.parse(readFileSync(graphFile, 'utf8')).graph.nodes;
        const nestProjects = Object.values(nodes).filter(({ data }) =>
          data.metadata?.technologies?.includes('nest')
        );
        expect(nestProjects.map(({ data }) => data.root)).toEqual([
          fixture.root,
        ]);
        const project = nodes[fixture.name].data;
        const targets = project.targets ?? {};
        expect(Object.keys(targets).sort()).toEqual(
          [buildName, startName].sort()
        );
        expect(targets[buildName]).toMatchObject({
          executor: 'nx:run-commands',
          options: { command: 'nest build', cwd: fixture.root },
          cache: true,
          dependsOn: [`^${buildName}`],
          outputs: [fixture.output],
          metadata: { technologies: ['nest'] },
        });
        if (fixture.configInputs)
          expect(targets[buildName].inputs).toEqual(
            expect.arrayContaining(fixture.configInputs)
          );
        expect(targets[startName]).toMatchObject({
          executor: 'nx:run-commands',
          options: { command: 'nest start', cwd: fixture.root },
          continuous: true,
          cache: false,
          metadata: { technologies: ['nest'] },
        });
        for (const key of ['inputs', 'outputs', 'dependsOn'])
          expect(
            targets[startName][key as keyof (typeof targets)[string]]
          ).toBeUndefined();
        rmSync(graphFile);
        nx(root, [
          'run',
          `${fixture.name}:${buildName}`,
          '--outputStyle=static',
        ]);
        const emittedPath = join(root, fixture.emittedMain);
        expect(existsSync(emittedPath)).toBe(true);
        const emitted = readFileSync(emittedPath, 'utf8');
        expect(emitted).toMatch(
          fixture.moduleType === 'module' ? /import\s/ : /require\(/
        );
        const outputPath = fixture.output
          .replace('{projectRoot}', join(root, fixture.root))
          .replace('{workspaceRoot}', root);
        rmSync(outputPath, { recursive: true, force: true });
        const cached = nx(root, [
          'run',
          `${fixture.name}:${buildName}`,
          '--outputStyle=static',
        ]);
        expect(cached).toMatch(
          /\[local cache\]|read the output from the cache/
        );
        expect(readFileSync(emittedPath, 'utf8')).toBe(emitted);
        await assertStarts(root, `${fixture.name}:${startName}`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
