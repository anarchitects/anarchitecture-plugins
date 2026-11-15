// SPDX-License-Identifier: MIT
import type { PackageManifest } from './validate-dependencies';

/** Complete native loader/checker peers without replacing consumer declarations. */
export function missingNativeToolPeers(
  manifest: PackageManifest
): Record<string, string> {
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };
  return !declared.webpack &&
    (declared['ts-loader'] || declared['fork-ts-checker-webpack-plugin'])
    ? { webpack: '^5.105.4' }
    : {};
}
