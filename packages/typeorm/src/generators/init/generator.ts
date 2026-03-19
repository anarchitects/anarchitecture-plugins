import {
  addDependenciesToPackageJson,
  formatFiles,
  Tree,
  updateJson,
  type GeneratorCallback,
} from '@nx/devkit';

interface InitGeneratorSchema {
  skipFormat?: boolean;
  skipInstall?: boolean;
}

interface NxJson {
  plugins?: Array<
    string | { plugin: string; options?: Record<string, unknown> }
  >;
}

const TYPEORM_PLUGIN_NAME = '@anarchitects/nx-typeorm';

export default async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {}
): Promise<GeneratorCallback> {
  ensureNxPluginRegistration(tree);

  const dependencyTask = addDependenciesToPackageJson(
    tree,
    {
      typeorm: '^0.3.28',
      'reflect-metadata': '^0.2.2',
    },
    {}
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  if (options.skipInstall) {
    return () => undefined;
  }

  return dependencyTask;
}

function ensureNxPluginRegistration(tree: Tree): void {
  updateJson<NxJson>(tree, 'nx.json', (json) => {
    const plugins = Array.isArray(json.plugins) ? [...json.plugins] : [];
    const alreadyRegistered = plugins.some((entry) =>
      typeof entry === 'string'
        ? entry === TYPEORM_PLUGIN_NAME
        : entry.plugin === TYPEORM_PLUGIN_NAME
    );

    if (!alreadyRegistered) {
      plugins.push({ plugin: TYPEORM_PLUGIN_NAME });
    }

    return {
      ...json,
      plugins,
    };
  });
}
