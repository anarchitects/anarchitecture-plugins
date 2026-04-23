---
name: monitor-ci
description: troubleshoot ci, workflow, build, test, lint, nx packaging, generator, executor, inference, or release failures in anarchitecture-plugins. use when a github action, nx target, plugin test, or package validation flow fails and the task is specifically about diagnosing and fixing that repo while preserving deterministic plugin behavior and backward compatibility.
---

# Overview
Use this skill when CI or automation is failing in `anarchitecture-plugins`.

Inspect these sources first when relevant:

- workflow logs and failed job output
- `AGENTS.md`
- `README.md`
- affected plugin `README.md`

## Required workflow
1. Identify the failing workflow, job, package, and Nx target.
2. Reduce the failure to the smallest reproducible command.
3. Fix the root cause while preserving plugin design principles.
4. Validate with package-manager-prefixed Nx commands.
5. Summarize the root cause, fix, validation, and any migration or compatibility implications.

## Repo-specific checks
- Do not bypass tests or inference behavior just to make CI green.
- Keep executors thin and deterministic.
- Keep generators idempotent and non-destructive.
- If the fix changes user-facing plugin behavior, say whether migration support and docs updates are required.
