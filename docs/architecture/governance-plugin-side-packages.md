# Governance Plugin-Side Package Architecture

This document captures plugin-side package boundaries and composition details that are intentionally kept out of package README files.

## Package Relationship

```mermaid
flowchart TD
  A[@anarchitects/nx-governance]
  B[@anarchitects/governance-adapter-nx]
  C[@anarchitects/governance-core]
  D[@anarchitects/governance-extension-nx]

  A --> B
  B --> C
  A --> C
  D --> C
```

## Boundary Summary

### @anarchitects/nx-governance

- Nx-facing host package.
- Owns plugin inference, generators, executors, extension loading, and output orchestration.
- Must not duplicate adapter extraction or core evaluation internals.

### @anarchitects/governance-adapter-nx

- Extracts Nx workspace/project graph facts.
- Produces canonical adapter results and capability signals.
- Must not own host orchestration, executor/generator concerns, or rendering concerns.

### @anarchitects/governance-extension-nx

- Extension boundary for Nx-specific governance interpretation.
- Uses Governance Core extension contracts.
- Must not own extraction, host orchestration, rendering, or Nx plugin command surfaces.

## Host Composition Expectations

- The Nx host composes adapter data and extension registrations with Governance Core contracts.
- Adapter capability signals are used by extensions as optional context for ecosystem-specific intelligence.
- Public APIs should remain package-oriented and avoid leaking internal source layout.
