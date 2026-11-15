// SPDX-License-Identifier: MIT
import { parseJson } from '@nx/devkit';
import { posix } from 'node:path';
import { httpSource } from './http-application';
import { treePath, type TreeSnapshot } from './tree-snapshot';
import {
  httpPlatforms,
  httpRuntimeVersion,
  type HttpPlatform,
} from '../utils/http-platform';

interface Workspace {
  projects?: Record<
    string,
    { type?: string; root: string; sourceRoot: string; entryFile?: string }
  >;
}

/** Only the requested new member is transformed, never a relocated owner app. */
export function transformHttpMember(
  before: TreeSnapshot,
  after: TreeSnapshot,
  requested: string,
  version: string,
  platform: HttpPlatform = 'node'
): void {
  const { packageName: adapterPackage, label } = httpPlatforms[platform];
  if (version !== '12.0.6')
    throw new Error(
      `${label} member generation requires audited @nestjs/schematics 12.0.6; found ${version}.`
    );
  const read = <T extends object>(snapshot: TreeSnapshot, path: string): T => {
    const content = snapshot.get(path);
    if (!content)
      throw new Error(`Missing native member configuration: ${path}`);
    return parseJson<T>(Buffer.from(content).toString());
  };
  const name = requested
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/\s/g, '-');
  const old = read<Workspace>(before, 'nest-cli.json');
  const member = read<Workspace>(after, 'nest-cli.json').projects?.[name];
  if (old.projects?.[name] || !member || member.type !== 'application')
    throw new Error(
      `${label} overlay requires a newly generated application member: ${name}.`
    );
  const root = treePath(member.root);
  const source = treePath(member.sourceRoot);
  if (!source.startsWith(root + '/'))
    throw new Error(`Invalid sourceRoot for ${label} member ${name}.`);
  const main = treePath(posix.join(source, member.entryFile ?? 'main') + '.ts');
  const paths = [
    main,
    ...[...after.keys()].filter(
      (path) =>
        path.startsWith(root + '/test/') && /\/app\.e2e-.+\.ts$/.test(path)
    ),
  ];
  const updates = new Map<string, Buffer>();
  for (const path of paths) {
    const content = after.get(path);
    if (before.has(path) || !content)
      throw new Error(
        `Cannot transform existing or missing ${label} member file: ${path}`
      );
    updates.set(
      path,
      Buffer.from(
        httpSource(
          Buffer.from(content).toString(),
          path,
          path === main ? 'bootstrap' : 'test',
          platform
        )
      )
    );
  }
  const manifest = read<{ dependencies?: Record<string, string> }>(
    after,
    'package.json'
  );
  if (!manifest.dependencies?.[adapterPackage]) {
    manifest.dependencies = Object.fromEntries(
      Object.entries({
        ...manifest.dependencies,
        [adapterPackage]: httpRuntimeVersion,
      }).sort(([a], [b]) => a.localeCompare(b))
    );
    updates.set(
      'package.json',
      Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
    );
  }
  for (const [path, content] of updates) after.set(path, content);
}
