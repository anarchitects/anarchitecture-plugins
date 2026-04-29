# @anarchitects/nest

Initial package shell for the upcoming Anarchitects Nest Nx plugin.

This package currently includes only the minimal structure required for Nx
workspace discovery, build, and test integration.

Intentionally out of scope in this foundation package:

- Nest project detection
- `createNodesV2` and inferred targets
- plugin options
- application, library, or resource generators
- `@nestjs/schematics` integration
- Fastify support
- migrations and e2e coverage

Follow-up implementation is tracked by the Nest foundation EPIC and related
issues beginning with `#124`.
