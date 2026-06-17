import type { GovernanceDiagnostic } from '@anarchitects/governance-core';

export interface AdapterProject {
  name: string;
  root: string;
  sourceRoot?: string;
  type: string;
  tags?: string[];
  nxTags?: string[];
  targets?: string[];
  implicitDependencies?: string[];
  metadata: Record<string, unknown>;
}

export interface AdapterDependency {
  source: string;
  target: string;
  type: string;
  sourceFile?: string;
  metadata?: Record<string, unknown>;
}

export interface AdapterWorkspaceSnapshot {
  root: string;
  projects: AdapterProject[];
  dependencies: AdapterDependency[];
  codeownersByProject: Record<string, string[]>;
  governanceProfileFiles?: string[];
  diagnostics?: GovernanceDiagnostic[];
}
