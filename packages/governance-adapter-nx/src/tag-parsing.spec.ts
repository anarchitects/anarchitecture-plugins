import { hasTagWithPrefix, readTagValue } from './tag-parsing.js';

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
});
