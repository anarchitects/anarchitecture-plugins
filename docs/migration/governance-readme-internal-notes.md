# Governance README Internal Notes

This document tracks internal documentation placement for information removed from public-facing package README files.

## Scope

Applies to plugin-side Governance packages:

- @anarchitects/nx-governance
- @anarchitects/governance-adapter-nx
- @anarchitects/governance-extension-nx

## Why This Exists

Package README files are public-facing product documentation for Nx users, package consumers, and repository visitors. Internal implementation context that is useful for maintainers is captured in docs/architecture and docs/migration instead of package README files.

## Internal Detail Placement

- Architecture and package boundaries: docs/architecture/governance-plugin-side-packages.md
- Migration-oriented notes and packaging conventions: this file and other docs/migration records

## README Rules For These Packages

- Keep package README files focused on purpose, usage, public API, and package relationships.
- Exclude issue references, sequencing notes, cleanup history, and implementation timeline details.
- Keep ownership boundaries explicit so package responsibilities remain clear for contributors and consumers.
