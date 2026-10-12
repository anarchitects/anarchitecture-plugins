# Repository application: anarchitecture-plugins

Reviewed 2026-10-11 against branch `docs/adr-modern-angular-22`, starting commit `f2616b6d0c3b8dacf10bcd29c5de722cd140e712`. This inventory complements the [common guide](README.md); it does not replace reading every ADR in full. Re-enumerate ADRs when the branch changes.

## Actual baseline and scope

Nx 23.2.0; TypeScript 6.0.3; Yarn 4.17.0; no root Angular runtime dependency.

Apply Angular defaults to supported generated Angular output and migrations. The plugin runtime remains Node/Nx tooling. Preserve inference-first createNodesV2 behavior, current Nx API conventions, idempotent init and narrow host integration.

Test generator/migration idempotency and packed consumers in supported workspaces before claiming runtime support. The historical Nest generation proposal is not the revived plugin contract: do not advertise unimplemented generators. Keep consumer package READMEs distinct from internal guides.

## Complete local ADR inventory

All 3 records below were read. Status labels are preserved; a proposed amendment within an accepted record does not automatically become accepted.

| Record                                                                                            | Status at review                                                          | Constraint on this guide                                                                            |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [ADR: Nest generation strategy for @anarchitects/nest](../../adr/adr-nest-generation-strategy.md) | Historical proposal; not the implemented contract for the revived plugin. | Historical proposal is not the implemented Nest plugin API; preserve inference and idempotent init. |
| [ADR: Public package documentation policy](../../adr/adr-public-package-documentation.md)         | Proposed                                                                  | Consumer package documentation must not claim historical proposed features are shipped.             |
| [ADR: Modern Angular 22 and Signal Forms](../../adr/modern-angular-22-signal-forms.md)            | Accepted (maintainer approval 2026-10-11)                                 | Accepted on 2026-10-11; adds source/API traceability and preserves local release gates.             |

## Application gates

Apply A01–A12 only to the relevant Angular implementation/consumer scope. The [traceability matrix](traceability.md) covers the source chapters independently of whether this repository currently implements a topic. “Not currently applicable” is a scope decision, not permission to skip reading local ADRs.

Before implementation, inspect package-level peers and exports, applicable agent instructions, existing tests and resolved build targets. Before a release, validate the consumer and documented support range; a root dependency alone does not establish every package's compatibility. This change modifies documentation and agent instructions only. No runtime manifest, lockfile, public package API or release artifact is changed.
