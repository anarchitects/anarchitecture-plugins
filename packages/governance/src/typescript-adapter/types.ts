import type { GovernanceDiagnostic } from '../core/index.js';

export type TypeScriptWorkspaceDetectionStatus =
  | 'supported'
  | 'partial'
  | 'unsupported';

export interface TypeScriptWorkspaceIndicators {
  packageJson: boolean;
  pnpmWorkspace: boolean;
  packageManagerWorkspaces: boolean;
  tsconfig: boolean;
  tsconfigBase: boolean;
}

export interface TypeScriptWorkspaceDetectionDiagnostic
  extends GovernanceDiagnostic {
  path?: string;
}

export interface TypeScriptWorkspaceDetectionResult {
  status: TypeScriptWorkspaceDetectionStatus;
  supported: boolean;
  workspaceRoot: string;
  indicators: TypeScriptWorkspaceIndicators;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export type TypeScriptWorkspacePackageManager = 'pnpm' | 'npm' | 'yarn';

export interface WorkspacePackageResolution {
  packageManager?: TypeScriptWorkspacePackageManager;
  workspaceRoot: string;
  patterns: string[];
  packageRoots: string[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}
