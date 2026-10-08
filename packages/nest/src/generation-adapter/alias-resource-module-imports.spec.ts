// SPDX-License-Identifier: MIT
import { aliasResourceModuleImports } from './alias-resource-module-imports';

function repair(before: string, after: string) {
  const original = new Map([['src/users.module.ts', Buffer.from(before)]]);
  const result = new Map([['src/users.module.ts', Buffer.from(after)]]);
  aliasResourceModuleImports(original, result);
  expect(original.get('src/users.module.ts')?.toString()).toBe(before);
  return result.get('src/users.module.ts')?.toString();
}

it('aliases only new registration, retaining native exports and user references', () => {
  const before =
    "import { Module } from '@nestjs/common';\n@Module({}) export class UsersModule {}\nconst userReference = UsersModule;\n";
  const after = before
    .replace(
      '@Module',
      "import { UsersModule } from './users/users.module.js';\n@Module"
    )
    .replace('@Module({})', '@Module({ imports: [UsersModule] })');
  expect(repair(before, after)).toBe(
    after
      .replace('{ UsersModule }', '{ UsersModule as UsersResourceModule }')
      .replace('imports: [UsersModule]', 'imports: [UsersResourceModule]')
  );
});

it('avoids occupied aliases and preserves existing import references', () => {
  const before =
    "import { UsersModule } from './existing.module';\nconst UsersResourceModule = 1;\n@Module({imports: [UsersModule]}) export class DomainModule {}";
  const after =
    "import { UsersModule } from './users/users.module';\n" + before;
  expect(repair(before, after)).toBe(
    after
      .replace(
        "{ UsersModule } from './users",
        "{ UsersModule as UsersResourceModule2 } from './users"
      )
      .replace(
        'imports: [UsersModule]',
        'imports: [UsersModule, UsersResourceModule2]'
      )
  );
});

it('does not change non-colliding native output or existing imports', () => {
  const before = 'export class DomainModule {}';
  const after =
    "import { UsersModule } from './users/users.module.js';\n" + before;
  expect(repair(before, after)).toBe(after);
  const existing =
    "import { UsersModule } from './users/users.module.js';\n@Module({imports: [UsersModule]}) export class DomainModule {}";
  expect(repair(existing, existing + '\n// user comment')).toBe(
    existing + '\n// user comment'
  );
});

it('rejects a colliding registration that cannot be safely identified', () => {
  const before =
    '@Module({imports: SHARED_IMPORTS}) export class UsersModule {}';
  const after =
    "import { UsersModule } from './users/users.module.js';\n" + before;
  expect(() => repair(before, after)).toThrow('Cannot safely alias');
});

it('recognizes existing imports structurally even when native formatting changes whitespace', () => {
  const before =
    "import {ExistingModule} from './existing.module.js';\n@Module({imports:[ExistingModule]}) export class DomainModule {}";
  const after =
    "import { ExistingModule } from './existing.module.js';\nimport { UsersModule } from './users/users.module.js';\n@Module({ imports: [ExistingModule, UsersModule] }) export class DomainModule {}";
  expect(repair(before, after)).toBe(after);
});
