// SPDX-License-Identifier: MIT
import { npmRegistryRecords, registryRecords } from '../consumer-locks';

it('compares Yarn registry metadata independently of local artifacts and platform checksums', () => {
  const registry =
    '"fixture@npm:1.0.0":\n  version: 1.0.0\n  resolution: "fixture@npm:1.0.0"\n  dependencies:\n    peer: "npm:2.0.0"\n  checksum: platform-specific\n  languageName: node\n  linkType: hard\n';
  const local =
    '\n\n"plugin@file:/temporary/plugin.tgz":\n  resolution: "plugin@file:/temporary/plugin.tgz"\n';
  expect(registryRecords(registry + local)).toEqual(
    registryRecords(registry.replace('  checksum: platform-specific\n', ''))
  );
  expect(registryRecords(registry).size).toBe(1);
  expect(
    registryRecords(registry.replace('npm:2.0.0', 'npm:3.0.0'))
  ).not.toEqual(registryRecords(registry));
});

it('detects npm integrity and peer changes while ignoring run-specific workspace records', () => {
  const entry = {
    version: '1.0.0',
    resolved: 'https://registry.npmjs.org/fixture/-/fixture-1.0.0.tgz',
    integrity: 'sha512-original',
    peerDependencies: { peer: '^2' },
  };
  const lock = (value: unknown, local = {}) =>
    JSON.stringify({ packages: { 'node_modules/fixture': value, ...local } });
  const expected = npmRegistryRecords(lock(entry));
  expect(expected.size).toBe(1);
  expect(
    npmRegistryRecords(
      lock(entry, {
        'node_modules/plugin': { resolved: 'file:/temporary/plugin.tgz' },
      })
    )
  ).toEqual(expected);
  expect(
    npmRegistryRecords(lock({ ...entry, integrity: 'sha512-changed' }))
  ).not.toEqual(expected);
  expect(
    npmRegistryRecords(lock({ ...entry, peerDependencies: { peer: '^3' } }))
  ).not.toEqual(expected);
});
