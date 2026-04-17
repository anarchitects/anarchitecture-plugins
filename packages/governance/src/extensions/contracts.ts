import {
  GovernanceProfile,
  GovernanceWorkspace,
  Measurement,
  Violation,
} from '../core/index.js';
import { AdapterWorkspaceSnapshot } from '../nx-adapter/types.js';
import { GovernanceSignal } from '../signal-engine/index.js';

export interface GovernanceExtensionHostContext {
  workspaceRoot: string;
  profileName: string;
  options: Readonly<Record<string, unknown>>;
  snapshot: AdapterWorkspaceSnapshot;
  inventory: GovernanceWorkspace;
}

export interface GovernanceExtensionDefinition {
  id: string;
  register(host: GovernanceExtensionHost): void | Promise<void>;
}

export interface GovernanceExtensionHost {
  readonly context: GovernanceExtensionHostContext;
  registerEnricher(enricher: GovernanceWorkspaceEnricher): void;
  registerRulePack(rulePack: GovernanceRulePack): void;
  registerSignalProvider(signalProvider: GovernanceSignalProvider): void;
  registerMetricProvider(metricProvider: GovernanceMetricProvider): void;
}

export interface GovernanceExtensionExecutionInput {
  workspace: GovernanceWorkspace;
  profile: GovernanceProfile;
  context: GovernanceExtensionHostContext;
}

export type GovernanceWorkspaceEnricherInput =
  GovernanceExtensionExecutionInput;

export type GovernanceRulePackInput = GovernanceExtensionExecutionInput;

export interface GovernanceSignalProviderInput
  extends GovernanceExtensionExecutionInput {
  violations: Violation[];
  signals: GovernanceSignal[];
}

export interface GovernanceMetricProviderInput
  extends GovernanceExtensionExecutionInput {
  signals: GovernanceSignal[];
  measurements: Measurement[];
  violations: Violation[];
}

export interface GovernanceWorkspaceEnricher {
  enrichWorkspace(
    input: GovernanceWorkspaceEnricherInput
  ): GovernanceWorkspace | Promise<GovernanceWorkspace>;
}

export interface GovernanceRulePack {
  evaluate(input: GovernanceRulePackInput): Violation[] | Promise<Violation[]>;
}

export interface GovernanceSignalProvider {
  provideSignals(
    input: GovernanceSignalProviderInput
  ): GovernanceSignal[] | Promise<GovernanceSignal[]>;
}

export interface GovernanceMetricProvider {
  provideMetrics(
    input: GovernanceMetricProviderInput
  ): Measurement[] | Promise<Measurement[]>;
}
