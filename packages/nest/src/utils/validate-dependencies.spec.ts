// SPDX-License-Identifier: MIT
import { validateNestDependencies } from './validate-dependencies';
import type {
  InstalledNestPackage,
  ResolveInstalledNestPackage,
} from './installed-nest-package';

describe('Nest dependency validation', () => {
  it.each([
    '12.0.0',
    '^12.0.0',
    '~12.1.0',
    '12.x',
    '>=12 <13',
    '^12.0.0 || ~12.2.0',
  ])('accepts stable v12 range %s', (range) => {
    expect(() =>
      validateNestDependencies({
        'package.json': { devDependencies: { '@nestjs/cli': range } },
      })
    ).not.toThrow();
  });
  it.each([
    '^11',
    '^13',
    '12.0.0-alpha.5',
    '^12.1.0-beta.1',
    '*',
    '>=11 <13',
    '^11 || ^12',
    'latest',
    'next',
    'workspace:*',
    'file:../nest',
    'npm:@nestjs/cli@12.0.0',
    '<0.0.0',
  ])('rejects unsupported or unprovable CLI range %s', (range) => {
    expect(() =>
      validateNestDependencies({
        'package.json': { devDependencies: { '@nestjs/cli': range } },
      })
    ).toThrow('not a stable Nest v12 range');
  });
  it.each([
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ])('validates framework declarations in %s', (section) => {
    expect(() =>
      validateNestDependencies({
        'package.json': { devDependencies: { '@nestjs/cli': '^12' } },
        'libs/shared/package.json': { [section]: { '@nestjs/core': '^11' } },
      })
    ).toThrow('libs/shared/package.json');
  });
  it('does not confuse independently versioned Nest integrations with the framework', () => {
    expect(() =>
      validateNestDependencies({
        'package.json': {
          devDependencies: { '@nestjs/cli': '^12' },
          dependencies: { '@nestjs/swagger': '^11', '@nestjs/typeorm': '^12' },
        },
      })
    ).not.toThrow();
  });
  it('reports conflicting declarations instead of letting one dependency section hide another', () => {
    expect(() =>
      validateNestDependencies({
        'package.json': {
          devDependencies: { '@nestjs/cli': '^12' },
          dependencies: { '@nestjs/cli': '^11' },
        },
      })
    ).toThrow('(dependencies): @nestjs/cli@^11');
  });
  it('does not count a CLI peer declaration as a workspace install', () => {
    expect(() =>
      validateNestDependencies({
        'package.json': { peerDependencies: { '@nestjs/cli': '^12' } },
      })
    ).toThrow('peer-only declaration');
  });
});

