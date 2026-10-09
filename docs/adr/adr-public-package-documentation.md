# ADR: Public package documentation policy

## Status

Proposed

## Context

Users discover packages through npm, GitHub, and package search results. A package README is often their first and only source for deciding whether a package fits their needs and how to use it. Documentation quality is therefore part of package quality and release readiness.

All packages in `anarchitects/anarchitecture-plugins` are Nx plugins. Users need a consistent standard across the package set, independent of which plugin they discover first. Internal engineering notes, implementation history, or repository-specific assumptions cannot substitute for installation and usage guidance.

A repository-wide policy makes this expectation durable for existing and future plugins rather than dependent on a particular package, feature, or release.

## Decision

Every publishable Nx plugin/package must have its own public-facing `README.md`. This policy applies across the entire current package set and to every future package in this repository. The README is part of the supported public package experience and must be suitable for npm and GitHub users without access to contributor discussions or a repository checkout.

### Required README content

Each package README must cover:

- **Purpose and scope:** what the plugin does, who it is for, and when to use it.
- **Installation:** the published package name, supported installation commands including the `nx add` path, and required initialization or configuration.
- **Compatibility and prerequisites:** supported Nx, Node.js, framework, and relevant peer dependency versions, plus platform requirements and limitations.
- **Quick start:** a minimal, complete path from installation to a working result, with commands, required configuration, and the expected outcome.
- **Usage:** the primary workflows, configuration options, defaults, and precedence rules that affect users.
- **Public surface:** available generators and their options, executors where provided, inferred targets and their discovery conventions, and any other supported public entry points. Clearly distinguish plugin-provided behavior from upstream tooling and describe only surfaces the package actually offers.
- **Examples:** practical, copyable examples for common use cases and supported modes, using public commands and imports.
- **Troubleshooting and common cases:** common setup failures, actionable remedies, important limitations, and how to obtain support.
- **Ownership and boundaries:** what the plugin owns, what Nx or upstream frameworks/tools own, what the consumer must configure, and which optional integrations or companion packages are needed. Explain these boundaries in terms of user choices and observable behavior.

Section names and depth may fit the package, but none of these applicable topics may be silently omitted. A package without a particular surface, such as custom executors, should make its supported alternative clear. Shared compatibility tables and detailed public API references may be linked, but links must work from npm and GitHub and the README must remain sufficient to install and complete the quick start.

### Public documentation boundaries

Package READMEs and supporting package-facing documentation must describe the supported package as users consume it. They must not read like engineering notes or contain:

- PR/issue chronology, epic/subissue language, or implementation progress reports
- internal implementation history, abandoned approaches, or delivery sequencing
- test fixture details or repository-only validation instructions
- source-internal architecture, helper modules, private imports, or contributor implementation constraints unless they are explicitly part of the supported public API contract

Internal rationale, contributor constraints, fixture instructions, and historical records belong in contributor or architecture documentation. A short link to such material is acceptable; following it must not be necessary for ordinary package use. A support link is not a substitute for troubleshooting guidance.

Document public ownership boundaries and architectural guarantees where they help consumers select, configure, or compose packages. Describe current supported behavior accurately; do not present planned functionality as available. User-facing migration guidance should explain actions and compatibility effects, without recounting internal delivery history.

### Enforcement expectations

- New publishable packages must ship a compliant package README before they are considered release-ready. A repository root README, generated placeholder, or link-only stub does not satisfy this requirement.
- Material changes to the public API or behavior must update the README in the same PR, including changes to generators, executors, inference, configuration, defaults, compatibility, and ownership boundaries. Related public examples and references must remain consistent.
- Authors must check the documentation against the package's actual supported commands and public surface. Reviewers must assess completeness, usable examples, working links, and the separation of consumer guidance from engineering notes before approving affected changes.
- Release validation must verify that the intended package-specific README is present and current in the actual packed artifact and is published with the package where applicable. Check the publish output after any build/copy transformations, not merely the source tree; a missing, stale, or wrong-package README must block release readiness.
- Existing packages are in scope. Maintainers must address documentation gaps as part of preparing affected packages for release; prior publication is not an exemption.
- Maintainers may automate structural and packaging checks, but human review remains necessary for accuracy and usability. Until automated checks exist, PR review and release validation must perform these checks explicitly.

## Consequences

### Positive

- Package discovery through npm and GitHub leads to actionable installation and usage guidance across the entire plugin set.
- Consumers can understand compatibility and ownership boundaries without learning repository internals.
- Documentation evolves with the public contract, and artifact validation prevents a correct source README from being lost or replaced during publication.

### Negative / trade-offs

- Authors and reviewers must budget documentation work alongside public changes, including improvements to existing READMEs.
- Examples, compatibility statements, and linked references require ongoing maintenance.
- Releases may be delayed by incomplete documentation or incorrect packaging even when implementation checks pass.

## Implementation notes

Apply this policy through package creation, PR review, and release validation. This ADR establishes the requirements; adopting it does not by itself certify existing READMEs or introduce automated checks. Package documentation improvements and any automation should be implemented in focused follow-up changes.
