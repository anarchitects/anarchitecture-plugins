import type {
  TypeScriptWorkspaceDetectionDiagnostic,
  TypeScriptWorkspaceIndicators,
} from './types.js';

const DIAGNOSTIC_SOURCE = 'governance.typescript_adapter';

export function invalidPackageJsonDiagnostic(
  filePath: string
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_json',
    message: `Failed to parse package.json file "${filePath}".`,
    source: DIAGNOSTIC_SOURCE,
    path: '/package.json',
  };
}

export function partialWorkspaceDetectionDiagnostic(
  indicators: TypeScriptWorkspaceIndicators
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.partial_workspace_detection',
    message:
      'Repository has TypeScript or JavaScript indicators but no explicit workspace-manager indicator.',
    source: DIAGNOSTIC_SOURCE,
    details: {
      detectedIndicators: detectedIndicators(indicators),
    },
  };
}

export function noWorkspaceIndicatorsDiagnostic(): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.no_workspace_indicators',
    message:
      'Repository does not contain supported TypeScript or JavaScript workspace indicators.',
    source: DIAGNOSTIC_SOURCE,
  };
}

function detectedIndicators(
  indicators: TypeScriptWorkspaceIndicators
): string[] {
  const detected: string[] = [];

  if (indicators.packageJson) {
    detected.push('packageJson');
  }

  if (indicators.pnpmWorkspace) {
    detected.push('pnpmWorkspace');
  }

  if (indicators.packageManagerWorkspaces) {
    detected.push('packageManagerWorkspaces');
  }

  if (indicators.tsconfig) {
    detected.push('tsconfig');
  }

  if (indicators.tsconfigBase) {
    detected.push('tsconfigBase');
  }

  return detected;
}
