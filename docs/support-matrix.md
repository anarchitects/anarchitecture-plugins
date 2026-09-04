# Plugin Support Matrix

This matrix describes the supported host toolchain for the published Nx
plugins. The current release line is developed and verified against Nx 23.2.

| Plugin                        | Nx                               | TypeScript    | TypeORM | Status    |
| ----------------------------- | -------------------------------- | ------------- | ------- | --------- |
| `@anarchitects/nx-governance` | `>=19 <24` (including Nx 23)     | 5.9.x and 6.x | n/a     | Supported |
| `@anarchitects/nx-typeorm`    | `>=19 <24` (including Nx 23)     | 5.9.x and 6.x | 1.x     | Supported |
| `@anarchitects/nx-js`         | `>=21.6.4 <24` (including Nx 23) | 5.9.x and 6.x | n/a     | Supported |

## TypeScript 5 policy

TypeScript 5 remains supported for the current plugin release line while it
is supported by the TypeScript ecosystem. TypeScript 6 is supported now.
TypeScript 5 support will be deprecated in a future plugin release after the
relevant TypeScript 5 support window ends; that change will be documented in
the release notes and reflected here.

The repository may use different compiler versions for individual package
build and spec projects when required by their toolchain. That does not
change the published support policy above.

TypeScript 6 is the repository default for local development and the primary
CI build, test, and typecheck lane. CI also runs a dedicated TypeScript 5.9
compatibility typecheck using `tsconfig.ts5.json`; this compatibility lane is
temporary and will be removed when TypeScript 5 support is deprecated.

## Nx policy

The `<24` upper bound is intentional. Nx 24 support is not implied by support
for Nx 23 and will be added only after a dedicated compatibility pass.

For NestJS applications, generated TypeORM integration supports
`@nestjs/typeorm` 11.0.1 and 12.0.1. NestJS TypeORM 11 may report a peer warning
with stable TypeORM 1.x because its published peer range only names the 1.x
development line; the integration is nevertheless covered by the plugin's
compatibility tests.
