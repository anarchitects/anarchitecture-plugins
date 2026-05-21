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

export function invalidWorkspaceConfigDiagnostic(
  path: string,
  message: string
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_workspace_config',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function unsupportedWorkspaceFormatDiagnostic(
  path: string,
  message: string
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.unsupported_workspace_format',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function noWorkspacePackagesFoundDiagnostic(
  patterns: readonly string[]
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.no_workspace_packages_found',
    message: 'Workspace patterns did not resolve to any package roots.',
    source: DIAGNOSTIC_SOURCE,
    details: {
      patterns: [...patterns],
    },
  };
}

export function invalidTsConfigDiagnostic(
  path: string,
  message: string
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_tsconfig',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function invalidTsConfigExtendsDiagnostic(
  path: string,
  message: string
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_tsconfig_extends',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function circularTsConfigExtendsDiagnostic(
  path: string,
  chain: readonly string[]
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.circular_tsconfig_extends',
    message: 'Circular tsconfig extends chain detected.',
    source: DIAGNOSTIC_SOURCE,
    path,
    details: {
      chain: [...chain],
    },
  };
}

export function invalidPathAliasDiagnostic(
  path: string,
  message: string
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_path_alias',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
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
