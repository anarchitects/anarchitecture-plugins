// SPDX-License-Identifier: MIT
export interface ModuleGeneratorSchema {
  skipInstall?: boolean;
  name: string;
  path?: string;
  module?: string;
  language?: string;
  sourceRoot?: string;
  skipImport?: boolean;
  flat?: boolean;
  format?: boolean;
  project?: string;
  nestProject?: string;
}
