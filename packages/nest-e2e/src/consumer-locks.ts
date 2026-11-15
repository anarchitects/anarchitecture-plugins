// SPDX-License-Identifier: MIT
/** Compare registry identity/metadata while allowing run-specific local artifacts. */
export function registryRecords(lock: string) {
  const records = new Map<string, string>();
  for (const block of lock.split('\n\n')) {
    const resolution = block.match(
      /^ {2}resolution: "([^"]+@npm:[^"]+)"$/m
    )?.[1];
    if (resolution)
      records.set(
        resolution,
        block
          .slice(block.indexOf('\n') + 1)
          .replace(/^ {2}checksum:.*\n?/m, '')
          .trim()
      );
  }
  return records;
}

export function npmRegistryRecords(lock: string) {
  const records = new Map<string, string>();
  for (const entry of Object.values(JSON.parse(lock).packages) as Record<
    string,
    unknown
  >[]) {
    if (
      typeof entry.resolved !== 'string' ||
      !entry.resolved.startsWith('https://registry.npmjs.org/')
    )
      continue;
    const metadata = Object.fromEntries(
      [
        'version',
        'resolved',
        'integrity',
        'dependencies',
        'optionalDependencies',
        'peerDependencies',
        'peerDependenciesMeta',
        'engines',
      ]
        .filter((key) => entry[key] !== undefined)
        .map((key) => [key, entry[key]])
    );
    records.set(entry.resolved, JSON.stringify(metadata));
  }
  return records;
}
