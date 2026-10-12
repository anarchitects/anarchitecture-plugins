# ADR: Nest HTTP Platform Scaffolding Is an Additive Overlay

## Status

Accepted

## Context

`@anarchitects/nest` v0.0.3 supports stable Nest 12 and Nx Project Crystal. Native Nest schematics own application/resource code; the Nx plugin owns workspace integration, inferred targets and caching. [Fastify overlay epic #508](https://github.com/anarchitects/anarchitecture-plugins/issues/508) explicitly keeps Fastify opt-in. Nest has announced a native Node HTTP adapter for a forthcoming minor release, but its production contract is not yet verified.

## Decision

1. Preserve native Nest schematics as the source of application and resource scaffolding. Only add structured, opt-in HTTP-platform overlays when the host framework requires them; do not fork or copy Nest templates.
2. Keep discovery, inference, cache inputs/outputs, start/build targets and ordinary artifact generation platform-neutral. An HTTP adapter selection must not alter them without concrete evidence.
3. Design a future explicit `platform` generator option for `node`, `fastify` and `express`, subject to upstream availability and validation. **This ADR does not add the option or change defaults.** Preserve native Nest defaults until an accepted Meta decision explicitly changes Anarchitects application-generation defaults.
4. Treat each supported adapter as a separate dependency/bootstrap/option transform with deterministic, idempotent installation and reversible migration guidance. Preserve ESM/CJS generation and `observe` instrumentation.
5. Fastify stays the opt-in overlay tracked under #508. Do not move Fastify-specific validation or multipart behavior into generic Nest generators. Schema validation and OpenAPI contracts remain Nest/domain concerns; verify parity with runtime consumer tests rather than assuming a platform option guarantees it.
6. Only admit Node HTTP after stable upstream versions, documented APIs, compatible Nest 12 matrix, and end-to-end generation plus running application tests. Verify native HTTP, standard schema, Swagger, raw body, static assets, proxies, error handling and any optional Fastify-equivalent feature independently.
7. Update dependency validator and generator schemas when implementing support, and document only actually shipped options and supported defaults in the package README. Version-breaking default changes need explicit SemVer and migration review.

## Consequences

- The plugin avoids maintenance-heavy Nest template drift and maintains upstream ownership boundaries.
- Feature-specific HTTP overlays may be less convenient than one large custom generator but remain portable and testable.
- Native Node is a candidate, not currently supported plugin scaffolding or a mandated default.

## References

- [Meta HTTP independence](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0008-http-platform-independence.md)
- [Meta Native Node candidate](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0009-native-node-candidate-default.md)
- [Fastify epic #508](https://github.com/anarchitects/anarchitecture-plugins/issues/508)
- [Existing Nest generation strategy](adr-nest-generation-strategy.md) (historical proposal; current package README is authoritative)
