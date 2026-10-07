// SPDX-License-Identifier: MIT
export interface FilterGeneratorSchema {
  skipInstall?: boolean;
  name: string;
  path?: string;
  language?: string;
  sourceRoot?: string;
  flat?: boolean;
  spec?: boolean;
  specFileSuffix?: string;
  format?: boolean;
  project?: string;
  nestProject?: string;
}
