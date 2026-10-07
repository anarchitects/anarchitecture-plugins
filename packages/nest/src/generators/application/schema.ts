// SPDX-License-Identifier: MIT
/** Native application options; defaults and validation belong to Nest's schema. */
export interface ApplicationGeneratorSchema {
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
}
