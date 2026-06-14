# Standalone Profile Compatibility

## Contract

The standalone `agov` CLI and Nx Governance do not currently consume the same
profile file contract.

The compatibility rule is intentional:

- Standalone CLI profile files use the standalone full-profile contract.
- Existing Nx Governance runtime profile files under
  `tools/governance/profiles/*.json` remain Nx-oriented override files.
- The standalone CLI rejects Nx runtime profile files deterministically.

This keeps the standalone host explicit and avoids partial compatibility with
Nx-only runtime concepts that the standalone CLI does not apply today, such as
`projectOverrides` and runtime exception handling.

## Why They Differ

The standalone CLI loads an explicit JSON file and expects a complete
Core-facing `GovernanceProfile` input with fields such as:

- `name`
- `boundaryPolicySource`
- `layers`
- `allowedDomainDependencies`
- `ownership`
- `health`
- `metrics`

Nx Governance runtime profiles are different. They behave as override files
merged onto built-in presets and may contain Nx-runtime-specific fields such
as:

- `projectOverrides`
- `exceptions`
- `eslint`
- legacy metric weight keys such as `architecturalEntropyWeight`

Those files rely on Nx-side preset resolution and override merging. The
standalone CLI does not perform that compatibility merge.

## Supported Standalone Profile Format

Use the standalone profile contract documented in
[standalone-cli-usage.md](./standalone-cli-usage.md).

Minimal example:

```json
{
  "name": "standalone-demo",
  "boundaryPolicySource": "profile",
  "layers": ["app", "domain", "infra"],
  "allowedDomainDependencies": {
    "*": ["shared"]
  },
  "ownership": {
    "required": true
  },
  "health": {
    "statusThresholds": {
      "goodMinScore": 90,
      "warningMinScore": 75
    }
  },
  "metrics": {
    "ownership-coverage": 0.3,
    "layer-integrity": 0.8,
    "domain-integrity": 0.6,
    "documentation-completeness": 0.1,
    "dependency-complexity": 0.4,
    "architectural-entropy": 0.5
  }
}
```

## Rejected Nx Runtime Profile Example

This existing Nx Governance profile shape is intentionally rejected by the
standalone CLI:

```json
{
  "boundaryPolicySource": "eslint",
  "layers": ["app", "feature", "ui", "data-access", "util"],
  "metrics": {
    "architecturalEntropyWeight": 0.2
  },
  "projectOverrides": {
    "nx-governance": {
      "documentation": true
    }
  }
}
```

## Deterministic Validation Behavior

When the standalone CLI is pointed at an Nx Governance runtime profile file, it
returns `agov.cli.invalid_profile` and includes deterministic issues such as:

- `governance.profile.unsupported_nx_runtime_profile`
- `governance.profile.unknown_field`
- `governance.profile.missing_required_field`

Example symptoms:

- `Profile name is required.`
- `Unknown field "projectOverrides" is not allowed.`

## Practical Guidance

Use standalone profiles when:

- you are running `agov` outside Nx
- you want an explicit full-profile document
- you are using the generic manual workspace input flow

Canonical ownership semantics are owned by Community Governance. Nx Governance
may surface Nx ownership evidence such as CODEOWNERS, but it does not define a
plugin-specific canonical ownership field contract.

Use Nx Governance runtime profiles when:

- you are running the Nx integration
- you rely on built-in preset defaults plus override merging
- you rely on Nx-runtime profile fields such as `projectOverrides`

## Current MVP Limitation

The standalone CLI does not currently provide an automatic migration or
compatibility normalization layer for Nx runtime profile files.

That limitation is explicit, tested, and documented so future work can change
it deliberately rather than accidentally.
