// Root package entrypoint compatibility shell only. This preserves the published
// package import path while the package surface is split across the dedicated
// host, adapter, and Core entrypoints. It does not preserve or imply legacy
// governance model compatibility such as project/dependency workspace contracts.
export * from './host-public-api.js';
// Older Nx loaders need the extensible plugin object, not an ESM namespace.
export { default } from './host-public-api.js';
export * from '@anarchitects/governance-adapter-nx';
export * from '@anarchitects/governance-core';
