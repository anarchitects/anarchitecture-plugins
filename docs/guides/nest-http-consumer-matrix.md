# Packed HTTP adapter consumer matrix

[#611](https://github.com/anarchitects/anarchitecture-plugins/issues/611) verifies
the development plugin as an npm tarball installed into independent workspaces.
The shared scenario is `packages/nest-e2e/src/http-consumer-matrix.ts`; its four
small spec files use the existing packed-plugin and installed-consumer harnesses.
This complements the [adapter API audit](nest-three-adapter-generation-contract.md)
and retains the [published-library gates](nest-published-library-compatibility.md).
The [milestone-1 readiness record](../releases/nest-three-adapter-generation.md)
consolidates these results with the security, optional-capability and regression
gates, and distinguishes local certification from release authorization.

## Version and selection boundaries

Fresh explicit applications use a coherent **12.5.0** set of common, core,
testing, the selected adapter and retained platform-express. Existing coherent
**12.3.0** owners remain admitted: members add a missing adapter at the owner's
version and preserve existing declarations. Mixed sets and unverified releases
fail before mutation. No owner is automatically upgraded. Omission still delegates
to native Nest and does not select a plugin default.

The plugin pins schematics **12.0.13** and Angular Devkit **22.2.6**. Native
12.0.13 supplies Vite 8 path resolution, the CommonJS `void bootstrap()` fix and
Rspack dependencies. The integration preserves those changes while adding its
bounded SWC configuration and member-aware lint scope. It supplies the native
loader/checker's missing Webpack peer for strict Yarn installs, preserving any existing
version, and recognizes the known lint defaults after native custom-root rewrites. Native `minimal` is
forwarded without a platform; explicit platforms require the full TypeScript
application template. Libraries, public exports and Nest 11/12 library peers
retain their separate contracts.

| Lane   | Node    | Nx / @nx/devkit | Package manager           | Observe |
| ------ | ------- | --------------- | ------------------------- | ------- |
| node22 | 22.22.3 | 23.2.0          | Yarn 4.17.0, node-modules | off     |
| node24 | 24.21.0 | 24.0.1          | Yarn 4.17.0, node-modules | on      |
| node26 | 26.0.0  | 24.0.1          | Yarn 4.17.0, node-modules | off     |
| npm    | 24.21.0 | 24.0.1          | npm 11.19.1               | on      |

Every lane exercises Node, Express and Fastify applications in ESM and CommonJS:
24 scenarios, using TypeScript 6.0.3 and CLI 12.0.13. Observe-on cases assert
0.3.26. The Yarn lanes rotate the new member's selection by zero, one and two
positions, covering all nine owner/member pairs in both module formats. npm
repeats the Node 24 pair selection. The Node 24 Fastify ESM cases move the native
application into the workspace root before member generation; other cases use a
nested owner. This samples supported versions and layouts, not every possible
combination of the public semver ranges or operating systems.

## Assertions and isolation

Each scenario checks the selected binary and locally resolved package versions,
independent generation, repeat generation, dry-run preservation, build, unit and
HTTP tests, lint, real loopback HTTP and resource registration. Member conversion
preserves the original bootstrap and test bytes and retains dependencies. HTTP
tests assert actual adapter identity; Fastify tests retain explicit readiness.
Built bootstrap fixtures also assert the actual adapter before listening.
Shutdown checks that the listening port can be rebound.

**Node 22 CommonJS Jest is excluded:** its unit and HTTP tests fail to load
`@nestjs/testing` as ESM. Jest documents [Node 24.9+ for this require(esm) path](https://jestjs.io/docs/ecmascript-modules#require-of-esm).
The three Node 22 CJS scenarios assert that specific upstream failure both before
and after conversion, then continue real builds, HTTP/resource startup and lint.
They do not claim generated Jest support. Node 24/26 CJS tests and all ESM tests
execute normally; the evidence record distinguishes these outcomes.

CLI calls exercise workspace defaults, invocation-project defaults, explicit
options, and the canonical `sub-app` default through the `app` alias. Invocation
from a different project with `--project=api` proves that owner selection does not
retarget Nx's default-project lookup. A later call from the workspace root with
no effective platform produces a native implicit sibling. Duplicate members and
an incompatible owner declaration reject without changing the checked files.

The Node binary and npm CLI are installed by exact version; Corepack selects the pinned Yarn release. Inner processes remove outer
Nx, debugger, `NODE_OPTIONS` and `NODE_PATH` state and own their caches. Dependencies
are installed normally with scripts disabled; no framework links, forced peer
installs, metadata edits or resolution overrides supply successful evidence.
CommonJS uses Nx exec with the package manager's Jest binary resolution and
`--experimental-vm-modules`, preserving native scripts and default hoisting.
Observe startup is covered; exporter delivery is not.

## Dependency fixtures and task inputs

`src/consumer-locks/http-yarn.lock` contains the Yarn registry-resolution union.
The npm fixtures retain the dependency tree for each adapter/module scenario.
Installs seed those fixtures, reconcile only the current manifests/local packed
artifact, compare every resulting registry record, and then require Yarn's
immutable install or npm ci. Registry identity, integrity and dependency/peer
metadata cannot silently drift. Run-specific tarball paths and workspace records
are local; optional platform checksums may be added by Yarn on another OS.

Fixture refreshes require explicit dependency review and a complete matrix rerun.
Do not bypass conflicts or bless a newly resolved package merely to make a test
pass. The older library fixture was extended for the new schematic dependencies;
its Nest 12.1.2 / CLI 12.0.0 compatibility controls remain intact.

Project inputs already include each fixture/spec/helper, plugin dependencies,
repository lockfile, package-manager selection, `.nvmrc`, and outer Node, OS,
architecture and npm version. Nx infers a task for each spec; the existing
`e2e-ci` wildcard includes all four lanes. Each spec owns its temporary workspaces
and archive, bounds subprocesses and cleans up. Registry access, Corepack and npm
are required. No CI run or multi-OS result is implied by local validation.

```sh
corepack yarn nx run nx-nest:test --runInBand
corepack yarn nx run-many -t build,lint,typecheck -p nx-nest,nx-nest-e2e
corepack yarn nx run nx-nest-e2e:e2e --runTestsByPath src/nest-scenarios/http-node22.spec.ts src/nest-scenarios/http-node24.spec.ts src/nest-scenarios/http-node26.spec.ts src/nest-scenarios/http-npm.spec.ts
```

Optional Fastify integrations remain #508; default activation and releases retain
their own gates.

## Shared HTTP and security conformance

The #612 suite adds four independently inferred specs named `http-contract-*`:
explicit Node, Express and Fastify, plus the native omitted-platform control.
Each installs the packed plugin into a fresh frozen Yarn consumer and generates
an application and CRUD resource in both ESM and CommonJS. These eight cases use
Node 24.21.0, Nx 24.0.1, Nest runtime/adapters 12.5.0, CLI/schematics 12.0.13,
TypeScript 6.0.3 and Standard Schema's type-only specification 1.1.0. The omitted
control pins the same runtime in its consumer manifest without changing the
native bootstrap. It also declares Webpack 5.112.2 as the native CLI
loader/checker's peer; the strict install rejects its omission. Explicit
generation already provides that peer. No schema vendor is required.

The native application is built and its generated source/configuration is checked
for preservation. An additional consumer-owned bootstrap configures the public
adapter APIs for the conformance application; it is not a plugin template. All
adapters execute the same controllers, schemas, guards and HTTP assertions, with
the generated application module and resource service. Runtime adapter identity
is asserted before requests. This supplements the original generated-bootstrap
startup checks above.

The common contract covers:

- Generated CRUD routes, success/error status codes, headers, redirects, HEAD,
  stream contents, lifecycle hooks and releasing the listening port on shutdown.
- Async Standard Schema body validation, path/query coercion, invalid input and
  duplicate query rejection, response filtering and invalid-response rejection.
- Authentication/tenant guard denial before validation or handler execution,
  exception redaction, security headers, CSRF rejection and CORS allowlisting.
- JSON/form/query parsing, a configured 512-byte body limit, malformed and
  oversized bodies, prototype-poisoned JSON and unsupported content types.
- Exact raw-body HMAC verification with whitespace tampering, missing and invalid
  signatures; cookie attributes, signed-cookie tampering and deletion.
- Forwarded IP/protocol/host behavior with trust disabled, a trusted loopback
  proxy and an untrusted CIDR; direct TLS, certificate validation and HTTPS
  request semantics.

Every consumer starts four application modes: direct HTTP, trusted proxy,
untrusted proxy and HTTPS. The complete common contract runs on HTTP and HTTPS;
proxy identity, lifecycle and port release are checked in all four modes. TLS
uses a disposable certificate generated by OpenSSL and an explicitly trusted
test CA. No private key is committed and verification is never disabled.

The assertions retain observed differences: Node and Fastify reject
prototype-poisoned JSON with 400; Express accepts the parsed object and Nest's
Standard Schema pipeline strips prototype keys before validation. Fastify rejects
an unsupported content type with 415; Node and Express leave the body unparsed
and the schema rejects it with 400. Query parsing uses flat keys and arrays for
repeated values; Express explicitly selects its public `simple` parser. Body
limits are configured through each adapter's public parser API, rather than
assuming identical defaults. Any change to these expectations fails the suite.

The guard and webhook fixtures prove request-boundary behavior only. Session
authentication, passkeys, production authorization policy, browser cookie
enforcement, reverse-proxy deployment configuration, HTTP/2, multipart uploads,
WebSockets, SSE reconnection and slow-client/backpressure behavior remain outside
this bounded test. Canonical application contracts remain owned by Contracts;
Nest runtime authentication/policy ownership follows Meta ADR 0011. Optional
capabilities and OpenAPI integration are handed off to #613, and Fastify extras
to #508. These results do not activate a default or establish production parity
for every adapter feature.

Architecture preflight re-enumerated and read all 25 Meta ADRs at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all six local ADRs, plus the
generation audit, adapter contract, published-library and consumer guides.
Accepted HTTP independence, first-party runtime, security, contract ownership
and Nx inference/cache decisions apply. Historical local wording about a future
Contracts repository yields to accepted Meta ADR 0012; initial-release wording
is governed by Meta ADRs 0013/0017. Proposed default/documentation decisions do
not override accepted policy. This test-only change alters no generator,
compatibility range, runtime dependency, adapter default or release behavior.

Reproduce the conformance suite through its inferred CI tasks:

```sh
corepack yarn nx run-many -p nx-nest-e2e -t e2e-ci--src/nest-scenarios/http-contract-node.spec.ts,e2e-ci--src/nest-scenarios/http-contract-express.spec.ts,e2e-ci--src/nest-scenarios/http-contract-fastify.spec.ts,e2e-ci--src/nest-scenarios/http-contract-implicit.spec.ts --parallel=2 --output-style=static
```

In addition to the consumer prerequisites above, this suite needs OpenSSL's
`req -addext` support and permission to bind local HTTP/HTTPS ports. Each request
has a five-second timeout, consumer subprocesses have bounded execution, and
each spec owns and removes its workspaces. The existing `e2e-ci` wildcard
automatically includes these four tasks; no explicit CI target is added.
The [conformance evidence](../audits/nest-http-contracts-2026-11-15.json) records
the reviewed ADR inventory, exact versions, fixture hashes, commands and limits.
Local validation on 2026-11-15 passed all eight consumer cases across the four
inferred tasks without E2E cache hits, covering 32 application starts. The 675
plugin unit tests and applicable plugin/e2e build, lint and typecheck tasks passed.
These are macOS arm64 results; the evidence does not imply Linux CI completion.

## Optional HTTP capabilities

[#613](https://github.com/anarchitects/anarchitecture-plugins/issues/613) evaluates
optional integrations independently of the baseline generation and HTTP/security
contracts above. The scope is explicit Node, Express and Fastify independent
applications in ESM and CJS, with consumer-owned configuration. It adds no
generator flags, optional dependencies to generated applications, compatibility
ranges, migration or adapter default. These are candidate implementation results,
not a release announcement or a claim of general production parity.

The matrix uses **supported** for the bounded configuration exercised by the
packed-consumer tests, **unsupported** for an explicitly excluded configuration,
and **unverified** when the evidence does not establish support. A package being
installable or an application building is not runtime capability evidence.

| Capability/configuration                                                                                 | Node        | Express     | Fastify     | Evidence or restriction                                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ----------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Swagger OpenAPI document, JSON endpoint and UI assets                                                    | Supported   | Supported   | Supported   | `createDocument` and `setup`; method/path, operation ID, request/response schema, error description, JSON, HTML, CSS and JS requests       |
| Standard Schema with Standard JSON Schema input/output conversion                                        | Supported   | Supported   | Supported   | Same vendor-neutral descriptor and schema assertions; real valid/invalid body requests                                                     |
| Validation-only Standard Schema with an explicit converter                                               | Supported   | Supported   | Supported   | Same `standardSchemaConverter` checks both input and output                                                                                |
| Inferring a complete OpenAPI schema from validation alone                                                | Unsupported | Unsupported | Unsupported | Negative document assertion: a validator without JSON-schema conversion does not produce the expected schema; supply conversion explicitly |
| Single, bounded, in-memory multipart file                                                                | Supported   | Supported   | Supported   | Native adapter `FileInterceptor`; one file, 64-byte limit, one 16-byte text field, three-part cap; valid upload and rejection cases below  |
| Express interceptor or manual Multer wiring on Fastify                                                   | N/A         | N/A         | Unsupported | Use the interceptor from `@nestjs/platform-fastify`; no cross-adapter compatibility claim                                                  |
| Static directory through the public adapter API                                                          | Supported   | Supported   | Supported   | GET/HEAD, content type, missing/hidden file and traversal rejection                                                                        |
| Explicit EJS engine with `@Render`                                                                       | Supported   | Supported   | Supported   | Real HTML response and escaped untrusted template data                                                                                     |
| Combined Swagger, multipart, static and EJS application                                                  | Supported   | Supported   | Supported   | All four enabled in the same process; separate disabled run verifies absent endpoints                                                      |
| Other template engines, layouts, includes or template caches                                             | Unverified  | Unverified  | Unverified  | Only EJS and one fixed view are exercised; #512/#514 own extensions                                                                        |
| Disk/cloud uploads, file-content validation, streaming uploads, concurrent/slow uploads                  | Unverified  | Unverified  | Unverified  | Memory storage only; no MIME trust, malware detection, persistence, cleanup, storage or backpressure claim; #511/#514 own extensions       |
| Optional capabilities in native monorepo members, Observe, Rspack or other Node/package-manager lanes    | Unverified  | Unverified  | Unverified  | The baseline has broader coverage; optional-feature composition is restricted to the six independent-app cases here; #514 owns expansion   |
| Swagger browser execution, custom CSP, authentication on documentation, reverse-proxy paths              | Unverified  | Unverified  | Unverified  | HTTP asset serving is checked, not a browser or production exposure policy; #510/#514 own expansion                                        |
| SSE reconnect, WebSockets, HTTP/2, session/passkey integrations, full authorization policy, frontend SSR | Unverified  | Unverified  | Unverified  | Outside this bounded HTTP fixture; #614 must retain these restrictions and route new claims to their runtime/deployment owners             |

The earlier #612 evidence covers shared validation/serialization, raw body,
cookies, CORS, CSRF, guard ordering, security headers, proxy trust, HTTPS and
representative streaming. It does not turn the unverified rows above into
supported features. No frontend renderer or SSR setup is included.
Runtime presentation/SSR parity remains with Bricks #506 and Community #33.

### Exact optional dependency boundary

The consumer runtime remains Node **24.21.0**, Nest common/core/testing and
selected adapter **12.5.0**, native CLI/schematics **12.0.13**, Nx **24.0.1**,
TypeScript **6.0.3**, Yarn **4.17.0** and Standard Schema spec **1.1.0**.
Dependencies added explicitly by the consumer are:

| Package              | Node/Express | Fastify | Purpose                                                            |
| -------------------- | ------------ | ------- | ------------------------------------------------------------------ |
| `@nestjs/swagger`    | 12.1.2       | 12.1.2  | Document generation and serving; includes `swagger-ui-dist` 5.34.1 |
| `ejs`                | 5.0.1        | 5.0.1   | Explicitly selected view engine                                    |
| `@fastify/static`    | Not added    | 10.1.11 | Swagger assets and application static directory                    |
| `@fastify/multipart` | Not added    | 10.1.8  | Native Fastify upload interceptor's optional peer                  |
| `@fastify/view`      | Not added    | 12.0.1  | Fastify view API's optional peer                                   |

The Nest Node/Express adapters supply Multer **2.5.0**; platform-express supplies
Express **5.3.0**, and platform-fastify supplies Fastify **5.12.8**. No direct
Fastify server package, mandatory schema vendor or legacy validation packages are
introduced. The baseline generated manifest is checked before optional packages
are added. Each separate consumer installs the real packed plugin and verifies
the resolved versions, strict peer/engine diagnostics, all registry lock records
and a second immutable install. The dedicated
[`http-capabilities-yarn.lock`](../../packages/nest-e2e/src/consumer-locks/http-capabilities-yarn.lock)
freezes the complete optional graph without changing the earlier baseline lock.

### Configuration differences and security limits

The shared controllers, schemas and request assertions are identical for all
adapters. Only public bootstrap options and the `FileInterceptor` import vary:

- Swagger setup and schema conversion are common. Fastify additionally needs
  `@fastify/static`. When Swagger and the application's static directory coexist,
  the latter uses `decorateReply: false` so only Swagger's registration decorates
  `reply.sendFile`. This is a composition requirement, not a reason to disable
  Swagger or duplicate its implementation.
- Node/Express call `useStaticAssets(path, { prefix })`,
  `setBaseViewsDir(path)` and `setViewEngine('ejs')`. Fastify uses
  `useStaticAssets({ root, prefix, decorateReply: false, dotfiles: 'ignore' })` and
  `setViewEngine({ engine: { ejs }, root })`; a string view-engine argument is
  unsupported there. Paths are absolute, resolved from the consumer's explicit
  working directory, without `__dirname` assumptions in ESM. Asset copying and
  deployment working directories remain the consumer's responsibility.
- Uploads import `FileInterceptor` from the selected Nest adapter. Fastify
  registers its optional multipart peer automatically; no explicit
  `app.register(multipart)` is needed. The public Nest upload decorators and
  `ParseFilePipe` are shared. Installing or using an interceptor from a different
  adapter is outside the supported configuration.
- The fixture sets limits explicitly rather than relying on different parser
  defaults. It rejects oversized files (413), unexpected/duplicate file fields,
  oversized/extra text fields, missing files and malformed multipart (400), and
  verifies rejection before the handler. Client filename paths are stripped;
  memory storage must not expose a persisted path. Uploaded content is never
  executed or rendered. This does not validate a file's declared MIME type or
  make arbitrary uploaded content safe.
- Fastify's tested static package defaults to allowing dotfiles; the first
  consumer run exposed the hidden sentinel with HTTP 200. The supported
  configuration explicitly sets `dotfiles: 'ignore'`. Node/Express hide it by
  default. #512 must preserve this restriction when offering a static preset.
  Static tests reject access to a hidden file and an out-of-root sentinel,
  including encoded traversal paths. EJS escaping is checked with script-shaped
  data. View names and engine options are fixed, never supplied by the request.

These restrictions apply to consumer configuration. There are currently no
optional-feature generator options to guard. Future presets must reject
unsupported combinations rather than silently installing packages or emitting
configuration based only on an adapter name.

### Follow-up ownership and reproducibility

[#508](https://github.com/anarchitects/anarchitecture-plugins/issues/508) remains
the optional Fastify integration owner. This evidence narrows its work:
[#510](https://github.com/anarchitects/anarchitecture-plugins/issues/510) can reuse
shared Swagger/schema configuration with the explicit Fastify serving peer;
[#511](https://github.com/anarchitects/anarchitecture-plugins/issues/511) can reuse
Nest's native multipart interceptor and avoid duplicate plugin registration;
[#512](https://github.com/anarchitects/anarchitecture-plugins/issues/512) owns
static/view presets and explicit engine selection. For
[#513](https://github.com/anarchitects/anarchitecture-plugins/issues/513), the
#612 raw-body/shared-pipeline results justify no additional adapter shim for the
verified cases; additional hooks still need independent evidence.
[#514](https://github.com/anarchitects/anarchitecture-plugins/issues/514) owns
broader optional-feature composition and failure coverage;
[#515](https://github.com/anarchitects/anarchitecture-plugins/issues/515) owns
documentation for those presets when implemented. None of these issues is
declared complete by this matrix. #614 owns readiness and consolidation of the
remaining restrictions; #615 owns the separate default gate.

The original MIT consumer fixture preserves native generated application,
bootstrap, test and configuration files, runs the native build and an explicit
consumer-owned compile target, then exercises real loopback HTTP. Each of six
consumers starts enabled and disabled applications. Disabled mode means the
optional packages are installed but endpoints/configuration are absent; it is
not a dependency-uninstall test. Baseline dependency omission is a separate
manifest assertion and the existing baseline consumer suite remains authoritative.

Reproduce through the three automatically inferred tasks:

```sh
corepack yarn nx run-many -p nx-nest-e2e -t e2e-ci--src/nest-scenarios/http-capability-node.spec.ts,e2e-ci--src/nest-scenarios/http-capability-express.spec.ts,e2e-ci--src/nest-scenarios/http-capability-fastify.spec.ts --parallel=2 --output-style=static
```

Registry access and loopback HTTP listeners are required. Requests and
subprocesses have deadlines, and each spec owns and removes its temporary
consumers. The existing `e2e-ci` wildcard discovers all three specs without
explicit target configuration. Local results, source hashes and the complete
fresh architecture preflight inventory are recorded in the
[capability evidence](../audits/nest-http-capabilities-2026-11-15.json).
Local validation on 2026-11-15 passed all six consumer cases and 12 application
starts across the three inferred tasks without E2E cache hits (1m44s). All 675
plugin unit tests in 35 suites and the five applicable build/lint/typecheck
tasks passed. These are macOS arm64 results, not cross-platform certification.
CI execution is not monitored or asserted by this evidence.

All 25 Meta ADRs at `4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all six local
ADRs were re-enumerated and read before implementation, with the relevant Nest
guides. Accepted HTTP independence, first-party runtime, security, canonical
contract ownership and Nx inference/cache decisions apply. Meta ADR 0012 takes
precedence over older local Contracts-ownership wording; generated OpenAPI is
runtime evidence, not the canonical application API contract. Meta ADRs 0013/0017
govern release authority. Proposed documentation/default decisions do not change
accepted behavior; no exception is required for these consumer-owned tests.

Primary API references: [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction),
[Nest uploads](https://docs.nestjs.com/techniques/file-upload), and the installed
12.5.0 adapter public types. Package versions and peer ranges were independently
read from released registry manifests; runtime support comes from the tests,
not solely from documentation or a dependency declaration.

## CI execution budget

[Main CI run 43748853192](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43748853192)
on 2026-11-15 reached the affected step's 15-minute deadline after 37 successful
task completions. The Node 24 and Node 22 matrix tasks completed at 9m41s and
10m05s after the affected command started; further successful completions
continued through 14m54s. No Nx task failure was reported. The coordinator log
does not distinguish queued from running tasks for the unfinished Node 26/npm
lanes, so it does not establish their required execution time.

Main CI allows 45 minutes per execution step and 50 minutes per worker job,
including setup and diagnostics. When Nx Cloud is enabled, the three agents and
inferred task splitting remain in use. When `NX_CLOUD_ENABLED=false`, Nx selects
affected E2E projects before allocating their runners. Nest's complete Jest suite
is partitioned with `--shard=1/4`, `2/4`, `3/4` and `4/4`; each other selected E2E project
runs once on its own runner. At most three E2E jobs run concurrently. Each Nest
shard retains two Jest workers, while separate checkouts isolate project-owned
files, registry ports and temporary fixtures. No tests are omitted or allowed to
pass merely because no tests were found.

The fallback follows measured evidence from
[PR #654's instrumented run](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/44903029786/job/136842735006):
all 33 non-E2E tasks and 41 of 43 Nest suites passed before the old combined
45-minute step expired. Node 26 completed seconds before cancellation, Node 24
was active, and Node 22 had just started; the other three E2E projects had not
started. Commands were still completing successfully. The serial workload
exceeded the budget; it was not idle.

The stable `main-ci` gate requires the checks job and every scheduled E2E job to
succeed. A valid empty affected selection skips the matrix; a failed selection,
failed test or cancelled/missing scheduled work fails the gate. Nx still restores
prerequisite builds and hashes shard arguments separately. The Main CI workflow
is a shared task input so orchestration changes select validation and invalidate
old results. Streamed command boundaries, suite heartbeats and resource samples
remain available. Per-test and subprocess deadlines are unchanged.

Repository maintainers own this fallback while Nx Cloud is unavailable. Revisit
its partition count and cost after workload changes or when Nx Cloud is enabled;
the Cloud path continues to use graph-aware scheduling instead of this matrix.
The [security-fix record](../releases/nest-minimatch-security.md) separates local
checks from hosted validation of the final candidate.
The previous 15/20-minute bounds were based on the smaller workload documented
in the [PR #570 investigation](../ci/pr-570-stall.md).

## Recorded validation

Local validation on 2026-11-15 passed **675 unit tests in 35 suites** and
**96 E2E tests in 36 suites**: 24 frozen HTTP matrix scenarios, 66 remaining
native/regression checks and six clean published-library checks. The four HTTP
lanes ran through their inferred CI tasks with no cache hits. The three Node 22
CommonJS combinations include the explicit Jest exclusion above; their real HTTP,
resource and lint checks pass. Plugin/e2e typecheck and lint pass, with 16 existing
plugin warnings and no lint errors.

The [versioned evidence record](../audits/nest-http-consumers-2026-11-15.json)
contains exact commands, locally resolved versions, fixture hashes, architecture
inventory and exclusions. The host was macOS arm64 / Node 24.22.3. Cache probes
on a small inferred task sharing the same input definition observed a repeat
hit, a miss after changing the HTTP lock, and a hit after restoring it. Remote
CI and other operating systems are not represented by these local results.
