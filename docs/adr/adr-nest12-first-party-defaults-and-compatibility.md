# ADR: Nest 12 First-Party Scaffolding and Dependency Discipline

## Status

Accepted

## Context

`@anarchitects/nest` is Nest 12-only tooling. The ecosystem has selected A2/B2/C1/D2/E1/F1, with a target Nest 12-first stack, native authentication and authorization, native mail, Zod, patch-only Nest 11 maintenance and optional reliability composition. These decisions concern runtime package ownership and must not lead to a fork of native Nest schematics.

## Decision

1. Keep the plugin focused on Nx workspace integration, target inference and additive overlays. Native Nest v12 schematics remain the source of Nest scaffolding and versioned framework boilerplate; no duplicate custom Nest templates or speculative APIs.
2. New optional generator presets may compose `@nestjs/authentication`, `@nestjs/authorization`, `@nestjs/mail`, Zod/Standard Schema, and opt-in resilience/outbox/idempotency/locks only when installed official versions and public integration contracts are verified. Avoid making any optional capability a default dependency of all generated apps.
3. Authentication WebAuthn remains an optional `@simplewebauthn/server` adapter in the Auth Brick, not a generic Nest CLI dependency. Policy vocabulary currently belongs in `auth-ts`; Zod transport schemas and public API operations must have a single cross-repository authority, to be designated in a separate Meta contracts-ownership ADR. The Nx generator must never fork, independently author or promote an implementation-generated API spec as canonical.
4. Explicitly select supported platform/preset through documented, idempotent additive configuration. Do not silently rewrite `main.ts`, change default HTTP adapter, or remove working dependencies; coordinate with [Fastify epic #508](https://github.com/anarchitects/anarchitecture-plugins/issues/508) and [HTTP scaffolding ADR](adr-nest-http-platform-scaffolding.md).
5. Nest 12 is the active tooling target; Nest 11 consumers remain supported only through documented patch-maintenance package lines where relevant, not by widening this Nest 12-only plugin's declared compatibility. Avoid claiming Nest 11 feature scaffolding.
6. Smoke-test generated clean consumers and dependency installation, ESM/CJS as supported, security/validation behavior and exact package API/peer availability. Update public README only when features ship.

## References

- [Meta Nest-first policy](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0010-nest-first-runtime-and-dependency-policy.md)
- [Meta auth migration policy](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0011-nest12-authn-authz-contracts-and-compatibility.md)
