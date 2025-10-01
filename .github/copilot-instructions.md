# Copilot Instructions — anarchitects-plugins (Rails)

## Goal

Provide a **native Nx developer experience** for Rails:

- `nx serve` == `rails server`
- `nx lint` == `rubocop` (or `standardrb`, configurable/inferred)
- `nx test` == `rspec` (if present) else `rails test`
- `nx format` uses `prettier` with `@prettier/plugin-ruby`
- Prefer **Project Crystal** to infer these targets automatically.

## Generators (what to create)

- `packages/rails/src/generators/app` → wraps `rails new` into `apps/<name>`
  - registers Nx project with tags: `framework:rails`, `lang:rb`
  - writes `.prettierrc` with `@prettier/plugin-ruby`
  - writes `.rubocop.yml` (sensible defaults)
  - optional flags: `--api-only`, `--postgres`, `--skip-active-record`, etc.
- Resource generators:
  - `model`, `controller`, `scaffold`, `migration`
  - `devise` → `rails g devise:install`
- Ensure generators add minimal `project.json` only if inference can’t cover it.

## Executors (how to run)

Implement small TS executors that shell out via `bundle exec`:

- **serve**:
  - `bundle exec rails server -p <port> -b <host>`
  - read options from executor schema (`port`, `host`, `env`)
- **lint**:
  - If `rubocop` present → `bundle exec rubocop`
  - Else if `standardrb` present → `bundle exec standardrb`
  - Else fail with helpful message to install one
- **test**:
  - If `rspec` present → `bundle exec rspec`
  - Else `bundle exec rails test`
- **db:migrate** → `bundle exec rails db:migrate`
- **db:seed** → `bundle exec rails db:seed`
- **bundle** → `bundle install`
- **rake** → `bundle exec rake <task>`

Executors should:

- Forward stdio (inherit), exit non-zero on failure.
- Be idempotent (safe to re-run with Nx caching disabled for IO tasks).
- Accept arbitrary extra args when useful (e.g., `nx run api:rake my:task`).

## Inference (Project Crystal)

Create an inference plugin that:

- Recognizes a **Rails project** if:
  - `Gemfile` **and** `bin/rails` **and** `config/application.rb` exist
- Infers targets:
  - `serve` → map to our serve executor
  - `test` → choose rspec vs rails test by inspecting Gemfile.lock
  - `lint` → choose rubocop vs standardrb by inspecting Gemfile.lock
  - `build` → `bundle install`
  - `db:migrate` / `db:seed` → rails db tasks
- Provide sensible default options (e.g., `port: 3000`, `host: localhost`)

## Formatting

- Enforce Prettier with `@prettier/plugin-ruby` in generated apps:
  - Write `.prettierrc` and optionally add npm script `format`.
- Allow `nx format:write` to run across TS + Ruby files (Copilot should include ruby file extensions in Prettier config).

## Examples (what to suggest)

**Serve executor (sketch)**

```ts
import { ExecutorContext, logger } from '@nx/devkit';
import { execa } from 'execa';

export default async function serve(
  options: { port?: number; host?: string; env?: Record<string, string> },
  ctx: ExecutorContext
) {
  const env = { ...process.env, ...options.env };
  const args = [
    'exec',
    'rails',
    'server',
    '-p',
    String(options.port ?? 3000),
    '-b',
    options.host ?? '127.0.0.1',
  ];
  await execa('bundle', args, { stdio: 'inherit', env });
  return { success: true };
}
```

**Lint executor (rubocop/standardrb inference)**

```ts
import { execa } from 'execa';
import { detectRubyTool } from '../utils/detect';

export default async function lint() {
  const tool = await detectRubyTool(['rubocop', 'standardrb']);
  if (!tool) throw new Error('No linter found. Install rubocop or standardrb.');
  await execa('bundle', ['exec', tool], { stdio: 'inherit' });
  return { success: true };
}
```

**Test executor (rspec vs rails test)**

```ts
import { execa } from 'execa';
import { hasGem } from '../utils/gems';

export default async function test() {
  const isRspec = await hasGem('rspec');
  const cmd = isRspec ? ['exec', 'rspec'] : ['exec', 'rails', 'test'];
  await execa('bundle', cmd, { stdio: 'inherit' });
  return { success: true };
}
```

**Inference rule (pseudo)**

```ts
// packages/rails/src/inference.ts
export const railsInference = {
  match: ({ workspaceRoot, projectRoot }) =>
    exists('Gemfile', projectRoot) &&
    exists('bin/rails', projectRoot) &&
    exists('config/application.rb', projectRoot),
  targets: () => ({
    serve: { executor: '@anarchitects/rails:serve' },
    test: { executor: '@anarchitects/rails:test' },
    lint: { executor: '@anarchitects/rails:lint' },
    build: { executor: '@anarchitects/rails:bundle' },
    'db:migrate': { executor: '@anarchitects/rails:db-migrate' },
    'db:seed': { executor: '@anarchitects/rails:db-seed' },
  }),
};
```

## Rules of Thumb

- Prefer inferred targets; only write project.json when absolutely needed.
- Keep executors thin; Rails/Ruby does the heavy lifting.
- Provide helpful errors (“Install rubocop or set linter option”).
- Always add tests for generators/executors.
- Use conventional commits in suggestions.
