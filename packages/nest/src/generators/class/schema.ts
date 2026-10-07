// SPDX-License-Identifier: MIT
export interface ClassGeneratorSchema {
  skipInstall?: boolean;
  name: string;
  flat?: boolean;
  spec?: boolean;
  specFileSuffix?: string;
  path?: string;
  language?: string;
  sourceRoot?: string;
  className?: string;
  format?: boolean;
  project?: string;
  nestProject?: string;
}
