// SPDX-License-Identifier: MIT
import {
  readJsonFile,
  type CreateNodesContext,
  type ProjectConfiguration,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { NativeMember } from './generate-nest-member';
import { treePath } from '../generation-adapter/tree-snapshot';
import { createNestBuildTarget } from './build-target';
import { createNestStartTarget } from './start-target';
import { readBuildOutputs } from './read-build-outputs';
import { readNamedInputs } from './named-inputs';

const shellArgument = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/** Only members with explicit Nx metadata opt into separate project inference. */
export function nativeMemberProjects(
  ownerRoot: string,
  context: CreateNodesContext,
  buildTargetName: string,
  startTargetName: string
): Record<string, ProjectConfiguration> {
  const config = readJsonFile<{ projects?: Record<string, NativeMember> }>(
    join(context.workspaceRoot, ownerRoot, 'nest-cli.json')
  );
  const projects: Record<string, ProjectConfiguration> = {};
  for (const [name, member] of Object.entries(config.projects ?? {})) {
    if (!member.root || !['application', 'library'].includes(member.type))
      continue;
    const root = posix.join(ownerRoot, treePath(member.root));
    if (
      root === ownerRoot ||
      !existsSync(join(context.workspaceRoot, root, 'project.json'))
    )
      continue;
    // A standalone nested Nest config owns its own targets.
    if (existsSync(join(context.workspaceRoot, root, 'nest-cli.json')))
      continue;
    const outputs = readBuildOutputs(context.workspaceRoot, ownerRoot, name);
    const build = createNestBuildTarget(
      root,
      readNamedInputs(root, context),
      buildTargetName,
      {
        ...outputs,
        outputs: outputs.outputs.map((output) =>
          output.replace(
            '{projectRoot}',
            ownerRoot === '.'
              ? '{workspaceRoot}'
              : `{workspaceRoot}/${ownerRoot}`
          )
        ),
      }
    );
    build.command = `nest build ${shellArgument(name)}`;
    build.options = { cwd: ownerRoot };
    // Nest compiles from its owner's shared configuration and may import other
    // members. Hash that native workspace conservatively until Nx has edges.
    build.inputs!.push(
      ownerRoot === '.'
        ? '{workspaceRoot}/**/*'
        : `{workspaceRoot}/${ownerRoot}/**/*`
    );
    const targets: ProjectConfiguration['targets'] = {
      [buildTargetName]: build,
    };
    if (member.type === 'application') {
      const start = createNestStartTarget(root, startTargetName);
      start.command = `nest start ${shellArgument(name)}`;
      start.options = { cwd: ownerRoot };
      targets[startTargetName] = start;
    }
    projects[root] = { root, targets, metadata: { technologies: ['nest'] } };
  }
  return projects;
}
