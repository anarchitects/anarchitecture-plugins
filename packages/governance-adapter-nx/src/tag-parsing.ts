export function hasTagWithPrefix(tags: string[], prefix: string): boolean {
  return tags.some((tag) => tag.trim().startsWith(`${prefix}:`));
}

export function readTagValue(
  tags: readonly string[],
  prefix: string
): string | undefined {
  const matchingTag = tags.find((tag) => tag.trim().startsWith(`${prefix}:`));
  if (!matchingTag) {
    return undefined;
  }

  const value = matchingTag
    .trim()
    .slice(prefix.length + 1)
    .trim();
  return value.length > 0 ? value : undefined;
}

export function isDefaultExcludedNxTag(tag: string): boolean {
  const normalizedTag = tag.trim();

  return normalizedTag.startsWith('npm:');
}

export function splitNxTags(tags: string[]): {
  governanceTags: string[];
  rawTags: string[];
} {
  return {
    governanceTags: tags.filter((tag) => !isDefaultExcludedNxTag(tag)),
    rawTags: [...tags],
  };
}
