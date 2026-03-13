export interface AdapterProject {
  name: string;
  root: string;
  type: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface AdapterDependency {
  source: string;
  target: string;
  type: string;
  sourceFile?: string;
}

export interface AdapterWorkspaceSnapshot {
  root: string;
  projects: AdapterProject[];
  dependencies: AdapterDependency[];
  codeownersByProject: Record<string, string[]>;
}
