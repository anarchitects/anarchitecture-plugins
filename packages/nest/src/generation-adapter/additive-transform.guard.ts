// TODO(#116): define additive-only enforcement once transform behavior is implemented.
export interface AdditiveTransformGuardContext {
  readonly targetRoot: string;
  readonly touchedFiles: readonly string[];
}

export interface AdditiveTransformGuardResult {
  readonly allowed: boolean;
  readonly reason?: string;
}
