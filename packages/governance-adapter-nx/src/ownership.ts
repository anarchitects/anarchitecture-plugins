import type { GovernanceOwnershipInput } from '@anarchitects/governance-core';

export function readCanonicalOwnershipFromProjectMetadata(
  metadata: Record<string, unknown>
): GovernanceOwnershipInput | undefined {
  const rawOwnership = asRecord(metadata.ownership);
  if (!rawOwnership) {
    return undefined;
  }

  const contacts = uniqueStrings(toStringArray(rawOwnership.contacts));
  const stewards = uniqueStrings(toStringArray(rawOwnership.stewards));
  const ownership: GovernanceOwnershipInput = {
    ...(asString(rawOwnership.team)
      ? { team: asString(rawOwnership.team) }
      : {}),
    ...(contacts.length > 0 ? { contacts } : {}),
    ...(stewards.length > 0 ? { stewards } : {}),
    ...(asString(rawOwnership.productOwner)
      ? { productOwner: asString(rawOwnership.productOwner) }
      : {}),
    ...(asString(rawOwnership.technicalOwner)
      ? { technicalOwner: asString(rawOwnership.technicalOwner) }
      : {}),
    ...(asString(rawOwnership.businessOwner)
      ? { businessOwner: asString(rawOwnership.businessOwner) }
      : {}),
    ...(asString(rawOwnership.source)
      ? { source: asString(rawOwnership.source) }
      : {}),
    ...(asRecord(rawOwnership.metadata)
      ? { metadata: asRecord(rawOwnership.metadata) }
      : {}),
  };

  return hasCanonicalOwnershipData(ownership) ? ownership : undefined;
}

export function hasCanonicalOwnershipData(
  ownership: GovernanceOwnershipInput | undefined
): boolean {
  return Boolean(
    ownership?.team ||
      (ownership?.contacts?.length ?? 0) > 0 ||
      (ownership?.stewards?.length ?? 0) > 0 ||
      ownership?.productOwner ||
      ownership?.technicalOwner ||
      ownership?.businessOwner
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
