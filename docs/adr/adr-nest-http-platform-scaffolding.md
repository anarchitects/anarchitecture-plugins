# ADR: Nest HTTP Platform Scaffolding Is an Additive Overlay

## Status

Accepted

## Context

`@anarchitects/nest` v0.0.3 supports stable Nest 12 and Nx Project Crystal. Native Nest schematics own application/resource code; the Nx plugin owns workspace integration, inferred targets and caching. [Fastify overlay epic #508](https://github.com/anarchitects/anarchitecture-plugins/issues/508) explicitly keeps Fastify opt-in. Nest has released `@nestjs/platform-node` / `NodeAdapter` starting with Nest 12.3 and [recommends it for new applications](https://docs.nestjs.com/http/performance#http-adapters). The initial ADR intentionally deferred it while its upstream API was not yet released. Its **Anarchitects generator and production support are still unverified**; Nest 12's implicit app default remains Express.

## Amendment — 2026-11-15

Prioritize native Node as the **first new platform-specific generator integration to design and validate**, in line with [Meta ADR-0009](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0009-native-node-candidate-default.md) as proposed in [Meta PR #53](https://github.com/anarchitects/anarchitecture-meta/pull/53). The strategic preference is distinct from a shipped `platform` option or changed default: this ADR authorizes neither. Existing Fastify overlay work (#508) remains opt-in and is not cancelled; Express remains separately selectable when validated. The new preference becomes governing after Meta approval.

## Decision

1. Preserve native Nest schematics as the source of application and resource scaffolding. Only add structured, opt-in HTTP-platform overlays when the host framework requires them; do not fork or copy Nest templates.
2. Keep discovery, inference, cache inputs/outputs, start/build targets and ordinary artifact generation platform-neutral. An HTTP adapter selection must not alter them without concrete evidence.
3. Design an explicit `platform` generator option for `node`, `fastify` and `express`. **Implement and validate `node` first**, using the stable upstream `NodeAdapter` API, with Fastify and Express as explicit opt-in alternatives as separately validated. This ADR does not ship the option or change the current default. Keep Nest's actual implicit Express default until an independently reviewed and evidence-backed Anarchitects generator-default decision. When native Node is selected, configuration must be explicit, idempotent and compatible with native Nest schematics.
4. Treat each supported adapter as a separate dependency/bootstrap/option transform with deterministic, idempotent installation and reversible migration guidance. Preserve ESM/CJS generation and `observe` instrumentation.
5. Fastify stays the opt-in overlay tracked under #508. Do not move Fastify-specific validation or multipart behavior into generic Nest generators. Schema validation and OpenAPI contracts remain Nest/domain concerns; verify parity with runtime consumer tests rather than assuming a platform option guarantees it.
6. Upstream `NodeAdapter` availability is established in Nest 12.3+, but plugin support is **not**. Admit a `node` generator option only after exact supported Nest/Node/adapter dependencies and end-to-end generated/installed running-app tests are verified. Explicitly bootstrap `NodeAdapter`; do not infer native Node from a default Nest app (which uses Express in Nest 12). Verify native HTTP, Standard Schema, Swagger, raw bodies, static assets, proxy trust, error mapping, instrumentation, ESM/CJS and relevant optional Fastify-equivalent features independently.
7. Update dependency validator and generator schemas when implementing support, and document only actually shipped options and supported defaults in the package README. Version-breaking default changes need explicit SemVer and migration review.

## Consequences

- The plugin avoids maintenance-heavy Nest template drift and maintains upstream ownership boundaries.
- Feature-specific HTTP overlays may be less convenient than one large custom generator but remain portable and testable.
- Native Node is the approved **first new generator adapter target**, but is not currently supported plugin scaffolding or an activated default. Any automatic default switch, existing-app migration, release or support claim still needs reviewed implementation and validation.

## References

- [Meta HTTP independence](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0008-http-platform-independence.md)
- [Meta native Node preference and activation gates](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0009-native-node-candidate-default.md)
- [Fastify epic #508](https://github.com/anarchitects/anarchitecture-plugins/issues/508)
- [Existing Nest generation strategy](adr-nest-generation-strategy.md) (historical proposal; current package README is authoritative)
