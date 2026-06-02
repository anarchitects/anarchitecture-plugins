import type { GovernanceDiagnostic } from '@anarchitects/governance-core';

export interface AdapterProject {
  name: string;
  root: string;
  type: string;
  tags?: string[];
  targets?: string[];
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
  diagnostics?: GovernanceDiagnostic[];
}