describe('published peers and selected Nest hosts', () => {
  const manifests = (peers = '^11 || ^12') => ({
    'package.json': {
      devDependencies: { '@nestjs/cli': '^12' },
      dependencies: { '@nestjs/common': '^12', '@nestjs/core': '^12' },
    },
    'libs/shared/package.json': {
      peerDependencies: { '@nestjs/common': peers, '@nestjs/core': peers },
    },
  });
  const installed = (path: string, name: string): InstalledNestPackage => ({
    version: name === '@nestjs/cli' ? '12.0.0' : '12.1.2',
    path: `${path}/node_modules/${name}/package.json`,
  });

  it.each(['^11 || ^12', '^11.0.0 || ^12.0.0', '>=11 <13', '11.9.0 || 12.1.2'])(
    'accepts bounded peers %s against the actual v12 host',
    (peers) => {
      expect(() =>
        validateNestDependencies(manifests(peers), installed)
      ).not.toThrow();
    }
  );

  it('accepts a publishable root with dual peers and v12 development dependencies', () => {
    expect(() =>
      validateNestDependencies(
        {
          'package.json': {
            ...manifests()['package.json'],
            ...manifests()['libs/shared/package.json'],
          },
        },
        installed
      )
    ).not.toThrow();
  });

  it.each([
    '^11',
    '^13',
    '^10 || ^12',
    '^12 || ^13',
    '*',
    '>=11',
    '',
    '<0.0.0',
    'latest',
    'workspace:*',
    'file:../nest',
    'npm:@nestjs/common@12',
    '^12.0.0-alpha.1 || ^12',
  ])('rejects unsupported library peer range %s', (peers) => {
    expect(() => validateNestDependencies(manifests(peers), installed)).toThrow(
      'libs/shared/package.json (peerDependencies)'
    );
  });

  it('rejects a dual peer that excludes the installed v12 minor', () => {
    expect(() =>
      validateNestDependencies(manifests('^11 || >=12.2 <13'), installed)
    ).toThrow('installed 12.1.2');
  });

  it.each(['10.0.0', '11.1.0', '13.0.0', '12.1.2-beta.1', 'invalid'])(
    'rejects installed framework %s even with supported declarations',
    (version) => {
      const resolve: ResolveInstalledNestPackage = (path, name) => ({
        ...installed(path, name),
        version: name === '@nestjs/cli' ? '12.0.0' : version,
      });
      expect(() => validateNestDependencies(manifests(), resolve)).toThrow(
        `installed ${version}`
      );
    }
  );

  it('rejects a nested install even when root framework and CLI are supported', () => {
    const resolve: ResolveInstalledNestPackage = (path, name) => ({
      ...installed(path, name),
      version: path.startsWith('libs/') ? '11.1.0' : '12.1.2',
    });
    expect(() => validateNestDependencies(manifests(), resolve)).toThrow(
      'libs/shared/package.json (peerDependencies): @nestjs/common@^11 || ^12: installed 11.1.0'
    );
  });

  it.each(['dependencies', 'devDependencies', 'optionalDependencies'] as const)(
    'does not broaden %s host selection',
    (section) => {
      const input = {
        ...manifests(),
        'apps/api/package.json': {
          [section]: { '@nestjs/common': '^11 || ^12' },
        },
      };
      expect(() => validateNestDependencies(input, installed)).toThrow(
        `(${section}): @nestjs/common@^11 || ^12 is not a stable Nest v12 range`
      );
    }
  );

  it('does not let peers hide conflicting host declarations', () => {
    const input = manifests();
    input['package.json'].dependencies['@nestjs/common'] = '^11';
    expect(() => validateNestDependencies(input, installed)).toThrow(
      '(dependencies): @nestjs/common@^11'
    );
  });

  it('requires installed CLI and framework evidence when accepting broader peers', () => {
    expect(() => validateNestDependencies(manifests())).toThrow(
      'no installed package could be resolved'
    );
    expect(() =>
      validateNestDependencies(manifests(), (path, name) =>
        name === '@nestjs/cli' ? undefined : installed(path, name)
      )
    ).toThrow('(devDependencies): @nestjs/cli@^12: no installed package');
  });

  it('keeps CLI peers strict', () => {
    expect(() =>
      validateNestDependencies(
        {
          ...manifests(),
          'tools/package.json': {
            peerDependencies: { '@nestjs/cli': '^11 || ^12' },
          },
        },
        installed
      )
    ).toThrow('@nestjs/cli@^11 || ^12 is not a stable Nest v12 range');
  });

  it('rejects an installed CLI outside stable v12 even when its declaration is supported', () => {
    expect(() =>
      validateNestDependencies(manifests(), (path, name) => ({
        ...installed(path, name),
        version: name === '@nestjs/cli' ? '11.0.0' : '12.1.2',
      }))
    ).toThrow('@nestjs/cli@^12: installed 11.0.0');
  });

  it('rejects an installed host that disagrees with a narrower v12 declaration', () => {
    const input = manifests();
    input['package.json'].dependencies['@nestjs/core'] = '^12.2';
    expect(() => validateNestDependencies(input, installed)).toThrow(
      '@nestjs/core@^12.2: installed 12.1.2'
    );
  });

  it('does not allow a missing optional CLI to stand in for installed tooling', () => {
    const input = {
      ...manifests(),
      'package.json': { optionalDependencies: { '@nestjs/cli': '^12' } },
    };
    expect(() =>
      validateNestDependencies(input, (path, name) =>
        name === '@nestjs/cli' ? undefined : installed(path, name)
      )
    ).toThrow('(optionalDependencies): @nestjs/cli@^12: no installed package');
  });

  it('allows an absent optional framework dependency but validates it when installed', () => {
    const input = {
      ...manifests(),
      'extras/package.json': {
        optionalDependencies: { '@nestjs/websockets': '^12' },
      },
    };
    expect(() =>
      validateNestDependencies(input, (path, name) =>
        name === '@nestjs/websockets' ? undefined : installed(path, name)
      )
    ).not.toThrow();
    expect(() =>
      validateNestDependencies(input, (path, name) => ({
        ...installed(path, name),
        version: name === '@nestjs/websockets' ? '11.0.0' : '12.1.2',
      }))
    ).toThrow(
      '(optionalDependencies): @nestjs/websockets@^12: installed 11.0.0'
    );
  });

  it('preserves declaration-only behavior when no broader peer is present', () => {
    const resolve = jest.fn(() => {
      throw new Error('should not resolve');
    });
    expect(() =>
      validateNestDependencies(manifests('^12'), resolve)
    ).not.toThrow();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('checks installed framework peer requirements instead of assuming same-major parity', () => {
    const resolve: ResolveInstalledNestPackage = (path, name) => ({
      ...installed(path, name),
      ...(name === '@nestjs/core'
        ? { peerDependencies: { '@nestjs/common': '^12.2' } }
        : {}),
    });
    expect(() => validateNestDependencies(manifests(), resolve)).toThrow(
      'requires @nestjs/common@^12.2'
    );
  });

  it('permits absent optional framework integrations but rejects incompatible installed ones', () => {
    const core: Partial<InstalledNestPackage> = {
      peerDependencies: {
        '@nestjs/websockets': '^12',
        '@nestjs/swagger': '^99',
      },
      peerDependenciesMeta: { '@nestjs/websockets': { optional: true } },
    };
    const resolve: ResolveInstalledNestPackage = (path, name) =>
      name === '@nestjs/websockets'
        ? undefined
        : {
            ...installed(path, name),
            ...(name === '@nestjs/core' ? core : {}),
          };
    expect(() => validateNestDependencies(manifests(), resolve)).not.toThrow();
    expect(() =>
      validateNestDependencies(manifests(), (path, name) =>
        name === '@nestjs/websockets'
          ? { ...installed(path, name), version: '11.0.0' }
          : resolve(path, name)
      )
    ).toThrow('requires @nestjs/websockets@^12');
  });

  it('reports resolution failures with the declaring manifest and leaves input intact', () => {
    const input = manifests();
    const before = JSON.stringify(input);
    expect(() =>
      validateNestDependencies(input, () => {
        throw new Error('malformed nearest install');
      })
    ).toThrow(
      'libs/shared/package.json (peerDependencies): @nestjs/common@^11 || ^12: Error: malformed nearest install'
    );
    expect(JSON.stringify(input)).toBe(before);
  });
});
