import { updateJson, type Tree } from '@nx/devkit';
import {
  nestDevDependencies,
  nestRuntimeDependencies,
} from '../../utils/nest-dependencies.js';
import type { InitGeneratorSchema } from './schema.js';

interface RootPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {}
): Promise<void> {
  if (!options.skipPackageJson) {
    addNestBaseDependencies(tree, options.forceVersions === true);
  }

  // TODO(#160): Implement Nest plugin initialization in later subissues.
}

export default initGenerator;

function addNestBaseDependencies(tree: Tree, forceVersions: boolean): void {
  updateJson<RootPackageJson>(tree, 'package.json', (json) => {
    const dependencies = { ...(json.dependencies ?? {}) };
    const devDependencies = { ...(json.devDependencies ?? {}) };

    mergeDependencyGroup(
      dependencies,
      devDependencies,
      nestRuntimeDependencies,
      forceVersions,
      'dependencies'
    );
    mergeDependencyGroup(
      devDependencies,
      dependencies,
      nestDevDependencies,
      forceVersions,
      'devDependencies'
    );

    return {
      ...json,
      dependencies,
      devDependencies,
    };
  });
}

function mergeDependencyGroup(
  targetDependencies: Record<string, string>,
  otherDependencies: Record<string, string>,
  desiredDependencies: Readonly<Record<string, string>>,
  forceVersions: boolean,
  targetSection: 'dependencies' | 'devDependencies'
): void {
  for (const [packageName, version] of Object.entries(desiredDependencies)) {
    if (packageName in targetDependencies) {
      if (forceVersions) {
        targetDependencies[packageName] = version;
      }
      continue;
    }

    if (packageName in otherDependencies) {
      if (forceVersions) {
        otherDependencies[packageName] = version;
      }
      continue;
    }

    if (targetSection === 'dependencies') {
      targetDependencies[packageName] = version;
      continue;
    }

    targetDependencies[packageName] = version;
  }
}
