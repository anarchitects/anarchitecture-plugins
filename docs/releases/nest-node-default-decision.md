# Native Node default activation review

**Accepted disposition: defer a plugin-owned Node default; align with Nest's native default.**
This is the decision review for [#615](https://github.com/anarchitects/anarchitecture-plugins/issues/615)
under [#607](https://github.com/anarchitects/anarchitecture-plugins/issues/607),
dated **16 November 2026**, against Plugins `29fabda` and Meta
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd`.

Keep native Express behavior when no effective platform option is supplied.
Explicit Node, Express and Fastify generation remains available within the
documented candidate matrix. No version or generator is approved for a new
Node default by this review, and existing applications remain unchanged.

**Review owner: Johan**, Nx Plugins capability owner and technical maintainer,
per the [ownership register](https://github.com/anarchitects/anarchitecture-meta/blob/4f0339d86f0ebfa073173ad307cb67c8d6042bdd/docs/ownership.md).
**Accepted by Johan on 16 November 2026:** deferring Node-default activation and
aligning with Nest is a continuing principle, not only a temporary response to
missing evidence. It is recorded in the
[HTTP scaffolding ADR](../adr/adr-nest-http-platform-scaffolding.md#default-alignment-principle--2026-11-16-accepted).
The plugin follows the native default of its supported Nest version; it does not
switch ahead of Nest. Explicit choices and configured Nx defaults remain available.
Adopting a later upstream default is part of a separately verified framework
upgrade, subject to the existing compatibility, evidence and release gates.

## Evidence supporting the outcome

[#614](https://github.com/anarchitects/anarchitecture-plugins/issues/614) is closed
and its [PR #630](https://github.com/anarchitects/anarchitecture-plugins/pull/630)
is merged. At the time of this decision, its local combined validation was pending
because of system-sleep timeouts. The subsequent
[16 November validation record](nest-three-adapter-generation.md#current-candidate-validation)
now supplies 675 passing unit tests and passing evidence for all 110 consumer
cases across the full invocation and an isolated six-case Node 22 rerun after a
port collision. It records the failed full invocation explicitly; CI remains
unverified. Neither these checks nor the earlier #611–#613 evidence establish the
production/default gates below.

| Evidence                                                                                                                                                                 | Established boundary                                                                                                                                                 | Default decision implication                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Generation matrix](../guides/nest-http-consumer-matrix.md#version-and-selection-boundaries), [#611 evidence](../audits/nest-http-consumers-2026-11-15.json)             | All three adapters, independent apps and members, ESM/CJS, all nine owner/member pairs, actual CLI precedence, resources and native tooling across four frozen lanes | Explicit Express/Fastify alternatives exist and have clean-installed evidence; a new omission path still needs its own certification         |
| [HTTP/security conformance](../guides/nest-http-consumer-matrix.md#shared-http-and-security-conformance), [#612 evidence](../audits/nest-http-contracts-2026-11-15.json) | Eight explicit/implicit ESM/CJS consumers and 32 starts; validation, serialization, limits, cookies, CORS/CSRF, guards, raw bodies, headers, proxy trust and HTTPS   | Request-boundary evidence does not certify application sessions, passkeys, policy semantics, rate-limit deployment or SSR                    |
| [Optional capabilities](../guides/nest-http-consumer-matrix.md#optional-http-capabilities), [#613 evidence](../audits/nest-http-capabilities-2026-11-15.json)            | Swagger/schema conversion, bounded memory uploads, static files and EJS in six independent apps                                                                      | Preserve the stated configuration restrictions; optional member/Observe/Rspack composition and broader upload/SSR behavior remain unverified |
| [Library compatibility](../guides/nest-published-library-compatibility.md) and [#585 readiness](nest-published-library-adoption.md)                                      | Nest 12 tooling hosts, bounded Nest 11/12 library peers, existing builds/exports and clean packed consumers                                                          | Default work must retain these independent guarantees and never impose an HTTP adapter on libraries                                          |
| [#614 current validation](nest-three-adapter-generation.md#current-candidate-validation)                                                                                 | Local unit/consumer coverage completed with a documented port-collision rerun; required CI and final release preview remain separate                                 | Retain exact support limits and release gates; local coverage supplies no production/default approval or inferred CI result                  |

The baseline generation lanes use runtime/adapters **12.5.0**, CLI/schematics
**12.0.13**, TypeScript **6.0.3**, Yarn **4.17.0** on Node/Nx
**22.22.3/23.2.0**, **24.21.0/24.0.1**, **26.0.0/24.0.1**, and npm **11.19.1**
on Node **24.21.0** / Nx **24.0.1**. Member generation also admits coherent audited
**12.3.0** owners. Node 22 CJS generated Jest remains unsupported; its build,
real HTTP and lint checks are a different claim. Optional capability evidence is
restricted to the Node 24 Yarn lane. No broader version or platform claim follows.

## Unresolved gates and accountable owners

These gates apply when adopting a framework version with a different native
default; they do not call for a separate plugin-owned default ahead of Nest or
block explicit Node generation. Ownership is
accountability from the central register, not a new implementation assignment or
deadline. The linked issues were read on 16 November 2026; remote CI was not queried.

| Gate                          | Required evidence and remaining work                                                                                                                                                                      | Accountable owner and tracking                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate certification       | Local case coverage recorded in #614 with one isolated rerun; verify required CI and the final release candidate, preserving all compatibility regressions                                                | Johan, Nx Plugins; [#614 readiness](nest-three-adapter-generation.md#current-candidate-validation), parent [#607](https://github.com/anarchitects/anarchitecture-plugins/issues/607)                                                                                                                                                                                                      |
| Production HTTP presentation  | Real application contract conformance, cookie/header/error behavior, raw webhook signatures, validation/redaction, relevant rate limits and optional capabilities; retain supported Fastify behavior      | Johan, Bricks technical maintainer and affected domain owner; [Bricks #506](https://github.com/anarchitects/anarchitecture-bricks-3tier/issues/506), with canonical Contracts ownership preserved                                                                                                                                                                                         |
| Authentication and policy     | Sessions, rotation/revocation, cookie/CSRF/recovery/JWT semantics, passkey challenge/replay/counter/credential handling and fail-closed tenant/field/deny policy parity on the proposed host              | Johan, Auth domain owner; [Bricks #503](https://github.com/anarchitects/anarchitecture-bricks-3tier/issues/503) and [#504](https://github.com/anarchitects/anarchitecture-bricks-3tier/issues/504), coordinated with #506                                                                                                                                                                 |
| SSR behavior                  | Distinct Node bridge, API bypass, GET/HEAD, redirects/cookies, secure assets, null/not-found, host/proxy validation, streaming/backpressure, abort/error cleanup and dependency-isolated packed consumers | Johan, SSR capability owner; [Community #33](https://github.com/anarchitects/anarchitecture-community/issues/33), concrete bridge [#744](https://github.com/anarchitects/anarchitecture-community/issues/744), routing [#745](https://github.com/anarchitects/anarchitecture-community/issues/745), conformance [#43](https://github.com/anarchitects/anarchitecture-community/issues/43) |
| Representative performance    | Comparable application API and SSR workloads, raw repeatable results and all metrics below; none is supplied by the reviewed Plugins evidence or linked runtime gate records                              | Johan coordinates the Nx Plugins, SSR and relevant domain evidence under [#607](https://github.com/anarchitects/anarchitecture-plugins/issues/607) and this #615 review                                                                                                                                                                                                                   |
| Default contract and approval | Exact eligible versions/templates, opt-outs, precedence, dependency policy, breaking-release impact and rollout/rollback accepted for a concrete candidate                                                | Johan, Nx Plugins owner/maintainer; review a framework-adoption follow-up under #607 after the preceding gates                                                                                                                                                                                                                                                                            |

Bricks #506/#503/#504 remain open. Community #744/#745/#43 explicitly record
unstarted implementation and unresolved dependencies; architectural acceptance
of three-adapter SSR in Community PR #746 is not runtime acceptance. Preserve
Community #578's independent Nest-major/Fastify release path and #737's version
policy. Completing entire external epics is not a substitute for the specific
evidence this proposed default needs, nor a blanket prerequisite to releasing
the plugin's explicit selections.

Likewise, completion of every [#508](https://github.com/anarchitects/anarchitecture-plugins/issues/508)
optional Fastify preset is not a gate. If the proposed production default claims
an optional capability, prove that exact configuration or explicitly block that
claim. Do not silently waive Meta ADR-0009's SSR/auth/security gates by describing
a bare-controller result as an API-only default approval. Any narrower proposal
needs an explicit scope decision from the relevant owners.

## Benchmark evidence required for future default adoption

Use the same representative application behavior for native Node and Nest/Fastify.
Include API requests with the actual validation, serialization, authentication,
payload and data-access profile, and SSR requests using the real renderer, assets
and routing. A plain GET throughput test or upstream promotional number does
not meet this gate. SSR measurement awaits the runtime implementation above.

Record source revisions, tarball/lock identities, exact Node/Nest/adapter and
Angular versions where relevant, OS/architecture, CPU model/core allocation,
memory and deployment topology. Hold logging, instrumentation/Observe, TLS/proxy
placement, worker counts, request mix, payloads, keep-alive, cache state and
downstream services constant. Document warm-up, measurement duration, concurrency,
load-generator location/capacity, repeat count, failures and measurement tools.

For each adapter and workload, retain raw samples and report **p50/p95/p99 latency,
requests per second, CPU and peak process memory**, with units and aggregation
method. Explain variability and trade-offs, including correctness under load;
failed requests must not inflate throughput. Agree workload-specific acceptance
thresholds before comparing results. No benchmark result or numeric acceptance
threshold is invented by this review.

## Default contract to resolve before a go decision

The [current selection contract](../guides/nest-three-adapter-generation-contract.md#selection-defaults-and-precedence-contract)
has **no platform schema default**. Explicit CLI options override the invocation
project's defaults, then workspace defaults; fully qualified keys take precedence
within each scope. `app` uses canonical `sub-app` defaults. `--project` selects
the Nest owner, not the invocation project's defaults, and application defaults
do not flow into member defaults. Programmatic calls use their supplied options.
Inference options, target defaults, installed adapters and sibling bootstraps do
not choose a new member's platform.

Explicit `--platform=express` and `--platform=fastify` are the implemented
alternatives for independent apps and members. Removing a configured Node default
currently restores native omission; no `auto`, `native`, `none` or null reset
exists. If the supported Nest version's native default changes, deleting workspace
configuration would no longer restore Express. The approved guidance and real CLI tests must
make that distinction clear, including explicit overrides from a different cwd.

A future framework upgrade that changes the default must resolve these cases:

- **Scope and eligibility:** name the exact released plugin/framework/schematic
  set and whether independent applications, native members or both change. The
  current 12.5.0 fresh-app and 12.3.0/12.5.0 member evidence is a candidate input,
  not approval for every Nest 12.3+ version.
- **Previously valid omission:** explicit platforms reject JavaScript, minimal
  applications and custom member path/rootDir layouts, and impose narrower
  installed-owner checks than native omission. Adding `default: node` alone
  would turn valid native calls into rejections. Specify and test the treatment
  of each existing path, including the absence of a native-reset option; do not
  add an undocumented fallback or assume explicit Express bypasses these checks.
- **Deterministic dependencies:** keep one audited common/core/testing/adapter
  set, preserve compatible owner declarations and shared adapters, and test
  frozen clean installs. Retained Express tooling dependencies are not evidence
  of a dependency-free Node application. No owner upgrade or adapter pruning
  follows from selecting a new member's default.
- **Behavior and regressions:** test omitted, configured and explicit choices
  through the actual Nx CLI, aliases and programmatic entry points; preserve
  ESM/CJS, Observe, resources, existing bootstrap/test bytes, native inference,
  transactional failure and the #585 library contract. Run the new omission
  path's real HTTP/security/capability matrix, not just explicit Node tests.

### Future Nest 13 behavior

The [upstream HTTP adapter guidance](https://docs.nestjs.com/http/performance#choosing-an-adapter)
states an intention to make Node the Nest 13 default while Nest 12 still uses
Express implicitly. This is an upstream plan, not released schematic evidence.
Registry tags checked on 16 November 2026 still identify core **12.5.0** and
schematics **12.0.13** as latest. The plugin remains stable Nest 12-only tooling.

Before adopting stable Nest 13, audit the actual released schematics, dependency
graph, generated bootstrap and HTTP tests, plus the runtime factory default:
unchanged implicit source can select a different adapter under a new major.
Reassess whether an overlay is still needed; retain native template ownership
and reject unsupported shapes rather than copying templates or widening guards
without evidence. Verify explicit Express/Fastify opt-outs independently.
Latest-stable adoption under Meta ADR-0022 does not authorize default activation,
invent a release date or start a previous-major maintenance clock on upstream
publication alone.

## Release, rollout and rollback

This deferral is a non-bumping documentation change. A later change to omitted
generator behavior is a **breaking public behavior change**, even if existing
application files are untouched. Use the exact `nx-nest` Conventional Commit
scope and breaking-change notation; Meta ADR-0013 requires a minor increment
while the package is on 0.x and a major increment on 1.x+. Nx derives the actual
version from the then-current published baseline. #614's additive 0.1.1 preview
is not permission to hide a default change in that candidate or publish it.

The local HTTP scaffolding ADR now records the accepted Nest-alignment principle.
A future framework-adoption decision must identify its actual native default and
the exact approved version/scope. Only after that decision should a separately
authorized implementation follow-up track the changed default's installed-consumer,
release and rollback gates. No independent early Node-default activation is
planned. Any departure from the alignment principle needs an explicit ADR amendment;
a change to ecosystem policy or a waiver belongs with Meta's architecture authority.

Roll out through an explicitly reviewed release and documented new-app selection.
Consumers can pin an explicit supported alternative before upgrading tooling.
Never regenerate existing bootstraps, remove shared dependencies or change
libraries/non-HTTP transports as part of activation. #558 remains tooling adoption,
not an adapter migration.

For future generation rollback, use an explicit supported alternative or restore
the prior plugin and lockfile coherently. That does not undo already generated
Node apps. Reverting those apps requires their own reviewed source/configuration/
dependency checkpoint and tests; preserve later user edits and sibling adapters.
Publication requires Johan's independent capability-owner authorization under
Meta ADR-0017; application deployments and rollbacks retain their App PO authority.
No tag, release, publication, migration or activation is part of this review.

## Preflight and validation

All 25 Meta ADRs at the revision above and all six local ADRs were re-enumerated
and read. The [#613 inventory](../audits/nest-http-capabilities-2026-11-15.json)
still matches. Relevant generation, consumer, library, readiness and ownership
guidance was reviewed. Accepted Meta 0008/0009/0010/0011/0012 govern independence,
default gates, first-party choices, security and canonical contracts;
0013/0016/0017 govern versions and ownership; 0015 governs task evidence; 0022
governs framework lifecycle. The local native-scaffolding decisions remain binding.

Older local statements that adapter generation was unimplemented describe their
original baseline; #614 records the later implementation. The local Contracts
designation deferral yields to accepted Meta 0012, and the older release text is
read with Meta's zero-major policy. Historical/proposed records do not supersede
accepted decisions. No Angular implementation or architecture exception is added.

Local validation on 16 November 2026 used macOS arm64, outer Node 24.22.3,
Yarn 4.17.0 and Nx 24.0.1:

- Build, lint and typecheck: five tasks passed, three local cache hits;
  16 existing lint warnings and no errors.
- Package/schema, application generator, HTTP transform and member-dependency
  tests: **137 passed in four suites** (125 seconds).
- Packed implicit-platform HTTP/security control: **two ESM/CJS consumers passed**
  (60 seconds), with no E2E cache hit. The consumer runtime is the frozen Node
  24.21.0 / Nest 12.5.0 lane described in the matrix.
- Formatting, local link targets and diff checks passed. Runtime code, schemas,
  dependencies and defaults are unchanged.

Reproduce the focused checks from the repository root:

```sh
corepack yarn nx run-many -t build,lint,typecheck -p nx-nest,nx-nest-e2e --output-style=static
corepack yarn nx run nx-nest:test --runInBand --runTestsByPath src/package.spec.ts src/generators/application/generator.spec.ts src/generation-adapter/http-application.spec.ts src/utils/http-member-dependencies.spec.ts --output-style=static
corepack yarn nx run nx-nest-e2e:e2e --runTestsByPath src/nest-scenarios/http-contract-implicit.spec.ts --output-style=static
```

Local runs used `NX_DAEMON=false`, `NX_ISOLATE_PLUGINS=false`, `NX_NO_CLOUD=true`
and a temporary SWC cache; consumers need registry access and loopback listeners.
The later [#614 validation](nest-three-adapter-generation.md#current-candidate-validation)
records the full consumer invocation and successful isolated Node 22 rerun.
Neither these focused passes nor that later local coverage clears the production,
benchmark or approval gates, and no CI outcome is asserted.
