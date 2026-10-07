// SPDX-License-Identifier: MIT
import { basename } from 'node:path';
import { treePath, type TreeSnapshot } from './tree-snapshot';

export interface AdditiveTransform {
  /** Create a missing file; existing bytes can only be retained identically. */
  createFile(path: string, content: string | Buffer): void;
  /** Add missing keys to Nx metadata, preserving all existing values. */
  addJsonProperties(path: string, properties: Record<string, unknown>): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeAdditions(
  current: Record<string, unknown>,
  additions: Record<string, unknown>,
  path: string
): void {
  for (const [key, value] of Object.entries(additions)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new Error(`Unsafe metadata key: ${key}`);
    if (!Object.prototype.hasOwnProperty.call(current, key))
      current[key] = value;
    else if (isObject(current[key]) && isObject(value))
      mergeAdditions(current[key], value, `${path}.${key}`);
    else if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      throw new Error(
        `Nx post-processing cannot replace existing metadata: ${path}.${key}`
      );
    }
  }
}

/** No raw Tree access: post-processing cannot patch or delete Nest's templates. */
export function additiveTransform(snapshot: TreeSnapshot): AdditiveTransform {
  return {
    createFile(path, content) {
      path = treePath(path);
      const next = Buffer.from(content);
      const previous = snapshot.get(path);
      if (previous && !previous.equals(next))
        throw new Error(`Nx post-processing cannot overwrite ${path}`);
      snapshot.set(path, next);
    },
    addJsonProperties(path, properties) {
      path = treePath(path);
      if (
        !['nx.json', 'project.json', 'package.json'].includes(basename(path))
      ) {
        throw new Error(
          `Nx post-processing cannot modify Nest configuration or source: ${path}`
        );
      }
      const previous = snapshot.get(path);
      const current: unknown = previous
        ? JSON.parse(previous.toString('utf8'))
        : {};
      if (!isObject(current) || !isObject(properties))
        throw new Error(`Expected JSON objects for ${path}`);
      const before = JSON.stringify(current);
      mergeAdditions(current, structuredClone(properties), path);
      if (previous && before === JSON.stringify(current)) return;
      snapshot.set(path, Buffer.from(`${JSON.stringify(current, null, 2)}\n`));
    },
  };
}
