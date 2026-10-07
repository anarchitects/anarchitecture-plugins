// SPDX-License-Identifier: MIT
import { additiveTransform } from './additive-transform';

describe('additive Nx post-processing', () => {
  it('adds metadata without changing Nest source or existing configuration values', () => {
    const files = new Map([
      ['src/custom-name.ts', Buffer.from('native bytes\r\n')],
      [
        'package.json',
        Buffer.from('{"type":"module","scripts":{"build":"nest build"}}'),
      ],
    ]);
    const guard = additiveTransform(files);
    guard.createFile('project.json', '{"name":"api"}');
    guard.addJsonProperties('package.json', { nx: { tags: ['nest'] } });
    expect(JSON.parse(files.get('package.json')!.toString())).toEqual({
      type: 'module',
      scripts: { build: 'nest build' },
      nx: { tags: ['nest'] },
    });
    expect(files.get('src/custom-name.ts')!.toString()).toBe(
      'native bytes\r\n'
    );
    const before = Buffer.from(files.get('package.json')!);
    guard.addJsonProperties('package.json', { nx: { tags: ['nest'] } });
    expect(files.get('package.json')).toEqual(before);
  });

  it('rejects source overwrites, metadata replacement, and template configuration edits', () => {
    const files = new Map([
      ['feature/unusual.ts', Buffer.from('native')],
      [
        'package.json',
        Buffer.from('{"type":"module","nx":{"tags":["existing"]}}'),
      ],
    ]);
    const guard = additiveTransform(files);
    expect(() => guard.createFile('feature/unusual.ts', 'patched')).toThrow(
      'cannot overwrite'
    );
    expect(() =>
      guard.addJsonProperties('package.json', { type: 'commonjs' })
    ).toThrow('cannot replace');
    expect(() =>
      guard.addJsonProperties('package.json', { nx: { tags: [] } })
    ).toThrow('cannot replace');
    expect(() =>
      guard.addJsonProperties('tsconfig.json', { compilerOptions: {} })
    ).toThrow('cannot modify');
    expect(() => guard.addJsonProperties('nest-cli.json', {})).toThrow(
      'cannot modify'
    );
    expect(() => guard.createFile('../outside', '')).toThrow(
      'workspace-relative'
    );
    expect(files.get('feature/unusual.ts')!.toString()).toBe('native');
  });
});
