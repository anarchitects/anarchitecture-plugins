// SPDX-License-Identifier: MIT
export interface ConfigurationGeneratorSchema {
  project?: string;
  directory?: string;
  language?: 'ts' | 'js';
  collection?: string;
}
