// SPDX-License-Identifier: MIT
import type { HttpPlatform } from '../../utils/http-platform';
/** Native application options; defaults and validation belong to Nest's schema. */
export interface ApplicationGeneratorSchema {
  /** Explicit HTTP adapter overlay; omission retains native Nest behavior. */
  platform?: HttpPlatform;
  skipInstall?: boolean;
  name: string | number;
  directory?: string;
  author?: string;
  description?: string;
  strict?: boolean;
  version?: string;
  type?: 'esm' | 'cjs';
  language?: string;
  packageManager?: string;
  dependencies?: string;
  devDependencies?: string;
  spec?: boolean;
  specFileSuffix?: string;
  format?: boolean;
  observe?: boolean;
  minimal?: boolean;
}
