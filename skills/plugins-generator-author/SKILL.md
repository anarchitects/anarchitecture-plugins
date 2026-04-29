---
name: plugins-generator-author
description: implement and refactor code in anarchitecture-plugins. use when work belongs specifically in the nx plugins repo, especially for generators, executors, project crystal inference, package documentation, tests for plugin behavior, and preserving the repo principles around thin executors, idempotent generators, and backward-compatible plugin evolution.
---

# Overview
Use this skill when the task belongs in `anarchitecture-plugins`.

Before changing code, inspect these repo files when relevant:

- `AGENTS.md`
- `README.md`
- affected package `README.md`
- plugin package source under `packages/`

## Core implementation rules
- Prefer inference (`createNodesV2`) when behavior can be derived from conventions.
- Keep executors thin, deterministic, and tool-adapter focused.
- Keep generators idempotent, minimal, and non-destructive.
- Preserve backward compatibility first; when behavior changes, include migration support and docs.
- Ship tests and docs with every user-facing change.

## Required workflow
1. Identify the target plugin package under `packages/`.
2. Determine whether the task belongs in generator, executor, inference, shared utility, or docs.
3. Implement the smallest coherent change.
4. Add or update tests for generator, executor, or inference behavior.
5. Validate using package-manager-prefixed Nx commands.
6. Summarize the changed plugin surface, validation, and any migration implications.

## Generator-specific guidance
- Do not overwrite existing config destructively.
- Merge configuration and preserve user changes where possible.
- Keep defaults architecture-aware and convention-first.

## Output expectations
In the final summary, explicitly report:
- affected plugin package
- whether generators, executors, or inference behavior changed
- whether backward compatibility is preserved
- whether migration logic or docs updates are required
