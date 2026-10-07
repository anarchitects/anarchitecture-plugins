// SPDX-License-Identifier: MIT
export interface DecoratorGeneratorSchema {
  skipInstall?: boolean;
  name: string;
  path?: string;
  language?: string;
  sourceRoot?: string;
  flat?: boolean;
  format?: boolean;
  project?: string;
  nestProject?: string;
}
