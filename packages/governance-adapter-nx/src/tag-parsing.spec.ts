import {
  hasTagWithPrefix,
  isDefaultExcludedNxTag,
  readTagValue,
  splitNxTags,
} from './tag-parsing.js';

describe('Nx tag parsing', () => {
  describe.each([
    {
      prefix: 'domain',
      normalizedValue: 'booking',
      validTags: [
        'domain:booking',
        'domain: booking',
        'domain:booking ',
        ' domain:booking',
        ' domain: booking ',
      ],
      emptyTags: ['domain:', 'domain: ', 'domain:    '],
    },
    {
      prefix: 'layer',
      normalizedValue: 'domain',
      validTags: [
        'layer:domain',
        'layer: domain',
        'layer:domain ',
        ' layer:domain',
        ' layer: domain ',
      ],
      emptyTags: ['layer:', 'layer: ', 'layer:    '],
    },
  ])('$prefix tags', ({ prefix, normalizedValue, validTags, emptyTags }) => {
    it.each(validTags)(
      'extracts "%s" as a normalized non-empty value',
      (tag) => {
        expect(readTagValue([tag], prefix)).toBe(normalizedValue);
        expect(hasTagWithPrefix([tag], prefix)).toBe(true);
      }
    );

    it.each(emptyTags)('treats "%s" as missing metadata', (tag) => {
      expect(readTagValue([tag], prefix)).toBeUndefined();
      expect(hasTagWithPrefix([tag], prefix)).toBe(true);
    });
  });

  it('keeps correctly formatted tags unchanged', () => {
    expect(readTagValue(['domain:booking'], 'domain')).toBe('booking');
    expect(readTagValue(['layer:domain'], 'layer')).toBe('domain');
  });

  it('ignores leading and trailing raw tag whitespace before prefix matching', () => {
    expect(readTagValue([' domain:booking '], 'domain')).toBe('booking');
    expect(readTagValue([' layer:domain '], 'layer')).toBe('domain');
  });

  it.each(['npm:private', 'npm:public', ' npm:keyword '])(
    'treats "%s" as a default excluded Nx tag',
    (tag) => {
      expect(isDefaultExcludedNxTag(tag)).toBe(true);
    }
  );

  it.each([
    'domain:booking',
    ' layer:application ',
    'scope:payments',
    'type:api',
    'owner:platform',
  ])(
    'does not exclude "%s" from canonical governance tags by default',
    (tag) => {
      expect(isDefaultExcludedNxTag(tag)).toBe(false);
    }
  );

  it('splits canonical governance tags from raw Nx tags while preserving order', () => {
    expect(
      splitNxTags([
        'domain:booking',
        'npm:private',
        ' layer:application ',
        'type:api',
        'scope:customer',
        'owner:platform',
      ])
    ).toEqual({
      governanceTags: [
        'domain:booking',
        ' layer:application ',
        'type:api',
        'scope:customer',
        'owner:platform',
      ],
      rawTags: [
        'domain:booking',
        'npm:private',
        ' layer:application ',
        'type:api',
        'scope:customer',
        'owner:platform',
      ],
    });
  });
});
