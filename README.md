# Anarchitects Plugins

**Nx plugins for Rails** (more frameworks later).  
Goal: deliver a **native Nx DX** for Rails by mapping Nx targets to Ruby/Rails tools under the hood.

- `nx serve <app>` → `rails server`
- `nx lint <app>` → `rubocop` (or `standardrb`, configurable)
- `nx test <app>` → `rspec` (if present) else `rails test`
- `nx format` → `prettier` with `@prettier/plugin-ruby`

All of this is wired with **Project Crystal** so targets are **inferred** wherever possible.

## Features

### Generators

- `@anarchitects/rails:app` – scaffold a Rails app into `apps/<name>`
  - optional flags: `--api-only`, `--postgres`, `--skip-javascript`, `--skip-active-record`, …
  - sets up Nx project registration, tags, and inference
  - writes `.prettierrc` with `@prettier/plugin-ruby`, sets up `.rubocop.yml` (opinionated defaults, overridable)
- `@anarchitects/rails:model|controller|scaffold|migration` – wraps standard generators
- `@anarchitects/rails:devise` – `devise:install` + wiring

### Executors (native Nx targets)

- **serve** → `bundle exec rails server -p <port> -b <host>` (watch by Rails)
- **lint** → `bundle exec rubocop` (or `standardrb` per config)
- **test** → `bundle exec rspec` (if RSpec present), else `bundle exec rails test`
- **db:migrate** → `bundle exec rails db:migrate`
- **db:seed** → `bundle exec rails db:seed`
- **bundle** → `bundle install`
- **rake** → `bundle exec rake <task>`

### Inference (Project Crystal)

Rails projects are **auto-detected** by:

- Presence of `Gemfile` + `bin/rails` + `config/application.rb`

Inferred targets:

- `serve`, `test`, `lint`, `build`(=bundle), `db:migrate`, `db:seed`
- Test runner inference:
  - `rspec` if Gemfile[lock] contains `rspec`
  - else `rails test` (minitest/ActiveSupport)

Linter inference:

- `rubocop` if Gemfile[lock] contains `rubocop`
- else `standardrb` if present
- else no lint target inferred (until installed)

## Usage

```bash
# Create a Rails app
nx g @anarchitects/rails:app api --api-only --postgres

# Run the server
nx serve api --port=4001 --host=0.0.0.0

# Lint with rubocop
nx lint api

# Test (uses rspec if installed)
nx test api

# Migrate DB
nx run api:db:migrate

# Run any rake task
nx run api:rake db:schema:dump
```

## Configurability

- Linter: set "rails.linter": "rubocop" | "standardrb" in plugin options or your project.json.
- Test framework: auto-detected; override via project options "testRunner": "rspec" | "rails".
- Env: pass-through with --env or standard ENV variables.

## Formatting (Prettier)

We use Prettier with @prettier/plugin-ruby:

```json
// .prettierrc
{
  "plugins": ["@prettier/plugin-ruby"]
}
```

Run:

```bash
nx format:write
```

## Development

```bash
yarn install
yarn nx build rails
yarn nx test rails
```

Try locally:

```bash
nx g @anarchitects/rails:app demo-api
nx serve demo-api
nx lint demo-api
nx test demo-api
```

## Roadmap

- Inferred lint via rubocop or standardrb
- Inferred test via RSpec/Minitest detection
- Devise, Sidekiq, RBS support, RuboCop config generator
- Multi-app workspaces (apps/\*) with shared gems via bundler groups

## License

MIT © Anarchitects
