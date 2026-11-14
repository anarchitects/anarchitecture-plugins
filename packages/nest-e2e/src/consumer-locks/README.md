# Packed consumer registry fixture

`yarn.lock` pins the registry resolutions used by the three clean packed-library
lanes. It was produced with Yarn 4.17.0 on 2026-11-14. Local tarball and workspace
records are omitted because their identities depend on the fresh temporary
directory and the current plugin/library build.

The test seeds each independent install from this file, checks **every resulting
registry record** against it (resolution plus dependency/peer/platform metadata),
and requires a subsequent immutable install. Only checksums are excluded from
the metadata comparison: Yarn validates existing checksums itself and may add a
checksum when another OS first fetches an optional native package. An unexpected
resolution or dependency change fails instead of silently broadening the lane.

To refresh intentionally:

1. Build and pack `@anarchitects/nest` through the usual Nx build and `npm pack`.
2. In a temporary Yarn workspace, use the exact development dependencies in
   `packed-library-consumer.ts`'s `prepare` function at the root (Nx 24.0.1), with
   the actual plugin tarball. Add a workspace with the same dependencies selecting
   Nx/devkit/js 23.2.0, and another with the negative fixture's common 11.1.0,
   reflect-metadata 0.2.2 and RxJS 7.8.2. Use `nodeLinker: node-modules` and
   `enableScripts: false`, matching the tests.
3. Run a normal Yarn install. Retain the generated header/metadata and entries
   whose `resolution` contains `@npm:`. Remove the temporary workspace and `file:`
   entries. Do not edit registry versions, peers or checksums by hand.
4. Review the dependency delta and run all three packed-library specs through
   Nx. Commit this fixture with any intentional lane/package contract change.

The npm-installed exact Node binaries are separate from these consumer graphs.
The harness verifies their versions before use. OS/architecture, outer Node/npm,
package manager and all fixture files are Nx task inputs. No registry publication
or repository-wide dependency upgrade is part of refreshing this fixture.
