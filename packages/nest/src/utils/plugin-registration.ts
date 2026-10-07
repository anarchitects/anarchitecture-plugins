// SPDX-License-Identifier: MIT
import type { NxJsonConfiguration } from '@nx/devkit';
import type { InitGeneratorSchema } from '../generators/init/schema';

type Plugins = NonNullable<NxJsonConfiguration['plugins']>;
const pluginName = '@anarchitects/nest/plugin';

/** Preserve scopes and unknown options, including intentional multiple registrations. */
export function registerNestPlugin(
  plugins: NxJsonConfiguration['plugins'],
  options: InitGeneratorSchema
): Plugins {
  const overrides = Object.fromEntries(
    Object.entries(options).filter(
      ([key, value]) =>
        ['buildTargetName', 'startTargetName'].includes(key) &&
        value !== undefined
    )
  );
  let found = false;
  function configure(entry: Plugins[number]): Plugins[number] {
    const name = typeof entry === 'string' ? entry : entry.plugin;
    if (name !== pluginName && name !== '@anarchitects/nest') return entry;
    found = true;
    const existing = typeof entry === 'string' ? {} : entry.options ?? {};
    const merged: Record<string, unknown> = { ...existing, ...overrides };
    const build = merged.buildTargetName ?? 'build';
    const start = merged.startTargetName ?? 'start';
    for (const [key, value] of [
      ['buildTargetName', build],
      ['startTargetName', start],
    ]) {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Nest plugin ${key} must be a non-empty string.`);
      }
    }
    if (build === start) {
      throw new Error(
        'Nest plugin buildTargetName and startTargetName must be different. Set a distinct --buildTargetName or --startTargetName.'
      );
    }
    if (Object.keys(overrides).length === 0) return entry;
    return {
      ...(typeof entry === 'string' ? { plugin: entry } : entry),
      options: merged,
    };
  }
  const result = (plugins ?? []).map(configure);
  if (!found) result.push(configure(pluginName));
  return result;
}
