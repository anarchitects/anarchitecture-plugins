// SPDX-License-Identifier: MIT
export interface ResourceGeneratorSchema {
  skipInstall?: boolean;
  name: string;
  project?: string;
  nestProject?: string;
  path?: string;
  sourceRoot?: string;
  language?: string;
  flat?: boolean;
  spec?: boolean;
  specFileSuffix?: string;
  type?:
    | 'rest'
    | 'graphql-code-first'
    | 'graphql-schema-first'
    | 'microservice'
    | 'ws';
  skipImport?: boolean;
  crud?: boolean;
  format?: boolean;
}
