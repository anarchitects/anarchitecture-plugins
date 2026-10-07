// SPDX-License-Identifier: MIT
export interface InterfaceGeneratorSchema {
  skipInstall?: boolean;
  name: string;
  path?: string;
  sourceRoot?: string;
  flat?: boolean;
  format?: boolean;
  project?: string;
  nestProject?: string;
}
