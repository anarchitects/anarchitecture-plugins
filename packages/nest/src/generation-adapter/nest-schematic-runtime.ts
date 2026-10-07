// SPDX-License-Identifier: MIT
import * as core from '@angular-devkit/core';
import * as schematics from '@angular-devkit/schematics';
import * as tools from '@angular-devkit/schematics/tools';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as rxjs from 'rxjs';
import { satisfies } from 'semver';

// Deliberately exclude upgrade/update: migration rules can have host side effects.
export const nativeSchematicNames = [
  'application',
  'sub-app',
  'library',
  'configuration',
  'class',
  'controller',
  'decorator',
  'filter',
  'gateway',
  'guard',
  'interceptor',
  'interface',
  'middleware',
  'module',
  'pipe',
  'provider',
  'service',
  'resolver',
  'resource',
] as const;
export type NativeSchematicName = (typeof nativeSchematicNames)[number];

interface CollectionEntry {
  factory: string;
  aliases?: string[];
}

/** Load only the official stable collection with native ESM import(). */
export async function loadNestSchematicRuntime() {
  let manifestPath: string;
  try {
    manifestPath = require.resolve('@nestjs/schematics/package.json');
  } catch (cause) {
    throw new Error(
      'Cannot resolve stable @nestjs/schematics v12. Reinstall @anarchitects/nest and its dependencies.',
      { cause }
    );
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!satisfies(manifest.version, '>=12.0.0 <13')) {
    throw new Error(
      `Nest generation requires stable @nestjs/schematics v12; found ${manifest.version}.`
    );
  }
  const nestRequire = createRequire(manifestPath);
  for (const name of [
    '@nestjs/schematics',
    '@angular-devkit/core',
    '@angular-devkit/schematics',
  ]) {
    const dependency = JSON.parse(
      readFileSync(nestRequire.resolve(`${name}/package.json`), 'utf8')
    );
    if (
      dependency.engines?.node &&
      !satisfies(process.versions.node, dependency.engines.node)
    ) {
      throw new Error(
        `Nest generation with ${name}@${dependency.version} requires Node ${dependency.engines.node}; found ${process.versions.node}.`
      );
    }
  }
  const collectionPath = resolve(dirname(manifestPath), manifest.schematics);
  const collection: { schematics: Record<string, CollectionEntry> } =
    JSON.parse(readFileSync(collectionPath, 'utf8'));
  const factories = new Map<
    string,
    { ref: schematics.RuleFactory<object>; path: string }
  >();
  const aliases = new Map<string, NativeSchematicName>();
  for (const name of nativeSchematicNames) {
    const entry = collection.schematics[name];
    if (!entry)
      throw new Error(`Stable Nest collection is missing schematic ${name}.`);
    const [request, exportName = 'default'] = entry.factory.split('#');
    const factoryPath = nestRequire.resolve(
      resolve(dirname(collectionPath), request)
    );
    // Keep native import() in the compiled CommonJS output (NodeNext). This also
    // supports ESM factories with asynchronous module initialization.
    const module = await import(pathToFileURL(factoryPath).href);
    const ref = module[exportName];
    if (typeof ref !== 'function')
      throw new Error(`Invalid Nest schematic factory: ${entry.factory}`);
    factories.set(entry.factory, { ref, path: factoryPath });
    aliases.set(name, name);
    for (const alias of entry.aliases ?? []) aliases.set(alias, name);
  }
  class NestEngineHost extends tools.NodeModulesEngineHost {
    protected override _resolveCollectionPath(name: string): string {
      if (name !== '@nestjs/schematics')
        throw new Error(
          `External schematic collections are not supported: ${name}`
        );
      return collectionPath;
    }
    protected override _resolveReferenceString(reference: string) {
      const factory = factories.get(reference);
      if (!factory)
        throw new Error(
          `Schematic is outside the native generation surface: ${reference}`
        );
      return factory;
    }
  }
  const host: tools.NodeModulesEngineHost = new NestEngineHost();
  return {
    core,
    schematics,
    tools,
    rxjs,
    host,
    aliases,
    version: manifest.version as string,
  };
}
