// SPDX-License-Identifier: MIT
import { createNestStartTarget } from './start-target';

describe('Nest start target', () => {
  it.each(['.', 'apps/api'])(
    'starts a continuous uncached command in %s',
    (root) => {
      expect(createNestStartTarget(root)).toEqual({
        command: 'nest start',
        options: { cwd: root },
        continuous: true,
        cache: false,
        metadata: {
          technologies: ['nest'],
          description: 'Start the Nest project.',
        },
      });
    }
  );

  it('keeps runtime semantics when renamed', () => {
    expect(createNestStartTarget('apps/api', 'serve')).toEqual(
      createNestStartTarget('apps/api')
    );
  });

  it.each(['', '  '])('rejects an empty custom target name %j', (name) => {
    expect(() => createNestStartTarget('.', name)).toThrow(
      'startTargetName must be a non-empty string'
    );
  });
});
